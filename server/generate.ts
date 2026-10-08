import type { FinalJeopardy } from "../lib/types";

export type GeneratedBoard = {
  categories: { title: string; clues: { question: string; answer: string; hint?: string }[] }[];
  final?: FinalJeopardy;
};

export class GenerateError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const HOURLY_LIMIT = 15;
const recent = new Map<string, number[]>();

/** Caps AI requests per board so a leaked link can't run up the API bill. */
function allowGeneration(boardId: string) {
  const now = Date.now();
  const times = (recent.get(boardId) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (times.length >= HOURLY_LIMIT) return false;
  recent.set(boardId, [...times, now]);
  return true;
}

const BOARD_TOOL = {
  name: "make_board",
  description: "Return the finished trivia board.",
  input_schema: {
    type: "object",
    required: ["categories", "final"],
    properties: {
      categories: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "clues"],
          properties: {
            title: { type: "string", description: "Short, punchy category name (max ~4 words)." },
            clues: {
              type: "array",
              description: "Easiest first, hardest last.",
              items: {
                type: "object",
                required: ["question", "answer", "hint"],
                properties: {
                  question: { type: "string", description: "The clue shown on the big screen." },
                  answer: { type: "string", description: "The correct response, short (a name, word or number)." },
                  hint: { type: "string", description: "A nudge for the Hint power-up that doesn't give the answer away." },
                },
              },
            },
          },
        },
      },
      final: {
        type: "object",
        required: ["category", "question", "answer"],
        properties: {
          category: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
  },
};

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function generateBoard(
  boardId: string,
  input: { topic?: string; categories?: number; rows?: number; audience?: string },
): Promise<GeneratedBoard> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new GenerateError(503, "AI isn't set up yet. Add ANTHROPIC_API_KEY to the server's environment.");
  const topic = text(input.topic, 300);
  if (!topic) throw new GenerateError(400, "Tell the AI what the board should be about.");
  const categories = Math.max(1, Math.min(8, Math.round(Number(input.categories) || 5)));
  const rows = Math.max(1, Math.min(8, Math.round(Number(input.rows) || 5)));
  const audience = text(input.audience, 100) || "a mixed group of adults at a party";
  if (!allowGeneration(boardId)) throw new GenerateError(429, "That's a lot of boards! Try again in an hour.");

  const prompt = [
    `Write a trivia board in the style of Jeopardy about: ${topic}`,
    `Players: ${audience}.`,
    `Exactly ${categories} categories with exactly ${rows} clues each, ordered from easiest to hardest.`,
    "Each clue is a statement or question shown on a big screen; the answer is the short correct response.",
    "Answers must be unambiguous and factually correct. Don't repeat an answer anywhere on the board.",
    "Make categories varied and fun; wordplay in category names is welcome.",
    "Also write one harder Final round clue on the same theme.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 8000,
      tools: [BOARD_TOOL],
      tool_choice: { type: "tool", name: BOARD_TOOL.name },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => {
    throw new GenerateError(502, "Couldn't reach the AI. Try again.");
  });
  if (!res.ok) {
    console.error("Anthropic error", res.status, await res.text().catch(() => ""));
    throw new GenerateError(502, res.status === 401 ? "The AI key was rejected. Check ANTHROPIC_API_KEY." : "The AI had a problem. Try again.");
  }
  const data = (await res.json()) as { content?: { type: string; input?: unknown }[] };
  const raw = data.content?.find((c) => c.type === "tool_use")?.input as Partial<GeneratedBoard> | undefined;
  const cats = Array.isArray(raw?.categories) ? raw.categories : [];
  const board: GeneratedBoard = {
    categories: cats.slice(0, categories).map((c) => ({
      title: text(c?.title, 80),
      clues: (Array.isArray(c?.clues) ? c.clues : []).slice(0, rows).map((cl) => ({
        question: text(cl?.question, 600),
        answer: text(cl?.answer, 200),
        hint: text(cl?.hint, 300) || undefined,
      })),
    })),
    final: raw?.final
      ? { category: text(raw.final.category, 80), question: text(raw.final.question, 600), answer: text(raw.final.answer, 200) }
      : undefined,
  };
  if (!board.categories.length) throw new GenerateError(502, "The AI didn't return a board. Try again.");
  return board;
}
