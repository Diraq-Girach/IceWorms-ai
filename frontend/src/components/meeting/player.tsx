"use client";

import { Check, Download, Pause, Play, RotateCcw, RotateCw } from "lucide-react";

import { PersonAvatar } from "@/components/common/person-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { SPEEDS } from "@/lib/constants";
import { formatClock } from "@/lib/format";
import type { Segment } from "@/lib/types";
import { type Player, usePlayerState } from "@/lib/use-player";

// Each small component below subscribes only to the player state it shows,
// so a clock tick re-renders a time label, not the whole meeting page.

function ClockLabel({ player, duration }: { player: Player; duration: number }) {
  const time = usePlayerState(player, (s) => Math.floor(s.time)); // whole seconds: at most 1 re-render/s
  return (
    <>
      {formatClock(time)} / {formatClock(duration)}
    </>
  );
}

function PlayPauseIcon({ player }: { player: Player }) {
  const playing = usePlayerState(player, (s) => s.playing);
  return playing ? <Pause className="size-7" /> : <Play className="ml-1 size-7" />;
}

function ProgressLine({ player, duration }: { player: Player; duration: number }) {
  const time = usePlayerState(player, (s) => s.time);
  return (
    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
      <div className="h-full bg-white" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
    </div>
  );
}

/** Video area placeholder: big play button + the current line as a live caption. */
export function VideoArea({ player, duration, current }: { player: Player; duration: number; current: Segment | null }) {
  return (
    <div className="player-backdrop relative aspect-video w-full overflow-hidden rounded-xl text-white">
      <button onClick={player.toggle} className="absolute inset-0 flex items-center justify-center" aria-label="Play or pause">
        <span className="flex size-16 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-transform hover:scale-105">
          <PlayPauseIcon player={player} />
        </span>
      </button>

      <span className="absolute top-3 left-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium tracking-wide uppercase">
        Simulated playback
      </span>

      {current?.speaker && (
        <div className="pointer-events-none absolute inset-x-6 bottom-12 flex flex-col items-center gap-1.5 text-center">
          <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs">
            <PersonAvatar name={current.speaker.name} color={current.speaker.avatar_color} size="xs" />
            {current.speaker.name}
          </span>
          <p className="line-clamp-2 max-w-xl rounded-md bg-black/55 px-3 py-1.5 text-sm leading-snug">{current.text}</p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pt-6 pb-3 text-xs tabular-nums">
        <ClockLabel player={player} duration={duration} />
        <ProgressLine player={player} duration={duration} />
      </div>
    </div>
  );
}

function SeekBar({ player, duration }: { player: Player; duration: number }) {
  const time = usePlayerState(player, (s) => s.time);
  return (
    <Slider
      value={[time]}
      max={Math.max(duration, 1)}
      step={1}
      onValueChange={([v]) => player.seek(v)}
      className="h-1.5 rounded-none [&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:rounded-none"
      aria-label="Seek"
    />
  );
}

function SpeedMenu({ player }: { player: Player }) {
  const rate = usePlayerState(player, (s) => s.rate);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-12 text-xs font-semibold" aria-label="Playback speed">
          {rate}×
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="min-w-28">
        {SPEEDS.map((s) => (
          <DropdownMenuItem key={s} onClick={() => player.setRate(s)} className="justify-between">
            {s}x {rate === s && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlayButton({ player }: { player: Player }) {
  const playing = usePlayerState(player, (s) => s.playing);
  return (
    <Button size="icon" className="size-10 rounded-full" onClick={player.toggle} aria-label={playing ? "Pause" : "Play"}>
      {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
    </Button>
  );
}

/** Fireflies-style bottom bar: seek bar on top, time left, transport controls centred. */
export function PlayerBar({ player, duration, onDownload }: { player: Player; duration: number; onDownload: () => void }) {
  return (
    <div className="shrink-0 border-t bg-background">
      <SeekBar player={player} duration={duration} />
      <div className="relative flex h-14 items-center px-5">
        <span className="text-xs text-muted-foreground tabular-nums">
          <ClockLabel player={player} duration={duration} />
        </span>

        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
          <SpeedMenu player={player} />
          <Button variant="ghost" size="icon" onClick={() => player.skip(-15)} aria-label="Back 15 seconds">
            <RotateCcw className="size-[18px]" />
          </Button>
          <PlayButton player={player} />
          <Button variant="ghost" size="icon" onClick={() => player.skip(15)} aria-label="Forward 15 seconds">
            <RotateCw className="size-[18px]" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDownload} aria-label="Download">
            <Download className="size-[18px]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
