"use client";

import { ArrowRight, Bot } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Floating "Ask anything from your meetings…" bar (Fireflies' AskFred).
 * Placeholder: shows the question, a brief "Understanding…" state, then "coming soon".
 */
export function AskBar() {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setAsked(q.trim());
    setQ("");
    setThinking(true);
    setTimeout(() => setThinking(false), 1400);
  }

  return (
    <>
      <form
        onSubmit={submit}
        className="fixed bottom-5 left-1/2 z-30 flex w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-xl border bg-background/95 py-1.5 pr-1.5 pl-3 shadow-lg backdrop-blur"
      >
        <Bot className="size-5 shrink-0 text-primary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything from your meetings…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!q.trim()}
          className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          aria-label="Ask"
        >
          <ArrowRight className="size-4" />
        </button>
      </form>

      <Dialog open={asked !== null} onOpenChange={(o) => !o && setAsked(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ask AI</DialogTitle>
            <DialogDescription>Chat with all of your meetings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="ml-auto w-fit max-w-[85%] rounded-xl bg-muted px-3.5 py-2">{asked}</div>
            <div className="flex items-start gap-2.5">
              <Bot className="mt-0.5 size-5 shrink-0 text-primary" />
              {thinking ? (
                <span className="animate-pulse text-muted-foreground">Understanding…</span>
              ) : (
                <p className="text-muted-foreground">
                  AI answers across your meetings are <span className="font-medium text-foreground">coming soon</span>. For
                  now, use the search bar at the top to find meetings and transcript lines by keyword.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
