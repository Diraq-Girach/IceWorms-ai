"""Minimal client for any OpenAI-compatible chat-completions API.

Deliberately tiny (plain httpx, no vendor SDK) so the provider is just configuration:
Groq, Gemini, OpenAI, OpenRouter and local Ollama all speak this protocol.
"""
import json
import logging
import re

import httpx

from ..config import llm_settings

log = logging.getLogger("iceworms.llm")


class LLMError(RuntimeError):
    """Any failure talking to the model. `user_message` is safe to show in the UI."""

    def __init__(self, user_message: str, detail: str = ""):
        super().__init__(f"{user_message} {detail}".strip())
        self.user_message = user_message


def llm_enabled() -> bool:
    s = llm_settings()
    return bool(s["api_key"] and s["model"])


def model_name() -> str | None:
    return llm_settings()["model"] or None


# Overridable in tests (an httpx.MockTransport stands in for the provider)
_transport: httpx.BaseTransport | None = None


def _post(payload: dict) -> httpx.Response:
    s = llm_settings()
    with httpx.Client(timeout=s["timeout"], transport=_transport) as client:
        return client.post(
            f"{s['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {s['api_key']}"},
            json={"model": s["model"], **payload},
        )


# Optional request fields some providers reject; dropped (and retried) on a 400/422.
_OPTIONAL_FIELDS = ("response_format", "reasoning_effort", "max_completion_tokens")


def _send(payload: dict) -> httpx.Response:
    """POST; if the provider rejects an optional field (HTTP 400/422), retry once without it."""
    try:
        r = _post(payload)
        optional = [k for k in _OPTIONAL_FIELDS if k in payload]
        if r.status_code in (400, 422) and optional:
            body = r.text
            if "json_validate_failed" in body:
                # Not an unsupported field: the model's output wasn't valid JSON (e.g. cut off at the
                # output limit). Retrying the same request would just fail again and use up quota.
                log.warning("Provider rejected the model's JSON output: %s", body[:300])
                raise LLMError(
                    "The AI didn't finish writing valid notes. Please try again "
                    "(raising LLM_MAX_TOKENS helps for long meetings).",
                    body[:300],
                )
            # Drop only the field(s) the error mentions; if it names none, drop all optional ones
            named = [k for k in optional if k in body]
            drop = named or optional
            log.warning("Provider rejected the request (HTTP %s); retrying without %s. %s",
                        r.status_code, ", ".join(drop), body[:200])
            for k in drop:
                payload.pop(k)
            r = _post(payload)
    except httpx.TimeoutException as e:
        raise LLMError("The AI took too long to respond. Please try again.", str(e)) from e
    except httpx.HTTPError as e:
        raise LLMError("Couldn't reach the AI provider.", str(e)) from e

    if r.status_code == 429:
        raise LLMError("AI rate limit reached. Please wait a minute and try again.")
    if r.status_code in (401, 403):
        raise LLMError("The AI provider rejected the API key. Check LLM_API_KEY.")
    if r.status_code >= 400:
        raise LLMError("The AI provider returned an error.", f"HTTP {r.status_code}: {r.text[:300]}")
    return r


def _complete(messages: list[dict], *, json_mode: bool, temperature: float) -> str:
    if not llm_enabled():
        raise LLMError("AI is not configured on the server.")
    payload: dict = {"messages": messages, "temperature": temperature}
    if json_mode:
        # the prompt also asks for JSON, and parse_json() copes with extra text, so this is optional
        payload["response_format"] = {"type": "json_object"}
    settings = llm_settings()
    if effort := settings["reasoning_effort"]:
        # reasoning models (e.g. gpt-oss) think before answering; less thinking = faster, and it
        # leaves more of the output budget for the actual answer
        payload["reasoning_effort"] = effort
    if settings["max_tokens"]:
        # Output budget (reasoning + answer). Without it the provider's default applies, which can be
        # too small for full meeting notes (Groq stopped gpt-oss at 2048 tokens mid-answer).
        payload["max_completion_tokens"] = settings["max_tokens"]

    for attempt in (1, 2):
        r = _send(payload)
        try:
            data = r.json()
            choice = data["choices"][0]
            content = choice["message"].get("content")
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as e:
            raise LLMError("Unexpected response from the AI provider.", r.text[:300]) from e
        if content and content.strip():
            return content

        # Empty answer: log what the provider told us so the cause is visible
        finish = choice.get("finish_reason")
        log.warning(
            "AI returned an empty answer (attempt %d): finish_reason=%s, usage=%s, had_reasoning=%s",
            attempt, finish, data.get("usage"), bool(choice["message"].get("reasoning")),
        )
        if finish == "length":
            break  # it hit the output limit: an identical retry would hit it again and waste quota
    if finish == "length":
        raise LLMError(
            "The AI ran out of room before finishing its answer. Raise LLM_MAX_TOKENS or set LLM_REASONING_EFFORT=low.",
            f"finish_reason={finish}",
        )
    raise LLMError("The AI returned an empty response. Please try again.", f"finish_reason={finish}")


def parse_json(text: str) -> dict:
    """Extract a JSON object from a model reply (tolerates ```json fences and chatter around it)."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise LLMError("The AI response wasn't valid JSON.", text[:200])
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError as e:
            raise LLMError("The AI response wasn't valid JSON.", text[:200]) from e
    if not isinstance(data, dict):
        raise LLMError("The AI response had the wrong shape.", text[:200])
    return data


def chat_json(messages: list[dict], temperature: float = 0.2) -> dict:
    return parse_json(_complete(messages, json_mode=True, temperature=temperature))


def chat_text(messages: list[dict], temperature: float = 0.3) -> str:
    return _complete(messages, json_mode=False, temperature=temperature).strip()
