"use client";

import { useEffect, useRef, useState } from "react";
import type { BuzzState } from "@/lib/types";

/** Draining bar and seconds left for the team that buzzed in. Counts locally from the server's time left. */
export function AnswerClock({
  timer,
  color,
  size = "md",
  onTimeUp,
}: {
  timer: NonNullable<BuzzState["timer"]>;
  color?: string;
  size?: "md" | "lg";
  onTimeUp?: () => void;
}) {
  const [left, setLeft] = useState(timer.leftMs);
  const timeUp = useRef(onTimeUp);
  timeUp.current = onTimeUp;

  useEffect(() => {
    const endsAt = performance.now() + timer.leftMs;
    let fired = timer.leftMs <= 0;
    let frame = 0;
    const tick = () => {
      const ms = Math.max(0, endsAt - performance.now());
      setLeft(ms);
      if (ms > 0) frame = requestAnimationFrame(tick);
      else if (!fired) {
        fired = true;
        timeUp.current?.();
      }
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [timer.leftMs, timer.totalMs, timer.teamId]);

  const out = left <= 0;
  const seconds = Math.ceil(left / 1000);
  const urgent = !out && seconds <= 3;
  return (
    <div className={`flex w-full items-center gap-3 ${size === "lg" ? "max-w-3xl" : "max-w-xs"}`}>
      <div className={`relative flex-1 overflow-hidden bg-line ${size === "lg" ? "h-3" : "h-2"}`}>
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${(left / timer.totalMs) * 100}%`, background: urgent ? "var(--color-bad)" : (color ?? "var(--color-coral)") }}
        />
      </div>
      <span
        key={out ? "out" : seconds}
        className={`font-display shrink-0 tabular-nums ${size === "lg" ? "text-4xl" : "text-2xl"} ${
          out ? "text-bad" : urgent ? "animate-pop text-bad" : ""
        }`}
      >
        {out ? "Time's up!" : `${seconds}s`}
      </span>
    </div>
  );
}
