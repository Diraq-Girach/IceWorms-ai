"use client";

import { ChevronsLeft, ChevronsRight, Gift } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_GROUPS, type NavItem } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { Logo, LogoMark } from "./logo";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const link = (
    <Link
      href={item.href}
      aria-label={collapsed ? item.label : undefined} // icon-only when collapsed
      className={cn(
        "flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-muted",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-[232px]",
      )}
    >
      <div className={cn("flex h-14 items-center px-3", collapsed ? "justify-center" : "justify-between")}>
        {collapsed ? (
          // Collapsed: the logo is the expand button; on hover it turns into a » icon
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                aria-label="Expand sidebar"
                className="group/expand relative flex size-9 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogoMark className="transition-opacity group-hover/expand:opacity-0 group-focus-visible/expand:opacity-0" />
                <ChevronsRight className="absolute size-4 text-muted-foreground opacity-0 transition-opacity group-hover/expand:opacity-100 group-focus-visible/expand:opacity-100" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Link href="/">
              <Logo />
            </Link>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={onToggle} aria-label="Collapse sidebar">
              <ChevronsLeft className="size-4" />
            </Button>
          </>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className={cn("space-y-0.5", i > 0 && "mt-3 border-t border-sidebar-border pt-3")}>
            {group.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="m-3 rounded-xl border border-sidebar-border bg-background p-3 text-center">
          <Gift className="mx-auto mb-1.5 size-5 text-primary" />
          <p className="text-[13px] font-semibold">Refer and get $5</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
            Get $5 when someone signs up using your referral link.
          </p>
          <Button size="sm" className="mt-2.5 h-8 w-full" onClick={() => toast.info("Referrals are coming soon")}>
            Refer
          </Button>
        </div>
      )}
    </aside>
  );
}
