"use client";

import { useEffect, useRef, useState } from "react";
import { POWERS } from "@/lib/powers";
import type { PowerNotice, Team } from "@/lib/types";

const SHOW_MS = 6000;

/** Announces power-ups as they're used or found. Skips whatever notice was current when it mounted. */
export function PowerNoticeToast({ notice, teams, big }: { notice?: PowerNotice; teams: Team[]; big?: boolean }) {
  const seen = useRef(notice?.id);
  const [shown, setShown] = useState<PowerNotice | null>(null);

  useEffect(() => {
    if (!notice || notice.id === seen.current) return;
    seen.current = notice.id;
    setShown(notice);
    const t = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [notice]);

  if (!shown) return null;
  const team = teams.find((t) => t.id === shown.teamId);
  const target = teams.find((t) => t.id === shown.targetTeamId);
  const info = POWERS[shown.power];
  if (!team || !info) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4">
      <div
        key={shown.id}
        className={`animate-pop panel pointer-events-auto flex max-w-2xl items-center gap-4 border-2 ${big ? "px-8 py-5" : "px-5 py-4"}`}
        style={{ borderColor: team.color, boxShadow: `0 0 60px -10px ${team.color}` }}
        onClick={() => setShown(null)}
      >
        <span className={big ? "text-5xl" : "text-3xl"}>{info.icon}</span>
        <div className="min-w-0 text-left">
          <p className={`font-display leading-tight ${big ? "text-4xl" : "text-2xl"}`}>
            <span style={{ color: team.color }}>{team.name}</span>{" "}
            {shown.kind === "found" ? "found" : "used"} <span className="text-coral">{info.name}</span>
            {target && (
              <>
                {" "}on <span style={{ color: target.color }}>{target.name}</span>
              </>
            )}
            {shown.kind === "found" && "!"}
          </p>
          {shown.detail && <p className={`font-medium ${big ? "text-2xl" : "text-lg"}`}>{shown.detail}</p>}
          <p className={`text-muted ${big ? "text-lg" : "text-sm"}`}>{info.description}</p>
        </div>
      </div>
    </div>
  );
}
