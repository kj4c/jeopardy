"use client";

import type { Board } from "@/lib/types";

export function PlayBoard({
  board,
  used,
  onOpen,
  onUnuse,
}: {
  board: Board;
  used: string[];
  onOpen: (clueId: string, tile: DOMRect) => void;
  onUnuse: (clueId: string) => void;
}) {
  const usedSet = new Set(used);
  return (
    <div
      className="grid h-full gap-2"
      style={{
        gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))`,
        gridTemplateRows: `auto repeat(${board.rowValues.length}, minmax(0, 1fr))`,
      }}
    >
      {board.categories.map((cat) => (
        <div key={cat.id} className="panel corner-marks flex min-h-20 items-center justify-center px-3 py-4">
          <h2 className="font-display text-center text-[clamp(1rem,1.9vw,2.2rem)] leading-tight">{cat.title}</h2>
        </div>
      ))}
      {board.rowValues.map((value, row) =>
        board.categories.map((cat) => {
          const clue = cat.clues[row];
          if (!clue) return <div key={`${cat.id}-${row}`} />;
          const isUsed = usedSet.has(clue.id);
          return (
            <button
              key={clue.id}
              disabled={isUsed}
              onClick={(e) => onOpen(clue.id, e.currentTarget.getBoundingClientRect())}
              onContextMenu={(e) => {
                if (!isUsed) return;
                e.preventDefault();
                onUnuse(clue.id);
              }}
              title={isUsed ? "Right-click to restore this tile" : undefined}
              className={`tile flex items-center justify-center ${isUsed ? "cursor-default opacity-25" : ""}`}
            >
              {!isUsed && (
                <span className="value-text text-[clamp(1.4rem,3.4vw,4rem)] font-bold tracking-tight">
                  ${value.toLocaleString("en-US")}
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
