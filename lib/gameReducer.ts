import { findClue, maxRowValue, newId } from "./board";
import { isPowerType, POWERS } from "./powers";
import type {
  Board,
  BuzzState,
  CluePhase,
  Duelist,
  FinalPhase,
  GameAction,
  GameState,
  PowerEffects,
  PowerNotice,
  PowerType,
  QuickfirePhase,
  RoomMode,
  Team,
} from "./types";

export function ddMaxWager(board: Board, team: Team | undefined): number {
  return Math.max(team?.score ?? 0, maxRowValue(board));
}

export function finalMaxWager(team: Team | undefined): number {
  return Math.max(team?.score ?? 0, 0);
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.round(n), min), max);
}

function addScore(teams: Team[], teamId: string, delta: number): Team[] {
  return teams.map((t) => (t.id === teamId ? { ...t, score: t.score + delta } : t));
}

const NO_EFFECTS: PowerEffects = { bets: [], doubled: [], blocked: [], second: [], retried: [], hints: [] };

/** Locked out after a wrong answer or a pass, or blocked by another team's power-up. */
export function isOut(phase: CluePhase, teamId: string) {
  const fx = phase.effects;
  return (
    phase.lockedTeams.includes(teamId) ||
    !!fx?.blocked.some((b) => b.teamId === teamId) ||
    (!!fx?.duel && !fx.duel.some((d) => d.teamId === teamId))
  );
}

/** Team sent a random question that hasn't answered yet. Nobody else can buzz until then. */
export function forcedTeam(phase: CluePhase): string | undefined {
  const id = phase.forced?.teamId;
  return id && !phase.resolvedBy && !isOut(phase, id) ? id : undefined;
}

/** Team currently answering a regular clue: the picking team on their turn, otherwise the first buzz still in. */
export function answeringTeam(state: GameState, buzz: BuzzState, mode: RoomMode): string | undefined {
  const p = state.phase;
  if (p.kind !== "clue" || p.resolvedBy || p.dailyDouble) return undefined;
  const forced = forcedTeam(p);
  if (forced) return forced;
  if (state.buzzMode !== "instant" && p.pickedBy && !isOut(p, p.pickedBy)) return p.pickedBy;
  if (mode !== "live") return undefined;
  return buzz.buzzes.find((b) => !isOut(p, b.teamId))?.teamId;
}

function addPower(teams: Team[], teamId: string, power: PowerType, delta: number): Team[] {
  return teams.map((t) =>
    t.id === teamId ? { ...t, powers: { ...t.powers, [power]: Math.max(0, (t.powers?.[power] ?? 0) + delta) } } : t,
  );
}

function notice(teamId: string, power: PowerType, kind: PowerNotice["kind"], targetTeamId?: string): PowerNotice {
  return { id: newId("n_"), teamId, power, kind, targetTeamId };
}

/** Gives the clue's hidden power-up (if any) to `teamId`. `state.phase` must be the clue. */
function awardHiddenPower(state: GameState, board: Board, teamId: string | undefined): GameState {
  const { phase } = state;
  if (phase.kind !== "clue" || phase.powerFoundBy || !teamId || !state.teams.some((t) => t.id === teamId)) return state;
  const power = findClue(board, phase.clueId)?.clue.powerup;
  if (!power) return state;
  return {
    ...state,
    teams: addPower(state.teams, teamId, power, 1),
    powerNotice: notice(teamId, power, "found"),
    phase: { ...phase, powerFoundBy: teamId },
  };
}

/**
 * Pure game rules shared by the live server and in-person mode.
 * Returns the same object when an action is not applicable.
 */
export function gameReducer(state: GameState, action: GameAction, board: Board): GameState {
  const { phase } = state;

  switch (action.type) {
    case "team:add": {
      const name = action.name.trim().slice(0, 40) || `Team ${state.teams.length + 1}`;
      return { ...state, teams: [...state.teams, { id: newId("t_"), name, color: action.color, score: 0 }] };
    }
    case "team:update":
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId
            ? {
                ...t,
                ...(action.name !== undefined ? { name: action.name.slice(0, 40) } : {}),
                ...(action.color ? { color: action.color } : {}),
              }
            : t,
        ),
      };
    case "team:remove":
      return {
        ...state,
        teams: state.teams.filter((t) => t.id !== action.teamId),
        controlTeam: state.controlTeam === action.teamId ? undefined : state.controlTeam,
        queued: state.queued?.filter((q) => q.teamId !== action.teamId && q.targetTeamId !== action.teamId),
      };
    case "score:adjust":
      return { ...state, teams: addScore(state.teams, action.teamId, Math.round(action.delta)) };

    case "clue:open": {
      const found = findClue(board, action.clueId);
      if (!found) return state;
      const next: CluePhase = { kind: "clue", clueId: action.clueId, revealed: false, lockedTeams: [] };
      if (found.clue.dailyDouble) {
        next.dailyDouble = {};
        return { ...state, phase: next };
      }
      const queued = state.queued ?? [];
      const duel = queued.find((q) => q.power === "duel" && q.duel)?.duel;
      if (!duel && state.buzzMode !== "instant" && state.teams.some((t) => t.id === state.controlTeam)) {
        next.pickedBy = state.controlTeam;
      }
      if (queued.length) {
        next.effects = {
          ...NO_EFFECTS,
          bets: queued.filter((q) => q.power === "bet").map((q) => q.teamId),
          doubled: queued.filter((q) => q.power === "double").map((q) => q.teamId),
          blocked: queued
            .filter((q) => q.power === "block" && q.targetTeamId)
            .map((q) => ({ teamId: q.targetTeamId!, by: q.teamId })),
          duel,
        };
      }
      return { ...state, queued: [], phase: next };
    }
    case "clue:reveal":
      if (phase.kind !== "clue") return state;
      return { ...state, phase: { ...phase, revealed: true } };
    case "clue:hide":
      if (phase.kind !== "clue" || !phase.revealed) return state;
      return { ...state, phase: { ...phase, revealed: false } };
    case "clue:question":
      if (phase.kind !== "clue" || !!phase.questionHidden === action.hidden) return state;
      return { ...state, phase: { ...phase, questionHidden: action.hidden } };
    case "settings:buzz-mode":
      if ((state.buzzMode ?? "countdown") === action.mode) return state;
      return { ...state, buzzMode: action.mode === "instant" ? "instant" : "countdown" };
    case "clue:pick":
      if (phase.kind !== "clue" || phase.resolvedBy || phase.dailyDouble || phase.forced) return state;
      if (action.teamId && !state.teams.some((t) => t.id === action.teamId)) return state;
      return { ...state, phase: { ...phase, pickedBy: action.teamId ?? undefined } };
    case "clue:pass":
      if (phase.kind !== "clue" || phase.resolvedBy || phase.dailyDouble) return state;
      if (isOut(phase, action.teamId) || phase.forced?.teamId === action.teamId) return state;
      return { ...state, phase: { ...phase, lockedTeams: [...phase.lockedTeams, action.teamId] } };
    case "clue:close": {
      if (phase.kind !== "clue") return state;
      const finder = phase.dailyDouble?.teamId ?? (state.buzzMode !== "instant" ? phase.pickedBy : undefined);
      const awarded = action.markUsed ? awardHiddenPower(state, board, finder) : state;
      const used =
        action.markUsed && !state.used.includes(phase.clueId) ? [...state.used, phase.clueId] : state.used;
      return { ...awarded, used, phase: { kind: "board" } };
    }
    case "clue:unuse":
      return { ...state, used: state.used.filter((id) => id !== action.clueId) };
    case "clue:judge": {
      if (phase.kind !== "clue" || phase.resolvedBy) return state;
      const found = findClue(board, phase.clueId);
      if (!found) return state;
      const dd = phase.dailyDouble;
      if (dd && dd.teamId !== action.teamId) return state;
      if (!dd && isOut(phase, action.teamId)) return state;
      const team = action.teamId;
      const fx = dd ? undefined : phase.effects;
      if (fx && !action.correct && fx.second.includes(team)) {
        const effects = { ...fx, second: fx.second.filter((t) => t !== team), retried: [...fx.retried, team] };
        return { ...state, phase: { ...phase, effects } };
      }
      const amount = dd ? (dd.wager ?? 0) : found.value;
      const multiplier = fx?.doubled.includes(team) ? 2 : 1;
      const rival = fx?.duel?.find((d) => d.teamId !== team)?.teamId;
      let teams = state.teams;
      if (!fx?.duel) {
        teams = addScore(teams, team, (action.correct ? amount : -amount) * multiplier);
      } else if (action.correct) {
        teams = addScore(teams, team, amount * multiplier);
        if (rival) teams = addScore(teams, rival, -amount * (fx.doubled.includes(rival) ? 2 : 1));
      }
      const duelOver = !!fx?.duel && !action.correct && (!rival || phase.lockedTeams.includes(rival));
      let effects = fx;
      if (fx?.bets.some((b) => b !== team)) {
        for (const bettor of fx.bets) {
          if (bettor !== team) teams = addScore(teams, bettor, action.correct ? -amount : amount);
        }
        effects = { ...fx, bets: fx.bets.filter((b) => b === team) };
      }
      const finder = dd
        ? dd.teamId
        : state.buzzMode === "instant"
          ? action.correct ? team : undefined
          : (phase.pickedBy ?? (action.correct ? team : undefined));
      let next: GameState;
      if (action.correct || dd || duelOver) {
        const used = state.used.includes(phase.clueId) ? state.used : [...state.used, phase.clueId];
        next = {
          ...state,
          teams,
          used,
          controlTeam: action.correct ? team : state.controlTeam,
          phase: { ...phase, effects, revealed: true, resolvedBy: action.correct ? team : "none" },
        };
      } else {
        next = { ...state, teams, phase: { ...phase, effects, lockedTeams: [...phase.lockedTeams, team] } };
      }
      return awardHiddenPower(next, board, finder);
    }

    case "dd:assign":
      if (phase.kind !== "clue" || !phase.dailyDouble || phase.resolvedBy) return state;
      return { ...state, phase: { ...phase, dailyDouble: { teamId: action.teamId } } };
    case "dd:wager": {
      if (phase.kind !== "clue" || !phase.dailyDouble?.teamId || phase.resolvedBy) return state;
      const team = state.teams.find((t) => t.id === phase.dailyDouble!.teamId);
      const wager = clamp(action.amount, 0, ddMaxWager(board, team));
      return { ...state, phase: { ...phase, dailyDouble: { ...phase.dailyDouble, wager } } };
    }

    case "final:start": {
      const final: FinalPhase = {
        kind: "final",
        step: "wager",
        eligible: state.teams.filter((t) => t.score > 0).map((t) => t.id),
        wagers: {},
        answers: {},
        revealed: [],
        judged: {},
      };
      return { ...state, phase: final };
    }
    case "final:step":
      if (phase.kind !== "final") return state;
      return { ...state, phase: { ...phase, step: action.step } };
    case "final:wager": {
      if (phase.kind !== "final" || phase.step !== "wager" || !phase.eligible.includes(action.teamId)) return state;
      const team = state.teams.find((t) => t.id === action.teamId);
      const amount = clamp(action.amount, 0, finalMaxWager(team));
      return {
        ...state,
        phase: { ...phase, wagers: { ...phase.wagers, [action.teamId]: { amount, by: action.by } } },
      };
    }
    case "final:answer":
      if (phase.kind !== "final" || phase.step !== "clue" || !phase.eligible.includes(action.teamId)) return state;
      return {
        ...state,
        phase: {
          ...phase,
          answers: { ...phase.answers, [action.teamId]: { text: action.text.slice(0, 200), by: action.by } },
        },
      };
    case "final:reveal":
      if (phase.kind !== "final" || phase.revealed.includes(action.teamId)) return state;
      return { ...state, phase: { ...phase, step: "reveal", revealed: [...phase.revealed, action.teamId] } };
    case "final:judge": {
      if (phase.kind !== "final" || action.teamId in phase.judged) return state;
      const wager = phase.wagers[action.teamId]?.amount ?? 0;
      return {
        ...state,
        teams: addScore(state.teams, action.teamId, action.correct ? wager : -wager),
        phase: {
          ...phase,
          revealed: phase.revealed.includes(action.teamId) ? phase.revealed : [...phase.revealed, action.teamId],
          judged: { ...phase.judged, [action.teamId]: action.correct },
        },
      };
    }
    case "final:exit":
      return { ...state, phase: { kind: "board" } };

    case "quickfire:start": {
      const total = board.quickfire?.questions.length ?? 0;
      if (!total) return state;
      const index = Math.min(state.quickfireNext ?? 0, total);
      const next: QuickfirePhase = { kind: "quickfire", index, revealed: false };
      return { ...state, phase: next };
    }
    case "quickfire:judge": {
      const qf = board.quickfire;
      if (phase.kind !== "quickfire" || phase.resolvedBy || !qf || phase.index >= qf.questions.length) return state;
      const delta = action.correct ? qf.points : qf.penalty ? -qf.points : 0;
      return {
        ...state,
        teams: delta ? addScore(state.teams, action.teamId, delta) : state.teams,
        quickfireNext: phase.index + 1,
        phase: {
          ...phase,
          revealed: true,
          resolvedBy: action.correct ? action.teamId : "none",
          missedBy: action.correct ? undefined : action.teamId,
        },
      };
    }
    case "quickfire:skip":
      if (phase.kind !== "quickfire" || phase.resolvedBy) return state;
      return { ...state, quickfireNext: phase.index + 1, phase: { ...phase, revealed: true, resolvedBy: "none" } };
    case "quickfire:reveal":
      if (phase.kind !== "quickfire") return state;
      return { ...state, phase: { ...phase, revealed: !phase.revealed } };
    case "quickfire:next": {
      const total = board.quickfire?.questions.length ?? 0;
      if (phase.kind !== "quickfire" || phase.index >= total) return state;
      const index = phase.index + 1;
      return { ...state, quickfireNext: Math.max(state.quickfireNext ?? 0, index), phase: { kind: "quickfire", index, revealed: false } };
    }
    case "power:settings": {
      const enabled = [...new Set(action.enabled.filter(isPowerType))];
      return { ...state, powerSettings: { enabled, draftCount: clamp(action.draftCount, 0, 10) } };
    }
    case "power:draft": {
      const settings = state.powerSettings;
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!settings?.enabled.length || !team || team.drafted) return state;
      const picks = action.picks.filter((p) => settings.enabled.includes(p)).slice(0, settings.draftCount);
      const powers = { ...team.powers };
      for (const p of picks) powers[p] = (powers[p] ?? 0) + 1;
      return { ...state, teams: state.teams.map((t) => (t.id === team.id ? { ...t, powers, drafted: true } : t)) };
    }
    case "power:give":
      if (!isPowerType(action.power) || !state.teams.some((t) => t.id === action.teamId)) return state;
      return { ...state, teams: addPower(state.teams, action.teamId, action.power, Math.round(action.delta)) };
    case "power:use": {
      const { teamId, power, targetTeamId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!isPowerType(power) || !team || (team.powers?.[power] ?? 0) < 1) return state;
      const teams = addPower(state.teams, teamId, power, -1);
      const used = notice(teamId, power, "used", targetTeamId);
      if (POWERS[power].timing === "board") {
        if (phase.kind !== "board" || power === "second" || power === "hint") return state;
        const queued = state.queued ?? [];
        if (queued.some((q) => q.teamId === teamId && q.power === power)) return state;
        if (power === "rng") {
          const target = state.teams.find((t) => t.id === targetTeamId);
          if (!target || target.id === teamId || queued.some((q) => q.power === "duel")) return state;
          const pool = board.categories.flatMap((c) =>
            c.clues.filter((cl) => !cl.dailyDouble && !state.used.includes(cl.id) && (cl.question || cl.media)),
          );
          if (!pool.length) return state;
          const clueId = pool[Math.floor(Math.random() * pool.length)].id;
          const opened = gameReducer({ ...state, teams }, { type: "clue:open", clueId }, board);
          if (opened.phase.kind !== "clue") return state;
          const found = findClue(board, clueId);
          used.detail = `${target.name} must answer ${found?.category.title || "a category"} for $${(found?.value ?? 0).toLocaleString("en-US")}`;
          const fx = opened.phase.effects;
          return {
            ...opened,
            powerNotice: used,
            phase: {
              ...opened.phase,
              pickedBy: target.id,
              forced: { teamId: target.id, by: teamId },
              effects: fx && { ...fx, blocked: fx.blocked.filter((b) => b.teamId !== target.id) },
            },
          };
        }
        const targeted = power === "block" || power === "duel";
        if (targeted && (!targetTeamId || targetTeamId === teamId || !state.teams.some((t) => t.id === targetTeamId))) {
          return state;
        }
        let duel: [Duelist, Duelist] | undefined;
        if (power === "duel") {
          if (queued.some((q) => q.power === "duel")) return state;
          const d = action.duel ?? {};
          duel = [
            { teamId, playerId: d.playerId, name: d.playerName },
            { teamId: targetTeamId!, playerId: d.targetPlayerId, name: d.targetPlayerName },
          ];
          if (d.playerName && d.targetPlayerName) used.detail = `${d.playerName} vs ${d.targetPlayerName}`;
        }
        return {
          ...state,
          teams,
          powerNotice: used,
          queued: [...queued, { teamId, power, targetTeamId: targeted ? targetTeamId : undefined, duel }],
        };
      }
      if (phase.kind !== "clue" || phase.resolvedBy || phase.dailyDouble || isOut(phase, teamId)) return state;
      const fx = phase.effects ?? NO_EFFECTS;
      if (power === "second" && (fx.second.includes(teamId) || fx.retried.includes(teamId))) return state;
      if (power === "hint" && fx.hints.includes(teamId)) return state;
      const effects =
        power === "second" ? { ...fx, second: [...fx.second, teamId] } : { ...fx, hints: [...fx.hints, teamId] };
      return { ...state, teams, powerNotice: used, phase: { ...phase, effects } };
    }

    case "game:board":
      return phase.kind === "board" ? state : { ...state, phase: { kind: "board" } };
    case "game:end":
      return phase.kind === "ended" ? state : { ...state, phase: { kind: "ended" } };

    case "game:reset":
      return {
        teams: state.teams.map((t) => ({ ...t, score: 0, powers: undefined, drafted: undefined })),
        used: [],
        phase: { kind: "board" },
        buzzMode: state.buzzMode,
        powerSettings: state.powerSettings,
      };
  }
}
