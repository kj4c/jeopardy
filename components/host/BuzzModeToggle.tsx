"use client";

import type { BuzzMode, GameAction } from "@/lib/types";

const OPTIONS: { mode: BuzzMode; label: string; title: string }[] = [
  {
    mode: "countdown",
    label: "Countdown",
    title: "The team that picked answers first; if they miss or pass, count down and everyone else buzzes",
  },
  { mode: "instant", label: "Free for all", title: "Buzzers open as soon as the question shows; buzzing hides the question" },
];

export function BuzzModeToggle({ mode, dispatch }: { mode: BuzzMode; dispatch: (a: GameAction) => void }) {
  return (
    <div className="flex border border-line-strong text-sm" role="group" aria-label="Buzz mode">
      {OPTIONS.map((o) => (
        <button
          key={o.mode}
          title={o.title}
          onClick={() => o.mode !== mode && dispatch({ type: "settings:buzz-mode", mode: o.mode })}
          className={`px-3 py-1.5 transition ${mode === o.mode ? "bg-coral/20 text-cream" : "text-muted hover:text-cream"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
