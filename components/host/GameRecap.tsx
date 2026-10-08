"use client";

import { formatScore } from "@/lib/board";
import type { GameStats, Team } from "@/lib/types";

type Award = { icon: string; title: string; who: string; color?: string; detail: string };

function best<T>(items: T[], score: (item: T) => number): T | undefined {
  let top: T | undefined;
  let topScore = 0;
  for (const item of items) {
    const s = score(item);
    if (s > topScore) [top, topScore] = [item, s];
  }
  return top;
}

function awards(stats: GameStats, teams: Team[]): Award[] {
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

/** Awards shown under the final standings. */
export function GameRecap({ stats, teams }: { stats?: GameStats; teams: Team[] }) {
  const list = stats ? awards(stats, teams) : [];
  if (!list.length) return null;
  return (
    <div className="w-full max-w-4xl">
      <p className="label mb-4">Game recap</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a, i) => (
          <div
            key={a.title}
            className="animate-pop flex items-center gap-4 border border-line bg-ink/60 px-5 py-4 text-left"
            style={{ animationDelay: `${0.8 + i * 0.15}s` }}
          >
            <span className="text-4xl">{a.icon}</span>
            <span className="min-w-0">
              <span className="label block">{a.title}</span>
              <span className="font-display block truncate text-2xl" style={{ color: a.color }}>
                {a.who}
              </span>
              <span className="block text-sm text-muted">{a.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
