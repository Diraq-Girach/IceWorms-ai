"use client";

import { Bell, CalendarDays, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { PersonAvatar } from "@/components/common/person-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { data: me } = useApi(api.me, "me");
  const { theme, setTheme } = useTheme();
  // next-themes only knows the theme on the client: true after hydration, false on the server
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 pt-8 pb-28">
      <section className="rounded-xl border p-5">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <div className="flex items-center gap-4">
          {me && <PersonAvatar name={me.name} color={me.avatar_color} size="lg" />}
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={me?.name ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={me?.email ?? ""} disabled />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Accounts and sign-in are coming soon. You&apos;re using the default workspace user.</p>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-4 font-semibold">Appearance</h2>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
              ["system", "System", Monitor],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-muted/60",
                mounted && theme === value && "border-primary bg-primary/5 text-primary",
              )}
            >
              <Icon className="size-5" /> {label}
            </button>
          ))}
        </div>
      </section>

      {[
        { icon: CalendarDays, title: "Calendar & notetaker", text: "Auto-join rules, recording preferences and meeting language." },
        { icon: Bell, title: "Notifications", text: "Email recaps and in-app alerts after each meeting." },
      ].map((s) => (
        <section key={s.title} className="flex items-start gap-3 rounded-xl border p-5 opacity-80">
          <s.icon className="mt-0.5 size-5 text-muted-foreground" />
          <div className="flex-1">
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">Coming soon</span>
        </section>
      ))}
    </div>
  );
}
