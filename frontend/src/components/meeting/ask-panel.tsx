"use client";

import { ArrowUp, Bot, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/common/coming-soon";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ChatTurn } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Timestamp } from "./timestamp";

const SUGGESTIONS = [
  "What were the key decisions?",
  "List the action items and who owns them",
  "Were there any risks or open questions?",
  "Summarize this meeting in 3 bullets",
];

interface Message extends ChatTurn {
  error?: boolean;
}

const IS_CITATION = /^\[\d{1,2}:\d{2}(?::\d{2})?\]$/;

function toSeconds(ts: string) {
  return ts.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

/** Inline text: **bold** and clickable [mm:ss] citations. */
function Inline({ text, onSeek }: { text: string; onSeek: (t: number) => void }) {
  const parts = text.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\]|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (IS_CITATION.test(p)) {
          return <Timestamp key={i} sec={toSeconds(p.slice(1, -1))} onSeek={onSeek} parens={false} className="mx-0.5 rounded bg-primary/10 px-1 text-xs" />;
        }
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Model answers are plain text with "- " bullets; render bullets as a list. */
function Answer({ text, onSeek }: { text: string; onSeek: (t: number) => void }) {
  const blocks: { bullets: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*•]\s+/.test(line);
    const content = line.replace(/^[-*•]\s+/, "").replace(/^#+\s*/, "");
    const last = blocks[blocks.length - 1];
    if (last && last.bullets === bullet && bullet) last.lines.push(content);
    else blocks.push({ bullets: bullet, lines: [content] });
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        b.bullets ? (
          <ul key={i} className="list-disc space-y-1 pl-4 marker:text-muted-foreground">
            {b.lines.map((l, j) => (
              <li key={j}>
                <Inline text={l} onSeek={onSeek} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Inline text={b.lines[0]} onSeek={onSeek} />
          </p>
        ),
      )}
    </div>
  );
}

/**
 * "Ask AI" about this meeting. The server sends the whole transcript to the model
 * (one meeting fits in context, so no RAG); answers cite [mm:ss] moments, which are
 * clickable here and seek the player. Earlier turns are sent along for follow-ups.
 */
export function AskPanel({
  meetingId,
  aiEnabled,
  hasTranscript,
  onSeek,
}: {
  meetingId: number;
  aiEnabled: boolean | null;
  hasTranscript: boolean;
  onSeek: (t: number) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Block body on purpose: newer browsers make scrollIntoView return a Promise, and an effect
  // must return nothing (or a cleanup function), so it can't be a one-line arrow.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: q }]);
    setDraft("");
    setBusy(true);
    try {
      const res = await api.ask(meetingId, q, history);
      setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      // drop the unanswered question from history so a retry doesn't send it twice
      setMessages((m) => [...m.slice(0, -1), { role: "user", content: q, error: true }, { role: "assistant", content: msg, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  if (aiEnabled === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!aiEnabled) {
    return (
      <EmptyState icon={Bot} title="Ask AI isn't set up">
        The server has no AI model configured. Add an <code>LLM_API_KEY</code> to the backend to ask questions about this meeting.
      </EmptyState>
    );
  }
  if (!hasTranscript) {
    return <EmptyState icon={Bot} title="No transcript to ask about">This meeting was created without a transcript.</EmptyState>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-[14px] leading-relaxed">
        {messages.length === 0 ? (
          <div className="pt-6 text-center">
            <Sparkles className="mx-auto mb-2 size-6 text-primary" />
            <p className="font-medium">Ask anything about this meeting</p>
            <p className="mt-1 text-xs text-muted-foreground">Answers cite the moments they come from. Click a time to jump there.</p>
            <div className="mt-5 flex flex-col items-stretch gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border px-3 py-2 text-left text-[13px] transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className={cn("ml-auto w-fit max-w-[85%] rounded-xl bg-muted px-3.5 py-2", m.error && "opacity-60")}>
                {m.content}
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2.5">
                <Bot className={cn("mt-0.5 size-5 shrink-0", m.error ? "text-destructive" : "text-primary")} />
                <div className={cn("min-w-0 flex-1", m.error && "text-destructive")}>
                  {m.error ? <p>{m.content}</p> : <Answer text={m.content} onSeek={onSeek} />}
                </div>
              </div>
            ),
          )
        )}
        {busy && (
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Bot className="size-5 text-primary" />
            <span className="animate-pulse">Reading the transcript…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex shrink-0 items-center gap-2 border-t p-3"
      >
        {messages.length > 0 && (
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setMessages([])} disabled={busy} aria-label="New chat" title="New chat">
            <RotateCcw className="size-4" />
          </Button>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about this meeting…"
          maxLength={1000}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
          aria-label="Ask a question about this meeting"
        />
        <Button type="submit" size="icon" className="size-9 shrink-0" disabled={busy || !draft.trim()} aria-label="Send">
          {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>
    </div>
  );
}
