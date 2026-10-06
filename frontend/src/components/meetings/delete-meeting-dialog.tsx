"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";

export function DeleteMeetingDialog({
  meeting,
  open,
  onOpenChange,
  onDeleted,
}: {
  meeting: { id: number; title: string };
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault(); // keep the dialog open until the request finishes
    setBusy(true);
    try {
      await api.deleteMeeting(meeting.id);
      toast.success("Meeting deleted", { description: meeting.title });
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast.error("Couldn't delete meeting", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{meeting.title}&rdquo; and its transcript, notes and action items will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={busy} className="bg-destructive text-white hover:bg-destructive/90">
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
