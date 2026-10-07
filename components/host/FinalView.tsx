"use client";

import { useEffect, useState } from "react";
import { formatScore } from "@/lib/board";
import { finalMaxWager } from "@/lib/gameReducer";
import type { Board, FinalPhase, GameAction, RoomMode, Team } from "@/lib/types";
import { GradientBackground } from "../GradientBackground";
import { MediaRenderer } from "../MediaRenderer";
import { Standings } from "./Standings";

export function FinalView({
  board,
  phase,
  teams,
  mode,
  canQuickfire,
  dispatch,
}: {
  board: Board;
  phase: FinalPhase;
  teams: Team[];
  mode: RoomMode;
  canQuickfire: boolean;
  dispatch: (a: GameAction) => void;
}) {
  const fj = board.finalJeopardy;
  const eligible = teams.filter((t) => phase.eligible.includes(t.id));
  const live = mode === "live";

  return (
    <div className="animate-fade-up fixed inset-0 z-40 flex flex-col bg-ink">
      <GradientBackground variant="hero" waves={false} />
      <header className="flex items-center justify-between border-b border-line bg-ink px-6 py-3">
        <p className="label !text-cream/80">Final Jeopardy · {stepLabel(phase.step)}</p>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => (phase.step === "done" || confirm("Leave Final Jeopardy?")) && dispatch({ type: "final:exit" })}
        >
          {phase.step === "done" ? "Back to board" : "Exit"}
        </button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-8 text-center">
        <div className="m-auto flex w-full flex-col items-center gap-8">
        {phase.step === "wager" && (
          <>
            <p className="label">The category is</p>
            <h1 className="font-display animate-pop gradient-text text-[clamp(3rem,8vw,8rem)]">
              {fj?.category || "Final Jeopardy"}
            </h1>
            {eligible.length === 0 ? (
              <p className="text-muted">No team has a positive score, so no one can play Final Jeopardy.</p>
            ) : (
              <>
                <p className="text-muted">
                  {live ? "Teams lock in wagers on their phones, or enter them here." : "Enter each team's wager."}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {eligible.map((t) => (
                    <WagerCard
                      key={t.id}
                      team={t}
                      submitted={phase.wagers[t.id]}
                      onSubmit={(amount) => dispatch({ type: "final:wager", teamId: t.id, amount })}
                    />
                  ))}
                </div>
              </>
            )}
            <button className="btn btn-primary px-8" onClick={() => dispatch({ type: "final:step", step: "clue" })}>
              Reveal the clue
            </button>
          </>
        )}

        {phase.step === "clue" && (
          <>
            <p className="label">{fj?.category}</p>
            <h1 className="font-display max-w-5xl text-balance text-[clamp(2rem,4.4vw,4.6rem)]">{fj?.question}</h1>
            {fj?.media && (
              <div className="flex w-full max-w-4xl justify-center">
                <MediaRenderer media={fj.media} maxHeight="38vh" />
              </div>
            )}
            <Timer
              seconds={30}
              endsAt={phase.timerEndsAt}
              timeUp={!!phase.timeUp}
              onStart={(seconds) => dispatch({ type: "final:timer", seconds })}
              onTimeUp={live ? undefined : () => dispatch({ type: "final:time-up" })}
            />
            <div className="flex flex-wrap justify-center gap-3">
              {eligible.map((t) => (
                <AnswerCard
                  key={t.id}
                  team={t}
                  answer={phase.answers[t.id]}
                  live={live}
                  timeUp={!!phase.timeUp}
                  onSubmit={(text) => dispatch({ type: "final:answer", teamId: t.id, text })}
                />
              ))}
            </div>
            <button className="btn btn-primary px-8" onClick={() => dispatch({ type: "final:step", step: "reveal" })}>
              Reveal responses
            </button>
          </>
        )}

        {phase.step === "reveal" && (
          <>
            <h1 className="font-display text-[clamp(2rem,4vw,4rem)]">{fj?.question}</h1>
            <div className="grid w-full max-w-5xl gap-3 md:grid-cols-2">
              {eligible.map((t) => (
                <RevealCard key={t.id} team={t} phase={phase} dispatch={dispatch} />
              ))}
            </div>
            <CorrectResponse answer={fj?.answer ?? ""} />
            <button className="btn btn-primary px-8" onClick={() => dispatch({ type: "final:step", step: "done" })}>
              Final standings
            </button>
          </>
        )}

        {phase.step === "done" && (
          <>
            <Standings teams={teams} title="Leading after Final Jeopardy" />
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn btn-primary px-8" onClick={() => dispatch({ type: "game:end" })}>
                End game
              </button>
              {canQuickfire && (
                <button className="btn btn-ghost px-8" onClick={() => dispatch({ type: "quickfire:start" })}>
                  Quickfire round
                </button>
              )}
              <button className="btn btn-ghost px-8" onClick={() => dispatch({ type: "final:exit" })}>
                Back to board
              </button>
            </div>
          </>
        )}
        </div>
      </section>
    </div>
  );
}

function stepLabel(step: FinalPhase["step"]) {
  return { wager: "Wagers", clue: "Clue", reveal: "Responses", done: "Results" }[step];
}

function TeamHeader({ team }: { team: Team }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 font-medium">
        <span className="h-2.5 w-2.5" style={{ background: team.color }} />
        {team.name}
      </span>
      <span className="font-mono text-xs text-muted">{formatScore(team.score)}</span>
    </div>
  );
}

function WagerCard({
  team,
  submitted,
  onSubmit,
}: {
  team: Team;
  submitted?: { amount: number; by?: string };
  onSubmit: (n: number) => void;
}) {
  const [value, setValue] = useState("");
  const max = finalMaxWager(team);
  return (
    <div className="panel w-64 p-4 text-left">
      <TeamHeader team={team} />
      {submitted ? (
        <p className="text-good">Wager locked in{submitted.by ? ` by ${submitted.by}` : ""}</p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value !== "") onSubmit(Number(value));
          }}
        >
          <input
            type="number"
            min={0}
            max={max}
            className="field py-1.5"
            placeholder={`0 – ${max}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm" disabled={value === ""}>
            Set
          </button>
        </form>
      )}
    </div>
  );
}

function AnswerCard({
  team,
  answer,
  live,
  timeUp,
  onSubmit,
}: {
  team: Team;
  answer?: { text: string; by?: string };
  live: boolean;
  timeUp: boolean;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="panel w-64 p-4 text-left">
      <TeamHeader team={team} />
      {answer ? (
        <p className="text-good">Response in{answer.by ? ` from ${answer.by}` : ""}</p>
      ) : live ? (
        <p className="text-muted">{timeUp ? "No response" : "Writing…"}</p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSubmit(value);
          }}
        >
          <input className="field py-1.5" placeholder="Their response" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn btn-ghost btn-sm" disabled={!value.trim()}>
            Set
          </button>
        </form>
      )}
    </div>
  );
}

function RevealCard({
  team,
  phase,
  dispatch,
}: {
  team: Team;
  phase: FinalPhase;
  dispatch: (a: GameAction) => void;
}) {
  const revealed = phase.revealed.includes(team.id);
  const judged = phase.judged[team.id];
  const wager = phase.wagers[team.id]?.amount ?? 0;
  const answer = phase.answers[team.id]?.text;
  return (
    <div className="panel corner-marks p-5 text-left" style={{ borderColor: revealed ? team.color : undefined }}>
      <TeamHeader team={team} />
      {!revealed ? (
        <button className="btn btn-ghost w-full" onClick={() => dispatch({ type: "final:reveal", teamId: team.id })}>
          Reveal {team.name}
        </button>
      ) : (
        <div className="animate-fade-up space-y-3">
          <p className="font-display text-3xl">{answer || <span className="text-muted">No response</span>}</p>
          <p className="label">Wagered {formatScore(wager)}</p>
          {judged === undefined ? (
            <div className="flex gap-2">
              <button
                className="btn btn-ghost flex-1 !border-good/50 text-good"
                onClick={() => dispatch({ type: "final:judge", teamId: team.id, correct: true })}
              >
                ✓ Correct
              </button>
              <button
                className="btn btn-ghost flex-1 !border-bad/50 text-bad"
                onClick={() => dispatch({ type: "final:judge", teamId: team.id, correct: false })}
              >
                ✕ Wrong
              </button>
            </div>
          ) : (
            <p className={judged ? "text-good" : "text-bad"}>
              {judged ? `+${formatScore(wager)}` : `−${formatScore(wager)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CorrectResponse({ answer }: { answer: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col items-center gap-4">
      {shown && (
        <div className="animate-fade-up">
          <p className="label mb-2 !text-sm">Correct response</p>
          <p className="font-display text-balance text-[clamp(2.8rem,6vw,6.5rem)] leading-tight text-coral">
            {answer || "—"}
          </p>
        </div>
      )}
      <button className="btn btn-ghost px-8 py-4 text-xl" onClick={() => setShown(!shown)}>
        {shown ? "Hide correct response" : "Show correct response"}
      </button>
    </div>
  );
}

function Timer({
  seconds,
  endsAt,
  timeUp,
  onStart,
  onTimeUp,
}: {
  seconds: number;
  endsAt?: number;
  timeUp: boolean;
  onStart: (seconds: number) => void;
  /** In-person games have no server to end the timer. */
  onTimeUp?: () => void;
}) {
  const secondsLeft = () => (timeUp || !endsAt ? 0 : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  const [left, setLeft] = useState(secondsLeft);
  useEffect(() => {
    setLeft(secondsLeft());
    if (!endsAt || timeUp) return;
    const t = setInterval(() => {
      const s = secondsLeft();
      setLeft(s);
      if (s <= 0) {
        clearInterval(t);
        onTimeUp?.();
      }
    }, 250);
    return () => clearInterval(t);
  }, [endsAt, timeUp]);
  if (!endsAt) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => onStart(seconds)}>
        Start {seconds}s timer
      </button>
    );
  }
  return (
    <div className="w-full max-w-md">
      <div className="h-1 w-full bg-line">
        <div
          className="h-full bg-gradient-to-r from-g-blue via-g-pink to-g-orange transition-[width] duration-1000 ease-linear"
          style={{ width: `${(left / seconds) * 100}%` }}
        />
      </div>
      <p className="label mt-2">{left > 0 ? `${left}s` : "Time's up · responses locked in"}</p>
    </div>
  );
}
