"use client";

import { Inbox, Loader2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/coming-soon";
import { FileDropzone } from "@/components/meetings/file-dropzone";
import { MeetingRow } from "@/components/meetings/meeting-row";
import { fromLocalInput, toLocalInput } from "@/components/meetings/participants-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";

const LANGUAGES = ["English (Global)", "English (US)", "English (UK)", "Hindi", "Spanish", "French", "German"];

export default function UploadsPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, reload } = useApi(() => api.listMeetings({ limit: 200 }), "uploads");
  const uploads = data?.items.filter((m) => m.source === "upload" || m.source === "paste") ?? [];

  function choose(f: File | null) {
    setFile(f);
    if (f) setDate(toLocalInput(new Date(f.lastModified || Date.now())));
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const m = await api.uploadTranscript(file, { date: fromLocalInput(date), language });
      toast.success("Upload complete", { description: `${m.title} is ready.` });
      setFile(null);
      reload();
      router.push(`/meetings/${m.id}`);
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pt-8 pb-28">
      <FileDropzone file={null} onFile={choose} onError={(m) => toast.error(m)} />

      {/* "Uploading 1 Files" card, like Fireflies */}
      {file && (
        <div className="mx-auto mt-6 max-w-md rounded-xl border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <p className="font-semibold">Uploading 1 File</p>
            <button onClick={() => setFile(null)} aria-label="Cancel upload" disabled={busy}>
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-3 p-5">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500 text-[10px] font-bold text-white uppercase">
                {file.name.split(".").pop()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-7 text-xs" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={upload} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload
              </Button>
            </div>
          </div>
        </div>
      )}

      <h3 className="mt-10 mb-2 px-3 text-sm font-semibold">Recent uploads</h3>
      {uploads.length ? (
        uploads.map((m) => <MeetingRow key={m.id} meeting={m} onChanged={reload} />)
      ) : (
        <EmptyState icon={Inbox} title="You have no recent uploads!" />
      )}
    </div>
  );
}
