import { findClue, maxRowValue, newId } from "./board";
import type { Board, CluePhase, FinalPhase, GameAction, GameState, Team } from "./types";

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
      };
    case "score:adjust":
      return { ...state, teams: addScore(state.teams, action.teamId, Math.round(action.delta)) };

    case "clue:open": {
      const found = findClue(board, action.clueId);
      if (!found) return state;
      const next: CluePhase = { kind: "clue", clueId: action.clueId, revealed: false, lockedTeams: [] };
      if (found.clue.dailyDouble) next.dailyDouble = {};
      else if (state.buzzMode !== "instant" && state.teams.some((t) => t.id === state.controlTeam)) {
        next.pickedBy = state.controlTeam;
      }
      return { ...state, phase: next };
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
      if (phase.kind !== "clue" || phase.resolvedBy || phase.dailyDouble) return state;
      if (action.teamId && !state.teams.some((t) => t.id === action.teamId)) return state;
      return { ...state, phase: { ...phase, pickedBy: action.teamId ?? undefined } };
    case "clue:pass":
      if (phase.kind !== "clue" || phase.resolvedBy || phase.dailyDouble) return state;
      if (phase.lockedTeams.includes(action.teamId)) return state;
      return { ...state, phase: { ...phase, lockedTeams: [...phase.lockedTeams, action.teamId] } };
    case "clue:close": {
      if (phase.kind !== "clue") return state;
      const used =
        action.markUsed && !state.used.includes(phase.clueId) ? [...state.used, phase.clueId] : state.used;
      return { ...state, used, phase: { kind: "board" } };
    }
    case "clue:unuse":
      return { ...state, used: state.used.filter((id) => id !== action.clueId) };
    case "clue:judge": {
      if (phase.kind !== "clue" || phase.resolvedBy) return state;
      const found = findClue(board, phase.clueId);
      if (!found) return state;
      const dd = phase.dailyDouble;
      if (dd && dd.teamId !== action.teamId) return state;
      if (!dd && phase.lockedTeams.includes(action.teamId)) return state;
      const amount = dd ? (dd.wager ?? 0) : found.value;
      const teams = addScore(state.teams, action.teamId, action.correct ? amount : -amount);
      if (action.correct || dd) {
        const used = state.used.includes(phase.clueId) ? state.used : [...state.used, phase.clueId];
        return {
          ...state,
          teams,
          used,
          controlTeam: action.correct ? action.teamId : state.controlTeam,
          phase: { ...phase, revealed: true, resolvedBy: action.correct ? action.teamId : "none" },
        };
      }
      return { ...state, teams, phase: { ...phase, lockedTeams: [...phase.lockedTeams, action.teamId] } };
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

    case "game:reset":
      return {
        teams: state.teams.map((t) => ({ ...t, score: 0 })),
        used: [],
        phase: { kind: "board" },
        buzzMode: state.buzzMode,
        controlTeam: undefined,
      };
  }
}
