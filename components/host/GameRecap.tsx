"use client";

import { useState } from "react";
import { formatScore } from "@/lib/board";
import { awards, describeMoment } from "@/lib/recap";
import type { GameStats, Team, TeamStats } from "@/lib/types";

const MOMENTS_SHOWN = 10;

/** Awards, per-team numbers and the game's milestones, shown under the final standings. */
export function GameRecap({ stats, teams }: { stats?: GameStats; teams: Team[] }) {
  if (!stats) return null;
  const list = awards(stats, teams);
  return (
    <div className="flex w-full max-w-5xl flex-col gap-12">
      {list.length > 0 && (
        <div>
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
      )}
      <TeamStatsTable stats={stats} teams={teams} />
      <Milestones stats={stats} teams={teams} />
    </div>
  );
}

const dash = (n: number | undefined, fmt: (n: number) => string = String) => (n === undefined ? "–" : fmt(n));

const COLUMNS: { label: string; title?: string; value: (s: TeamStats) => string }[] = [
  { label: "Right", value: (s) => String(s.right) },
  { label: "Wrong", value: (s) => String(s.wrong) },
  {
    label: "Accuracy",
    value: (s) => (s.right + s.wrong ? `${Math.round((s.right / (s.right + s.wrong)) * 100)}%` : "–"),
  },
  { label: "Best streak", title: "Most tiles won in a row", value: (s) => dash(s.bestStreak) },
  { label: "Won", title: "Points won on correct answers", value: (s) => dash(s.earned, (n) => `+${formatScore(n)}`) },
  { label: "Lost", title: "Points lost on wrong answers", value: (s) => dash(s.lost, (n) => (n ? `−${formatScore(n)}` : "$0")) },
  { label: "Biggest", title: "Biggest gain from one answer", value: (s) => (s.best ? `+${formatScore(s.best)}` : "–") },
  { label: "Peak", value: (s) => dash(s.high, formatScore) },
  { label: "Lowest", value: (s) => formatScore(s.low) },
  {
    label: "Daily Doubles",
    title: "Right out of attempted",
    value: (s) => (s.ddRight === undefined ? "–" : s.ddRight + (s.ddWrong ?? 0) ? `${s.ddRight}/${s.ddRight + (s.ddWrong ?? 0)}` : "–"),
  },
  { label: "Power-ups", title: "Power-ups used", value: (s) => dash(s.powers) },
  { label: "Steals", value: (s) => String(s.steals) },
];

function TeamStatsTable({ stats, teams }: { stats: GameStats; teams: Team[] }) {
  const rows = [...teams].sort((a, b) => b.score - a.score).map((t) => ({ team: t, s: stats.teams?.[t.id] }));
  if (!rows.some((r) => r.s)) return null;
  return (
    <div className="text-left">
      <p className="label mb-4">Team stats</p>
      <div className="overflow-x-auto border border-line bg-ink/60">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line">
              <th className="label sticky left-0 bg-ink px-4 py-3 text-left align-bottom font-normal">Team</th>
              <th className="label px-2 py-3 text-right align-bottom font-normal">Score</th>
              {COLUMNS.map((c) => (
                <th key={c.label} className="label px-2 py-3 text-right align-bottom font-normal" title={c.title}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ team, s }) => (
              <tr key={team.id} className="border-b border-line last:border-0">
                <td className="sticky left-0 whitespace-nowrap bg-ink px-4 py-3 font-medium" style={{ color: team.color }}>
                  {team.name}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right font-bold">{formatScore(team.score)}</td>
                {COLUMNS.map((c) => (
                  <td key={c.label} className="whitespace-nowrap px-2 py-3 text-right text-cream/85">
                    {s ? c.value(s) : "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Milestones({ stats, teams }: { stats: GameStats; teams: Team[] }) {
  const [showAll, setShowAll] = useState(false);
  const lines = (stats.moments ?? []).map((m) => describeMoment(m, teams)).filter((l) => l !== null);
  if (!lines.length) return null;
  const shown = showAll ? lines : lines.slice(0, MOMENTS_SHOWN);
  return (
    <div className="text-left">
      <p className="label mb-4">Milestones</p>
      <ol className="border-l border-line-strong">
        {shown.map((l, i) => (
          <li key={i} className="relative flex items-center gap-4 py-2 pl-6">
            <span className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="w-24 shrink-0 font-mono text-xs uppercase text-muted">{l.where}</span>
            <span className="text-2xl">{l.icon}</span>
            <span className="text-lg">
              {l.parts.map((p, j) =>
                typeof p === "string" ? (
                  <span key={j}>{p}</span>
                ) : (
                  <span key={j} className="font-medium" style={{ color: p.color }}>
                    {p.name}
                  </span>
                ),
              )}
            </span>
          </li>
        ))}
      </ol>
      {lines.length > MOMENTS_SHOWN && (
        <button className="btn btn-ghost btn-sm mt-4" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${lines.length}`}
        </button>
      )}
    </div>
  );
}
