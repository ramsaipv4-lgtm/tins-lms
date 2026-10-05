// Small hooks shared by the files screens.
import { useEffect, useReducer, useState } from 'react';
import * as phone from './phone.ts';

// Re-renders when the phone store changes (bundle refreshed, sync change, local write); also makes sure it is running.
export function usePhone(): { bundle: phone.Bundle | null; ready: boolean } {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    phone.start();
    let live = true;
    // The screen is useful from the stored copy; waiting for the hub's first answer is bounded (a few seconds).
    void phone.refreshNow().then(() => phone.whenReady()).then(() => { if (live) setReady(true); });
    const off = phone.subscribe(bump);
    return () => { live = false; off(); };
  }, []);
  return { bundle: phone.getBundle(), ready };
}
