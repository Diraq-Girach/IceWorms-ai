"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ParticipantInput } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Returns an error message, or null if `p` can be added to `list`. */
function validate(p: ParticipantInput, list: ParticipantInput[]): string | null {
  if (!p.name.trim()) return "Enter a name";
  if (p.email && !EMAIL_RE.test(p.email)) return "That email doesn't look valid";
  if (p.email && list.some((x) => sameEmail(x.email, p.email))) return "Someone with that email is already added";
  if (!p.email && list.some((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase() && !x.email))
    return "That person is already added";
  return null;
}

/** Every email is empty or well-formed, and emails are unique. */
function listValid(list: ParticipantInput[]): boolean {
  return list.every((p, i) => !p.email || (EMAIL_RE.test(p.email) && !list.some((x, j) => j !== i && sameEmail(x.email, p.email))));
}

/**
 * State for a participants field, owned by the dialog that renders <ParticipantsInput>.
 * `collect()` returns the list to save INCLUDING a person typed into Name/Email but not
 * yet added (so clicking Save without pressing Add doesn't silently drop them),
 * or null if that pending entry is invalid (the error is shown under the field).
 */
export function useParticipantsField(initial: ParticipantInput[] = []) {
  const [people, setPeople] = useState(initial);
  const [draft, setDraft] = useState({ name: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  const pending = (): ParticipantInput => ({ name: draft.name.trim(), email: draft.email.trim() || null });

  function add() {
    const p = pending();
    const err = validate(p, people);
    setError(err);
    if (err) return;
    setPeople([...people, p]);
    setDraft({ name: "", email: "" });
  }

  function collect(): ParticipantInput[] | null {
    if (!draft.name.trim() && !draft.email.trim()) return people;
    const p = pending();
    const err = validate(p, people);
    if (err) {
      setError(err);
      return null;
    }
    return [...people, p];
  }

  // stable identity, so callers can use it inside memoized callbacks
  const reset = useCallback((list: ParticipantInput[] = []) => {
    setPeople(list);
    setDraft({ name: "", email: "" });
    setError(null);
  }, []);

  return { people, setPeople, draft, setDraft, error, setError, add, collect, reset, valid: listValid(people) };
}

export type ParticipantsField = ReturnType<typeof useParticipantsField>;

/**
 * Editor for a meeting's participants: one row per person with an editable email
 * (so people found in a transcript can be given an email later), plus Name/Email
 * fields and an Add button for new people. Email is optional.
 */
export function ParticipantsInput({ field }: { field: ParticipantsField }) {
  const { people, setPeople, draft, setDraft, error, setError, add } = field;

  function updateEmail(target: ParticipantInput, next: string) {
    setPeople(people.map((p) => (p === target ? { ...p, email: next.trim() || null } : p)));
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault(); // don't submit the surrounding dialog
      add();
    }
  };

  return (
    <div className="space-y-2">
      {people.length > 0 && (
        <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
          {people.map((p, i) => {
            const bad = !!p.email && (!EMAIL_RE.test(p.email) || people.some((x) => x !== p && sameEmail(x.email, p.email)));
            return (
              <li key={i} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="w-36 shrink-0 truncate text-sm font-medium" title={p.name}>
                  {p.name}
                </span>
                <input
                  value={p.email ?? ""}
                  onChange={(e) => updateEmail(p, e.target.value)}
                  placeholder="Add email (optional)"
                  aria-label={`Email for ${p.name}`}
                  aria-invalid={bad}
                  className="min-w-0 flex-1 rounded bg-transparent px-1.5 py-1 text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-muted/60 focus:text-foreground aria-[invalid=true]:text-destructive"
                />
                <button
                  type="button"
                  onClick={() => setPeople(people.filter((x) => x !== p))}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${p.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={draft.name}
          onChange={(e) => {
            setDraft({ ...draft, name: e.target.value });
            setError(null);
          }}
          onKeyDown={onEnter}
          placeholder="Name"
          aria-label="Participant name"
          className="flex-1"
        />
        <Input
          value={draft.email}
          onChange={(e) => {
            setDraft({ ...draft, email: e.target.value });
            setError(null);
          }}
          onKeyDown={onEnter}
          placeholder="Email (optional)"
          aria-label="Participant email"
          type="email"
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.name.trim()}>
          <Plus /> Add
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** <input type="datetime-local"> helpers (local time, minute precision). */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}
