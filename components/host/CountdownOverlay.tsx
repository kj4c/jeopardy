"use client";

export function CountdownOverlay({ count, go }: { count?: number; go?: boolean }) {
  if (!count && !go) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <span
        key={go ? "go" : count}
        className="font-display animate-pop gradient-text text-[min(40vw,40vh)] leading-none drop-shadow-[0_0_80px_rgba(255,79,154,0.45)]"
      >
        {go ? "Buzz!" : count}
      </span>
    </div>
  );
}
