import type { Board, Category, Clue, GameState, Media } from "./types";

export function newId(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix + rand;
}

export function emptyClue(): Clue {
  return { id: newId("c_"), question: "", answer: "" };
}

export function emptyCategory(rows: number, title = ""): Category {
  return { id: newId("cat_"), title, clues: Array.from({ length: rows }, emptyClue) };
}

export function defaultBoard(name = "Untitled board"): Omit<Board, "id" | "slug"> {
  const rowValues = [200, 400, 600, 800, 1000];
  return {
    name,
    rowValues,
    categories: Array.from({ length: 5 }, (_, i) => emptyCategory(rowValues.length, `Category ${i + 1}`)),
    finalJeopardy: { category: "", question: "", answer: "" },
  };
}

export function findClue(board: Board, clueId: string) {
  for (const category of board.categories) {
    const row = category.clues.findIndex((c) => c.id === clueId);
    if (row !== -1) {
      return { clue: category.clues[row], category, row, value: board.rowValues[row] ?? 0 };
    }
  }
  return null;
}

export function maxRowValue(board: Board): number {
  return board.rowValues.length ? Math.max(...board.rowValues) : 0;
}

export function parseYouTube(input: string): Media | null {
  const text = input.trim();
  if (!text) return null;
  if (/^[\w-]{11}$/.test(text)) return { type: "youtube", videoId: text };
  let url: URL;
  try {
    url = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let videoId: string | null = null;
  if (host === "youtu.be") {
    videoId = url.pathname.slice(1).split("/")[0];
  } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    if (url.pathname === "/watch") videoId = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      videoId = match?.[1] ?? null;
    }
  }
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;
  const t = url.searchParams.get("t") ?? url.searchParams.get("start");
  const start = t ? parseTimestamp(t) : undefined;
  return { type: "youtube", videoId, ...(start ? { start } : {}) };
}

function parseTimestamp(t: string): number | undefined {
  if (/^\d+$/.test(t)) return Number(t);
  const match = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return undefined;
  const [, h, m, s] = match;
  const total = Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  return total || undefined;
}

export function youtubeUrl(media: Extract<Media, { type: "youtube" }>): string {
  return `https://youtu.be/${media.videoId}${media.start ? `?t=${media.start}` : ""}`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const TEAM_COLORS = ["#ff4f9a", "#3b6bff", "#f5a14a", "#22d3a6", "#a66bff", "#ff6b5b", "#e8d44d", "#38bdf8"];

export function initialGameState(teams: { name: string; color: string }[]): GameState {
  return {
    teams: teams.map((t) => ({ id: newId("t_"), name: t.name, color: t.color, score: 0 })),
    used: [],
    phase: { kind: "board" },
  };
}

export function formatScore(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US")}`;
}
