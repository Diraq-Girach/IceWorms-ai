"use client";

import { Copy, Loader2, Sparkles } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { MeetingDetail } from "@/lib/types";

import { Timestamp } from "./timestamp";

export function SectionHeading({ id, icon, title, action }: { id: string; icon?: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div id={id} className="mb-3 flex scroll-mt-16 items-center gap-2">
      {icon}
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <div className="ml-auto">{action}</div>
    </div>
  );
}

/** "General Summary": keywords + emoji overview bullets. */
export const SummarySection = memo(function SummarySection({
  meeting,
  canRegenerate,
  regenerating,
  onRegenerate,
}: {
  meeting: MeetingDetail;
  canRegenerate: boolean;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  const s = meeting.summary;

  function copy() {
    if (!s) return;
    const text = s.overview.map((b) => `• ${b.title}: ${b.text}`).join("\n");
    navigator.clipboard.writeText(text).then(() => toast.success("Summary copied"));
  }

  return (
    <section>
      <SectionHeading
        id="summary"
        icon={<Sparkles className="size-4 text-primary" />}
        title="General Summary"
        action={
          <div className="flex items-center gap-1">
            {s?.generated_by === "ai" && (
              <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Sparkles className="size-3" /> AI-generated
              </span>
            )}
            {s?.generated_by === "heuristic" && (
              <span className="mr-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title="Built with simple rules, without a language model">
                Basic notes
              </span>
            )}
            {canRegenerate && (
              <Button variant="ghost" size="sm" className="h-7 text-primary" onClick={onRegenerate} disabled={regenerating}>
                {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {regenerating ? "Generating…" : s?.generated_by === "ai" ? "Regenerate" : "Generate with AI"}
              </Button>
            )}
            {s && (
              <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={copy}>
                <Copy className="size-3.5" /> Copy
              </Button>
            )}
          </div>
        }
      />
      {!s ? (
        <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          No summary yet. Summaries are generated when a meeting has a transcript.
        </p>
      ) : (
        <>
          {s.keywords.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Keywords</span>
              {s.keywords.map((k) => (
                <span key={k} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {k}
                </span>
              ))}
            </div>
          )}
          <ul className="space-y-2.5">
            {s.overview.map((b) => (
              <li key={b.title} className="flex gap-2.5 text-[14px] leading-relaxed">
                <span className="shrink-0">{b.emoji}</span>
                <span>
                  <span className="font-semibold">{b.title}:</span> <span className="text-foreground/80">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
});

/** "Notes": chapter title + paragraph + timestamped bullets (each timestamp seeks). */
export const NotesSection = memo(function NotesSection({ meeting, onSeek }: { meeting: MeetingDetail; onSeek: (t: number) => void }) {
  if (!meeting.notes.length) return null;
  return (
    <section>
      <SectionHeading id="notes" title="Notes" />
      <div className="space-y-6">
        {meeting.notes.map((n) => (
          <div key={n.id}>
            <h3 className="mb-1 text-[14px] font-semibold">{n.title}</h3>
            <p className="text-[14px] leading-relaxed text-foreground/80">
              {n.summary} <Timestamp sec={n.start_sec} onSeek={onSeek} />
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-foreground/80 marker:text-muted-foreground">
              {n.bullets.map((b) => (
                <li key={b.id}>
                  {b.text} <Timestamp sec={b.start_sec} onSeek={onSeek} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
});
