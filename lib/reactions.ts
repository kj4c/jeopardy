export const REACTIONS = ["😂", "💀", "💩", "🔥", "🤔", "❓", "🧌"] as const;

export type Reaction = { emoji: string; name: string; color?: string };

export const isReaction = (v: unknown): v is (typeof REACTIONS)[number] =>
  typeof v === "string" && (REACTIONS as readonly string[]).includes(v);
