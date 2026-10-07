"use client";

import { useEffect, useRef, useState } from "react";
import { POWERS } from "@/lib/powers";
import type { PowerNotice, Team } from "@/lib/types";

const SHOW_MS = { used: 5000, lost: 5000, found: 6000, missed: 6000 };
/** A newer notice replaces the current one after this long. */
const MIN_SHOW_MS = 1500;
const FADE_MS = 350;
const SUSPENSE_MS = 1400;

/**
 * Announces power-ups as they're used, found, missed or wasted, one at a time.
 * Skips whatever notices already existed when it mounted.
 */
export function PowerNoticeToast({
  notices,
  teams,
  big,
  myTeamId,
}: {
  notices?: PowerNotice[];
  teams: Team[];
  big?: boolean;
  /** On a phone: speak to the player's own team as "you". */
  myTeamId?: string;
}) {
  const seen = useRef(new Set((notices ?? []).map((n) => n.id)));
  const [queue, setQueue] = useState<PowerNotice[]>([]);
  const [leaving, setLeaving] = useState(false);
  const shownAt = useRef(0);
  const current = queue[0];

  useEffect(() => {
    const fresh = (notices ?? []).filter((n) => !seen.current.has(n.id));
    if (!fresh.length) return;
    for (const n of fresh) seen.current.add(n.id);
    setQueue((q) => [...q, ...fresh]);
  }, [notices]);

  useEffect(() => {
    if (!current) return;
    shownAt.current = Date.now();
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), SHOW_MS[current.kind]);
    return () => clearTimeout(t);
  }, [current]);

  useEffect(() => {
    if (!current || queue.length < 2 || leaving) return;
    const t = setTimeout(() => setLeaving(true), Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt.current)));
    return () => clearTimeout(t);
  }, [current, queue.length, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), FADE_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!current) return null;
  const info = POWERS[current.power];
  const team = teams.find((t) => t.id === current.teamId);
  if (!info || (current.kind !== "missed" && !team)) {
    return <Skip onSkip={() => setQueue((q) => q.slice(1))} />;
  }
  const fade = `transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`;
  const dismiss = () => setLeaving(true);

  if (current.kind === "found" || current.kind === "missed") {
    return (
      <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 px-6 backdrop-blur-sm ${fade}`} onClick={dismiss}>
        <HiddenReveal key={current.id} notice={current} team={team} mine={!!myTeamId && team?.id === myTeamId} big={big} />
      </div>
    );
  }

  const target = teams.find((t) => t.id === current.targetTeamId);
  const lost = current.kind === "lost";
  const mine = !!myTeamId && team!.id === myTeamId;
  return (
    <div className={`pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4 ${fade}`}>
      <div
        key={current.id}
        className={`animate-pop panel pointer-events-auto flex max-w-2xl items-center gap-4 border-2 ${big ? "px-8 py-5" : "px-5 py-4"}`}
        style={{ borderColor: team!.color, boxShadow: `0 0 60px -10px ${team!.color}` }}
        onClick={dismiss}
      >
        <span className={`${big ? "text-5xl" : "text-3xl"} ${lost ? "opacity-40 grayscale" : ""}`}>{info.icon}</span>
        <div className="min-w-0 text-left">
          <p className={`font-display leading-tight ${big ? "text-4xl" : "text-2xl"}`}>
            <span style={{ color: team!.color }}>{mine ? "Your team" : team!.name}</span>{" "}
            {lost ? (mine ? "lost its" : "lost their") : "used"} <span className={lost ? "text-bad" : "text-coral"}>{info.name}</span>
            {target && (
              <>
                {" "}on <span style={{ color: target.color }}>{target.name}</span>
              </>
            )}
          </p>
          {current.detail && <p className={`font-medium ${big ? "text-2xl" : "text-lg"}`}>{current.detail}</p>}
          {!lost && <p className={`text-muted ${big ? "text-lg" : "text-sm"}`}>{info.description}</p>}
        </div>
      </div>
    </div>
  );
}

function Skip({ onSkip }: { onSkip: () => void }) {
  useEffect(onSkip, [onSkip]);
  return null;
}

/** "Oh, what's this…?" then the power-up pops out. */
function HiddenReveal({ notice, team, mine, big }: { notice: PowerNotice; team?: Team; mine: boolean; big?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), SUSPENSE_MS);
    return () => clearTimeout(t);
  }, []);
  const info = POWERS[notice.power];
  const missed = notice.kind === "missed";
  const glow = team?.color ?? "#ff6fc8";

  return (
    <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
      <div
        className={`flex items-center justify-center border-2 ${big ? "h-48 w-48" : "h-32 w-32"}`}
        style={{
          borderColor: revealed ? glow : "var(--color-line-strong)",
          boxShadow: revealed ? `0 0 90px -10px ${glow}` : undefined,
          animation: revealed ? undefined : "mystery 0.45s ease-in-out infinite",
        }}
      >
        <span key={String(revealed)} className={`animate-pop ${big ? "text-8xl" : "text-6xl"} ${revealed && missed ? "opacity-50" : ""}`}>
          {revealed ? info.icon : "?"}
        </span>
      </div>
      {!revealed ? (
        <p key="suspense" className={`font-display animate-fade-up italic text-muted ${big ? "text-6xl" : "text-4xl"}`}>
          {missed ? "Aw, nobody got it…" : "Oh, what's this…?"}
        </p>
      ) : (
        <div key="reveal" className="animate-pop space-y-3">
          <p className={`font-display leading-tight ${big ? "text-6xl" : "text-4xl"}`}>
            {missed ? (
              <>
                …but there was a hidden <span className="text-coral">{info.name}</span> power-up!
              </>
            ) : (
              <>
                <span style={{ color: team?.color }}>{mine ? "You" : team?.name}</span> found a{" "}
                <span className="text-coral">{info.name}</span> power-up!
              </>
            )}
          </p>
          <p className={`text-muted ${big ? "text-2xl" : "text-base"}`}>{missed ? "Nobody gets it this time." : info.description}</p>
        </div>
      )}
    </div>
  );
}
