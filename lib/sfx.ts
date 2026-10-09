"use client";

let ctx: AudioContext | null = null;

/** Follows the host's music mute and volume, so one slider controls everything. */
function level() {
  try {
    const saved = JSON.parse(localStorage.getItem("jeopardy:music") ?? "{}");
    if (saved.muted) return 0;
    return typeof saved.volume === "number" ? saved.volume : 0.45;
  } catch {
    return 0.45;
  }
}

function tone(freq: number, start: number, length: number, type: OscillatorType, gain: number, endFreq?: number) {
  const vol = level();
  if (!vol) return;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + length);
  amp.gain.setValueAtTime(gain * vol, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

/** Plays a sound file once at the host's music level. Returns a stop function. */
export function playClip(src: string, gain = 1) {
  const vol = level();
  if (!vol) return () => {};
  const el = new Audio(src);
  el.volume = Math.min(1, vol * gain);
  void el.play().catch(() => {});
  return () => {
    el.pause();
    el.src = "";
  };
}

export const sfx = {
  /** A reel flicking past one item. */
  tick() {
    tone(1400 + Math.random() * 300, 0, 0.035, "square", 0.12);
  },
  /** A reel thunking to a stop. */
  land() {
    tone(260, 0, 0.16, "triangle", 0.6, 90);
    tone(1800, 0, 0.03, "square", 0.15);
  },
  /** A tile flying up to fill the screen. */
  whoosh() {
    tone(180, 0, 0.45, "triangle", 0.35, 720);
    tone(360, 0.05, 0.4, "sine", 0.15, 1440);
  },
  /** The dollar value landing. */
  chime() {
    tone(784, 0, 0.5, "triangle", 0.3);
    tone(1175, 0.05, 0.6, "triangle", 0.22);
    tone(1568, 0.1, 0.7, "sine", 0.14);
  },
  /** An old phone's double ring: brrring-brrring. */
  ring() {
    for (const burst of [0, 0.45]) {
      for (let i = 0; i < 14; i++) tone(i % 2 ? 1180 : 1420, burst + i * 0.025, 0.03, "square", 0.07);
      tone(440, burst, 0.36, "sine", 0.12);
      tone(480, burst, 0.36, "sine", 0.12);
    }
  },
  /** The last reel lands. */
  jackpot() {
    tone(260, 0, 0.16, "triangle", 0.6, 90);
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.08 + i * 0.09, 0.22, "square", 0.14));
    tone(2093, 0.44, 0.5, "triangle", 0.25);
  },
};
