"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

import { FileDropzone } from "./file-dropzone";
import { ParticipantsInput, fromLocalInput, toLocalInput, useParticipantsField } from "./participants-input";

type Mode = "upload" | "paste" | "form";

const NewMeetingContext = createContext<{ open: (mode?: Mode) => void }>({ open: () => {} });

/** Lets any component (top bar, empty states, Uploads page) open the "New meeting" dialog. */
export const useNewMeeting = () => useContext(NewMeetingContext);

const PASTE_EXAMPLE = `[00:00:05] Alice: Thanks for joining, let's review the launch plan.
[00:00:21] Bob: Sounds good. I'll send the updated timeline by Friday.`;

export function NewMeetingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);

  // form state (shared across tabs so switching tabs keeps what was typed)
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const people = useParticipantsField();
  const resetPeople = people.reset;

  const open = useCallback((m: Mode = "upload") => {
    setTitle("");
    setDate(toLocalInput(new Date()));
    setFile(null);
    setText("");
    resetPeople();
    setMode(m);
  }, [resetPeople]);

  const canSubmit =
    !busy &&
    people.valid &&
    (mode === "upload" ? !!file : mode === "paste" ? !!title.trim() && !!text.trim() : !!title.trim());

  async function submit() {
    if (!canSubmit || !mode) return;
    const participants = mode === "upload" ? [] : people.collect(); // includes a typed-but-not-added person
    if (!participants) return;
    setBusy(true);
    try {
      const iso = fromLocalInput(date);
      const meeting =
        mode === "upload"
          ? await api.uploadTranscript(file!, { title: title.trim() || undefined, date: iso })
          : await api.createMeeting({
              title: title.trim(),
              date: iso,
              participants,
              transcript_text: mode === "paste" ? text : undefined,
            });
      toast.success("Meeting created", {
        description: meeting.summary ? "Transcript processed and notes generated." : meeting.title,
      });
      setMode(null);
      router.push(`/meetings/${meeting.id}`);
    } catch (e) {
      toast.error("Couldn't create meeting", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <NewMeetingContext.Provider value={{ open }}>
      {children}
      <Dialog open={mode !== null} onOpenChange={(o) => !o && !busy && setMode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New meeting</DialogTitle>
            <DialogDescription>Upload or paste a transcript to generate notes, or add a meeting manually.</DialogDescription>
          </DialogHeader>

          <Tabs value={mode ?? "upload"} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">Upload file</TabsTrigger>
              <TabsTrigger value="paste">Paste transcript</TabsTrigger>
              <TabsTrigger value="form">Manual</TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              <TabsContent value="upload" className="mt-0">
                <FileDropzone file={file} onFile={setFile} onError={(m) => toast.error(m)} compact />
              </TabsContent>

              <div className="space-y-1.5">
                <Label htmlFor="nm-title">Title{mode === "upload" && <span className="text-muted-foreground"> (optional)</span>}</Label>
                <Input
                  id="nm-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={mode === "upload" ? "Defaults to the file name" : "e.g. Weekly product sync"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nm-date">Date & time</Label>
                <Input id="nm-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <TabsContent value="paste" className="mt-0 space-y-1.5">
                <Label htmlFor="nm-text">Transcript</Label>
                <Textarea
                  id="nm-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PASTE_EXAMPLE}
                  className="h-40 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  One line per utterance: <code>[hh:mm:ss] Name: text</code> or <code>Name: text</code>. WebVTT and JSON also work.
                </p>
              </TabsContent>

              {mode !== "upload" && (
                <div className="space-y-1.5">
                  <Label>Participants</Label>
                  <ParticipantsInput field={people} />
                  {mode === "paste" && (
                    <p className="text-xs text-muted-foreground">
                      Speakers in the transcript are added automatically. Add someone here with the same name to attach their email.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "upload" ? "Upload" : "Create meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NewMeetingContext.Provider>
  );
}
