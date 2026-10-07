"use client";

import type { LobbyStyle } from "@/lib/useMusic";

export function MusicControl({
  lobby,
  muted,
  volume,
  onLobby,
  onMute,
  onVolume,
}: {
  lobby: LobbyStyle;
  muted: boolean;
  volume: number;
  onLobby: (style: LobbyStyle) => void;
  onMute: (muted: boolean) => void;
  onVolume: (volume: number) => void;
}) {
  const option = (active: boolean) =>
    `px-3 py-1.5 transition ${active ? "bg-coral/20 text-cream" : "text-muted hover:text-cream"}`;
  const shown = muted ? 0 : Math.round(volume * 100);
  return (
    <>
      <div className="flex border border-line-strong text-sm" role="group" aria-label="Lobby music">
        {(["upbeat", "lofi"] as const).map((s) => (
          <button key={s} onClick={() => onLobby(s)} className={option(!muted && lobby === s)}>
            {s === "upbeat" ? "Upbeat" : "Lofi"}
          </button>
        ))}
        <button onClick={() => onMute(!muted)} className={option(muted)} title={muted ? "Unmute music" : "Mute music"}>
          {muted ? "🔇 Muted" : "Mute"}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <span aria-hidden>{shown === 0 ? "🔈" : shown < 50 ? "🔉" : "🔊"}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={shown}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          className="w-28 cursor-pointer accent-coral"
          aria-label="Music volume"
        />
        <span className="w-9 tabular-nums">{shown}%</span>
      </label>
    </>
  );
}
