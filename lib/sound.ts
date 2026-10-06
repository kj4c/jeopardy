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

export const sounds = {
  tick: () => tone(660, 0.12, "sine", 0.15),
  go: () => tone(990, 0.3, "triangle", 0.2),
  buzz: () => {
    tone(520, 0.18, "square", 0.08);
    tone(780, 0.35, "square", 0.08, 0.12);
  },
  correct: () => {
    tone(660, 0.15, "triangle", 0.18);
    tone(880, 0.3, "triangle", 0.18, 0.12);
  },
  wrong: () => tone(180, 0.45, "sawtooth", 0.08),
  dailyDouble: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "triangle", 0.16, i * 0.11)),
};
