"use client";

import { useEffect, useRef, useState } from "react";
import { findClue, formatScore } from "@/lib/board";
import { ddMaxWager, isOut } from "@/lib/gameReducer";
import { POWERS } from "@/lib/powers";
import type {
  Board,
  BuzzEntry,
  BuzzMode,
  BuzzState,
  CluePhase,
  GameAction,
  PowerType,
  RoomMode,
  Team,
} from "@/lib/types";
import { GradientBackground } from "../GradientBackground";
import { MediaRenderer } from "../MediaRenderer";
import { BuzzModeToggle } from "./BuzzModeToggle";

function clueTextSize(text: string) {
  if (text.length > 220) return "text-[clamp(1.4rem,min(2.6vw,4.5vh),2.6rem)]";
  if (text.length > 120) return "text-[clamp(1.8rem,min(3.4vw,6vh),3.6rem)]";
  return "text-[clamp(2.2rem,min(4.6vw,8vh),5rem)]";
}

export function ClueView({
  board,
  phase,
  teams,
  mode,
  buzzMode,
  buzz,
  dispatch,
  onCountdown,
  onResetBuzz,
  onOpenPowerups,
}: {
  board: Board;
  phase: CluePhase;
  teams: Team[];
  mode: RoomMode;
  buzzMode: BuzzMode;
  buzz: BuzzState;
  dispatch: (a: GameAction) => void;
  onCountdown: () => void;
  onResetBuzz: () => void;
  onOpenPowerups: () => void;
}) {
  const found = findClue(board, phase.clueId);
  const [showAllBuzzes, setShowAllBuzzes] = useState(false);
  const dd = phase.dailyDouble;
  const ddTeam = dd?.teamId ? teams.find((t) => t.id === dd.teamId) : undefined;
  const resolvedTeam = phase.resolvedBy ? teams.find((t) => t.id === phase.resolvedBy) : undefined;
  const duelRivalId = resolvedTeam && phase.effects?.duel?.find((d) => d.teamId !== resolvedTeam.id)?.teamId;
  const duelRival = duelRivalId ? teams.find((t) => t.id === duelRivalId) : undefined;
  const live = mode === "live";
  const showClue = !dd || dd.wager !== undefined;
  const instant = buzzMode === "instant";
  const open = !dd && !phase.resolvedBy;
  const forced = open ? phase.forced : undefined;
  const turnBased = open && (!instant || !!forced);
  const canCountdown = turnBased && !instant;
  const pickedTeam = turnBased && phase.pickedBy ? teams.find((t) => t.id === phase.pickedBy) : undefined;
  const pickedPending = !!pickedTeam && !isOut(phase, pickedTeam.id);
  const current = live && !dd && !pickedPending ? buzz.buzzes.find((b) => !isOut(phase, b.teamId)) : undefined;
  const fx = dd ? undefined : phase.effects;
  const teamName = (id: string) => teams.find((t) => t.id === id);
  const currentTeam = pickedPending ? pickedTeam : current ? teams.find((t) => t.id === current.teamId) : undefined;
  const questionHidden = !!phase.questionHidden && !phase.revealed && !phase.resolvedBy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      const key = e.key.toLowerCase();
      if (key === "c" && showClue && canCountdown && !pickedPending) {
        onCountdown();
      } else if ((e.code === "Space" || key === "a") && showClue) {
        e.preventDefault();
        dispatch({ type: phase.revealed ? "clue:hide" : "clue:reveal" });
      } else if (key === "q" && showClue) {
        dispatch({ type: "clue:question", hidden: !phase.questionHidden });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showClue, canCountdown, pickedPending, phase.revealed, phase.questionHidden, onCountdown, dispatch]);

  if (!found) return null;
  const { clue, category, value } = found;
  const played = !!phase.resolvedBy || phase.revealed || phase.lockedTeams.length > 0 || dd?.wager !== undefined;
  const crowded = !!phase.resolvedBy || phase.revealed;

  return (
    <div className="animate-fade-up fixed inset-0 z-40 flex flex-col bg-ink">
      <GradientBackground variant="hero" accent={resolvedTeam?.color ?? currentTeam?.color} waves={false} />
      <header className="flex items-center justify-between gap-4 border-b border-line bg-ink px-6 py-3">
        <p className="label !text-cream/80">
          {category.title} · {dd ? "Daily Double" : `$${value.toLocaleString("en-US")}`}
          {dd?.wager !== undefined && ` · wager ${formatScore(dd.wager)}`}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-ghost btn-sm gap-2 !border-g-violet/80 hover:!border-g-violet" onClick={onOpenPowerups}>
            <span aria-hidden>⚡</span> Power-ups
          </button>
          <BuzzModeToggle mode={buzzMode} dispatch={dispatch} />
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => dispatch({ type: "clue:close", markUsed: played })}
          title={played ? "Close and mark this tile as played" : "Nothing happened yet, so the tile stays on the board"}
        >
          Back to board
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col overflow-y-auto px-8 py-8 text-center">
          <div className="m-auto flex w-full flex-col items-center gap-6">
          {dd && !dd.teamId && (
            <div className="animate-pop flex flex-col items-center gap-8">
              <h1 className="font-display gradient-text text-[clamp(4rem,11vw,11rem)] italic">Daily Double</h1>
              <p className="label">Which team picked this tile?</p>
              <div className="flex flex-wrap justify-center gap-3">
                {teams.map((t) => (
                  <TeamButton key={t.id} team={t} onClick={() => dispatch({ type: "dd:assign", teamId: t.id })} />
                ))}
              </div>
            </div>
          )}

          {dd && ddTeam && dd.wager === undefined && (
            <WagerPrompt
              team={ddTeam}
              max={ddMaxWager(board, ddTeam)}
              live={live}
              onSubmit={(amount) => dispatch({ type: "dd:wager", amount })}
              onChangeTeam={() => dispatch({ type: "dd:assign", teamId: "" })}
            />
          )}

          {showClue && (
            <>
              {phase.resolvedBy && (
                <ResultBanner
                  team={resolvedTeam ?? ddTeam}
                  correct={!!resolvedTeam}
                  amount={dd ? (dd.wager ?? 0) : value * (resolvedTeam && fx?.doubled.includes(resolvedTeam.id) ? 2 : 1)}
                  duel={!dd && !!fx?.duel}
                  rival={duelRival}
                  rivalAmount={duelRival ? value * (fx?.doubled.includes(duelRival.id) ? 2 : 1) : 0}
                  thieves={phase.stolen
                    ?.filter((s) => s.teamId === resolvedTeam?.id && s.amount > 0)
                    .map((s) => teams.find((t) => t.id === s.by))
                    .filter((t): t is Team => !!t)}
                />
              )}
              {questionHidden ? (
                <div className="animate-pop flex flex-col items-center gap-3">
                  <p className="label !text-sm">Question hidden</p>
                  {currentTeam && (
                    <p className="font-display text-[clamp(2.4rem,min(6vw,9vh),6rem)] leading-tight text-muted">
                      <span style={{ color: currentTeam.color }}>{currentTeam.name}</span> buzzed.
                    </p>
                  )}
                </div>
              ) : (
                clue.question && (
                  <h1 className={`font-display max-w-5xl text-balance ${clueTextSize(clue.question)}`}>
                    {clue.question}
                  </h1>
                )
              )}
              {clue.media && !questionHidden && (
                <div className="flex w-full max-w-4xl justify-center">
                  <MediaRenderer media={clue.media} maxHeight={crowded ? "28vh" : "50vh"} />
                </div>
              )}
              {phase.revealed && (
                <div className="animate-fade-up mt-2 flex max-w-5xl flex-col items-center gap-3 border-t border-line pt-6">
                  <p className="label !text-sm">Correct response</p>
                  <p className="font-display text-balance text-[clamp(2.4rem,min(6vw,9vh),6.5rem)] leading-tight text-coral">
                    {clue.answer || "—"}
                  </p>
                  {clue.answerMedia && (
                    <div className="flex w-full max-w-3xl justify-center">
                      <MediaRenderer media={clue.answerMedia} maxHeight="24vh" />
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                {pickedPending && pickedTeam && !forced && (
                  <button
                    className="btn btn-primary px-10 py-5 text-2xl"
                    onClick={() => dispatch({ type: "clue:pass", teamId: pickedTeam.id })}
                    title="Lock out the picking team without losing points, then count down for everyone else"
                  >
                    {pickedTeam.name} passes
                  </button>
                )}
                {canCountdown && !pickedPending && (
                  <button
                    className="btn btn-primary px-10 py-5 text-2xl"
                    onClick={onCountdown}
                    disabled={buzz.status === "countdown"}
                    title="Shortcut: C"
                  >
                    {live && buzz.status === "armed" ? "Countdown again" : pickedTeam ? "Countdown for others" : "Countdown"}
                  </button>
                )}
                <button
                  className="btn btn-ghost px-10 py-5 text-2xl"
                  onClick={() => dispatch({ type: phase.revealed ? "clue:hide" : "clue:reveal" })}
                  title="Shortcut: Space"
                >
                  {phase.revealed ? "Hide answer" : "Reveal answer"}
                </button>
                {!phase.revealed && !phase.resolvedBy && (instant || phase.questionHidden) && (
                  <button
                    className="btn btn-ghost px-8 py-5 text-xl"
                    onClick={() => dispatch({ type: "clue:question", hidden: !phase.questionHidden })}
                    title="Shortcut: Q"
                  >
                    {phase.questionHidden ? "Show question" : "Hide question"}
                  </button>
                )}
              </div>
              {forced && (
                <ForcedBanner
                  team={teamName(forced.teamId)}
                  by={teamName(forced.by)}
                  pending={pickedPending}
                  instant={instant}
                />
              )}
              <PowerStrip
                fx={fx}
                hint={clue.hint}
                resolved={!!phase.resolvedBy}
                foundBy={phase.powerFoundBy ? teamName(phase.powerFoundBy) : undefined}
                unclaimed={phase.powerFoundBy === "none"}
                foundPower={clue.powerup}
                teamName={teamName}
              />
              {turnBased && !fx?.duel && !forced && (
                <PickedByPicker
                  teams={teams}
                  pickedBy={phase.pickedBy}
                  lockedTeams={phase.lockedTeams}
                  onPick={(teamId) => dispatch({ type: "clue:pick", teamId })}
                />
              )}
            </>
          )}
          </div>
        </section>

        {live && !dd && (
          <BuzzPanel
            buzz={buzz}
            teams={teams}
            lockedTeams={phase.lockedTeams}
            showAll={showAllBuzzes}
            onToggleAll={() => setShowAllBuzzes(!showAllBuzzes)}
            current={current}
            instant={instant}
            firstUp={pickedPending ? pickedTeam : undefined}
            onReset={phase.resolvedBy ? undefined : onResetBuzz}
          />
        )}
      </div>

      {showClue && (
        <footer className="border-t border-line bg-surface px-6 py-4">
          {phase.resolvedBy ? (
            <div className="flex justify-center">
              <button
                className="btn btn-primary px-12 py-5 text-2xl"
                onClick={() => dispatch({ type: "clue:close", markUsed: true })}
              >
                Back to board
              </button>
            </div>
          ) : (
            <div>
              <div className="relative mb-3 flex items-center justify-center">
                <p className="label text-center !text-sm">
                  {dd ? "Judge the Daily Double" : currentTeam ? `${currentTeam.name} is answering` : "Who answered?"}
                </p>
                <button
                  className="btn btn-ghost btn-sm absolute right-0"
                  onClick={() => dispatch({ type: "clue:skip" })}
                  title="No one else answers: show the answer and end this clue with no points"
                >
                  {dd ? "No answer" : phase.lockedTeams.length || phase.answered?.length ? "Everyone else skips" : "Nobody answers"}
                </button>
              </div>
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${dd ? 1 : teams.length}, minmax(0, 1fr))`,
                }}
              >
                {(dd ? teams.filter((t) => t.id === dd.teamId) : teams).map((t) => (
                  <JudgeChip
                    key={t.id}
                    team={t}
                    amount={dd ? (dd.wager ?? 0) : value * (fx?.doubled.includes(t.id) ? 2 : 1)}
                    locked={!dd && isOut(phase, t.id)}
                    lockedLabel={
                      fx?.blocked.some((b) => b.teamId === t.id)
                        ? "Blocked"
                        : fx?.duel && !fx.duel.some((d) => d.teamId === t.id)
                          ? "Not in the 1v1"
                          : undefined
                    }
                    note={
                      fx?.second.includes(t.id)
                        ? "2 tries"
                        : fx?.retried.includes(t.id)
                          ? "Last try"
                          : fx?.doubled.includes(t.id)
                            ? "Doubled"
                            : undefined
                    }
                    active={currentTeam?.id === t.id || !!dd}
                    onJudge={(correct) => dispatch({ type: "clue:judge", teamId: t.id, correct })}
                    onUnlock={
                      !dd && phase.lockedTeams.includes(t.id) && phase.forced?.teamId !== t.id
                        ? () => dispatch({ type: "clue:unlock", teamId: t.id })
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}

function PowerStrip({
  fx,
  hint,
  resolved,
  foundBy,
  unclaimed,
  foundPower,
  teamName,
}: {
  fx?: CluePhase["effects"];
  hint?: string;
  resolved: boolean;
  foundBy?: Team;
  unclaimed: boolean;
  foundPower?: PowerType;
  teamName: (id: string) => Team | undefined;
}) {
  const chips: { key: string; team?: Team; text: string }[] = [];
  for (const id of fx?.doubled ?? []) chips.push({ key: `d${id}`, team: teamName(id), text: `${POWERS.double.icon} doubled` });
  for (const id of fx?.bets ?? []) chips.push({ key: `b${id}`, team: teamName(id), text: `${POWERS.bet.icon} betting against the next answer` });
  for (const b of fx?.blocked ?? []) {
    chips.push({ key: `k${b.teamId}`, team: teamName(b.teamId), text: `${POWERS.block.icon} blocked by ${teamName(b.by)?.name ?? "?"}` });
  }
  for (const id of fx?.second ?? []) chips.push({ key: `s${id}`, team: teamName(id), text: `${POWERS.second.icon} gets two answers` });
  for (const id of fx?.retried ?? []) {
    if (!resolved) chips.push({ key: `r${id}`, team: teamName(id), text: `${POWERS.second.icon} second answer!` });
  }
  const hinted = (fx?.hints ?? []).map(teamName).filter(Boolean) as Team[];
  const duel = fx?.duel;

  if (!chips.length && !hinted.length && !foundBy && !unclaimed && !duel) return null;
  return (
    <div className="flex max-w-5xl flex-col items-center gap-3">
      {duel && (
        <div className="animate-pop flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          {duel.map((d, i) => {
            const t = teamName(d.teamId);
            return (
              <span key={d.teamId} className="flex items-center gap-5">
                {i === 1 && <span className="font-display text-3xl text-muted">{POWERS.duel.icon} vs</span>}
                <span className="text-center">
                  <span className="font-display block text-[clamp(1.8rem,3.4vw,3.2rem)] leading-none" style={{ color: t?.color }}>
                    {d.name ?? t?.name}
                  </span>
                  {d.name && <span className="label">{t?.name}</span>}
                </span>
              </span>
            );
          })}
        </div>
      )}
      {hinted.length > 0 && !resolved && (
        <div className="animate-pop border-2 border-coral/60 bg-coral/10 px-6 py-3">
          <p className="label mb-1 !text-coral">
            {POWERS.hint.icon} Hint for {hinted.map((t) => t.name).join(" & ")}
          </p>
          <p className="font-display text-[clamp(1.6rem,3vw,2.8rem)] leading-tight">{hint || "Host, give them a hint!"}</p>
        </div>
      )}
      {foundBy && foundPower && (
        <p className="animate-pop label !text-base">
          <span style={{ color: foundBy.color }}>{foundBy.name}</span> found a hidden power-up: {POWERS[foundPower].icon}{" "}
          {POWERS[foundPower].name}
        </p>
      )}
      {unclaimed && foundPower && (
        <p className="animate-pop label !text-base">
          Nobody got it, but there was a hidden power-up: {POWERS[foundPower].icon} {POWERS[foundPower].name}
        </p>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {chips.map((c) => (
            <span key={c.key} className="border px-3 py-1 text-sm" style={{ borderColor: c.team?.color }}>
              <span style={{ color: c.team?.color }}>{c.team?.name}</span> {c.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ForcedBanner({ team, by, pending, instant }: { team?: Team; by?: Team; pending: boolean; instant: boolean }) {
  if (!team) return null;
  return (
    <div className="animate-pop flex flex-col items-center gap-1">
      <p className="font-display text-[clamp(1.6rem,3vw,2.8rem)] leading-tight">
        {POWERS.rng.icon} <span style={{ color: team.color }}>{team.name}</span>{" "}
        {pending ? "must answer this one" : "is out"}
      </p>
      <p className="label">
        {by && (
          <>
            Sent by <span style={{ color: by.color }}>{by.name}</span> ·{" "}
          </>
        )}
        {pending ? "no passing · buzzers open after they answer" : instant ? "buzzers are open" : "count down for the rest"}
      </p>
    </div>
  );
}

function PickedByPicker({
  teams,
  pickedBy,
  lockedTeams,
  onPick,
}: {
  teams: Team[];
  pickedBy?: string;
  lockedTeams: string[];
  onPick: (teamId: string | null) => void;
}) {
  const picked = teams.find((t) => t.id === pickedBy);
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="label">
        {picked
          ? lockedTeams.includes(picked.id)
            ? `${picked.name} is out · count down for the rest`
            : `${picked.name} picked this · they answer first`
          : "Who picked this tile?"}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {teams.map((t) => {
          const active = t.id === pickedBy;
          return (
            <button
              key={t.id}
              onClick={() => onPick(active ? null : t.id)}
              className={`btn btn-sm ${active ? "btn-ghost" : "btn-ghost opacity-60 hover:opacity-100"}`}
              style={{
                borderColor: active ? t.color : undefined,
                boxShadow: active ? `inset 0 -3px 0 ${t.color}` : undefined,
              }}
            >
              {t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultBanner({
  team,
  correct,
  amount,
  duel,
  rival,
  rivalAmount = 0,
  thieves = [],
}: {
  team?: Team;
  correct: boolean;
  amount: number;
  duel?: boolean;
  rival?: Team;
  rivalAmount?: number;
  thieves?: Team[];
}) {
  const stolen = correct && thieves.length > 0;
  if (!team) {
    return (
      <div className="animate-pop flex flex-col items-center gap-1">
        <p className="font-display text-[clamp(2rem,min(5vw,8vh),4.5rem)] text-muted">Nobody got it</p>
        {duel && <p className="label !text-base">1v1 · no points change hands</p>}
      </div>
    );
  }
  return (
    <div className="animate-pop flex flex-col items-center gap-2 pb-2">
      <p className="label !text-base">{duel ? `${POWERS.duel.icon} 1v1 won!` : correct ? "Correct!" : "Not quite"}</p>
      <p
        className="font-display text-[clamp(3rem,min(9vw,13vh),9rem)] leading-[0.95]"
        style={{ color: team.color, textShadow: `0 0 60px ${team.color}88, 0 0 120px ${team.color}55` }}
      >
        {team.name}
      </p>
      <p className="font-display text-[clamp(1.8rem,min(4vw,6vh),4rem)]">
        {correct ? "got it" : "missed"}{" "}
        <span className={stolen ? "text-muted line-through" : correct ? "text-good" : "text-bad"}>
          {correct ? "+" : "−"}
          {formatScore(amount)}
        </span>
      </p>
      {stolen && (
        <p className="font-display text-[clamp(1.4rem,min(3vw,4.5vh),3rem)]">
          {POWERS.steal.icon}{" "}
          {thieves.map((t, i) => (
            <span key={t.id}>
              {i > 0 && " & "}
              <span style={{ color: t.color }}>{t.name}</span>
            </span>
          ))}{" "}
          secretly stole it <span className="text-good">+{formatScore(amount)}</span>
        </p>
      )}
      {correct && rival && (
        <p className="font-display text-[clamp(1.4rem,min(3vw,4.5vh),3rem)] text-muted">
          <span style={{ color: rival.color }}>{rival.name}</span> lost the 1v1{" "}
          <span className="text-bad">−{formatScore(rivalAmount)}</span>
        </p>
      )}
    </div>
  );
}

function TeamButton({ team, onClick }: { team: Team; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-ghost px-6 py-4 text-lg"
      style={{ borderColor: team.color, boxShadow: `inset 0 -3px 0 ${team.color}` }}
    >
      {team.name}
    </button>
  );
}

export function JudgeChip({
  team,
  amount,
  penalty = amount,
  locked,
  lockedLabel = "Locked out",
  note,
  active,
  onJudge,
  onUnlock,
}: {
  team: Team;
  amount: number;
  /** Points lost for a wrong answer. */
  penalty?: number;
  locked: boolean;
  lockedLabel?: string;
  note?: string;
  active: boolean;
  onJudge: (correct: boolean) => void;
  /** Shown on a locked-out card to let the team back in. */
  onUnlock?: () => void;
}) {
  const [delta, setDelta] = useState<{ value: number; key: number } | null>(null);
  const prevScore = useRef(team.score);
  useEffect(() => {
    const diff = team.score - prevScore.current;
    prevScore.current = team.score;
    if (!diff) return;
    setDelta({ value: diff, key: Date.now() });
    const t = setTimeout(() => setDelta(null), 1600);
    return () => clearTimeout(t);
  }, [team.score]);

  return (
    <div
      className="relative flex min-w-0 flex-col border-2 bg-ink transition"
      style={{
        borderColor: active ? team.color : "var(--color-line-strong)",
        boxShadow: active ? `0 0 32px -6px ${team.color}` : undefined,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: team.color }} />
      {delta && (
        <span
          key={delta.key}
          className={`animate-pop absolute -top-12 left-1/2 -translate-x-1/2 text-3xl font-bold ${
            delta.value > 0 ? "text-good" : "text-bad"
          }`}
        >
          {delta.value > 0 ? "+" : "−"}
          {formatScore(Math.abs(delta.value))}
        </span>
      )}
      <div className={`flex items-baseline justify-between gap-3 px-4 pb-2 pt-3 ${locked ? "opacity-45" : ""}`}>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-2xl font-semibold">{team.name}</span>
          {note && <span className="label shrink-0 !text-coral">{note}</span>}
        </span>
        <span className={`shrink-0 text-2xl font-bold tabular-nums ${team.score < 0 ? "text-bad" : ""}`}>
          {formatScore(team.score)}
        </span>
      </div>
      {locked ? (
        <div className="flex flex-1 items-center justify-center gap-4 border-t border-line-strong py-3">
          <span className="text-xl text-bad opacity-60">{lockedLabel}</span>
          {onUnlock && (
            <button className="btn btn-ghost btn-sm" onClick={onUnlock} title="Let this team buzz and answer again">
              Unlock
            </button>
          )}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 border-t border-line-strong">
          <button
            className="flex items-center justify-center gap-2 py-4 text-good transition hover:bg-good/15 active:bg-good/25"
            onClick={() => onJudge(true)}
            aria-label={`${team.name} correct, add ${amount}`}
          >
            <span className="text-3xl leading-none">✓</span>
            <span className="text-xl font-semibold">+{formatScore(amount)}</span>
          </button>
          <button
            className="flex items-center justify-center gap-2 border-l border-line-strong py-4 text-bad transition hover:bg-bad/15 active:bg-bad/25"
            onClick={() => onJudge(false)}
            aria-label={penalty ? `${team.name} wrong, subtract ${penalty}` : `${team.name} wrong`}
          >
            <span className="text-3xl leading-none">✕</span>
            <span className="text-xl font-semibold">{penalty ? `−${formatScore(penalty)}` : "Wrong"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function WagerPrompt({
  team,
  max,
  live,
  onSubmit,
  onChangeTeam,
}: {
  team: Team;
  max: number;
  live: boolean;
  onSubmit: (amount: number) => void;
  onChangeTeam: () => void;
}) {
  const [amount, setAmount] = useState("");
  return (
    <div className="animate-fade-up flex flex-col items-center gap-5">
      <p className="label">Daily Double</p>
      <h1 className="font-display text-[clamp(2.5rem,6vw,6rem)]">
        <span style={{ color: team.color }}>{team.name}</span>, make your wager.
      </h1>
      <p className="text-muted">
        Up to {formatScore(max)}
        {live && " · they can enter it on their phones, or type it here"}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount !== "") onSubmit(Number(amount));
        }}
      >
        <input
          type="number"
          min={0}
          max={max}
          className="field w-48 text-center text-xl"
          placeholder="Wager"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <button className="btn btn-primary" disabled={amount === ""}>
          Lock in
        </button>
      </form>
      <div className="flex gap-2">
        <button className="btn btn-ghost btn-sm" onClick={() => onSubmit(max)}>
          True Daily Double ({formatScore(max)})
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onChangeTeam}>
          Change team
        </button>
      </div>
    </div>
  );
}

function BuzzPanel({
  buzz,
  teams,
  lockedTeams,
  showAll,
  onToggleAll,
  current,
  instant,
  firstUp,
  onReset,
}: {
  buzz: BuzzState;
  teams: Team[];
  lockedTeams: string[];
  showAll: boolean;
  onToggleAll: () => void;
  current?: BuzzEntry;
  instant: boolean;
  firstUp?: Team;
  onReset?: () => void;
}) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const list = showAll
    ? buzz.buzzes
    : buzz.buzzes.filter((b) => (seen.has(b.teamId) ? false : (seen.add(b.teamId), true)));
  const first = buzz.buzzes[0]?.time ?? 0;
  const currentTeam = current ? teamById.get(current.teamId) : undefined;

  return (
    <aside className="flex w-[22rem] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="label">Buzz order</p>
        <button className="label hover:!text-cream" onClick={onToggleAll}>
          {showAll ? "Group by team" : "Show all players"}
        </button>
      </div>

      <div className="border-b border-line px-5 py-6">
        {currentTeam && current ? (
          <div key={current.playerId} className="animate-pop">
            <p className="label mb-2">First in</p>
            <p className="font-display text-5xl leading-none" style={{ color: currentTeam.color }}>
              {currentTeam.name}
            </p>
            <p className="mt-2 text-lg text-cream/80">{current.name}</p>
          </div>
        ) : (
          <p className="font-display text-3xl text-muted">
            {buzz.status === "armed"
              ? "Buzzers open…"
              : buzz.status === "countdown"
                ? `Get ready… ${buzz.count ?? ""}`
                : firstUp
                  ? `${firstUp.name} answers first.`
                  : buzz.buzzes.length
                  ? "Everyone who buzzed is locked out."
                  : instant
                    ? "Press Reset buzzers to open them."
                    : "Press Countdown to open buzzers."}
          </p>
        )}
        {onReset && (buzz.status !== "idle" || buzz.buzzes.length > 0) && (
          <button className="btn btn-ghost btn-sm mt-5 w-full" onClick={onReset}>
            Reset buzzers
          </button>
        )}
      </div>

      <ol className="flex-1 overflow-y-auto">
        {list.map((b, i) => {
          const team = teamById.get(b.teamId);
          const locked = lockedTeams.includes(b.teamId);
          return (
            <li
              key={b.playerId}
              className={`flex items-center gap-3 border-b border-line px-5 py-2.5 ${locked ? "opacity-40" : ""}`}
            >
              <span className="w-5 font-mono text-xs text-muted">{i + 1}</span>
              <span className="h-full w-1 self-stretch" style={{ background: team?.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{team?.name ?? "?"}</span>
                <span className="block truncate text-xs text-muted">{b.name}</span>
              </span>
              <span className="font-mono text-xs text-muted">
                {i === 0 && !showAll ? "first" : `+${((b.time - first) / 1000).toFixed(2)}s`}
              </span>
              {locked && <span className="label !text-bad">✕</span>}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
