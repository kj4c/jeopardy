"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { slugify, TEAM_COLORS } from "@/lib/board";
import type { Room, RoomMode, RoomSummary } from "@/lib/types";
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
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const slug = slugify(name);

  useEffect(() => {
    api<RoomSummary[]>(`/api/boards/${boardId}/rooms`).then(setRooms).catch(() => {});
  }, [boardId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const room = await api<Room>("/api/rooms", { method: "POST", json: { name, boardId, mode, teams } });
      router.push(`/host/${room.slug}?intro`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Start a game" subtitle={boardName}>
      {rooms.length > 0 && (
        <div className="mb-6 border-b border-line pb-6">
          <p className="label mb-2">Resume a game · uses your latest edits</p>
          <ul className="divide-y divide-line border border-line">
            {rooms.map((r) => (
              <li key={r.slug} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="font-mono text-xs text-muted">
                    /play/{r.slug} · {r.mode === "live" ? "live" : "in person"}
                  </p>
                </div>
                <Link href={`/host/${r.slug}?intro`} className="btn btn-primary btn-sm shrink-0">
                  Resume
                </Link>
              </li>
            ))}
          </ul>
          <p className="label mt-6">Or start a new game</p>
        </div>
      )}
      <form onSubmit={create} className="space-y-6">
        <div>
          <label className="label mb-2 block">Room name</label>
          <input
            className="field"
            placeholder="e.g. Friday trivia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={rooms.length === 0}
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
