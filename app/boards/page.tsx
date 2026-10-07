"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { StartGameDialog } from "@/components/StartGameDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { slugify } from "@/lib/board";
import type { Board, RoomSummary } from "@/lib/types";

type BoardListItem = {
  id: string;
  slug: string;
  name: string;
  updatedAt: number;
  hasPassword: boolean;
  rooms: RoomSummary[];
};

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<BoardListItem[] | null>(null);
  const [starting, setStarting] = useState<BoardListItem | null>(null);

  const load = useCallback(() => {
    api<BoardListItem[]>("/api/boards").then(setBoards).catch(() => setBoards([]));
  }, []);
  useEffect(load, [load]);

  async function act(path: string, method: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    await api(path, { method });
    load();
  }

  return (
    <main className="min-h-dvh">
      <GradientBackground waves={false} />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          <Link href="/" className="font-display text-2xl">
            Jeopardy<span className="text-coral">.</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
        <p className="label mb-3">Host</p>
        <h1 className="font-display mb-10 text-5xl md:text-6xl">Boards</h1>

        <div className="grid gap-4 md:grid-cols-2">
          <CreateBoard />
          <OpenBoard />
        </div>

        <div className="mt-14">
          <p className="label mb-4">Unlocked on this device</p>
          {boards === null ? (
            <p className="text-muted">Loading…</p>
          ) : boards.length === 0 ? (
            <p className="text-muted">
              No boards yet. Create one above, or open an existing board with its name and password.
            </p>
          ) : (
            <div className="grid gap-px border border-line bg-line md:grid-cols-2">
              {boards.map((b) => (
                <article key={b.id} className="flex flex-col bg-ink p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-display truncate text-3xl">{b.name}</h2>
                      <p className="label mt-1">
                        /b/{b.slug} · {b.hasPassword ? "password" : "open"} · edited {timeAgo(b.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        className="btn btn-ghost btn-sm"
                        title={b.hasPassword ? "Sign out of this board on this device" : "Remove from this list"}
                        onClick={() => act(`/api/b/${b.slug}/logout`, "POST")}
                      >
                        {b.hasPassword ? "Lock" : "Hide"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => act(`/api/boards/${b.id}/duplicate`, "POST")}
                      >
                        Copy
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          act(`/api/boards/${b.id}`, "DELETE", `Delete "${b.name}" and all of its rooms? This can't be undone.`)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Link href={`/b/${b.slug}`} className="btn btn-ghost">
                      Edit board
                    </Link>
                    <button className="btn btn-primary" onClick={() => setStarting(b)}>
                      Start game
                    </button>
                  </div>

                  {b.rooms.length > 0 && (
                    <div className="mt-6 border-t border-line pt-4">
                      <p className="label mb-2">Rooms</p>
                      <ul className="divide-y divide-line">
                        {b.rooms.map((r) => (
                          <li key={r.slug} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.name}</p>
                              <p className="font-mono text-xs text-muted">
                                /play/{r.slug} · {r.mode === "live" ? "live" : "in person"} · {timeAgo(r.updatedAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Link href={`/host/${r.slug}?intro`} className="btn btn-primary btn-sm">
                                Resume
                              </Link>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  act(`/api/rooms/${r.slug}/reset`, "POST", `Reset scores and tiles for "${r.name}"?`)
                                }
                              >
                                Reset
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => act(`/api/rooms/${r.slug}`, "DELETE", `Delete room "${r.name}"?`)}
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {starting && (
        <StartGameDialog boardId={starting.id} boardName={starting.name} onClose={() => setStarting(null)} />
      )}
    </main>
  );
}

function CreateBoard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const slug = slugify(name);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("create");
    if (preset) setName(preset.replace(/-/g, " "));
  }, []);

  return (
    <form
      className="panel corner-marks flex flex-col gap-3 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password && password !== confirmPw) return setError("Passwords don't match");
        setBusy(true);
        setError("");
        try {
          const board = await api<Board>("/api/boards", { method: "POST", json: { name, password } });
          router.push(`/b/${board.slug}`);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <p className="label">New board</p>
      <h2 className="font-display mb-1 text-3xl">Create a board</h2>
      <input className="field" placeholder="Board name" value={name} onChange={(e) => setName(e.target.value)} />
      <p className="-mt-1 font-mono text-xs text-muted">
        Your link: <span className="text-cream">/b/{slug || "board-name"}</span> · remember this name
      </p>
      <input
        type="password"
        className="field"
        placeholder="Password (optional)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {password && (
        <input
          type="password"
          className="field"
          placeholder="Confirm password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
        />
      )}
      <p className="-mt-1 text-xs text-muted">
        {password
          ? "Only people with the password can edit or host this board."
          : "Without a password, anyone who knows the name can edit or host this board."}
      </p>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary mt-1" disabled={busy || !slug}>
        {busy ? "Creating…" : "Create board"}
      </button>
    </form>
  );
}

function OpenBoard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const slug = slugify(name);
  return (
    <form
      className="panel corner-marks flex flex-col gap-3 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (slug) router.push(`/b/${slug}`);
      }}
    >
      <p className="label">Existing board</p>
      <h2 className="font-display mb-1 text-3xl">Open a board</h2>
      <p className="text-sm text-muted">
        Type your board&apos;s name. You&apos;ll be asked for its password, then you can edit and host from this device.
      </p>
      <input
        className="field"
        placeholder="Board name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <button className="btn btn-ghost mt-auto" disabled={!slug}>
        Open
      </button>
    </form>
  );
}
