"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { buildExport, downloadFile, type ExportFormat, type ExportKind } from "@/lib/export";
import type { MeetingDetail, Segment } from "@/lib/types";
import { cn } from "@/lib/utils";

const FORMATS: { value: ExportFormat | "docx" | "pdf"; label: string; soon?: boolean }[] = [
  { value: "docx", label: "DOCX", soon: true },
  { value: "pdf", label: "PDF", soon: true },
  { value: "json", label: "JSON" },
  { value: "md", label: "MD" },
  { value: "txt", label: "TXT" },
];

/** "Download Meeting" modal: Transcript / Summary tabs, format chips, timestamps toggle. */
export function DownloadDialog({
  open,
  onOpenChange,
  meeting,
  segments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meeting: MeetingDetail;
  segments: Segment[];
}) {
  const [kind, setKind] = useState<ExportKind | "video" | "audio">("transcript");
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [timestamps, setTimestamps] = useState(true);
  const mediaTab = kind === "video" || kind === "audio";

  function download() {
    if (!format || mediaTab) return;
    const { content, mime, filename } = buildExport(kind, format, meeting, segments, timestamps);
    downloadFile(content, mime, filename);
    toast.success("Download started", { description: filename });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Meeting</DialogTitle>
        </DialogHeader>

        <div className="flex gap-5 border-b text-sm">
          {(["transcript", "summary", "video", "audio"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "-mb-px border-b-2 pb-2 capitalize transition-colors",
                kind === k ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>

        {mediaTab ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Recordings aren&apos;t stored in this demo. Media downloads are coming soon.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  disabled={f.soon}
                  title={f.soon ? "Coming soon" : undefined}
                  onClick={() => setFormat(f.value as ExportFormat)}
                  className={cn(
                    "rounded-md border px-3.5 py-2 text-sm font-medium shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    format === f.value ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="dl-ts" checked={timestamps} onCheckedChange={(c) => setTimestamps(c === true)} />
              <Label htmlFor="dl-ts" className="font-normal">
                Include timestamps
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={download} disabled={!format || mediaTab}>
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
