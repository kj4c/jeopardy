"use client";

import { useState } from "react";
import { formatScore, TEAM_COLORS } from "@/lib/board";
import type { GameAction, Player, Team } from "@/lib/types";

export function Scoreboard({
  teams,
  players,
  step,
  dispatch,
  highlight,
}: {
  teams: Team[];
  players?: Player[];
  step: number;
  dispatch: (a: GameAction) => void;
  highlight?: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="border-t border-line bg-ink/70 backdrop-blur-md">
      <div className="flex items-stretch overflow-x-auto">
        {teams.map((team) => {
          const count = players?.filter((p) => p.teamId === team.id && p.connected).length;
          return (
            <div
              key={team.id}
              className={`relative min-w-44 flex-1 border-r border-line px-5 py-3 transition ${
                highlight === team.id ? "bg-cream/5" : ""
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: team.color }} />
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={team.color}
                    onChange={(e) => dispatch({ type: "team:update", teamId: team.id, color: e.target.value })}
                    className="h-8 w-8 shrink-0 cursor-pointer border border-line-strong bg-transparent p-0.5"
                  />
                  <input
                    className="field py-1"
                    value={team.name}
                    onChange={(e) => dispatch({ type: "team:update", teamId: team.id, name: e.target.value })}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => confirm(`Remove ${team.name}?`) && dispatch({ type: "team:remove", teamId: team.id })}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <p className="label flex items-center gap-2 !text-cream/80">
                  {team.name}
                  {count !== undefined && <span className="text-muted">· {count} online</span>}
                </p>
              )}
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className={`text-3xl font-bold tabular-nums ${team.score < 0 ? "text-bad" : ""}`}>
                  {formatScore(team.score)}
                </span>
                <div className="flex gap-1">
                  <button
                    className="btn btn-ghost btn-sm px-2.5"
                    onClick={() => dispatch({ type: "score:adjust", teamId: team.id, delta: -step })}
                    aria-label={`Subtract ${step}`}
                  >
                    −
                  </button>
                  <button
                    className="btn btn-ghost btn-sm px-2.5"
                    onClick={() => dispatch({ type: "score:adjust", teamId: team.id, delta: step })}
                    aria-label={`Add ${step}`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex shrink-0 flex-col justify-center gap-1 px-3">
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
            {editing ? "Done" : "Edit teams"}
          </button>
          {editing && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                dispatch({
                  type: "team:add",
                  name: `Team ${teams.length + 1}`,
                  color: TEAM_COLORS[teams.length % TEAM_COLORS.length],
                })
              }
            >
              + Team
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
