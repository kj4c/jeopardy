"use client";

import { useEffect } from "react";
import { formatScore } from "@/lib/board";
import type { Board, BuzzState, GameAction, QuickfirePhase, RoomMode, Team } from "@/lib/types";
import { GradientBackground } from "../GradientBackground";
import { MediaRenderer } from "../MediaRenderer";
import { JudgeChip } from "./ClueView";
import { Standings } from "./Standings";

export function QuickfireView({
  board,
  phase,
  teams,
  mode,
  buzz,
  canFinal,
  dispatch,
}: {
  board: Board;
  phase: QuickfirePhase;
  teams: Team[];
  mode: RoomMode;
  buzz: BuzzState;
  canFinal: boolean;
  dispatch: (a: GameAction) => void;
}) {
  const qf = board.quickfire;
  const total = qf?.questions.length ?? 0;
  const points = qf?.points ?? 0;
  const done = phase.index >= total;
  const question = done ? undefined : qf?.questions[phase.index];
  const live = mode === "live";
  const first = live && !phase.resolvedBy ? buzz.buzzes[0] : undefined;
  const firstTeam = first ? teams.find((t) => t.id === first.teamId) : undefined;
  const winner = teams.find((t) => t.id === phase.resolvedBy);
  const missed = teams.find((t) => t.id === phase.missedBy);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea") || done) return;
      const key = e.key.toLowerCase();
      if ((e.code === "Space" || e.key === "ArrowRight") && phase.resolvedBy) {
        e.preventDefault();
        dispatch({ type: "quickfire:next" });
      } else if (key === "a" || e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "quickfire:reveal" });
      } else if (key === "s" && !phase.resolvedBy) {
        dispatch({ type: "quickfire:skip" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, phase.resolvedBy, dispatch]);

  return (
    <div className="animate-fade-up fixed inset-0 z-40 flex flex-col bg-ink">
      <GradientBackground variant="hero" accent={winner?.color ?? firstTeam?.color} waves={false} />
      <header className="flex items-center justify-between gap-4 border-b border-line bg-ink px-6 py-3">
        <p className="label !text-cream/80">
          Quickfire · {done ? "Complete" : `Question ${phase.index + 1} of ${total}`} · {formatScore(points)} each
          {qf?.penalty ? " · wrong answers lose points" : ""} · no steals
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "game:board" })}>
          Back to board
        </button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-8 text-center">
        <div className="m-auto flex w-full flex-col items-center gap-6">
          {done ? (
            <>
              <Standings teams={teams} title="Leading after Quickfire" />
              <div className="flex flex-wrap justify-center gap-3">
                <button className="btn btn-primary px-8" onClick={() => dispatch({ type: "game:end" })}>
                  End game
                </button>
                {canFinal && (
                  <button className="btn btn-ghost px-8" onClick={() => dispatch({ type: "final:start" })}>
                    Final Jeopardy
                  </button>
                )}
                <button className="btn btn-ghost px-8" onClick={() => dispatch({ type: "game:board" })}>
                  Back to board
                </button>
              </div>
            </>
          ) : (
            question && (
              <>
                {phase.resolvedBy && (
                  <div className="animate-pop flex flex-col items-center gap-1">
                    {winner ? (
                      <p className="font-display text-[clamp(2.4rem,min(7vw,10vh),7rem)] leading-none" style={{ color: winner.color }}>
                        {winner.name} <span className="text-good">+{formatScore(points)}</span>
                      </p>
                    ) : missed ? (
                      <p className="font-display text-[clamp(2.4rem,min(7vw,10vh),7rem)] leading-none" style={{ color: missed.color }}>
                        {missed.name} missed
                        {qf?.penalty && <span className="text-bad"> −{formatScore(points)}</span>}
                      </p>
                    ) : (
                      <p className="font-display text-[clamp(2.4rem,min(7vw,10vh),7rem)] leading-none text-muted">Skipped</p>
                    )}
                  </div>
                )}
                {firstTeam && first && (
                  <p key={first.playerId} className="animate-pop label !text-base">
                    <span style={{ color: firstTeam.color }}>{firstTeam.name}</span> buzzed first · {first.name}
                  </p>
                )}
                <h1 className="font-display max-w-5xl text-balance text-[clamp(2rem,min(4.6vw,8vh),5rem)]">
                  {question.question}
                </h1>
                {question.media && (
                  <div className="flex w-full max-w-4xl justify-center">
                    <MediaRenderer media={question.media} maxHeight={phase.revealed ? "28vh" : "45vh"} />
                  </div>
                )}
                {phase.revealed && (
                  <div className="animate-fade-up flex flex-col items-center gap-2 border-t border-line pt-5">
                    <p className="label !text-sm">Correct response</p>
                    <p className="font-display text-balance text-[clamp(2.4rem,min(6vw,9vh),6rem)] leading-tight text-coral">
                      {question.answer || "—"}
                    </p>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
                  {phase.resolvedBy ? (
                    <button
                      className="btn btn-primary px-10 py-5 text-2xl"
                      onClick={() => dispatch({ type: "quickfire:next" })}
                      title="Shortcut: Space or →"
                    >
                      {phase.index + 1 >= total ? "Finish quickfire" : "Next question →"}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost px-10 py-5 text-2xl"
                      onClick={() => dispatch({ type: "quickfire:skip" })}
                      title="Nobody got it. Shortcut: S"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    className="btn btn-ghost px-10 py-5 text-2xl"
                    onClick={() => dispatch({ type: "quickfire:reveal" })}
                    title="Shortcut: Space or A"
                  >
                    {phase.revealed ? "Hide answer" : "Reveal answer"}
                  </button>
                </div>
              </>
            )
          )}
        </div>
      </section>

      {!done && !phase.resolvedBy && (
        <footer className="border-t border-line bg-surface px-6 py-4">
          <p className="label mb-3 text-center !text-sm">
            {firstTeam ? `${firstTeam.name} is answering` : live ? "Buzzers open" : "Who answered?"}
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` }}>
            {teams.map((t) => (
              <JudgeChip
                key={t.id}
                team={t}
                amount={points}
                penalty={qf?.penalty ? points : 0}
                locked={false}
                active={firstTeam?.id === t.id}
                onJudge={(correct) => dispatch({ type: "quickfire:judge", teamId: t.id, correct })}
              />
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
