"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Simulated media player (no real audio: speech-to-text is out of scope).
 *
 * The clock lives in a small store OUTSIDE React state. A requestAnimationFrame loop
 * advances the exact time every frame, but subscribers are only notified ~10×/s,
 * and each component subscribes to just the slice it needs (usePlayerState).
 * So the player bar re-renders 10×/s, while the rest of the meeting page re-renders
 * only when the active transcript line changes, not on every frame
 * (60–165 times a second, depending on the display's refresh rate).
 */
export interface PlayerState {
  time: number;
  playing: boolean;
  rate: number;
}

const EMIT_EVERY_MS = 100;

function createPlayer() {
  let duration = 0;
  let exact = 0; // precise clock, advanced every frame
  let state: PlayerState = { time: 0, playing: false, rate: 1 }; // what subscribers see
  const listeners = new Set<() => void>();
  let raf = 0;
  let last = 0;
  let lastEmit = 0;

  // Replace the snapshot (never mutate it) so useSyncExternalStore sees a change
  const set = (patch: Partial<PlayerState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  const loop = (now: number) => {
    exact = Math.min(duration, exact + ((now - last) / 1000) * state.rate);
    last = now;
    if (exact >= duration) {
      set({ time: exact, playing: false });
      return;
    }
    if (now - lastEmit >= EMIT_EVERY_MS) {
      lastEmit = now;
      set({ time: exact });
    }
    raf = requestAnimationFrame(loop);
  };

  const play = () => {
    if (state.playing || !duration) return;
    if (exact >= duration) exact = 0; // replay from the start
    last = lastEmit = performance.now();
    set({ playing: true, time: exact });
    raf = requestAnimationFrame(loop);
  };

  const pause = () => {
    cancelAnimationFrame(raf);
    set({ playing: false, time: exact });
  };

  const seek = (t: number) => {
    exact = Math.min(Math.max(0, t), duration);
    set({ time: exact });
  };

  return {
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getState: () => state,
    setDuration: (d: number) => {
      duration = d;
    },
    seek,
    skip: (delta: number) => seek(exact + delta),
    toggle: () => (state.playing ? pause() : play()),
    setRate: (rate: number) => set({ rate }),
    destroy: () => cancelAnimationFrame(raf),
  };
}

export type Player = ReturnType<typeof createPlayer>;

/** Creates one player per mounted page. The returned object is stable, so its methods are safe effect deps. */
export function usePlayer(duration: number): Player {
  const [player] = useState(createPlayer);

  useEffect(() => player.setDuration(duration), [player, duration]);
  useEffect(() => () => player.destroy(), [player]);

  // Keyboard: Space = play/pause, ←/→ = ∓5s (ignored while typing or inside menus/dialogs)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        player.toggle();
      } else if (e.key === "ArrowRight") player.skip(5);
      else if (e.key === "ArrowLeft") player.skip(-5);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player]);

  return player;
}

/**
 * Subscribe to a slice of player state. The component re-renders only when the
 * selected value changes, e.g. `usePlayerState(p, s => s.playing)`.
 */
export function usePlayerState<T>(player: Player, select: (s: PlayerState) => T): T {
  const get = () => select(player.getState());
  return useSyncExternalStore(player.subscribe, get, get);
}
