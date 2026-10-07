"use client";

import { useState } from "react";
import type { GameAction, Team } from "@/lib/types";
import { Modal } from "../Modal";

export function TurnOrderDialog({
  teams,
  order,
  nextTeamId,
  dispatch,
  onClose,
}: {
  teams: Team[];
  order: string[];
  nextTeamId?: string;
  dispatch: (a: GameAction) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => {
    const ids = order.filter((id) => teams.some((t) => t.id === id));
    if (!ids.length) return teams.map((t) => t.id);
    const start = nextTeamId ? Math.max(0, ids.indexOf(nextTeamId)) : 0;
    return [...ids.slice(start), ...ids.slice(0, start)];
  });
  const byId = new Map(teams.map((t) => [t.id, t]));
  const left = teams.filter((t) => !draft.includes(t.id));
  const move = (i: number, delta: number) => {
    const next = [...draft];
    const [id] = next.splice(i, 1);
    next.splice(i + delta, 0, id);
    setDraft(next);
  };

  return (
    <Modal title="Turn order" subtitle="Countdown mode" onClose={onClose}>
      <p className="mb-6 text-lg text-muted">
        Teams pick tiles in this order, so the picking team is filled in for you. You can still change it on any clue.
      </p>
      <ol className="space-y-3">
        {draft.map((id, i) => {
          const t = byId.get(id);
          if (!t) return null;
          return (
            <li key={id} className="flex items-center gap-4 border border-line-strong px-4 py-3">
              <span className="w-6 font-mono text-muted">{i + 1}</span>
              <span className="h-4 w-4 shrink-0" style={{ background: t.color }} />
              <span className="min-w-0 flex-1 truncate text-xl font-medium">
                {t.name}
                {i === 0 && <span className="label ml-3 !text-coral">picks next</span>}
              </span>
              <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                ↑
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={i === draft.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDraft(draft.filter((x) => x !== id))} aria-label="Remove">
                ✕
              </button>
            </li>
          );
        })}
      </ol>
      {left.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-muted">Add:</span>
          {left.map((t) => (
            <button key={t.id} className="btn btn-ghost btn-sm" style={{ borderColor: t.color }} onClick={() => setDraft([...draft, t.id])}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-8 flex flex-wrap justify-end gap-3">
        {order.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              dispatch({ type: "settings:turn-order", order: [] });
              onClose();
            }}
          >
            Turn off
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={!draft.length}
          onClick={() => {
            dispatch({ type: "settings:turn-order", order: draft });
            onClose();
          }}
        >
          Use this order
        </button>
      </div>
    </Modal>
  );
}
