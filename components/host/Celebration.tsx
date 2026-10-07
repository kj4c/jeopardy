"use client";

import { useEffect, useState } from "react";
import { playClip } from "@/lib/sfx";

const COLORS = ["#ff4f9a", "#3b6bff", "#f5a14a", "#7dff8a", "#ffd75e", "#b57bff", "#fff6c9"];

type Piece = { left: number; delay: number; duration: number; drift: number; spin: number; size: number; color: string; round: boolean };

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 3.2 + Math.random() * 2.4,
    drift: (Math.random() - 0.5) * 30,
    spin: 360 + Math.random() * 720,
    size: 0.5 + Math.random() * 0.6,
    color: COLORS[i % COLORS.length],
    round: Math.random() < 0.25,
  }));
}

/** Confetti over the whole screen plus applause, once per mount. */
export function Celebration() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    setPieces(makePieces(140));
    return playClip("/music/applause.mp3", 1.6);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-[5vh] block"
          style={
            {
              left: `${p.left}%`,
              width: `${p.size}rem`,
              height: `${p.round ? p.size : p.size * 0.45}rem`,
              background: p.color,
              borderRadius: p.round ? "9999px" : "1px",
              "--drift": `${p.drift}vw`,
              "--spin": `${p.spin}deg`,
              animation: `confetti-fall ${p.duration}s cubic-bezier(0.3, 0.6, 0.6, 1) ${p.delay}s 2 both`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
