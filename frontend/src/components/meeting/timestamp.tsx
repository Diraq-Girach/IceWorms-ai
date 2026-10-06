import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Blue "(05:28)" link used in notes, action items and the transcript. Clicking seeks the player. */
export function Timestamp({
  sec,
  onSeek,
  parens = true,
  className,
}: {
  sec: number;
  onSeek: (t: number) => void;
  parens?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSeek(sec);
      }}
      className={cn("font-medium text-timestamp tabular-nums hover:underline", className)}
      title="Jump to this moment"
    >
      {parens ? `(${formatClock(sec)})` : formatClock(sec)}
    </button>
  );
}
