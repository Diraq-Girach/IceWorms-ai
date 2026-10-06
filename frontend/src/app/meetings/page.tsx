"use client";

import { CalendarDays, Hash, Inbox, Plus, Search, Share2, SlidersHorizontal, Video, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/coming-soon";
import { MeetingRow, MeetingRowSkeleton } from "@/components/meetings/meeting-row";
import { useNewMeeting } from "@/components/meetings/new-meeting-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { groupByDay } from "@/lib/format";
import type { MeetingListParams } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type View = "mine" | "all" | "shared";

export default function MeetingsPage() {
  // useSearchParams needs a Suspense boundary in Next 16 (see docs: use-search-params)
  return (
    <Suspense>
      <MeetingsLibrary />
    </Suspense>
  );
}

function MeetingsLibrary() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { open: openNewMeeting } = useNewMeeting();

  // URL is the source of truth for filters, so the top-bar search can deep-link here
  const view = (params.get("view") as View) ?? "all";
  const q = params.get("q") ?? "";
  const scope = (params.get("scope") as "title" | "all") ?? "title";
  const participant = params.get("participant") ?? "any";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const sort = (params.get("sort") as MeetingListParams["sort"]) ?? "newest";

  function setParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v === null || v === "" ? next.delete(k) : next.set(k, v)));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  // debounce typing into the search box before touching the URL
  const [draft, setDraft] = useState(q);
  // if the URL query changes from outside (e.g. the top-bar search), reset the box during render
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setDraft(q);
  }
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => setParams({ q: draft }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const { data: people } = useApi(api.participants, "participants");
  const { data: me } = useApi(api.me, "me");
  const myParticipantId = people?.find((p) => p.email === me?.email)?.id;

  const query: MeetingListParams = {
    q: q || undefined,
    scope,
    sort,
    participant_id: view === "mine" ? myParticipantId : participant !== "any" ? Number(participant) : undefined,
    date_from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    date_to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    limit: 200,
  };
  const ready = view !== "mine" || myParticipantId !== undefined;
  const { data, loading, error, reload } = useApi(
    () => (ready ? api.listMeetings(query) : Promise.resolve({ items: [], total: 0 })),
    JSON.stringify({ query, ready }),
  );

  useEffect(() => {
    if (error) toast.error("Couldn't load meetings", { description: error });
  }, [error]);

  const groups = useMemo(() => (sort === "longest" ? null : groupByDay(data?.items ?? [])), [data, sort]);
  const activeFilters = Number(participant !== "any") + Number(!!from || !!to);

  return (
    <div className="flex h-full">
      {/* secondary sidebar: views + channels (channels are a placeholder) */}
      <aside className="hidden w-[220px] shrink-0 border-r px-3 py-4 lg:block">
        {(
          [
            ["mine", "My Meetings", Hash],
            ["all", "All Meetings", Video],
            ["shared", "Shared With Me", Share2],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            onClick={() => setParams({ view: v === "all" ? null : v })}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors",
              view === v ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "hover:bg-muted",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
        <p className="mt-6 mb-2 px-2.5 text-xs font-medium text-muted-foreground">All channels</p>
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <Hash className="mb-2 size-5 text-pink-500" />
          <p className="text-[13px] text-muted-foreground">Create channels to organize your conversations</p>
          <Button variant="outline" size="sm" className="mt-3 h-8" onClick={() => toast.info("Channels are coming soon")}>
            <Plus className="size-3.5" /> Channel
          </Button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-6 pt-4 pb-28">
        {/* filter bar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3 text-sm focus-within:border-primary/50 sm:max-w-sm">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={scope === "all" ? "Search titles and transcripts" : "Search by title"}
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {draft && (
              <button onClick={() => setDraft("")} aria-label="Clear search">
                <X className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </label>
          <Button
            variant={scope === "all" ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setParams({ scope: scope === "all" ? null : "all" })}
            title="Also search inside transcripts"
          >
            {scope === "all" ? "Titles + transcripts" : "Titles only"}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <SlidersHorizontal className="size-4" /> Filters
                {activeFilters > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{activeFilters}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-4">
              <div className="space-y-1.5">
                <Label>Participant</Label>
                <Select value={participant} onValueChange={(v) => setParams({ participant: v === "any" ? null : v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Anyone</SelectItem>
                    {people?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="f-from">From</Label>
                  <Input id="f-from" type="date" value={from} onChange={(e) => setParams({ from: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-to">To</Label>
                  <Input id="f-to" type="date" value={to} onChange={(e) => setParams({ to: e.target.value })} />
                </div>
              </div>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setParams({ participant: null, from: null, to: null })}>
                  Clear filters
                </Button>
              )}
            </PopoverContent>
          </Popover>

          <Select value={sort} onValueChange={(v) => setParams({ sort: v === "newest" ? null : v })}>
            <SelectTrigger size="sm" className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="longest">Longest first</SelectItem>
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-muted-foreground">
            {data ? `${data.total} meeting${data.total === 1 ? "" : "s"}` : ""}
          </span>
        </div>

        {view === "shared" ? (
          <EmptyState icon={Share2} title="Nothing shared with you yet">
            Team sharing is coming soon.
          </EmptyState>
        ) : loading && !data ? (
          Array.from({ length: 6 }, (_, i) => <MeetingRowSkeleton key={i} />)
        ) : !data?.items.length ? (
          <EmptyState icon={q || activeFilters ? Search : Inbox} title={q || activeFilters ? "No meetings match your search" : "Transcribe your first meeting"}>
            {q || activeFilters ? (
              "Try different keywords or clear the filters."
            ) : (
              <Button className="mt-3" onClick={() => openNewMeeting("upload")}>
                <Plus /> Upload a transcript
              </Button>
            )}
          </EmptyState>
        ) : groups ? (
          groups.map(([label, items]) => (
            <div key={label} className="mb-2">
              <h3 className="flex items-center gap-2 px-3 pt-4 pb-1 text-[13px] font-medium text-muted-foreground">
                <CalendarDays className="size-3.5" /> {label}
                <span className="text-muted-foreground/70">· {items.length} meeting{items.length > 1 ? "s" : ""}</span>
              </h3>
              {items.map((m) => (
                <MeetingRow key={m.id} meeting={m} onChanged={reload} />
              ))}
            </div>
          ))
        ) : (
          data.items.map((m) => <MeetingRow key={m.id} meeting={m} onChanged={reload} />)
        )}
      </section>
    </div>
  );
}
