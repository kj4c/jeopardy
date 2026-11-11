"use client";

import { useEffect, useState } from "react";
import type { Reaction } from "@/lib/reactions";
import { getSocket } from "@/lib/socket";

type Floater = Reaction & { id: number; x: number; drift: number; scale: number };

const FLOAT_MS = 3400;
const MAX_ON_SCREEN = 40;
let nextId = 0;

/** Emoji that players send from their phones, drifting up the big screen. */
export function ReactionLayer() {
  const [items, setItems] = useState<Floater[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const onReaction = (r: Reaction) => {
      const id = nextId++;
      const item = { ...r, id, x: 6 + Math.random() * 88, drift: (Math.random() - 0.5) * 160, scale: 0.85 + Math.random() * 0.45 };
      setItems((list) => [...list.slice(-(MAX_ON_SCREEN - 1)), item]);
      setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), FLOAT_MS);
    };
    socket.on("room:reaction", onReaction);
    return () => {
      socket.off("room:reaction", onReaction);
    };
  }, []);

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {items.map((i) => (
        <div
          key={i.id}
          className="absolute bottom-0 flex flex-col items-center"
          style={
            {
              left: `${i.x}%`,
              animation: `reaction-float ${FLOAT_MS}ms cubic-bezier(0.2, 0.7, 0.4, 1) forwards`,
              "--drift": `${i.drift}px`,
            } as React.CSSProperties
          }
        >
          <span className="leading-none drop-shadow-lg" style={{ fontSize: `${4 * i.scale}rem` }}>
            {i.emoji}
          </span>
          <span className="mt-1 bg-ink/75 px-2 py-0.5 text-xs font-medium" style={{ color: i.color }}>
            {i.name}
          </span>
        </div>
      ))}
    </div>
  );
}
