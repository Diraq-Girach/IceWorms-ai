"use client";

import { FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ACCEPTED = ".txt,.vtt,.json,.srt";
export const MAX_BYTES = 2 * 1024 * 1024;

/** Validates type + size client-side (the API enforces the same limits). */
export function checkFile(file: File): string | null {
  if (!/\.(txt|vtt|json|srt)$/i.test(file.name)) return "Please choose a .txt, .vtt, .json or .srt transcript";
  if (file.size > MAX_BYTES) return "File is larger than 2 MB";
  return null;
}

/** Dashed drag-and-drop area with a "Browse Files" button (Fireflies Uploads style). */
export function FileDropzone({
  file,
  onFile,
  onError,
  compact,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  onError: (msg: string) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function pick(f: File | undefined) {
    if (!f) return;
    const err = checkFile(f);
    if (err) onError(err);
    else onFile(f);
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
        <span className="flex size-9 items-center justify-center rounded-md bg-sky-500 text-[10px] font-bold text-white uppercase">
          {file.name.split(".").pop()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onFile(null)} aria-label="Remove file">
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-8" : "px-6 py-14",
        over ? "border-primary bg-primary/5" : "border-primary/30",
      )}
    >
      {compact ? <FileText className="mb-2 size-7 text-primary" /> : <Upload className="mb-3 size-7 text-primary" />}
      <p className="font-semibold">Upload a file to generate a transcript</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Browse or drag and drop <b>TXT</b>, <b>VTT</b>, <b>JSON</b> or <b>SRT</b> transcripts (max size: 2 MB)
      </p>
      <Button className="mt-4" onClick={() => inputRef.current?.click()}>
        Browse Files
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
    </div>
  );
}
