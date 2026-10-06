"use client";

import { CalendarDays, ChevronRight, Download, FileUp, Globe, MoreHorizontal, Pencil, Share2, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/coming-soon";
import { PersonAvatar } from "@/components/common/person-avatar";
import { ActionItemsSection } from "@/components/meeting/action-items";
import { DownloadDialog } from "@/components/meeting/download-dialog";
import { PlayerBar, VideoArea } from "@/components/meeting/player";
import { NotesSection, SummarySection } from "@/components/meeting/summary-sections";
import { TranscriptPanel } from "@/components/meeting/transcript-panel";
import { DeleteMeetingDialog } from "@/components/meetings/delete-meeting-dialog";
import { EditMeetingDialog } from "@/components/meetings/edit-meeting-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { APP_NAME } from "@/lib/constants";
import { activeSegmentIndex } from "@/lib/format";
import type { ActionItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { usePlayer, usePlayerState } from "@/lib/use-player";

export default function MeetingPage() {
  return (
    <Suspense>
      <MeetingView />
    </Suspense>
  );
}

function MeetingView() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: meeting, setData: setMeeting, error, loading } = useApi(() => api.getMeeting(id), `meeting-${id}`);
  const { data: segments } = useApi(() => api.getTranscript(id), `transcript-${id}`);
  const { data: analytics } = useApi(() => api.getAnalytics(id), `analytics-${id}`);

  const duration = meeting?.duration_sec ?? 0;
  const player = usePlayer(duration);
  const { seek } = player;

  const centerRef = useRef<HTMLDivElement>(null);
  // Scroll only the centre column (scrollIntoView would also scroll outer containers)
  function scrollToSection(anchor: string) {
    const box = centerRef.current;
    const el = document.getElementById(anchor);
    if (box && el) box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 64, behavior: "smooth" });
  }

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Deep link: /meetings/3?t=128 (used by the Home > Tasks list) starts at that moment
  useEffect(() => {
    const t = Number(searchParams.get("t"));
    if (meeting && t) seek(t);
  }, [meeting?.id, searchParams, seek]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (meeting) document.title = `${meeting.title} · ${APP_NAME}`;
  }, [meeting]);

  // Which transcript line is "now playing": binary search over start times.
  // Subscribing to the *index* (not the time) means this page re-renders only when the line changes.
  const starts = useMemo(() => segments?.map((s) => s.start_sec) ?? [], [segments]);
  const activeIdx = usePlayerState(player, (s) => activeSegmentIndex(starts, s.time));
  const active = segments && activeIdx >= 0 ? segments[activeIdx] : null;

  const setItems = useCallback(
    (updater: (items: ActionItem[]) => ActionItem[]) =>
      setMeeting((m) => (m ? { ...m, action_items: updater(m.action_items) } : m)),
    [setMeeting],
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={Video} title="Meeting not found">
          It may have been deleted.{" "}
          <Link href="/meetings" className="text-primary hover:underline">
            Back to meetings
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (loading && !meeting) {
    return <div className="m-8 h-[60vh] animate-pulse rounded-xl bg-muted/50" />;
  }
  if (!meeting) return null;

  const others = meeting.participants.filter((p) => p.id !== meeting.host?.id);
  const when = new Date(meeting.date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex h-full flex-col">
      {/* header: breadcrumb + actions */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 text-sm">
        <Link href="/meetings" className="text-muted-foreground hover:text-foreground">
          # All Meetings
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="max-w-[40vw] truncate font-medium">{meeting.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Meeting actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil /> Edit details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDownloading(true)}>
              <Download /> Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2 /> Delete meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setDownloading(true)} aria-label="Download">
            <Download className="size-4" />
          </Button>
          <Button size="sm" className="h-8" onClick={() => toast.info("Sharing is coming soon")}>
            <Share2 className="size-4" /> Share
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* centre: player + title + summary / notes / action items */}
        <div ref={centerRef} className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-6">
            <VideoArea player={player} duration={duration} current={active} />

            <div className="mt-6 flex items-start gap-3">
              <h1 className="flex-1 text-xl leading-snug font-semibold">{meeting.title}</h1>
              <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                {meeting.platform === "upload" ? <FileUp className="size-3.5" /> : <Video className="size-3.5" />}
                {meeting.platform === "upload" ? "Upload" : "Video"}
              </span>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setEditing(true)} aria-label="Edit meeting">
                <Pencil className="size-4" />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              {meeting.host && (
                <Popover>
                  <PopoverTrigger className="flex items-center gap-1.5 hover:text-foreground">
                    <PersonAvatar name={meeting.host.name} color={meeting.host.avatar_color} size="xs" />
                    <span className="font-medium text-foreground">{meeting.host.name}</span>
                    {others.length > 0 && <span className="text-primary">+{others.length}</span>}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-2">
                    <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">{meeting.participants.length} participants</p>
                    {meeting.participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                        <PersonAvatar name={p.name} color={p.avatar_color} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{p.name}</p>
                          {p.email && <p className="truncate text-xs text-muted-foreground">{p.email}</p>}
                        </div>
                        {p.is_host && <span className="text-[10px] font-semibold text-primary uppercase">Host</span>}
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> {when}
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="size-3.5" /> {meeting.language}
              </span>
            </div>

            {/* quick section links */}
            <nav className="sticky top-0 z-10 -mx-2 mt-6 mb-5 flex gap-1 border-b bg-background/95 px-2 py-2 backdrop-blur">
              {[
                ["summary", "Summary"],
                ["notes", "Notes"],
                ["action-items", `Action items (${meeting.action_items.length})`],
              ].map(([anchor, label]) => (
                <button
                  key={anchor}
                  onClick={() => scrollToSection(anchor)}
                  className="rounded-md px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="space-y-10 pb-10">
              <SummarySection meeting={meeting} />
              <NotesSection meeting={meeting} onSeek={seek} />
              <ActionItemsSection
                meetingId={meeting.id}
                items={meeting.action_items}
                people={meeting.participants}
                onSeek={seek}
                onItemsChange={setItems}
              />
            </div>
          </div>
        </div>

        {/* right: transcript */}
        <aside className="hidden w-[420px] shrink-0 border-l md:block">
          <TranscriptPanel segments={segments ?? []} analytics={analytics} activeId={active?.id ?? null} onSeek={seek} />
        </aside>
      </div>

      <PlayerBar player={player} duration={duration} onDownload={() => setDownloading(true)} />

      {editing && (
        <EditMeetingDialog
          meeting={meeting}
          open={editing}
          onOpenChange={setEditing}
          onSaved={(m) => setMeeting(m)}
        />
      )}
      <DeleteMeetingDialog meeting={meeting} open={deleting} onOpenChange={setDeleting} onDeleted={() => router.push("/meetings")} />
      <DownloadDialog open={downloading} onOpenChange={setDownloading} meeting={meeting} segments={segments ?? []} />
    </div>
  );
}
