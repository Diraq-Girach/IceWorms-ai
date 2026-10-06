// Client-side export of a meeting's transcript or summary as TXT / Markdown / JSON.
import { formatClock } from "./format";
import type { MeetingDetail, Segment } from "./types";

export type ExportKind = "transcript" | "summary";
export type ExportFormat = "txt" | "md" | "json";

function header(m: MeetingDetail, md: boolean) {
  const date = new Date(m.date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const people = m.participants.map((p) => p.name).join(", ");
  return md
    ? `# ${m.title}\n\n**Date:** ${date}  \n**Participants:** ${people}\n`
    : `${m.title}\nDate: ${date}\nParticipants: ${people}\n`;
}

function transcriptText(m: MeetingDetail, segs: Segment[], md: boolean, ts: boolean) {
  const lines = segs.map((s) => {
    const who = s.speaker?.name ?? "Unknown";
    const stamp = ts ? `[${formatClock(s.start_sec)}] ` : "";
    return md ? `**${stamp}${who}:** ${s.text}` : `${stamp}${who}: ${s.text}`;
  });
  return `${header(m, md)}\n${lines.join(md ? "\n\n" : "\n")}\n`;
}

function summaryText(m: MeetingDetail, md: boolean, ts: boolean) {
  const t = (sec: number | null) => (ts && sec != null ? ` (${formatClock(sec)})` : "");
  const h = (s: string) => (md ? `## ${s}` : s.toUpperCase());
  const out: string[] = [header(m, md)];

  if (m.summary) {
    out.push(h("Keywords"), m.summary.keywords.join(", "), "");
    out.push(h("Overview"));
    m.summary.overview.forEach((b) => out.push(md ? `- ${b.emoji} **${b.title}:** ${b.text}` : `- ${b.title}: ${b.text}`));
    out.push("");
  }
  if (m.notes.length) {
    out.push(h("Notes"));
    m.notes.forEach((s) => {
      out.push(md ? `### ${s.title}` : s.title, `${s.summary}${t(s.start_sec)}`);
      s.bullets.forEach((b) => out.push(`- ${b.text}${t(b.start_sec)}`));
      out.push("");
    });
  }
  if (m.action_items.length) {
    out.push(h("Action Items"));
    m.action_items.forEach((a) => {
      const box = a.is_completed ? "[x]" : "[ ]";
      const who = a.assignee ? `${a.assignee.name}: ` : "";
      out.push(`- ${box} ${who}${a.text}${t(a.start_sec)}`);
      a.details.forEach((d) => out.push(`    - ${d}`));
    });
  }
  return out.join("\n") + "\n";
}

export function buildExport(
  kind: ExportKind,
  format: ExportFormat,
  meeting: MeetingDetail,
  segments: Segment[],
  includeTimestamps: boolean,
): { content: string; mime: string; filename: string } {
  const base = `${meeting.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_")}_${kind}`;
  if (format === "json") {
    const body =
      kind === "transcript"
        ? segments.map((s) => ({
            speaker: s.speaker?.name ?? null,
            ...(includeTimestamps ? { start: s.start_sec, end: s.end_sec } : {}),
            text: s.text,
          }))
        : { summary: meeting.summary, notes: meeting.notes, action_items: meeting.action_items };
    return { content: JSON.stringify({ title: meeting.title, date: meeting.date, ...{ [kind]: body } }, null, 2), mime: "application/json", filename: `${base}.json` };
  }
  const md = format === "md";
  const content = kind === "transcript" ? transcriptText(meeting, segments, md, includeTimestamps) : summaryText(meeting, md, includeTimestamps);
  return { content, mime: md ? "text/markdown" : "text/plain", filename: `${base}.${format}` };
}

export function downloadFile(content: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
