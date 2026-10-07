"use client";

import { POWER_TYPES, POWERS } from "@/lib/powers";
import type { GameAction, Player, PowerSettings, Team } from "@/lib/types";
import { Modal } from "../Modal";

export function PowerupsDialog({
  settings,
  teams,
  players,
  dispatch,
  onClose,
}: {
  settings?: PowerSettings;
  teams: Team[];
  players?: Player[];
  dispatch: (a: GameAction) => void;
  onClose: () => void;
}) {
  const enabled = settings?.enabled ?? [];
  const draftCount = settings?.draftCount ?? 2;
  const columns = POWER_TYPES.filter((id) => enabled.includes(id) || teams.some((t) => t.powers?.[id]));

  const setSettings = (next: Partial<PowerSettings>) =>
    dispatch({ type: "power:settings", enabled, draftCount, ...next });

  return (
    <Modal title="Power-ups" subtitle="Team leaders draft and use these from their phones" onClose={onClose} wide="xl">
      <div className="space-y-10">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <p className="label !text-sm">Choose what&apos;s in play</p>
            <label className="flex items-center gap-4">
              <span className="text-right">
                <span className="block text-lg font-medium">Each team drafts</span>
                <span className="text-sm text-muted">Picked by the team leader</span>
              </span>
              <input
                type="number"
                min={0}
                max={10}
                className="field w-20 text-center text-xl"
                value={draftCount}
                onChange={(e) => setSettings({ draftCount: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {POWER_TYPES.map((id) => {
              const p = POWERS[id];
              const on = enabled.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => setSettings({ enabled: on ? enabled.filter((x) => x !== id) : [...enabled, id] })}
                  className={`flex flex-col gap-3 border-2 p-5 text-left transition ${
                    on ? "border-coral bg-coral/10" : "border-line-strong opacity-60 hover:opacity-100"
                  }`}
                  aria-pressed={on}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-3xl">{p.icon}</span>
                    <span className={`label ${on ? "!text-coral" : ""}`}>{on ? "In play" : "Off"}</span>
                  </span>
                  <span>
                    <span className="block text-xl font-semibold">{p.name}</span>
                    <span className="label">{p.timing === "board" ? "Before the question" : p.timing === "anytime" ? "Any time · secret" : "Before answering"}</span>
                  </span>
                  <span className="text-base leading-relaxed text-muted">{p.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="label mb-4 !text-sm">Teams</p>
          {columns.length === 0 ? (
            <p className="text-muted">Turn on at least one power-up to see team inventories.</p>
          ) : (
            <div className="overflow-x-auto border border-line">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-5 py-4 font-normal">
                      <span className="label">Team</span>
                    </th>
                    {columns.map((id) => (
                      <th key={id} className="px-3 py-4 text-center font-normal">
                        <span className="block text-2xl">{POWERS[id].icon}</span>
                        <span className="text-sm text-muted">{POWERS[id].name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {teams.map((t) => {
                    const leader = players?.find((p) => p.teamId === t.id && p.leader);
                    return (
                      <tr key={t.id}>
                        <td className="px-5 py-4 align-middle">
                          <span className="flex items-center gap-2 text-lg font-semibold">
                            <span className="h-3 w-3 shrink-0" style={{ background: t.color }} />
                            {t.name}
                          </span>
                          <span className="text-sm text-muted">
                            {leader ? `Leader: ${leader.name}` : players ? "No players yet" : "In person"}
                            {enabled.length > 0 && (t.drafted ? " · drafted" : " · not drafted")}
                          </span>
                        </td>
                        {columns.map((id) => (
                          <td key={id} className="px-3 py-4 text-center align-middle">
                            <PowerCell
                              count={t.powers?.[id] ?? 0}
                              onAdjust={(delta) => dispatch({ type: "power:give", teamId: t.id, power: id, delta })}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-sm text-muted">Use − / + to fix a team&apos;s counts.</p>
        </section>
      </div>
    </Modal>
  );
}

function PowerCell({ count, onAdjust }: { count: number; onAdjust: (delta: number) => void }) {
  return (
    <div className="inline-flex items-center gap-1">
        <button
          className="h-8 w-8 border border-line-strong text-lg hover:bg-cream/10 disabled:opacity-30"
          onClick={() => onAdjust(-1)}
          disabled={!count}
          aria-label="Remove one"
        >
          −
        </button>
        <span className={`w-8 text-center text-xl font-bold tabular-nums ${count ? "" : "text-muted"}`}>{count}</span>
        <button className="h-8 w-8 border border-line-strong text-lg hover:bg-cream/10" onClick={() => onAdjust(1)} aria-label="Add one">
        +
      </button>
    </div>
  );
}
