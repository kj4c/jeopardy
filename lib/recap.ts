import { formatScore } from "./board";
import type { GameStats, Moment, Team } from "./types";

/** A milestone as text, with teams left as objects so they can be shown in their colour. */
export type MomentLine = { icon: string; parts: (string | Team)[]; where: string };

export function describeMoment(m: Moment, teams: Team[]): MomentLine | null {
  const team = teams.find((t) => t.id === m.teamId);
  if (!team) return null;
  const amount = formatScore(m.amount ?? 0);
  const where = m.round === "final" ? "Final" : m.round === "quickfire" ? `Quickfire ${m.n}` : `Tile ${m.n}`;
  const line = (icon: string, ...parts: (string | Team)[]) => ({ icon, parts, where });
  switch (m.kind) {
    case "first-blood":
      return line("🩸", team, ` drew first blood${m.amount ? ` with ${amount}` : ""}`);
    case "lead":
      return line("👑", team, " took the lead");
    case "milestone":
      return line("💵", team, ` hit ${amount}`);
    case "streak":
      return line("🔥", team, ` got ${m.amount} in a row`);
    case "dd-hit":
      return line("🎰", team, ` nailed a Daily Double (+${amount})`);
    case "dd-miss":
      return line("💸", team, ` missed a Daily Double (−${amount})`);
    case "steal": {
      const victim = teams.find((t) => t.id === m.otherTeamId);
      return victim ? line("🥷", team, ` stole ${amount} from `, victim) : line("🥷", team, ` stole ${amount}`);
    }
    case "below-zero":
      return line("📉", team, " dropped below $0");
    case "final-hit":
      return line("🏁", team, ` won ${amount} on Final Kashpot!`);
    case "final-miss":
      return line("🏁", team, ` lost ${amount} on Final Kashpot!`);
  }
}

export type Award = { icon: string; title: string; who: string; color?: string; detail: string };

function best<T>(items: T[], score: (item: T) => number): T | undefined {
  let top: T | undefined;
  let topScore = 0;
  for (const item of items) {
    const s = score(item);
    if (s > topScore) [top, topScore] = [item, s];
  }
  return top;
}

export function awards(stats: GameStats, teams: Team[]): Award[] {
  const team = (id: string) => teams.find((t) => t.id === id);
  const players = Object.values(stats.players ?? {}).filter((p) => team(p.teamId));
  const teamStats = Object.entries(stats.teams ?? {})
    .map(([id, s]) => ({ ...s, team: team(id)! }))
    .filter((s) => s.team);
  const list: Award[] = [];

  const brain = best(players, (p) => p.correct);
  if (brain) {
    list.push({
      icon: "🧠",
      title: "Most correct",
      who: brain.name,
      color: team(brain.teamId)?.color,
      detail: `${brain.correct} right answer${brain.correct === 1 ? "" : "s"}`,
    });
  }
  const quickest = best(players, (p) => (p.fastest === undefined ? 0 : 100_000 - p.fastest));
  if (quickest?.fastest !== undefined) {
    list.push({
      icon: "⚡",
      title: "Fastest buzz",
      who: quickest.name,
      color: team(quickest.teamId)?.color,
      detail: `${(quickest.fastest / 1000).toFixed(2)}s after buzzers opened`,
    });
  }
  const trigger = best(players, (p) => p.firsts);
  if (trigger && trigger.firsts > 1) {
    list.push({
      icon: "🔔",
      title: "Quickest finger",
      who: trigger.name,
      color: team(trigger.teamId)?.color,
      detail: `First to buzz ${trigger.firsts} times`,
    });
  }
  const bigShot = best(teamStats, (s) => s.best);
  if (bigShot) {
    list.push({
      icon: "💰",
      title: "Biggest win",
      who: bigShot.team.name,
      color: bigShot.team.color,
      detail: `+${formatScore(bigShot.best)} on one answer`,
    });
  }
  const comeback = best(teamStats, (s) => (s.low < 0 && s.team.score > s.low ? s.team.score - s.low : 0));
  if (comeback) {
    list.push({
      icon: "📈",
      title: "Biggest comeback",
      who: comeback.team.name,
      color: comeback.team.color,
      detail: `From ${formatScore(comeback.low)} to ${formatScore(comeback.team.score)}`,
    });
  }
  const thief = best(teamStats, (s) => s.steals);
  if (thief) {
    list.push({
      icon: "🥷",
      title: "Master thief",
      who: thief.team.name,
      color: thief.team.color,
      detail: `${thief.steals} successful steal${thief.steals === 1 ? "" : "s"}`,
    });
  }
  const sharp = best(
    teamStats.filter((s) => s.right + s.wrong >= 3),
    (s) => s.right / (s.right + s.wrong),
  );
  if (sharp) {
    list.push({
      icon: "🎯",
      title: "Sharpest team",
      who: sharp.team.name,
      color: sharp.team.color,
      detail: `${Math.round((sharp.right / (sharp.right + sharp.wrong)) * 100)}% correct (${sharp.right}/${sharp.right + sharp.wrong})`,
    });
  }
  return list;
}
