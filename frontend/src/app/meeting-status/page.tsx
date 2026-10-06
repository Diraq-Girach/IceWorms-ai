"use client";

import { CircleCheck, FileUp, Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PersonAvatar } from "@/components/common/person-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatTime, groupByDay } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Processing status per meeting. Everything here is already processed, so it's derived from `source`. */
function status(m: MeetingListItem) {
  return m.source === "form"
    ? { label: "No transcript", icon: Info, cls: "text-muted-foreground" }
    : { label: m.source === "seed" ? "Completed" : "Processed", icon: CircleCheck, cls: "text-emerald-600 dark:text-emerald-400" };
}

export default function MeetingStatusPage() {
  const [filter, setFilter] = useState("all");
  const { data } = useApi(() => api.listMeetings({ limit: 200 }), "status");
  const items = (data?.items ?? []).filter((m) => filter === "all" || status(m).label === filter);

  return (
    <div className="mx-auto max-w-3xl px-6 pt-6 pb-28">
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger size="sm" className="mb-4 w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="Completed">Completed</SelectItem>
          <SelectItem value="Processed">Processed</SelectItem>
          <SelectItem value="No transcript">No transcript</SelectItem>
        </SelectContent>
      </Select>

      {groupByDay(items).map(([label, list]) => (
        <div key={label} className="mb-4">
          <h3 className="px-2 pb-1 text-[13px] font-medium text-muted-foreground">{label}</h3>
          {list.map((m) => {
            const s = status(m);
            return (
              <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60">
                {m.host && <PersonAvatar name={m.host.name} color={m.host.avatar_color} />}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {m.title} {m.source === "upload" && <FileUp className="size-3.5 text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, {formatTime(m.date)}
                  </p>
                </div>
                <span className={`flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium ${s.cls}`}>
                  <s.icon className="size-3.5" /> {s.label}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
