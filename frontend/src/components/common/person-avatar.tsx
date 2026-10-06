import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Fireflies-style rounded-square letter avatar in the person's colour. */
export function PersonAvatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-5 text-[10px] rounded",
    sm: "size-6 text-[11px] rounded-md",
    md: "size-8 text-[13px] rounded-lg",
    lg: "size-10 text-base rounded-lg",
  };
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center font-semibold text-white", sizes[size], className)}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping stack of small avatars with a "+N" overflow chip. */
export function AvatarStack({ people, max = 4 }: { people: { name: string; avatar_color: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <PersonAvatar key={p.name} name={p.name} color={p.avatar_color} size="xs" className="ring-2 ring-background" />
      ))}
      {extra > 0 && (
        <span className="inline-flex size-5 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
          +{extra}
        </span>
      )}
    </div>
  );
}
