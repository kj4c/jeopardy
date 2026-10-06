"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { StartGameDialog } from "@/components/StartGameDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import type { Board, RoomSummary } from "@/lib/types";

type BoardListItem = { id: string; name: string; updatedAt: number; rooms: RoomSummary[] };

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function BoardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardListItem[] | null>(null);
  const [starting, setStarting] = useState<BoardListItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<BoardListItem[]>("/api/boards").then(setBoards).catch(() => setBoards([]));
  }, []);
  useEffect(load, [load]);

  async function createBoard() {
    const board = await api<Board>("/api/boards", { method: "POST", json: { name: "Untitled board" } });
    router.push(`/editor/${board.id}`);
  }

  async function importBoard(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Partial<Board>;
      const board = await api<Board>("/api/boards", { method: "POST", json: { board: data, name: data.name } });
      router.push(`/editor/${board.id}`);
    } catch (err) {
      alert(`Could not import: ${(err as Error).message}`);
    }
  }

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
          <div className="flex gap-2">
            <ThemeToggle />
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBoard(f);
                e.target.value = "";
              }}
            />
            <button className="btn btn-primary btn-sm" onClick={createBoard}>
              + New board
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
        <p className="label mb-3">Your library</p>
        <h1 className="font-display mb-10 text-5xl md:text-6xl">Boards</h1>

        {boards === null ? (
          <p className="text-muted">Loading…</p>
        ) : boards.length === 0 ? (
          <div className="panel corner-marks flex flex-col items-start gap-4 p-10">
            <p className="font-display text-3xl">No boards yet.</p>
            <p className="text-muted">Create your first board, fill it with questions, then open a room to play.</p>
            <button className="btn btn-primary" onClick={createBoard}>
              Create a board
            </button>
          </div>
        ) : (
          <div className="grid gap-px border border-line bg-line md:grid-cols-2">
            {boards.map((b) => (
              <article key={b.id} className="flex flex-col bg-ink/90 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-3xl">{b.name}</h2>
                    <p className="label mt-1">Edited {timeAgo(b.updatedAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Duplicate"
                      onClick={() => act(`/api/boards/${b.id}/duplicate`, "POST")}
                    >
                      Copy
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Delete"
                      onClick={() =>
                        act(`/api/boards/${b.id}`, "DELETE", `Delete "${b.name}" and all of its rooms?`)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <Link href={`/editor/${b.id}`} className="btn btn-ghost">
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
                            <Link href={`/host/${r.slug}`} className="btn btn-primary btn-sm">
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
      </section>

      {starting && (
        <StartGameDialog boardId={starting.id} boardName={starting.name} onClose={() => setStarting(null)} />
      )}
    </main>
  );
}
