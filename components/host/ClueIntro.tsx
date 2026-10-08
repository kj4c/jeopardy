"use client";

import { useEffect, useRef } from "react";
import { CLUE_INTRO_MS } from "@/lib/board";
import { sfx } from "@/lib/sfx";

const GROW_MS = 550;
const EXIT_MS = 380;
/** The board tile's value font size relative to the intro's. */
const TILE_TEXT_SCALE = 0.19;

/** The picked tile grows from its spot to fill the screen with its dollar value, then fades to reveal the clue. Click to skip. */
export function ClueIntro({
  value,
  category,
  from,
  onReveal,
  onDone,
}: {
  value: number;
  category: string;
  from: DOMRect;
  /** Called when the intro starts fading, so the clue can fade in underneath. */
  onReveal: () => void;
  onDone: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const label = useRef<HTMLParagraphElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const reveal = useRef(onReveal);
  reveal.current = onReveal;

  useEffect(() => {
    const dx = from.left + from.width / 2 - window.innerWidth / 2;
    const dy = from.top + from.height / 2 - window.innerHeight / 2;
    const exitAt = CLUE_INTRO_MS - EXIT_MS;
    const anims = [
      box.current!.animate(
        [
          { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` },
          { left: "0px", top: "0px", width: "100vw", height: "100vh" },
        ],
        { duration: GROW_MS, easing: "cubic-bezier(0.7, 0, 0.2, 1)", fill: "both" },
      ),
      text.current!.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${TILE_TEXT_SCALE})` },
          { transform: "translate(0, 0) scale(1.08)", offset: 0.75 },
          { transform: "translate(0, 0) scale(1)" },
        ],
        { duration: GROW_MS + 200, easing: "cubic-bezier(0.7, 0, 0.2, 1)", fill: "both" },
      ),
      text.current!.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }], {
        delay: exitAt,
        duration: EXIT_MS,
        easing: "ease-in",
        fill: "forwards",
      }),
      label.current!.animate(
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "none" },
        ],
        { delay: GROW_MS - 100, duration: 300, easing: "ease-out", fill: "both" },
      ),
    ];
    const exit = root.current!.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: exitAt,
      duration: EXIT_MS,
      easing: "ease-in",
      fill: "forwards",
    });
    exit.onfinish = () => done.current();
    sfx.whoosh();
    const chime = setTimeout(sfx.chime, GROW_MS - 80);
    const reveals = setTimeout(() => reveal.current(), exitAt);
    return () => {
      clearTimeout(chime);
      clearTimeout(reveals);
      exit.onfinish = null;
      exit.cancel();
      anims.forEach((a) => a.cancel());
    };
  }, [from]);

  return (
    <div ref={root} className="fixed inset-0 z-[45] cursor-pointer" onClick={() => done.current()}>
      <div ref={box} className="tile tile-lit fixed" />
      <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center">
        <p ref={label} className="label mb-[2vh] !text-[clamp(0.9rem,1.6vw,1.6rem)] !text-cream/80">
          {category}
        </p>
        <p ref={text} className="value-text text-[clamp(5rem,18vw,22rem)] font-bold leading-none tracking-tight">
          ${value.toLocaleString("en-US")}
        </p>
      </div>
    </div>
  );
}
