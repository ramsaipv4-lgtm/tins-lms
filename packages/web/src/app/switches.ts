// Feature switches for the shell (SPEC 4.27): GET /api/switches, refreshed whenever the shell asks, so a switch an admin
// flips shows up on the next navigation. `null` means not known yet (or the hub is unreachable): nav entries stay.
import { useEffect, useState } from 'react';
import { api } from './api.ts';

export type Switches = Record<string, boolean>;

export function switchOn(sw: Switches | null, name: string | string[] | undefined): boolean {
  if (!name || !sw) return true;
  return (Array.isArray(name) ? name : [name]).some((n) => sw[n] !== false);
}

// `active` is false when no visible entry declares a switch, so the shell does not make a request it does not need.
export function useSwitches(active: boolean, refreshKey: string): Switches | null {
  const [sw, setSw] = useState<Switches | null>(null);
  useEffect(() => {
    if (!active) return;
    let live = true;
    api<{ switches: Switches }>('/api/switches').then((r) => { if (live) setSw(r.switches); }).catch(() => { /* keep the last answer */ });
    return () => { live = false; };
  }, [active, refreshKey]);
  return sw;
}
