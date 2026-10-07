"use client";

import { useEffect, useState } from "react";

const HOLD_MS = 3200;
const EXIT_MS = 900;

/** Title card shown when a game opens; slides up like a presentation to reveal the board. Click to skip. */
export function WelcomeIntro({ boardName, onDone }: { boardName: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  return (
    <div
      className="fixed inset-0 z-[70] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center"
      style={{
        transform: leaving ? "translateY(-100%)" : "translateY(0)",
        transition: `transform ${EXIT_MS}ms cubic-bezier(0.76, 0, 0.24, 1)`,
      }}
      onClick={() => setLeaving(true)}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 45% at 30% 60%, color-mix(in srgb, var(--color-g-pink) 22%, transparent) 0%, transparent 70%), radial-gradient(ellipse 40% 45% at 70% 40%, color-mix(in srgb, var(--color-g-blue) 26%, transparent) 0%, transparent 70%)",
          animation: "intro-fade 1.2s ease both",
        }}
      />

      <p className="label relative !text-[clamp(0.8rem,1.3vw,1.3rem)]" style={{ animation: "intro-track 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s both" }}>
        Welcome to
      </p>

      <div className="relative mt-[2vh] overflow-hidden">
        <h1
          className="font-display max-w-[90vw] px-[0.12em] pb-[0.3em] text-[clamp(3rem,9vw,10rem)] leading-[1.02] text-cream"
          style={{ animation: "intro-rise 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.5s both" }}
        >
          {boardName}
        </h1>
      </div>

      <div
        className="relative mb-[3vh] mt-[1vh] h-px w-[min(40vw,28rem)] bg-gradient-to-r from-g-blue via-g-pink to-g-orange"
        style={{ animation: "intro-line 0.9s cubic-bezier(0.65, 0, 0.35, 1) 1.1s both" }}
      />

      <div className="relative overflow-hidden">
        <p
          className="font-display bg-gradient-to-r from-g-pink via-g-hot to-g-orange bg-clip-text px-[0.15em] pb-[0.25em] pt-[0.05em] text-[clamp(2.2rem,6vw,6.5rem)] font-black italic leading-none text-transparent"
          style={{ animation: "intro-rise 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 1.4s both" }}
        >
          Jeopardy!
        </p>
      </div>
    </div>
  );
}
