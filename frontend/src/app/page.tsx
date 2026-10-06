"use client";

import { CalendarDays, ChevronDown, ChevronUp, CircleCheck, Contact, Globe, Plus, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/coming-soon";
import { PersonAvatar } from "@/components/common/person-avatar";
import { TasksList } from "@/components/home/tasks-list";
import { MeetingRowSkeleton } from "@/components/meetings/meeting-row";
import { useNewMeeting } from "@/components/meetings/new-meeting-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { MeetingListItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

/** Recent meeting with Fireflies-style expandable AI summary bullets. */
function FeedItem({ meeting, defaultOpen }: { meeting: MeetingListItem; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const when = new Date(meeting.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="rounded-xl px-3 py-3 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3">
        {meeting.host && <PersonAvatar name={meeting.host.name} color={meeting.host.avatar_color} />}
        <div className="min-w-0 flex-1">
          <Link href={`/meetings/${meeting.id}`} className="block truncate text-[14px] font-semibold hover:text-primary">
            {meeting.title}
          </Link>
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs text-muted-foreground">
            {when}
            {meeting.overview_preview.length > 0 && (open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />)}
          </button>
        </div>
      </div>
      {open && meeting.overview_preview.length > 0 && (
        <ul className="mt-3 ml-11 space-y-2">
          {meeting.overview_preview.map((b) => (
            <li key={b.title} className="flex gap-2 text-[13px] leading-relaxed">
              <span>{b.emoji}</span>
              <span>
                <span className="font-semibold">{b.title}:</span> <span className="text-muted-foreground">{b.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HomePage() {
  const { data: me } = useApi(api.me, "me");
  const { data: stats } = useApi(api.stats, "stats");
  const { data: recent, loading } = useApi(() => api.listMeetings({ limit: 6 }), "recent");
  const { open: openNewMeeting } = useNewMeeting();

  const cards = [
    { icon: CircleCheck, label: `${stats?.new_tasks_7d ?? "–"} New Tasks`, hint: "LAST 7 DAYS" },
    { icon: Video, label: `${stats?.meetings ?? "–"} Meetings`, hint: "ALL TIME" },
    { icon: Contact, label: `${stats?.contacts ?? "–"} Contacts`, hint: "" },
  ];

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 pb-28">
        <div className="home-banner px-8 pt-10 pb-6">
          <h2 className="text-2xl font-semibold">
            {greeting()}
            {me && `, ${me.name.split(" ")[0]}`}
          </h2>
          <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
            {cards.map((c) => (
              <div key={c.label} className="flex items-center gap-2.5 rounded-xl border bg-background/90 px-4 py-3 shadow-sm">
                <c.icon className="size-4 text-primary" />
                <span className="text-sm font-medium">{c.label}</span>
                {c.hint && <span className="ml-auto text-[10px] font-medium tracking-wide text-muted-foreground">{c.hint}</span>}
              </div>
            ))}
          </div>
        </div>

        <Tabs defaultValue="feed" className="px-8">
          <TabsList variant="line" className="mb-2">
            <TabsTrigger value="feed">Recent Meetings</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>
          <TabsContent value="feed" className="max-w-3xl">
            {loading && !recent ? (
              Array.from({ length: 4 }, (_, i) => <MeetingRowSkeleton key={i} />)
            ) : recent?.items.length ? (
              <>
                {recent.items.map((m, i) => (
                  <FeedItem key={m.id} meeting={m} defaultOpen={i === 0} />
                ))}
                <Link href="/meetings" className="mt-2 inline-block px-3 text-sm text-primary hover:underline">
                  View all meetings →
                </Link>
              </>
            ) : (
              <EmptyState icon={Video} title="Meet your AI-powered feed">
                Stay up to date with your meetings and catch up on important discussions at a glance.
                <div>
                  <Button className="mt-3" onClick={() => openNewMeeting("upload")}>
                    <Plus /> New
                  </Button>
                </div>
              </EmptyState>
            )}
          </TabsContent>
          <TabsContent value="tasks" className="max-w-3xl">
            <TasksList />
          </TabsContent>
        </Tabs>
      </div>

      {/* right rail: notetaker settings + upcoming meetings (placeholders, as in Fireflies) */}
      <aside className="hidden w-[300px] shrink-0 space-y-4 border-l p-4 xl:block">
        <Button className="w-full" onClick={() => toast.info("Adding the notetaker to a live meeting is coming soon")}>
          <Video /> Add to live meeting
        </Button>
        <div className="space-y-4 rounded-xl border p-4">
          <p className="text-sm font-semibold">Notetaker</p>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Auto-join calendar meetings</p>
            <Select defaultValue="all" onValueChange={() => toast.info("Calendar integration is coming soon")}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All meetings with web-conf link</SelectItem>
                <SelectItem value="mine">Only meetings I organise</SelectItem>
                <SelectItem value="none">Don&apos;t auto-join</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Send email recap to</p>
            <Select defaultValue="everyone" onValueChange={() => toast.info("Email recaps are coming soon")}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone on the invite</SelectItem>
                <SelectItem value="me">Only me</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="size-3.5" /> Meeting language <span className="text-primary">English (Global)</span>
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 text-primary" /> Upcoming Meetings
          </p>
          <div className="py-6 text-center">
            <CalendarDays className="mx-auto mb-2 size-7 text-muted-foreground/50" />
            <p className="text-sm font-medium">No meetings in the next 2 days</p>
            <p className="mt-1 text-xs text-muted-foreground">Connect your calendar to see upcoming meetings.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
