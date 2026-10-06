"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { slugify, TEAM_COLORS } from "@/lib/board";
import type { Room, RoomMode } from "@/lib/types";
import { Modal } from "./Modal";

export function StartGameDialog({
  boardId,
  boardName,
  onClose,
}: {
  boardId: string;
  boardName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RoomMode>("live");
  const [teams, setTeams] = useState([
    { name: "Team 1", color: TEAM_COLORS[0] },
    { name: "Team 2", color: TEAM_COLORS[1] },
    { name: "Team 3", color: TEAM_COLORS[2] },
  ]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const slug = slugify(name);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const room = await api<Room>("/api/rooms", { method: "POST", json: { name, boardId, mode, teams } });
      router.push(`/host/${room.slug}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Start a game" subtitle={boardName}>
      <form onSubmit={create} className="space-y-6">
        <div>
          <label className="label mb-2 block">Room name</label>
          <input
            className="field"
            placeholder="e.g. Friday trivia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="mt-2 font-mono text-xs text-muted">
            Players join at{" "}
            <span className="text-cream">
              /play/{slug || "your-room-name"}
            </span>{" "}
            · the link stays the same every time
          </p>
        </div>

        <div>
          <label className="label mb-2 block">How are you playing?</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["live", "Live room", "Players join on their phones, pick a team and buzz in."],
                ["local", "In person", "No phones. You run everything and pick who answered."],
              ] as const
            ).map(([value, title, body]) => (
              <button
                type="button"
                key={value}
                onClick={() => setMode(value)}
                className={`border p-4 text-left transition ${
                  mode === value ? "border-coral bg-coral/10" : "border-line-strong hover:border-cream/30"
                }`}
              >
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label mb-2 block">Teams</label>
          <div className="space-y-2">
            {teams.map((team, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={team.color}
                  onChange={(e) => setTeams(teams.map((t, j) => (j === i ? { ...t, color: e.target.value } : t)))}
                  className="h-10 w-10 shrink-0 cursor-pointer border border-line-strong bg-transparent p-1"
                />
                <input
                  className="field"
                  value={team.name}
                  onChange={(e) => setTeams(teams.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)))}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTeams(teams.filter((_, j) => j !== i))}
                  aria-label="Remove team"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-3"
            onClick={() =>
              setTeams([
                ...teams,
                { name: `Team ${teams.length + 1}`, color: TEAM_COLORS[teams.length % TEAM_COLORS.length] },
              ])
            }
          >
            + Add team
          </button>
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-5">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !slug}>
            {busy ? "Creating…" : "Open room"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
