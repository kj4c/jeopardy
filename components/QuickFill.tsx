"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { buildBoard, parseSpreadsheet, type FillItem } from "@/lib/boardFill";
import type { Board, FinalJeopardy } from "@/lib/types";
import { Modal } from "./Modal";

type Fill = Pick<Board, "categories" | "rowValues"> & { final?: FinalJeopardy };
type Generated = {
  categories: { title: string; clues: { question: string; answer: string; hint?: string }[] }[];
  final?: FinalJeopardy;
};

const EXAMPLE = `Category\tValue\tQuestion\tAnswer\tHint
Space\t200\tThe closest planet to the Sun\tMercury\tIt shares its name with a messenger god
Space\t400\tThe largest moon of Saturn\tTitan\t
Movies\t200\tThis 1997 film features Jack and Rose\tTitanic\tA famous ship
Final: Geography\t\tThe only country that borders both the Atlantic and Indian Oceans\tSouth Africa\t`;

/** Fills the whole board at once from a pasted spreadsheet or an AI-written board. */
export function QuickFill({ board, onApply, onClose }: { board: Board; onApply: (fill: Fill) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"paste" | "ai">("paste");
  return (
    <Modal title="Quick fill" subtitle="Fill the whole board at once" onClose={onClose} wide>
      <div className="mb-6 flex border border-line-strong text-sm">
        {(
          [
            ["paste", "Paste a spreadsheet"],
            ["ai", "Write it with AI"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 px-3 py-2 transition ${tab === id ? "bg-coral/20 text-cream" : "text-muted hover:text-cream"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "paste" ? <PasteTab onApply={onApply} /> : <AiTab board={board} onApply={onApply} />}
    </Modal>
  );
}

function Summary({ fill }: { fill: Fill }) {
  const count = fill.categories.reduce((n, c) => n + c.clues.filter((cl) => cl.question).length, 0);
  return (
    <div className="border border-line bg-ink/40 p-4 text-sm">
      <p className="mb-2">
        {fill.categories.length} categories × {fill.rowValues.length} rows · {count} clues
        {fill.final?.question ? " · Final Kashpot! included" : ""}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {fill.categories.map((c) => (
          <span key={c.id} className="border border-line-strong px-2 py-0.5 text-xs">
            {c.title}
          </span>
        ))}
      </div>
    </div>
  );
}

function ApplyButton({ fill, onApply, label = "Replace the board" }: { fill: Fill; onApply: (f: Fill) => void; label?: string }) {
  return (
    <button
      className="btn btn-primary"
      onClick={() => confirm("Replace every category and clue on this board?") && onApply(fill)}
    >
      {label}
    </button>
  );
}

function PasteTab({ onApply }: { onApply: (fill: Fill) => void }) {
  const [text, setText] = useState("");
  const fill = useMemo<Fill | null>(() => {
    if (!text.trim()) return null;
    const { items, final } = parseSpreadsheet(text);
    return items.length ? { ...buildBoard(items), final } : null;
  }, [text]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Copy rows from Google Sheets, Excel or Numbers and paste them here. Columns: <b>Category</b>, <b>Value</b>,{" "}
        <b>Question</b>, <b>Answer</b>, and optionally <b>Hint</b>. Value can be left out. Put{" "}
        <b>Final: Topic</b> in the category column for the Final Kashpot! clue.
      </p>
      <textarea
        className="field min-h-56 font-mono text-xs"
        placeholder={EXAMPLE}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost btn-sm" onClick={() => setText(EXAMPLE)}>
          Show an example
        </button>
        {text.trim() && !fill && <p className="text-sm text-bad">Couldn't find any questions in that.</p>}
      </div>
      {fill && (
        <>
          <Summary fill={fill} />
          <div className="flex justify-end">
            <ApplyButton fill={fill} onApply={onApply} />
          </div>
        </>
      )}
    </div>
  );
}

function AiTab({ board, onApply }: { board: Board; onApply: (fill: Fill) => void }) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [categories, setCategories] = useState(board.categories.length || 5);
  const [rows, setRows] = useState(board.rowValues.length || 5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fill, setFill] = useState<Fill | null>(null);

  async function generate() {
    setBusy(true);
    setError("");
    setFill(null);
    try {
      const result = await api<Generated>(`/api/boards/${board.id}/generate`, {
        method: "POST",
        json: { topic, audience, categories, rows },
      });
      const values =
        board.rowValues.length === rows && board.rowValues.every((v) => v > 0)
          ? board.rowValues
          : Array.from({ length: rows }, (_, i) => (i + 1) * 200);
      const items: FillItem[] = result.categories.flatMap((c) =>
        c.clues.map((cl, i) => ({ category: c.title, value: values[i] ?? values[values.length - 1], ...cl })),
      );
      setFill({ ...buildBoard(items), final: result.final });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="label">What's it about?</span>
        <input
          className="field"
          placeholder="e.g. 2000s pop culture, our family's inside jokes, Marvel movies, Australian history"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={300}
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">Who's playing? (optional)</span>
        <input
          className="field"
          placeholder="e.g. kids aged 10–12, uni friends, work trivia night"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          maxLength={100}
        />
      </label>
      <div className="flex gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="label">Categories</span>
          <input
            type="number"
            min={1}
            max={8}
            className="field w-24"
            value={categories}
            onChange={(e) => setCategories(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Rows</span>
          <input type="number" min={1} max={8} className="field w-24" value={rows} onChange={(e) => setRows(Number(e.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={generate} disabled={busy || !topic.trim()}>
          {busy ? "Writing your board…" : fill ? "Try again" : "Generate"}
        </button>
        {busy && <p className="text-sm text-muted">This usually takes 20–40 seconds.</p>}
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>
      {fill && (
        <>
          <Summary fill={fill} />
          <p className="text-xs text-muted">AI can get facts wrong. Skim the clues in the editor before you play.</p>
          <div className="flex justify-end">
            <ApplyButton fill={fill} onApply={onApply} label="Use this board" />
          </div>
        </>
      )}
    </div>
  );
}
