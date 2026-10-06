"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { AskBar } from "./ask-bar";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Sidebar + top bar around every page. The meeting page starts with the sidebar
 * collapsed (more room for transcript + notes, as in Fireflies) but it can still be
 * expanded there; that choice resets when you navigate to another page.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMeetingDetail = /^\/meetings\/\d+/.test(pathname);
  const [collapsed, setCollapsed] = useState(false); // user's choice on regular pages
  const [expandedOnMeeting, setExpandedOnMeeting] = useState(false);

  // reset the meeting-page override on navigation (state adjusted during render, no effect needed)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setExpandedOnMeeting(false);
  }

  const isCollapsed = isMeetingDetail ? !expandedOnMeeting : collapsed;
  const toggle = () => (isMeetingDetail ? setExpandedOnMeeting((e) => !e) : setCollapsed((c) => !c));

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar collapsed={isCollapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        {!isMeetingDetail && <Topbar />}
        {/* the meeting page manages its own scroll areas, so the outer container must not scroll */}
        <main className={`relative min-h-0 flex-1 ${isMeetingDetail ? "overflow-hidden" : "overflow-y-auto"}`}>{children}</main>
      </div>
      {!isMeetingDetail && <AskBar />}
    </div>
  );
}
