"use client";

import { Bell, ChevronDown, FileUp, LogOut, Mic, Monitor, Moon, PenLine, Search, Settings, Sun, UserPlus, Video } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/common/person-avatar";
import { useNewMeeting } from "@/components/meetings/new-meeting-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";

const TITLES: Record<string, string> = {
  "/": "Home",
  "/meetings": "Meetings",
  "/meeting-status": "Meeting Status",
  "/uploads": "Uploads",
  "/integrations": "Integrations",
  "/analytics": "Analytics",
  "/ai-skills": "AI Skills",
  "/team": "Team",
  "/settings": "Settings",
};

const soon = (what: string) => () => toast.info(`${what} is coming soon`);

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useNewMeeting();
  const { theme, setTheme } = useTheme();
  const { data: me } = useApi(api.me, "me");
  const [q, setQ] = useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/meetings?q=${encodeURIComponent(query)}&scope=all` : "/meetings");
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-5">
      <h1 className="w-40 shrink-0 truncate text-[15px] font-semibold">{TITLES[pathname] ?? ""}</h1>

      <form onSubmit={onSearch} className="mx-auto w-full max-w-md">
        <label className="flex h-9 items-center gap-2 rounded-lg border bg-muted/60 px-3 text-sm focus-within:border-primary/50 focus-within:bg-background">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or keyword"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
      </form>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="secondary" size="sm" className="h-8 gap-1.5" onClick={soon("Team invites")}>
          <UserPlus className="size-4" /> Invite
        </Button>

        {/* Split "Capture" button like Fireflies */}
        <div className="flex">
          <Button size="sm" className="h-8 gap-1.5 rounded-r-none" onClick={() => open("upload")}>
            <Video className="size-4" /> Capture
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 rounded-l-none border-l border-white/25 px-1.5" aria-label="More capture options">
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => open("upload")}>
                <FileUp /> Upload transcript
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => open("paste")}>
                <PenLine /> Paste transcript
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => open("form")}>
                <Video /> New meeting (manual)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={soon("Adding the notetaker to a live meeting")}>
                <UserPlus /> Add to live meeting
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button variant="ghost" size="icon" className="size-8" onClick={soon("Live recording")} aria-label="Record">
          <Mic className="size-[18px]" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative size-8" aria-label="Notifications">
              <Bell className="size-[18px]" />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3 text-sm font-semibold">Notifications</div>
            <div className="space-y-3 p-4 text-sm">
              <p>
                <span className="font-medium">Your meeting notes are ready.</span>{" "}
                <span className="text-muted-foreground">Summaries and action items were generated for your recent meetings.</span>
              </p>
              <Link href="/meetings" className="text-primary hover:underline">
                View meetings →
              </Link>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
              {me ? <PersonAvatar name={me.name} color={me.avatar_color} /> : <span className="block size-8 rounded-lg bg-muted" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{me?.name}</p>
              <p className="text-xs text-muted-foreground">{me?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Sun /> Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <Sun /> Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon /> Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor /> System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={soon("Sign out")}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
