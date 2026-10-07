import type { PowerType } from "./types";

export type PowerInfo = {
  id: PowerType;
  name: string;
  icon: string;
  /**
   * "board": used before the next question is picked. "answer": used once your team is answering.
   * "anytime": whenever you like, even mid-question.
   */
  timing: "board" | "answer" | "anytime";
  description: string;
  needsTarget?: boolean;
};

export const POWERS: Record<PowerType, PowerInfo> = {
  bet: {
    id: "bet",
    name: "Bet against",
    icon: "🎲",
    timing: "board",
    description: "Next question: if the first other team to answer gets it wrong, you win its value. If they get it right, you lose it.",
  },
  double: {
    id: "double",
    name: "Double",
    icon: "2×",
    timing: "board",
    description: "Next question: double points if you get it right, double loss if you get it wrong.",
  },
  block: {
    id: "block",
    name: "Block",
    icon: "⛔",
    timing: "board",
    description: "Next question: stop a team from buzzing in.",
    needsTarget: true,
  },
  duel: {
    id: "duel",
    name: "1v1",
    icon: "⚔️",
    timing: "board",
    description:
      "Next question: one of your players faces one player from another team. Only they can buzz. Right takes the points from the other; both wrong, nobody loses.",
    needsTarget: true,
  },
  rng: {
    id: "rng",
    name: "Random question",
    icon: "🎰",
    timing: "board",
    description:
      "Send another team a random question they must answer, whatever it's worth. Others can only buzz in after they answer.",
    needsTarget: true,
  },
  steal: {
    id: "steal",
    name: "Steal",
    icon: "🥷",
    timing: "anytime",
    description:
      "Secret. The next time another team answers, you get their points instead, or their loss if they get it wrong. Nobody knows until it happens.",
  },
  second: {
    id: "second",
    name: "Second answer",
    icon: "🔁",
    timing: "answer",
    description: "Answer twice. Lose points only if both answers are wrong.",
  },
  hint: {
    id: "hint",
    name: "Hint",
    icon: "💡",
    timing: "answer",
    description: "Ask the host for a hint before answering.",
  },
};

export const POWER_TYPES = Object.keys(POWERS) as PowerType[];

export function isPowerType(value: unknown): value is PowerType {
  return typeof value === "string" && value in POWERS;
}

export function powerCount(powers: Partial<Record<PowerType, number>> | undefined) {
  return Object.values(powers ?? {}).reduce((sum, n) => sum + (n ?? 0), 0);
}
