export type Media =
  | { type: "image"; src: string }
  | { type: "youtube"; videoId: string; start?: number };

export type Clue = {
  id: string;
  question: string;
  answer: string;
  media?: Media;
  answerMedia?: Media;
  dailyDouble?: boolean;
  /** Shown on the host screen when a team uses a Hint power-up. */
  hint?: string;
  /** Hidden power-up awarded to the team that wins this tile. */
  powerup?: PowerType;
};

export type Category = {
  id: string;
  title: string;
  /** One clue per row; index matches `Board.rowValues`. */
  clues: Clue[];
};

export type FinalJeopardy = {
  category: string;
  question: string;
  answer: string;
  media?: Media;
};

export type QuickfireQuestion = {
  id: string;
  question: string;
  answer: string;
  media?: Media;
};

/** Rapid-fire round: every question is worth the same, first buzz answers, no steals. */
export type Quickfire = {
  points: number;
  /** Subtract the points for a wrong answer. */
  penalty?: boolean;
  questions: QuickfireQuestion[];
};

export type Board = {
  id: string;
  /** Permanent URL name: /b/<slug>. */
  slug: string;
  name: string;
  hasPassword?: boolean;
  categories: Category[];
  rowValues: number[];
  finalJeopardy?: FinalJeopardy;
  quickfire?: Quickfire;
  updatedAt?: number;
};

export type PowerType = "bet" | "double" | "block" | "duel" | "rng" | "second" | "hint";

/** One side of a 1v1. Without a player id, anyone on the team can buzz. */
export type Duelist = { teamId: string; playerId?: string; name?: string };

export type Team = {
  id: string;
  name: string;
  color: string;
  score: number;
  /** Power-ups the team holds, by type. */
  powers?: Partial<Record<PowerType, number>>;
  /** True once the team leader has drafted their starting power-ups. */
  drafted?: boolean;
};

export type PowerSettings = {
  /** Power-ups in play. Empty turns the feature off. */
  enabled: PowerType[];
  /** How many power-ups each team leader drafts. */
  draftCount: number;
};

/** Board-phase power-up waiting to apply to the next question. */
export type QueuedPower = {
  teamId: string;
  power: "bet" | "double" | "block" | "duel";
  targetTeamId?: string;
  /** For a 1v1: the challenger first, then the opponent. */
  duel?: [Duelist, Duelist];
};

export type PowerEffects = {
  /** Teams betting against whoever answers next. */
  bets: string[];
  doubled: string[];
  /** Teams that can't buzz or answer this question, with the team that blocked them. */
  blocked: { teamId: string; by: string }[];
  /** Teams with an unused second answer. */
  second: string[];
  /** Teams that used their second answer already. */
  retried: string[];
  hints: string[];
  /** Only these two can buzz; a correct answer takes the points from the other side. */
  duel?: [Duelist, Duelist];
};

export type PowerNotice = {
  id: string;
  teamId: string;
  power: PowerType;
  kind: "used" | "found";
  targetTeamId?: string;
  detail?: string;
};

export type CluePhase = {
  kind: "clue";
  clueId: string;
  revealed: boolean;
  lockedTeams: string[];
  resolvedBy?: string;
  dailyDouble?: { teamId?: string; wager?: number };
  /** Instant buzz mode hides the question from the big screen once someone buzzes. */
  questionHidden?: boolean;
  /** Countdown mode: the team that chose this tile answers first, before anyone can buzz. */
  pickedBy?: string;
  /** Random question power-up: `teamId` must answer first (no passing), in either buzz mode. */
  forced?: { teamId: string; by: string };
  effects?: PowerEffects;
  /** Team that won this tile's hidden power-up. */
  powerFoundBy?: string;
};

export type FinalStep = "wager" | "clue" | "reveal" | "done";

export type FinalPhase = {
  kind: "final";
  step: FinalStep;
  eligible: string[];
  wagers: Record<string, { amount: number; by?: string }>;
  answers: Record<string, { text: string; by?: string }>;
  revealed: string[];
  judged: Record<string, boolean>;
};

export type QuickfirePhase = {
  kind: "quickfire";
  /** Equal to the question count once every question has been played. */
  index: number;
  revealed: boolean;
  /** Team that answered correctly, or "none" after a miss or skip. */
  resolvedBy?: string;
  /** Team that answered wrong; nobody can steal. */
  missedBy?: string;
};

export type Phase = { kind: "board" } | CluePhase | FinalPhase | QuickfirePhase | { kind: "ended" };

/**
 * "countdown": the team that picked the tile answers first; if they miss or pass, the host counts down for everyone else.
 * "instant" (free for all): buzzers open as soon as a clue shows.
 */
export type BuzzMode = "countdown" | "instant";

export type GameState = {
  teams: Team[];
  used: string[];
  phase: Phase;
  buzzMode?: BuzzMode;
  /** Last team to answer correctly; they pick the next tile in countdown mode. */
  controlTeam?: string;
  /** Next quickfire question, so leaving the round and coming back continues where it stopped. */
  quickfireNext?: number;
  powerSettings?: PowerSettings;
  queued?: QueuedPower[];
  powerNotice?: PowerNotice;
};

export type RoomMode = "live" | "local";

export type RoomSummary = {
  slug: string;
  name: string;
  boardId: string;
  mode: RoomMode;
  createdAt: number;
  updatedAt: number;
};

export type Room = RoomSummary & { state: GameState };

export type Player = {
  id: string;
  name: string;
  teamId: string | null;
  connected: boolean;
  /** First player to join the team; the only one who can draft and use power-ups. */
  leader?: boolean;
};

export type BuzzEntry = {
  playerId: string;
  name: string;
  teamId: string;
  /** Milliseconds after buzzers armed, latency-adjusted. */
  time: number;
};

export type BuzzState = {
  status: "idle" | "countdown" | "armed";
  count?: number;
  buzzes: BuzzEntry[];
};

/** What the host screen receives in live mode. */
export type HostSnapshot = {
  room: Room;
  board: Board;
  players: Player[];
  buzz: BuzzState;
};

/** What phones receive. Never includes answers. */
export type PublicSnapshot = {
  slug: string;
  name: string;
  mode: RoomMode;
  buzzMode: BuzzMode;
  teams: Team[];
  players: Player[];
  buzz: BuzzState;
  powerSettings?: PowerSettings;
  queued: QueuedPower[];
  powerNotice?: PowerNotice;
  /** Team currently answering a regular clue, if any. */
  answeringTeam?: string;
  phase:
    | { kind: "board" }
    | {
        kind: "clue";
        category: string;
        value: number;
        lockedTeams: string[];
        revealed: boolean;
        resolvedBy?: string;
        pickedBy?: string;
        forced?: { teamId: string; by: string };
        effects?: PowerEffects;
        powerFoundBy?: string;
        dailyDouble?: { teamId?: string; wager?: number; maxWager?: number };
      }
    | {
        kind: "final";
        step: FinalStep;
        category: string;
        eligible: string[];
        wagers: Record<string, { by?: string; amount?: number }>;
        answers: Record<string, { by?: string }>;
      }
    | {
        kind: "quickfire";
        index: number;
        total: number;
        points: number;
        resolvedBy?: string;
        missedBy?: string;
      }
    | { kind: "ended" };
};

export type GameAction =
  | { type: "team:add"; name: string; color: string }
  | { type: "team:update"; teamId: string; name?: string; color?: string }
  | { type: "team:remove"; teamId: string }
  | { type: "score:adjust"; teamId: string; delta: number }
  | { type: "clue:open"; clueId: string }
  | { type: "clue:reveal" }
  | { type: "clue:hide" }
  | { type: "clue:question"; hidden: boolean }
  | { type: "clue:pick"; teamId: string | null }
  | { type: "clue:pass"; teamId: string }
  | { type: "settings:buzz-mode"; mode: BuzzMode }
  | { type: "clue:close"; markUsed: boolean }
  | { type: "clue:judge"; teamId: string; correct: boolean }
  | { type: "clue:unuse"; clueId: string }
  | { type: "dd:assign"; teamId: string }
  | { type: "dd:wager"; amount: number }
  | { type: "final:start" }
  | { type: "final:step"; step: FinalStep }
  | { type: "final:wager"; teamId: string; amount: number; by?: string }
  | { type: "final:answer"; teamId: string; text: string; by?: string }
  | { type: "final:reveal"; teamId: string }
  | { type: "final:judge"; teamId: string; correct: boolean }
  | { type: "final:exit" }
  | { type: "quickfire:start" }
  | { type: "quickfire:judge"; teamId: string; correct: boolean }
  | { type: "quickfire:skip" }
  | { type: "quickfire:reveal" }
  | { type: "quickfire:next" }
  | { type: "power:settings"; enabled: PowerType[]; draftCount: number }
  | { type: "power:draft"; teamId: string; picks: PowerType[] }
  | { type: "power:give"; teamId: string; power: PowerType; delta: number }
  | {
      type: "power:use";
      teamId: string;
      power: PowerType;
      targetTeamId?: string;
      /** 1v1 players; the server fills in names. */
      duel?: { playerId?: string; playerName?: string; targetPlayerId?: string; targetPlayerName?: string };
    }
  | { type: "game:board" }
  | { type: "game:end" }
  | { type: "game:reset" };
