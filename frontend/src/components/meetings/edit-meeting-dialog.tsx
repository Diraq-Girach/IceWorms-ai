"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { MeetingDetail, Participant } from "@/lib/types";

import { ParticipantsInput, fromLocalInput, toLocalInput, useParticipantsField } from "./participants-input";

interface EditableMeeting {
  id: number;
  title: string;
  date: string;
  participants: Participant[];
}

/**
 * Edit title, date and participants. Rendered with a `key` per meeting by the caller,
 * so the form state initialises fresh each time it opens.
 */
export function EditMeetingDialog({
  meeting,
  open,
  onOpenChange,
  onSaved,
}: {
  meeting: EditableMeeting;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (m: MeetingDetail) => void;
}) {
  const [title, setTitle] = useState(meeting.title);
  const [date, setDate] = useState(toLocalInput(meeting.date));
  const people = useParticipantsField(meeting.participants.map((p) => ({ name: p.name, email: p.email })));
  const [busy, setBusy] = useState(false);

  async function save() {
    const participants = people.collect(); // includes a typed-but-not-added person
    if (!title.trim() || !people.valid || !participants) return;
    setBusy(true);
    try {
      const updated = await api.updateMeeting(meeting.id, {
        title: title.trim(),
        date: fromLocalInput(date),
        participants,
      });
      toast.success("Meeting updated");
      onSaved(updated);
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't update meeting", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit meeting</DialogTitle>
          <DialogDescription>Update the title, date or who attended.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="em-title">Title</Label>
            <Input id="em-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em-date">Date & time</Label>
            <Input id="em-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Participants</Label>
            <ParticipantsInput field={people} />
            <p className="text-xs text-muted-foreground">
              The first person is the host. Adding an email links the same person across meetings.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !title.trim() || !people.valid}>
            {busy && <Loader2 className="animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
