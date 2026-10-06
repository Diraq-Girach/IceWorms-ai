"use client";

import { ChevronUp } from "lucide-react";
import { useState } from "react";

import { PersonAvatar } from "@/components/common/person-avatar";
import { CATEGORY_COLORS, CATEGORY_LABELS, SENTIMENT_COLORS } from "@/lib/constants";
import type { Analytics } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TranscriptFilter =
  | { kind: "category"; value: string; label: string }
  | { kind: "sentiment"; value: string; label: string }
  | { kind: "speaker"; value: number; label: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b px-4 py-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
        <ChevronUp className={cn("size-3.5 transition-transform", !open && "rotate-180")} />
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

/** Small ring showing a percentage (speaker talktime). */
function Ring({ pct }: { pct: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90">
      <circle cx="9" cy="9" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
      <circle cx="9" cy="9" r={r} fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-primary" strokeDasharray={`${(pct / 100) * c} ${c}`} />
    </svg>
  );
}

/**
 * Fireflies "Smart Search": AI filters, sentiment mix and speaker talktime.
 * Every row is clickable and filters the transcript to matching lines.
 */
export function SmartSearch({
  analytics,
  filter,
  onFilter,
}: {
  analytics: Analytics;
  filter: TranscriptFilter | null;
  onFilter: (f: TranscriptFilter | null) => void;
}) {
  const isOn = (kind: TranscriptFilter["kind"], value: string | number) => filter?.kind === kind && filter.value === value;
  const pick = (f: TranscriptFilter) => onFilter(isOn(f.kind, f.value) ? null : f);

  return (
    <div className="text-[13px]">
      <Section title="AI Filters">
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(analytics.categories).map(([key, count]) => (
            <button
              key={key}
              disabled={!count}
              onClick={() => pick({ kind: "category", value: key, label: CATEGORY_LABELS[key] })}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-40",
                isOn("category", key) && "bg-primary/10 ring-1 ring-primary/40",
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: CATEGORY_COLORS[key] }} />
              <span className="flex-1">{CATEGORY_LABELS[key]}</span>
              <span className="text-muted-foreground tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sentiments">
        <div className="space-y-1">
          {Object.entries(analytics.sentiments).map(([key, pct]) => (
            <button
              key={key}
              disabled={!pct}
              onClick={() => pick({ kind: "sentiment", value: key, label: `${key[0].toUpperCase()}${key.slice(1)}` })}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 capitalize transition-colors hover:bg-muted disabled:opacity-40",
                isOn("sentiment", key) && "bg-primary/10 ring-1 ring-primary/40",
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: SENTIMENT_COLORS[key] }} />
              <span className="flex-1 text-left">{key}</span>
              <span className="text-muted-foreground tabular-nums">{pct}%</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Speaker Talktime">
        <div className="mb-1.5 grid grid-cols-[1fr_52px_74px] px-2.5 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
          <span>Speakers</span>
          <span>WPM</span>
          <span className="text-right">Talktime</span>
        </div>
        <div className="space-y-1">
          {analytics.speakers.map((s) => (
            <button
              key={s.speaker.id}
              onClick={() => pick({ kind: "speaker", value: s.speaker.id, label: s.speaker.name })}
              className={cn(
                "grid w-full grid-cols-[1fr_52px_74px] items-center rounded-lg bg-muted/60 px-2.5 py-2 text-left transition-colors hover:bg-muted",
                isOn("speaker", s.speaker.id) && "bg-primary/10 ring-1 ring-primary/40",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <PersonAvatar name={s.speaker.name} color={s.speaker.avatar_color} size="sm" />
                <span className="truncate">{s.speaker.name}</span>
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <span className="size-1 rounded-full bg-pink-500" />
                {s.wpm}
              </span>
              <span className="flex items-center justify-end gap-1.5 tabular-nums">
                <Ring pct={s.talktime_pct} /> {s.talktime_pct}%
              </span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
