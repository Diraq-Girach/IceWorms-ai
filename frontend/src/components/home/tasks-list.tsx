"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/coming-soon";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { formatClock } from "@/lib/format";
import type { ActionItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

/** Every action item across meetings (Home > Tasks), with complete/uncomplete. */
export function TasksList() {
  const { data: items, setData, loading } = useApi(() => api.listActionItems(), "all-tasks");

  async function toggle(item: ActionItem, done: boolean) {
    setData((list) => list?.map((a) => (a.id === item.id ? { ...a, is_completed: done } : a)) ?? null); // optimistic
    try {
      await api.updateActionItem(item.id, { is_completed: done });
      if (done) toast.success("Task completed");
    } catch {
      setData((list) => list?.map((a) => (a.id === item.id ? item : a)) ?? null);
      toast.error("Couldn't update task");
    }
  }

  if (loading && !items) return <div className="h-40 animate-pulse rounded-xl bg-muted/50" />;
  if (!items?.length) return <EmptyState icon={CircleCheck} title="No tasks yet" />;

  const open = items.filter((a) => !a.is_completed);
  const done = items.filter((a) => a.is_completed);

  return (
    <div className="space-y-6">
      {[
        ["Open", open],
        ["Completed", done],
      ].map(([label, list]) => (
        <div key={label as string}>
          <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {label as string} · {(list as ActionItem[]).length}
          </h3>
          <ul className="divide-y rounded-xl border">
            {(list as ActionItem[]).map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-3.5 py-3">
                <Checkbox checked={a.is_completed} onCheckedChange={(c) => toggle(a, c === true)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", a.is_completed && "text-muted-foreground line-through")}>{a.text}</p>
                  <Link
                    href={`/meetings/${a.meeting_id}${a.start_sec != null ? `?t=${Math.floor(a.start_sec)}` : ""}`}
                    className="mt-0.5 inline-block text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    {a.meeting_title}
                    {a.start_sec != null && ` · ${formatClock(a.start_sec)}`}
                  </Link>
                </div>
                {a.assignee && <PersonAvatar name={a.assignee.name} color={a.assignee.avatar_color} size="sm" />}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
