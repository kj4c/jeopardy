"use client";

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.18, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

const BUZZ_ROOTS = [523, 392, 659, 440, 587, 349, 494, 698];

export const sounds = {
  tick: () => tone(660, 0.12, "sine", 0.15),
  go: () => tone(990, 0.3, "triangle", 0.2),
  /** Each team gets its own pitch, so the room can hear who buzzed. */
  buzz: (teamIndex = 0) => {
    const root = BUZZ_ROOTS[teamIndex % BUZZ_ROOTS.length];
    tone(root, 0.18, "square", 0.08);
    tone(root * 1.5, 0.35, "square", 0.08, 0.12);
  },
  correct: () => {
    tone(660, 0.15, "triangle", 0.18);
    tone(880, 0.3, "triangle", 0.18, 0.12);
  },
  timeUp: () => [0, 0.22, 0.44].forEach((d) => tone(330, 0.18, "square", 0.1, d)),
  wrong: () => tone(180, 0.45, "sawtooth", 0.08),
  dailyDouble: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "triangle", 0.16, i * 0.11)),
};
