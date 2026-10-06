"use client";

import { Check, ListChecks, Plus, Trash2, UserRound } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/common/person-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { ActionItem, ActionItemUpdate, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SectionHeading } from "./summary-sections";
import { Timestamp } from "./timestamp";

const UNASSIGNED = "unassigned";

function ItemRow({
  item,
  people,
  onSeek,
  onUpdate,
  onDelete,
}: {
  item: ActionItem;
  people: Participant[];
  onSeek: (t: number) => void;
  onUpdate: (item: ActionItem, patch: ActionItemUpdate) => void;
  onDelete: (item: ActionItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  function save() {
    setEditing(false);
    const text = draft.trim();
    if (text && text !== item.text) onUpdate(item, { text });
    else setDraft(item.text);
  }

  return (
    <li className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50">
      <Checkbox
        checked={item.is_completed}
        onCheckedChange={(c) => onUpdate(item, { is_completed: c === true })}
        className="mt-[3px]"
        aria-label="Mark complete"
      />
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(item.text);
                setEditing(false);
              }
            }}
            className="h-8"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className={cn("cursor-text", item.is_completed && "text-muted-foreground line-through")}
            title="Click to edit"
          >
            {item.text}
          </span>
        )}{" "}
        {!editing && item.start_sec != null && <Timestamp sec={item.start_sec} onSeek={onSeek} />}
        {item.details.length > 0 && (
          <ul className="mt-1 list-[circle] space-y-0.5 pl-5 text-[13px] text-muted-foreground">
            {item.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Change assignee" title="Assign">
              <UserRound className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {people.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => onUpdate(item, { assignee_id: p.id })}>
                <PersonAvatar name={p.name} color={p.avatar_color} size="xs" /> {p.name}
                {item.assignee?.id === p.id && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onUpdate(item, { clear_assignee: true })}>Unassign</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => onDelete(item)} aria-label="Delete action item">
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

/**
 * Action items grouped by assignee (Fireflies layout), with inline add / edit /
 * complete / reassign / delete. Changes are applied optimistically and rolled back on error.
 */
export const ActionItemsSection = memo(function ActionItemsSection({
  meetingId,
  items,
  people,
  onSeek,
  onItemsChange,
}: {
  meetingId: number;
  items: ActionItem[];
  people: Participant[];
  onSeek: (t: number) => void;
  onItemsChange: (updater: (items: ActionItem[]) => ActionItem[]) => void;
}) {
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState(UNASSIGNED);
  const [adding, setAdding] = useState(false);

  // group by assignee, keeping first-seen order; unassigned last
  const groups = new Map<string, { person: Participant | null; items: ActionItem[] }>();
  for (const a of items) {
    const key = a.assignee ? String(a.assignee.id) : UNASSIGNED;
    if (!groups.has(key)) groups.set(key, { person: a.assignee, items: [] });
    groups.get(key)!.items.push(a);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => Number(a === UNASSIGNED) - Number(b === UNASSIGNED));
  const done = items.filter((a) => a.is_completed).length;

  async function update(item: ActionItem, patch: ActionItemUpdate) {
    // optimistic: reflect the change immediately
    const assigneeObj =
      patch.clear_assignee ? null : patch.assignee_id != null ? people.find((p) => p.id === patch.assignee_id) ?? item.assignee : item.assignee;
    onItemsChange((list) =>
      list.map((a) =>
        a.id === item.id
          ? { ...a, text: patch.text ?? a.text, is_completed: patch.is_completed ?? a.is_completed, assignee: assigneeObj }
          : a,
      ),
    );
    try {
      const saved = await api.updateActionItem(item.id, patch);
      onItemsChange((list) => list.map((a) => (a.id === item.id ? saved : a)));
      if (patch.is_completed) toast.success("Action item completed");
    } catch {
      onItemsChange((list) => list.map((a) => (a.id === item.id ? item : a)));
      toast.error("Couldn't update action item");
    }
  }

  async function remove(item: ActionItem) {
    onItemsChange((list) => list.filter((a) => a.id !== item.id));
    try {
      await api.deleteActionItem(item.id);
      toast.success("Action item deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            const restored = await api.createActionItem(meetingId, {
              text: item.text,
              assignee_id: item.assignee?.id,
              start_sec: item.start_sec,
              details: item.details,
            });
            onItemsChange((list) => [...list, restored]);
          },
        },
      });
    } catch {
      onItemsChange((list) => [...list, item]);
      toast.error("Couldn't delete action item");
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    try {
      const created = await api.createActionItem(meetingId, {
        text: text.trim(),
        assignee_id: assignee === UNASSIGNED ? null : Number(assignee),
      });
      onItemsChange((list) => [...list, created]);
      setText("");
      toast.success("Action item added");
    } catch (err) {
      toast.error("Couldn't add action item", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setAdding(false);
    }
  }

  return (
    <section>
      <SectionHeading
        id="action-items"
        icon={<ListChecks className="size-4 text-primary" />}
        title="Action items"
        action={items.length > 0 && <span className="text-xs text-muted-foreground">{done}/{items.length} done</span>}
      />

      {ordered.map(([key, g]) => (
        <div key={key} className="mb-4">
          <h3 className="mb-1 flex items-center gap-2 px-2 text-[14px] font-semibold">
            {g.person ? <PersonAvatar name={g.person.name} color={g.person.avatar_color} size="xs" /> : <UserRound className="size-4 text-muted-foreground" />}
            {g.person?.name ?? "Unassigned"}
          </h3>
          <ul>
            {g.items.map((a) => (
              <ItemRow key={a.id} item={a} people={people} onSeek={onSeek} onUpdate={update} onDelete={remove} />
            ))}
          </ul>
        </div>
      ))}

      <form onSubmit={add} className="mt-2 flex items-center gap-2 rounded-lg border border-dashed p-2">
        <Plus className="ml-1 size-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an action item…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={adding || !text.trim()}>
          Add
        </Button>
      </form>
    </section>
  );
});
