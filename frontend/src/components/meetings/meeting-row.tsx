"use client";

import { ChevronRight, CircleCheck, FileUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AvatarStack, PersonAvatar } from "@/components/common/person-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTime } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";

import { DeleteMeetingDialog } from "./delete-meeting-dialog";
import { EditMeetingDialog } from "./edit-meeting-dialog";

/**
 * One meeting in the library: host avatar, title, "6 Oct · 11:00 AM · 42 min · Host",
 * participants, and hover actions (··· menu + Details) like Fireflies.
 */
export function MeetingRow({ meeting, onChanged }: { meeting: MeetingListItem; onChanged: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const host = meeting.host;
  const day = new Date(meeting.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        onClick={() => router.push(`/meetings/${meeting.id}`)}
        onKeyDown={(e) => e.key === "Enter" && router.push(`/meetings/${meeting.id}`)}
        className="group flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-muted/70"
      >
        {host ? <PersonAvatar name={host.name} color={host.avatar_color} size="lg" /> : <span className="size-10 rounded-lg bg-muted" />}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold">{meeting.title}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            {meeting.source === "upload" && <FileUp className="size-3.5 shrink-0 text-muted-foreground" aria-label="Uploaded" />}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {day} · {formatTime(meeting.date)} · {Math.round(meeting.duration_sec / 60)} min
            {host && ` · ${host.name}`}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-4 md:flex">
          {meeting.action_items_total > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Open action items">
              <CircleCheck className="size-3.5" />
              {meeting.action_items_open}/{meeting.action_items_total}
            </span>
          )}
          <AvatarStack people={meeting.participants} />
        </div>

        {/* hover actions — stopPropagation so they don't trigger row navigation */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="size-8 bg-background" aria-label="Meeting actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil /> Edit details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-8 bg-background" asChild>
            <Link href={`/meetings/${meeting.id}`}>
              Details <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {editing && <EditMeetingDialog meeting={meeting} open={editing} onOpenChange={setEditing} onSaved={onChanged} />}
      <DeleteMeetingDialog meeting={meeting} open={deleting} onOpenChange={setDeleting} onDeleted={onChanged} />
    </>
  );
}

export function MeetingRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-3 py-3">
      <div className="size-10 animate-pulse rounded-lg bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
