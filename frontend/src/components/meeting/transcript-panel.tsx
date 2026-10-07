"use client";

import { Bot, ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/common/coming-soon";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Button } from "@/components/ui/button";
import { formatClock, splitMatches } from "@/lib/format";
import type { Analytics, Segment } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AskPanel } from "./ask-panel";
import { SmartSearch, type TranscriptFilter } from "./smart-search";

/** One utterance. Memoised: only re-renders when it becomes (in)active or the search changes. */
const SegmentRow = memo(function SegmentRow({
  seg,
  active,
  query,
  currentMatch,
  onSeek,
}: {
  seg: Segment;
  active: boolean;
  query: string;
  currentMatch: boolean;
  onSeek: (t: number) => void;
}) {
  return (
    <div
      data-seg={seg.id}
      onClick={() => onSeek(seg.start_sec)}
      className={cn("group cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60", active && "bg-primary/[0.04]")}
    >
      <div className="mb-1 flex items-center gap-2 text-[13px]">
        {seg.speaker && <PersonAvatar name={seg.speaker.name} color={seg.speaker.avatar_color} size="xs" />}
        <span className="truncate font-medium">{seg.speaker?.name ?? "Unknown"}</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-medium text-timestamp tabular-nums group-hover:underline">{formatClock(seg.start_sec)}</span>
      </div>
      <p className={cn("text-[14px] leading-relaxed", active ? "text-transcript-active" : "text-foreground/90")}>
        {splitMatches(seg.text, query).map((part, i) =>
          part.match ? (
            <mark key={i} className="transcript-match" data-current={currentMatch}>
              {part.text}
            </mark>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </p>
    </div>
  );
});

function matchesFilter(s: Segment, f: TranscriptFilter | null) {
  if (!f) return true;
  if (f.kind === "category") return s.category === f.value;
  if (f.kind === "sentiment") return s.sentiment === f.value;
  return s.speaker?.id === f.value;
}

/**
 * Right-hand transcript panel.
 * - click a line → player seeks there; the playing line is highlighted (pink) and auto-scrolled into view
 * - "Find" highlights matches with ↑/↓ navigation
 * - Smart Search filters lines by AI category, sentiment or speaker
 */
export function TranscriptPanel({
  meetingId,
  segments,
  analytics,
  activeId,
  aiEnabled,
  onSeek,
}: {
  meetingId: number;
  segments: Segment[];
  analytics: Analytics | null;
  activeId: number | null;
  aiEnabled: boolean | null;
  onSeek: (t: number) => void;
}) {
  const [tab, setTab] = useState<"transcript" | "ask">("transcript");
  const [query, setQuery] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  const [showSmart, setShowSmart] = useState(false);
  const [filter, setFilter] = useState<TranscriptFilter | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledAt = useRef(0);

  const visible = useMemo(() => segments.filter((s) => matchesFilter(s, filter)), [segments, filter]);
  const q = query.trim();
  const matches = useMemo(
    () => (q ? visible.filter((s) => s.text.toLowerCase().includes(q.toLowerCase())).map((s) => s.id) : []),
    [visible, q],
  );
  const currentMatchId = matches.length ? matches[Math.min(matchIdx, matches.length - 1)] : null;

  function scrollToSeg(id: number, smooth = true) {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-seg="${id}"]`);
    if (!list || !el) return;
    list.scrollTo({ top: el.offsetTop - list.clientHeight / 3, behavior: smooth ? "smooth" : "auto" });
  }

  // Follow playback, unless the user scrolled in the last 4s or is searching
  useEffect(() => {
    if (activeId == null || q || Date.now() - userScrolledAt.current < 4000) return;
    scrollToSeg(activeId);
  }, [activeId, q]);

  // Jump to the current search match
  useEffect(() => {
    if (currentMatchId != null) scrollToSeg(currentMatchId);
  }, [currentMatchId]);

  const step = (d: number) => matches.length && setMatchIdx((i) => (i + d + matches.length) % matches.length);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-5 border-b px-4 text-sm">
        {(
          [
            ["transcript", "Transcript"],
            ["ask", "Ask AI"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "-mb-px flex h-full items-center gap-1.5 border-b-2 font-medium transition-colors",
              tab === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "ask" && <Bot className="size-4 text-primary" />} {label}
          </button>
        ))}
      </div>

      {/* The chat stays mounted (just hidden) so switching tabs doesn't lose the conversation */}
      <div className={cn("min-h-0 flex-1", tab !== "ask" && "hidden")}>
        <AskPanel meetingId={meetingId} aiEnabled={aiEnabled} hasTranscript={segments.length > 0} onSeek={onSeek} />
      </div>
      {tab === "transcript" && (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <label className="flex h-8 flex-1 items-center gap-2 rounded-md border px-2.5 text-sm focus-within:border-primary/50">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setMatchIdx(0);
                }}
                onKeyDown={(e) => e.key === "Enter" && step(e.shiftKey ? -1 : 1)}
                placeholder="Find in transcript"
                className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
              {q && (
                <>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {matches.length ? `${Math.min(matchIdx, matches.length - 1) + 1}/${matches.length}` : "0/0"}
                  </span>
                  <button onClick={() => step(-1)} aria-label="Previous match" className="text-muted-foreground hover:text-foreground">
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button onClick={() => step(1)} aria-label="Next match" className="text-muted-foreground hover:text-foreground">
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </>
              )}
            </label>
            <Button
              variant={showSmart ? "secondary" : "outline"}
              size="icon"
              className="size-8"
              onClick={() => setShowSmart((s) => !s)}
              aria-label="Smart Search"
              title="Smart Search"
              disabled={!analytics}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>

          {filter && (
            <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs">
              Showing {visible.length} line{visible.length === 1 ? "" : "s"}:
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {filter.label}
                <button onClick={() => setFilter(null)} aria-label="Clear filter">
                  <X className="size-3" />
                </button>
              </span>
            </div>
          )}

          <div
            ref={listRef}
            onWheel={() => (userScrolledAt.current = Date.now())}
            onTouchMove={() => (userScrolledAt.current = Date.now())}
            className="relative min-h-0 flex-1 overflow-y-auto"
          >
            {showSmart && analytics && (
              <div className="border-b bg-background">
                <p className="px-4 pt-3 text-sm font-semibold">Smart Search</p>
                <SmartSearch analytics={analytics} filter={filter} onFilter={setFilter} />
              </div>
            )}
            <div className="space-y-0.5 p-2">
              {visible.length ? (
                visible.map((s) => (
                  <SegmentRow
                    key={s.id}
                    seg={s}
                    active={s.id === activeId}
                    query={q}
                    currentMatch={s.id === currentMatchId}
                    onSeek={onSeek}
                  />
                ))
              ) : (
                <EmptyState icon={Search} title={segments.length ? "No lines match this filter" : "No transcript for this meeting"}>
                  {!segments.length && "This meeting was created without a transcript."}
                </EmptyState>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
