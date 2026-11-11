"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, ApiError } from "@/lib/api";
import { formatScore } from "@/lib/board";
import type { RoomSummary } from "@/lib/types";

type AdminRoom = RoomSummary & {
  board: { name: string; slug: string; hasPassword: boolean } | null;
  phase: string;
  teams: { name: string; color: string; score: number }[];
  tilesPlayed: number;
  activity: { players: number; hosts: number } | null;
};
type AdminBoard = { id: string; slug: string; name: string; updatedAt: number; hasPassword: boolean; rooms: number };
type Backup = { name: string; size: number; createdAt: number };
type Overview = { rooms: AdminRoom[]; boards: AdminBoard[]; backups: Backup[] };

const PHASES: Record<string, string> = {
  board: "On the board",
  clue: "Question open",
  quickfire: "Quickfire",
  final: "Final Kashpot!",
  ended: "Game over",
};
const REFRESH_MS = 10000;

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

const isLive = (r: AdminRoom) => !!r.activity && r.activity.players + r.activity.hosts > 0;

export default function AdminPage() {
  const [status, setStatus] = useState<{ enabled: boolean; authed: boolean } | null>(null);
  const refreshStatus = useCallback(() => {
    api<{ enabled: boolean; authed: boolean }>("/api/admin").then(setStatus).catch(() => setStatus({ enabled: false, authed: false }));
  }, []);
  useEffect(refreshStatus, [refreshStatus]);

  return (
    <main className="min-h-dvh">
      <GradientBackground waves={false} />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          <Link href="/" className="font-display text-xl sm:text-2xl">
            KASHMONEY<span className="text-coral">.</span>
          </Link>
          <div className="flex items-center gap-2">
            {status?.authed && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => api("/api/admin/logout", { method: "POST" }).then(refreshStatus)}
              >
                Sign out
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
        <p className="label mb-3">Admin</p>
        <h1 className="font-display mb-10 text-5xl md:text-6xl">All rooms</h1>
        {!status ? (
          <p className="text-muted">Loading…</p>
        ) : !status.enabled ? (
          <div className="panel max-w-xl p-6">
            <h2 className="font-display mb-2 text-2xl">The admin page is off</h2>
            <p className="text-muted">
              Add an <code className="font-mono text-cream">ADMIN_PASSWORD</code> variable to the server (in Railway: your
              service → Variables), redeploy, then come back here to sign in.
            </p>
          </div>
        ) : !status.authed ? (
          <SignIn onDone={refreshStatus} />
        ) : (
          <Dashboard onSignedOut={refreshStatus} />
        )}
      </section>
    </main>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel corner-marks flex max-w-md flex-col gap-3 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("/api/admin/login", { method: "POST", json: { password } });
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't sign in");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-display text-3xl">Sign in</h2>
      <p className="text-sm text-muted">Use the admin password set on the server.</p>
      <input
        className="field"
        type="password"
        placeholder="Admin password"
        value={password}
        autoFocus
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary" disabled={!password || busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Dashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [query, setQuery] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    api<Overview>("/api/admin/overview")
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onSignedOut();
      });
  }, [onSignedOut]);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <p className="text-muted">Loading…</p>;

  const q = query.trim().toLowerCase();
  const rooms = data.rooms.filter(
    (r) =>
      (!liveOnly || isLive(r)) &&
      (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q) || r.board?.name.toLowerCase().includes(q)),
  );
  const liveCount = data.rooms.filter(isLive).length;

  async function deleteRoom(r: AdminRoom) {
    if (!confirm(`Delete room "${r.name}"? A backup is made first.`)) return;
    await api(`/api/rooms/${r.slug}`, { method: "DELETE" });
    load();
  }

  async function deleteBoard(b: AdminBoard) {
    const rooms = b.rooms ? ` and its ${b.rooms} ${b.rooms === 1 ? "room" : "rooms"}` : "";
    if (!confirm(`Delete board "${b.name}"${rooms}? A backup is made first.`)) return;
    await api(`/api/boards/${b.id}`, { method: "DELETE" });
    load();
  }

  async function backupNow() {
    const { file } = await api<{ file: string }>("/api/admin/backups", { method: "POST" });
    setNotice(file ? `Saved ${file}` : "Backup failed");
    load();
  }

  return (
    <div className="space-y-14">
      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        <Stat label="Rooms" value={data.rooms.length} />
        <Stat label="Live now" value={liveCount} accent={liveCount > 0} />
        <Stat label="Boards" value={data.boards.length} />
        <Stat label="Backups" value={data.backups.length} />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="field max-w-xs flex-1"
            placeholder="Search rooms or boards"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[#ff7a6b]" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} />
            Live now only
          </label>
          <span className="label ml-auto">Refreshes every {REFRESH_MS / 1000}s</span>
        </div>
        {rooms.length === 0 ? (
          <p className="text-muted">{data.rooms.length ? "No rooms match." : "No rooms yet."}</p>
        ) : (
          <div className="divide-y divide-line border border-line bg-ink/60">
            {rooms.map((r) => (
              <RoomRow key={r.slug} room={r} onDelete={() => deleteRoom(r)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="label mb-4">Boards</p>
        <div className="divide-y divide-line border border-line bg-ink/60">
          {data.boards.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {b.hasPassword && <span title="Password protected">🔒 </span>}
                  {b.name}
                </p>
                <p className="font-mono text-xs text-muted">
                  /b/{b.slug} · {b.rooms} {b.rooms === 1 ? "room" : "rooms"} · edited {timeAgo(b.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Link href={`/b/${b.slug}`} className="btn btn-ghost btn-sm">
                  Edit
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteBoard(b)} title="Delete board">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="label">Backups · newest first</p>
          <div className="flex items-center gap-3">
            {notice && <span className="text-sm text-muted">{notice}</span>}
            <button className="btn btn-ghost btn-sm" onClick={backupNow}>
              Back up now
            </button>
          </div>
        </div>
        {data.backups.length === 0 ? (
          <p className="text-muted">No backups yet.</p>
        ) : (
          <div className="divide-y divide-line border border-line bg-ink/60">
            {data.backups.map((b) => (
              <div key={b.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{b.name}</p>
                  <p className="text-xs text-muted">
                    {new Date(b.createdAt).toLocaleString()} · {(b.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <a href={`/api/admin/backups/${encodeURIComponent(b.name)}`} className="btn btn-ghost btn-sm" download>
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-muted">
          To roll back, set <code className="font-mono text-cream">RESTORE_BACKUP</code> to a file name above and restart
          the server.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-ink px-5 py-4">
      <p className="label">{label}</p>
      <p className={`font-display text-4xl tabular-nums ${accent ? "text-good" : ""}`}>{value}</p>
    </div>
  );
}

function RoomRow({ room: r, onDelete }: { room: AdminRoom; onDelete: () => void }) {
  const live = isLive(r);
  return (
    <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          {live && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-good" title="Live now" />}
          <span className="truncate">{r.name}</span>
        </p>
        <p className="font-mono text-xs text-muted">
          /play/{r.slug} · {r.mode === "live" ? "live" : "in person"} ·{" "}
          {r.board ? (
            <>
              {r.board.hasPassword && "🔒 "}
              {r.board.name}
            </>
          ) : (
            "board deleted"
          )}
        </p>
        <p className="mt-1 text-xs text-muted">
          {PHASES[r.phase] ?? r.phase} · {r.tilesPlayed} {r.tilesPlayed === 1 ? "tile" : "tiles"} played ·{" "}
          {live && r.activity
            ? `${r.activity.players} ${r.activity.players === 1 ? "player" : "players"}${r.activity.hosts ? " · host on" : ""}`
            : `active ${timeAgo(r.updatedAt)}`}
        </p>
      </div>
      {r.teams.length > 0 && (
        <div className="flex flex-wrap gap-1.5 md:max-w-[40%] md:justify-end">
          {r.teams.map((t, i) => (
            <span key={i} className="border px-2 py-0.5 text-xs" style={{ borderColor: t.color }}>
              <span style={{ color: t.color }}>{t.name}</span> <span className="tabular-nums">{formatScore(t.score)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex shrink-0 gap-1">
        <Link href={`/host/${r.slug}`} className="btn btn-primary btn-sm">
          Host
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={onDelete} title="Delete room">
          ✕
        </button>
      </div>
    </div>
  );
}
