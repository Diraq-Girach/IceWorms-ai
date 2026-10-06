"use client";

import { type SetStateAction, useCallback, useEffect, useEffectEvent, useState } from "react";

interface State<T> {
  data: T | null;
  error: string | null;
  doneFor: string | null; // which request the current data/error belongs to
}

/**
 * Minimal data-fetching hook: runs `fetcher` whenever `key` changes (or `reload()` is called).
 * - keeps showing the previous data while a new request is in flight (no flicker)
 * - ignores responses from superseded requests (no race when typing fast in a search box)
 * - `setData` allows optimistic updates after a mutation
 */
export function useApi<T>(fetcher: () => Promise<T>, key: string) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, doneFor: null });
  const [version, setVersion] = useState(0);
  const requestId = `${key}#${version}`;

  // Always calls the latest `fetcher` closure without making it an effect dependency
  const runFetch = useEffectEvent(() => fetcher());

  useEffect(() => {
    let cancelled = false;
    runFetch().then(
      (data) => !cancelled && setState({ data, error: null, doneFor: requestId }),
      (e: unknown) =>
        !cancelled &&
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : "Something went wrong", doneFor: requestId })),
    );
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const setData = useCallback(
    (update: SetStateAction<T | null>) =>
      setState((s) => ({
        ...s,
        data: typeof update === "function" ? (update as (prev: T | null) => T | null)(s.data) : update,
      })),
    [],
  );
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data: state.data, setData, error: state.error, loading: state.doneFor !== requestId, reload };
}
