"use client";

import type { GameAction, GameStats, Team } from "@/lib/types";
import { GradientBackground } from "../GradientBackground";
import { GameRecap } from "./GameRecap";
import { Standings } from "./Standings";

export function EndedView({
  teams,
  stats,
  dispatch,
}: {
  teams: Team[];
  stats?: GameStats;
  dispatch: (a: GameAction) => void;
}) {
  const leader = [...teams].sort((a, b) => b.score - a.score)[0];
  return (
    <div className="animate-fade-up fixed inset-0 z-40 flex flex-col bg-ink">
      <GradientBackground variant="hero" accent={leader?.color} />
      <header className="flex items-center justify-between border-b border-line bg-ink px-6 py-3">
        <p className="label !text-cream/80">Game over</p>
        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "game:board" })}>
          Back to board
        </button>
      </header>
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-10 text-center">
        <div className="m-auto flex w-full flex-col items-center gap-8">
          <p className="font-display gradient-text text-[clamp(2rem,5vw,4rem)] italic">Thanks for playing</p>
          <Standings teams={teams} />
          <GameRecap stats={stats} teams={teams} />
          <button
            className="btn btn-ghost px-8"
            onClick={() => confirm("Reset all scores and tiles for a new game?") && dispatch({ type: "game:reset" })}
          >
            Play again
          </button>
        </div>
      </section>
    </div>
  );
}
