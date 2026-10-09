// Synthesized sound (D-43): no audio files, only WebAudio. Created lazily on the first sound, after a user gesture.
import type { Quality, Sfx } from './types.ts';

const SOUNDS: Record<string, { f: number[]; ms: number; type?: OscillatorType; gain?: number }> = {
  hit: { f: [660, 880], ms: 90 }, perfect: { f: [880, 1320], ms: 120 }, good: { f: [660, 880], ms: 100 }, late: { f: [440], ms: 100, type: 'triangle' },
  miss: { f: [220, 160], ms: 160, type: 'sawtooth', gain: 0.05 }, lock: { f: [520, 780, 1040], ms: 140 }, crack: { f: [180, 90], ms: 220, type: 'square', gain: 0.06 },
  win: { f: [523, 659, 784, 1046], ms: 420 }, lose: { f: [392, 311, 233], ms: 520, type: 'triangle' }, boom: { f: [120, 60], ms: 300, type: 'sawtooth', gain: 0.08 },
  ui: { f: [600], ms: 50, type: 'triangle', gain: 0.04 },
};

export function createSfx(storage?: { get(): boolean; set(muted: boolean): void }): Sfx {
  let ctx: AudioContext | null = null;
  let muted = storage?.get() ?? false;
  let musicNode: { stop(): void } | null = null;
  const audio = (): AudioContext | null => {
    if (ctx) return ctx;
    const C = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { ctx = null; }
    return ctx;
  };
  return {
    play(name) {
      if (muted) return;
      const a = audio(); const def = SOUNDS[name] ?? SOUNDS.ui;
      if (!a) return;
      const t0 = a.currentTime;
      const o = a.createOscillator(); const g = a.createGain();
      o.type = def.type ?? 'square';
      def.f.forEach((f, i) => o.frequency.setValueAtTime(f, t0 + (i * def.ms) / 1000 / def.f.length));
      g.gain.setValueAtTime(def.gain ?? 0.07, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + def.ms / 1000);
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + def.ms / 1000 + 0.02);
    },
    music(name) {
      musicNode?.stop(); musicNode = null;
      if (!name || muted) return;
      const a = audio(); if (!a) return;
      // A quiet two-note pulse; games layer more voices as the combo rises (procedural music, §13.6).
      const o = a.createOscillator(); const g = a.createGain(); const lfo = a.createOscillator(); const lg = a.createGain();
      o.type = 'triangle'; o.frequency.value = name === 'calm' ? 110 : 165;
      lfo.frequency.value = name === 'calm' ? 0.5 : 2; lg.gain.value = 0.02; g.gain.value = 0.03;
      lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(a.destination); o.start(); lfo.start();
      musicNode = { stop() { try { o.stop(); lfo.stop(); } catch { /* already stopped */ } } };
    },
    setMuted(m) { muted = m; storage?.set(m); if (m) { musicNode?.stop(); musicNode = null; } },
    muted: () => muted,
  };
}

/** Quality tier from the device (SPEC §13.2): low for weak CPUs, high only for plenty of cores and memory. */
export function detectQuality(env: { hardwareConcurrency?: number; deviceMemory?: number; devicePixelRatio?: number } = {}): Quality {
  const cores = env.hardwareConcurrency ?? 4, mem = env.deviceMemory ?? 4;
  const tier: Quality['tier'] = cores <= 2 || mem <= 2 ? 'low' : cores >= 8 && mem >= 8 ? 'high' : 'medium';
  return { tier, pixelRatio: Math.min(env.devicePixelRatio ?? 1, tier === 'low' ? 1 : 2), shadows: tier === 'high' };
}
