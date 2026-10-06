"use client";

import { formatScore } from "@/lib/board";
import type { Team } from "@/lib/types";

export function Standings({ teams, title = "Champion" }: { teams: Team[]; title?: string }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const tied = sorted.length > 1 && sorted[1].score === winner?.score;
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-8">
      {winner && (
        <div className="animate-pop">
          <p className="label mb-3">{tied ? "Tied at the top" : title}</p>
          <h1 className="font-display text-[clamp(3.5rem,9vw,9rem)]" style={{ color: winner.color }}>
            {tied
              ? sorted
                  .filter((t) => t.score === winner.score)
                  .map((t) => t.name)
                  .join(" & ")
              : winner.name}
          </h1>
        </div>
      )}
      <ol className="w-full divide-y divide-line border border-line">
        {sorted.map((t, i) => (
          <li key={t.id} className="flex items-center gap-4 bg-ink/60 px-6 py-4">
            <span className="w-6 font-mono text-muted">{i + 1}</span>
            <span className="h-3 w-3" style={{ background: t.color }} />
            <span className="flex-1 text-left text-xl">{t.name}</span>
            <span className="text-2xl font-bold tabular-nums">{formatScore(t.score)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
