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

export type Board = {
  id: string;
  /** Permanent URL name: /b/<slug>. */
  slug: string;
  name: string;
  hasPassword?: boolean;
  categories: Category[];
  rowValues: number[];
  finalJeopardy?: FinalJeopardy;
  updatedAt?: number;
};

export type Team = { id: string; name: string; color: string; score: number };

export type CluePhase = {
  kind: "clue";
  clueId: string;
  revealed: boolean;
  lockedTeams: string[];
  resolvedBy?: string;
  dailyDouble?: { teamId?: string; wager?: number };
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

export type Phase = { kind: "board" } | CluePhase | FinalPhase;

export type GameState = {
  teams: Team[];
  used: string[];
  phase: Phase;
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
  teams: Team[];
  players: Player[];
  buzz: BuzzState;
  phase:
    | { kind: "board" }
    | {
        kind: "clue";
        category: string;
        value: number;
        lockedTeams: string[];
        revealed: boolean;
        resolvedBy?: string;
        dailyDouble?: { teamId?: string; wager?: number; maxWager?: number };
      }
    | {
        kind: "final";
        step: FinalStep;
        category: string;
        eligible: string[];
        wagers: Record<string, { by?: string; amount?: number }>;
        answers: Record<string, { by?: string }>;
      };
};

export type GameAction =
  | { type: "team:add"; name: string; color: string }
  | { type: "team:update"; teamId: string; name?: string; color?: string }
  | { type: "team:remove"; teamId: string }
  | { type: "score:adjust"; teamId: string; delta: number }
  | { type: "clue:open"; clueId: string }
  | { type: "clue:reveal" }
  | { type: "clue:hide" }
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
  | { type: "game:reset" };
