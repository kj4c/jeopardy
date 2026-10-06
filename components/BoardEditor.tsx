"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { MediaField } from "@/components/MediaField";
import { Modal } from "@/components/Modal";
import { StartGameDialog } from "@/components/StartGameDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { emptyCategory, emptyClue, newId } from "@/lib/board";
import type { Board, Clue, FinalJeopardy, Quickfire, QuickfireQuestion } from "@/lib/types";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type Selection = { kind: "clue"; categoryId: string; clueId: string } | { kind: "final" } | { kind: "quickfire" } | null;

export function BoardEditor({ id, onLocked }: { id: string; onLocked: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [returnRoom, setReturnRoom] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setReturnRoom(new URLSearchParams(window.location.search).get("room"));
  }, []);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [selection, setSelection] = useState<Selection>(null);
  const [starting, setStarting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<Board | null>(null);

  useEffect(() => {
    api<Board>(`/api/boards/${id}`)
      .then((b) => {
        latest.current = b;
        setBoard(b);
      })
      .catch((err) => (err.status === 401 ? onLocked() : setLoadError((err as Error).message)));
  }, [id, onLocked]);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!latest.current) return;
    setStatus("saving");
    try {
      await api(`/api/boards/${id}`, { method: "PUT", json: latest.current });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [id]);

  const update = useCallback(
    (fn: (b: Board) => Board) => {
      setBoard((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        latest.current = next;
        return next;
      });
      setStatus("unsaved");
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, 700);
    },
    [flush],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "unsaved" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  if (loadError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <GradientBackground />
        <p className="font-display text-4xl">Board not found.</p>
        <Link href="/boards" className="btn btn-ghost">
          Back to boards
        </Link>
      </main>
    );
  }
  if (!board) return <main className="min-h-dvh"><GradientBackground /></main>;

  const rows = board.rowValues.length;

  const addColumn = () =>
    update((b) => ({ ...b, categories: [...b.categories, emptyCategory(b.rowValues.length, "New category")] }));
  const removeColumn = (catId: string) => {
    if (!confirm("Remove this category and its clues?")) return;
    update((b) => ({ ...b, categories: b.categories.filter((c) => c.id !== catId) }));
  };
  const moveColumn = (index: number, dir: -1 | 1) =>
    update((b) => {
      const cats = [...b.categories];
      const target = index + dir;
      if (target < 0 || target >= cats.length) return b;
      [cats[index], cats[target]] = [cats[target], cats[index]];
      return { ...b, categories: cats };
    });
  const addRow = () =>
    update((b) => {
      const last = b.rowValues[b.rowValues.length - 1] ?? 0;
      const step = b.rowValues.length > 1 ? last - b.rowValues[b.rowValues.length - 2] : 200;
      return {
        ...b,
        rowValues: [...b.rowValues, last + (step || 200)],
        categories: b.categories.map((c) => ({ ...c, clues: [...c.clues, emptyClue()] })),
      };
    });
  const removeRow = (row: number) => {
    if (!confirm("Remove this row from every category?")) return;
    update((b) => ({
      ...b,
      rowValues: b.rowValues.filter((_, i) => i !== row),
      categories: b.categories.map((c) => ({ ...c, clues: c.clues.filter((_, i) => i !== row) })),
    }));
  };
  const updateClue = (categoryId: string, clueId: string, patch: Partial<Clue>) =>
    update((b) => ({
      ...b,
      categories: b.categories.map((c) =>
        c.id === categoryId ? { ...c, clues: c.clues.map((cl) => (cl.id === clueId ? { ...cl, ...patch } : cl)) } : c,
      ),
    }));
  const updateFinal = (patch: Partial<FinalJeopardy>) =>
    update((b) => ({
      ...b,
      finalJeopardy: { category: "", question: "", answer: "", ...b.finalJeopardy, ...patch },
    }));

  const updateQuickfire = (fn: (qf: Quickfire) => Quickfire) =>
    update((b) => ({ ...b, quickfire: fn(b.quickfire ?? { points: 200, questions: [] }) }));
  const updateQuickfireQuestion = (id: string, patch: Partial<QuickfireQuestion>) =>
    updateQuickfire((qf) => ({ ...qf, questions: qf.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));

  async function importJson(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Partial<Board>;
      if (!Array.isArray(data.categories) || !Array.isArray(data.rowValues)) throw new Error("Not a board file");
      if (!confirm("Replace everything on this board with the imported file?")) return;
      update((b) => ({
        ...b,
        categories: data.categories!,
        rowValues: data.rowValues!,
        finalJeopardy: data.finalJeopardy ?? b.finalJeopardy,
        quickfire: data.quickfire ?? b.quickfire,
      }));
      setSelection(null);
    } catch (err) {
      alert(`Could not import: ${(err as Error).message}`);
    }
  }

  async function lock() {
    await flush();
    await api(`/api/b/${board!.slug}/logout`, { method: "POST" });
    onLocked();
  }

  function exportJson() {
    if (!board) return;
    const { id: _id, slug: _s, hasPassword: _p, updatedAt: _u, ...data } = board;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${board.name.replace(/[^\w-]+/g, "_") || "board"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const selectedCategory =
    selection?.kind === "clue" ? board.categories.find((c) => c.id === selection.categoryId) : undefined;
  const selectedRow = selectedCategory?.clues.findIndex((c) => selection?.kind === "clue" && c.id === selection.clueId);
  const selectedClue = selectedCategory && selectedRow !== undefined ? selectedCategory.clues[selectedRow] : undefined;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <GradientBackground waves={false} />
      <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-8">
          <Link href="/boards" className="btn btn-ghost btn-sm">
            ← Boards
          </Link>
          <div className="min-w-0 flex-1">
            <input
              className="font-display w-full bg-transparent text-3xl outline-none placeholder:text-muted"
              value={board.name}
              onChange={(e) => update((b) => ({ ...b, name: e.target.value }))}
              placeholder="Board name"
            />
            <p className="label mt-0.5 truncate">
              Edit from any device at /b/{board.slug}
              {!board.hasPassword && " · no password, anyone with the link can edit"}
            </p>
          </div>
          <span className={`label ${status === "error" ? "!text-bad" : ""}`}>
            {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : status === "error" ? "Save failed" : "Editing"}
          </span>
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={() => importRef.current?.click()}>
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = "";
            }}
          />
          <button className="btn btn-ghost btn-sm" onClick={exportJson}>
            Export
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPasswordOpen(true)}>
            {board.hasPassword ? "Password" : "Set password"}
          </button>
          {board.hasPassword && (
            <button className="btn btn-ghost btn-sm" onClick={lock} title="Sign out of this board on this device">
              Lock
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setSelection({ kind: "quickfire" })}>
            Quickfire{board.quickfire?.questions.length ? ` (${board.quickfire.questions.length})` : ""}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelection({ kind: "final" })}>
            Final Jeopardy
          </button>
          {returnRoom ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={async () => {
                await flush();
                router.push(`/host/${returnRoom}`);
              }}
            >
              Back to game
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={async () => {
                await flush();
                setStarting(true);
              }}
            >
              Play
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-auto p-4 md:p-8">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `5.5rem repeat(${board.categories.length}, minmax(10rem, 1fr)) 3.5rem`,
            }}
          >
            <div />
            {board.categories.map((cat, ci) => (
              <div key={cat.id} className="group panel flex flex-col">
                <textarea
                  rows={2}
                  className="font-display w-full resize-none bg-transparent px-3 pt-3 text-center text-xl leading-tight outline-none placeholder:text-muted"
                  value={cat.title}
                  placeholder="Category"
                  onChange={(e) =>
                    update((b) => ({
                      ...b,
                      categories: b.categories.map((c) => (c.id === cat.id ? { ...c, title: e.target.value } : c)),
                    }))
                  }
                />
                <div className="flex justify-center gap-1 pb-2 opacity-40 transition group-hover:opacity-100">
                  <IconButton label="Move left" onClick={() => moveColumn(ci, -1)} disabled={ci === 0}>
                    ←
                  </IconButton>
                  <IconButton label="Remove category" onClick={() => removeColumn(cat.id)}>
                    ✕
                  </IconButton>
                  <IconButton
                    label="Move right"
                    onClick={() => moveColumn(ci, 1)}
                    disabled={ci === board.categories.length - 1}
                  >
                    →
                  </IconButton>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost h-full flex-col px-0 text-xl" onClick={addColumn} title="Add category">
              +
            </button>

            {board.rowValues.map((value, row) => (
              <RowCells
                key={row}
                row={row}
                value={value}
                board={board}
                selection={selection}
                onValue={(v) => update((b) => ({ ...b, rowValues: b.rowValues.map((x, i) => (i === row ? v : x)) }))}
                onRemove={() => removeRow(row)}
                onSelect={(categoryId, clueId) => setSelection({ kind: "clue", categoryId, clueId })}
              />
            ))}

            <div />
            <button
              className="btn btn-ghost py-3"
              style={{ gridColumn: `span ${board.categories.length}` }}
              onClick={addRow}
            >
              + Add row
            </button>
          </div>
          <p className="label mt-6">
            {board.categories.length} categories · {rows} rows · click any tile to write its clue
          </p>
        </div>

        {selection && (
          <aside className="panel animate-fade-up fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto overscroll-contain border-l border-line p-6 md:static md:z-auto md:h-full md:shrink-0">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="label mb-1">
                  {selection.kind === "final"
                    ? "Final Jeopardy"
                    : selection.kind === "quickfire"
                      ? "Quickfire"
                      : `${selectedCategory?.title || "Category"} · $${board.rowValues[selectedRow ?? 0]}`}
                </p>
                <h2 className="font-display text-3xl">
                  {selection.kind === "final" ? "Final round" : selection.kind === "quickfire" ? "Rapid round" : "Edit clue"}
                </h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelection(null)}>
                ✕
              </button>
            </div>

            {selection.kind === "clue" && selectedClue && selectedCategory && (
              <div key={selectedClue.id} className="space-y-5">
                <Field label="Question (shown to players)">
                  <textarea
                    className="field min-h-28"
                    value={selectedClue.question}
                    autoFocus
                    onChange={(e) => updateClue(selectedCategory.id, selectedClue.id, { question: e.target.value })}
                  />
                </Field>
                <MediaField boardId={board.id}
                  label="Question media"
                  value={selectedClue.media}
                  onChange={(media) => updateClue(selectedCategory.id, selectedClue.id, { media })}
                />
                <Field label="Correct response">
                  <textarea
                    className="field min-h-20"
                    value={selectedClue.answer}
                    placeholder="What is…"
                    onChange={(e) => updateClue(selectedCategory.id, selectedClue.id, { answer: e.target.value })}
                  />
                </Field>
                <MediaField boardId={board.id}
                  label="Answer media (optional)"
                  value={selectedClue.answerMedia}
                  onChange={(answerMedia) => updateClue(selectedCategory.id, selectedClue.id, { answerMedia })}
                />
                <label className="flex cursor-pointer items-center justify-between border border-line-strong p-3">
                  <span>
                    <span className="block font-medium">Daily Double</span>
                    <span className="text-sm text-muted">The picking team wagers instead of buzzing.</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#ff7a6b]"
                    checked={!!selectedClue.dailyDouble}
                    onChange={(e) =>
                      updateClue(selectedCategory.id, selectedClue.id, { dailyDouble: e.target.checked || undefined })
                    }
                  />
                </label>
                <ClueNav board={board} selection={selection} onSelect={setSelection} />
              </div>
            )}

            {selection.kind === "quickfire" && (
              <div className="space-y-5">
                <p className="text-sm text-muted">
                  Every question is worth the same. Buzzers open as soon as a question shows; the first team to buzz
                  answers, and if they miss, nobody can steal.
                </p>
                <Field label="Points per question">
                  <input
                    type="number"
                    className="field"
                    value={board.quickfire?.points ?? 200}
                    onChange={(e) => updateQuickfire((qf) => ({ ...qf, points: Math.round(Number(e.target.value) || 0) }))}
                  />
                </Field>
                <label className="flex cursor-pointer items-center justify-between border border-line-strong p-3">
                  <span>
                    <span className="block font-medium">Wrong answers lose points</span>
                    <span className="text-sm text-muted">Otherwise a miss just moves on.</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#ff7a6b]"
                    checked={!!board.quickfire?.penalty}
                    onChange={(e) => updateQuickfire((qf) => ({ ...qf, penalty: e.target.checked }))}
                  />
                </label>
                <div className="space-y-4">
                  {(board.quickfire?.questions ?? []).map((q, i, all) => (
                    <div key={q.id} className="space-y-3 border border-line-strong p-4">
                      <div className="flex items-center justify-between">
                        <span className="label">Question {i + 1}</span>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={i === 0}
                            aria-label="Move up"
                            onClick={() =>
                              updateQuickfire((qf) => {
                                const qs = [...qf.questions];
                                [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
                                return { ...qf, questions: qs };
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={i === all.length - 1}
                            aria-label="Move down"
                            onClick={() =>
                              updateQuickfire((qf) => {
                                const qs = [...qf.questions];
                                [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
                                return { ...qf, questions: qs };
                              })
                            }
                          >
                            ↓
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            aria-label="Remove question"
                            onClick={() =>
                              updateQuickfire((qf) => ({ ...qf, questions: qf.questions.filter((x) => x.id !== q.id) }))
                            }
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="field min-h-20"
                        placeholder="Question"
                        value={q.question}
                        onChange={(e) => updateQuickfireQuestion(q.id, { question: e.target.value })}
                      />
                      <input
                        className="field"
                        placeholder="Correct response"
                        value={q.answer}
                        onChange={(e) => updateQuickfireQuestion(q.id, { answer: e.target.value })}
                      />
                      <MediaField boardId={board.id}
                        label="Media (optional)"
                        value={q.media}
                        onChange={(media) => updateQuickfireQuestion(q.id, { media })}
                      />
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-ghost w-full"
                  onClick={() =>
                    updateQuickfire((qf) => ({
                      ...qf,
                      questions: [...qf.questions, { id: newId("q_"), question: "", answer: "" }],
                    }))
                  }
                >
                  + Add question
                </button>
              </div>
            )}

            {selection.kind === "final" && (
              <div className="space-y-5">
                <Field label="Category (shown first, before wagers)">
                  <input
                    className="field"
                    value={board.finalJeopardy?.category ?? ""}
                    onChange={(e) => updateFinal({ category: e.target.value })}
                  />
                </Field>
                <Field label="Question">
                  <textarea
                    className="field min-h-28"
                    value={board.finalJeopardy?.question ?? ""}
                    onChange={(e) => updateFinal({ question: e.target.value })}
                  />
                </Field>
                <MediaField boardId={board.id}
                  label="Question media"
                  value={board.finalJeopardy?.media}
                  onChange={(media) => updateFinal({ media })}
                />
                <Field label="Correct response">
                  <textarea
                    className="field min-h-20"
                    value={board.finalJeopardy?.answer ?? ""}
                    onChange={(e) => updateFinal({ answer: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </aside>
        )}
      </div>

      {starting && <StartGameDialog boardId={board.id} boardName={board.name} onClose={() => setStarting(false)} />}
      {passwordOpen && (
        <PasswordDialog
          boardId={board.id}
          hasPassword={!!board.hasPassword}
          onClose={() => setPasswordOpen(false)}
          onSaved={(hasPassword) => {
            setPasswordOpen(false);
            setBoard((b) => (b ? { ...b, hasPassword } : b));
          }}
        />
      )}
    </main>
  );
}

function PasswordDialog({
  boardId,
  hasPassword,
  onClose,
  onSaved,
}: {
  boardId: string;
  hasPassword: boolean;
  onClose: () => void;
  onSaved: (hasPassword: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: string) {
    setBusy(true);
    try {
      await api(`/api/boards/${boardId}/password`, { method: "POST", json: { password: next } });
      onSaved(next.length > 0);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Board password" subtitle="Used to edit and host from any device" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (password !== confirmPw) return setError("Passwords don't match");
          save(password);
        }}
      >
        <input
          type="password"
          className="field"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          className="field"
          placeholder="Confirm password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
        />
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          {hasPassword && (
            <button
              type="button"
              className="btn btn-ghost mr-auto"
              disabled={busy}
              onClick={() => confirm("Remove the password? Anyone with the link will be able to edit.") && save("")}
            >
              Remove password
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !password}>
            Save password
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RowCells({
  row,
  value,
  board,
  selection,
  onValue,
  onRemove,
  onSelect,
}: {
  row: number;
  value: number;
  board: Board;
  selection: Selection;
  onValue: (v: number) => void;
  onRemove: () => void;
  onSelect: (categoryId: string, clueId: string) => void;
}) {
  return (
    <>
      <div className="group flex flex-col items-stretch justify-center gap-1">
        <div className="flex items-center border border-line-strong bg-ink/60">
          <span className="pl-2 text-muted">$</span>
          <input
            type="number"
            className="w-full bg-transparent px-1 py-2 font-medium outline-none"
            value={value}
            onChange={(e) => onValue(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <button
          className="label text-center opacity-40 transition hover:!text-bad group-hover:opacity-100"
          onClick={onRemove}
        >
          remove
        </button>
      </div>
      {board.categories.map((cat) => {
        const clue = cat.clues[row];
        if (!clue) return <div key={cat.id} />;
        const active = selection?.kind === "clue" && selection.clueId === clue.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id, clue.id)}
            className={`tile flex min-h-24 flex-col p-3 text-left ${active ? "!border-coral" : ""}`}
          >
            <span className="value-text text-lg font-bold">${value}</span>
            <span className={`mt-1 line-clamp-2 text-sm ${clue.question ? "text-cream/85" : "text-muted/60 italic"}`}>
              {clue.question || "Empty"}
            </span>
            <span className="mt-auto flex gap-1.5 pt-2">
              {clue.media && <Badge>{clue.media.type === "image" ? "IMG" : "YT"}</Badge>}
              {clue.dailyDouble && <Badge accent>DD</Badge>}
              {clue.question && !clue.answer && <Badge warn>No answer</Badge>}
            </span>
          </button>
        );
      })}
      <div />
    </>
  );
}

function ClueNav({
  board,
  selection,
  onSelect,
}: {
  board: Board;
  selection: Extract<Selection, { kind: "clue" }>;
  onSelect: (s: Selection) => void;
}) {
  const flat = board.rowValues.flatMap((_, row) =>
    board.categories.map((c) => ({ categoryId: c.id, clueId: c.clues[row]?.id })).filter((x) => x.clueId),
  );
  const idx = flat.findIndex((x) => x.clueId === selection.clueId);
  const go = (d: number) => {
    const next = flat[idx + d];
    if (next) onSelect({ kind: "clue", categoryId: next.categoryId, clueId: next.clueId! });
  };
  return (
    <div className="flex justify-between border-t border-line pt-4">
      <button className="btn btn-ghost btn-sm" disabled={idx <= 0} onClick={() => go(-1)}>
        ← Previous
      </button>
      <button className="btn btn-ghost btn-sm" disabled={idx >= flat.length - 1} onClick={() => go(1)}>
        Next →
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-6 w-6 text-xs text-muted transition hover:text-cream disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Badge({ children, accent, warn }: { children: React.ReactNode; accent?: boolean; warn?: boolean }) {
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${
        accent ? "border-coral/60 text-coral" : warn ? "border-amber/50 text-amber" : "border-line-strong text-muted"
      }`}
    >
      {children}
    </span>
  );
}
