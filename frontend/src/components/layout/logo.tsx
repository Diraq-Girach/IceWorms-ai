import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Original mark (glowing dots on a purple→pink tile) — not the real Fireflies logo. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e84393" />
          <stop offset="1" stopColor="#6d3bea" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
      <circle cx="11" cy="12" r="3.2" fill="#fff" />
      <circle cx="21" cy="10" r="2" fill="#fff" opacity=".75" />
      <circle cx="19" cy="20" r="3.8" fill="#fff" opacity=".9" />
      <circle cx="10" cy="22" r="1.6" fill="#fff" opacity=".6" />
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      {!collapsed && <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>}
    </div>
  );
}
