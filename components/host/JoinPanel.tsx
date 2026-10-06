"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { Player, Team } from "@/lib/types";

function useJoinUrl(slug: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const origin = window.location.origin;
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    if (!isLocal) {
      setUrl(`${origin}/play/${slug}`);
      return;
    }
    fetch("/api/public/info")
      .then((r) => r.json())
      .then((info: { lan: string[] }) => setUrl(`${info.lan[0] ?? origin}/play/${slug}`))
      .catch(() => setUrl(`${origin}/play/${slug}`));
  }, [slug]);
  return url;
}

export function JoinPanel({
  slug,
  teams,
  players,
  onRemovePlayer,
  onClose,
}: {
  slug: string;
  teams: Team[];
  players: Player[];
  onRemovePlayer: (id: string) => void;
  onClose: () => void;
}) {
  const url = useJoinUrl(slug);
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#161211", light: "#f3ece6" } }).then(setQr);
  }, [url]);

  const unassigned = players.filter((p) => !p.teamId || !teams.some((t) => t.id === p.teamId));

  return (
    <aside className="panel animate-fade-up flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="label">Join on your phone</p>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Hide join panel">
          ✕
        </button>
      </div>
      <div className="flex flex-col items-center gap-3 p-5">
        {qr ? (
          <img src={qr} alt="QR code to join" className="corner-marks w-full max-w-60" />
        ) : (
          <div className="aspect-square w-full max-w-60 bg-surface" />
        )}
        <p className="break-all text-center font-mono text-sm text-cream">{url.replace(/^https?:\/\//, "")}</p>
      </div>
      <div className="border-t border-line px-5 py-4">
        <p className="label mb-3">Players · {players.filter((p) => p.connected).length} online</p>
        {teams.map((team) => {
          const members = players.filter((p) => p.teamId === team.id);
          return (
            <div key={team.id} className="mb-3">
              <p className="mb-1 flex items-center gap-2 text-sm font-medium">
                <span className="h-2.5 w-2.5" style={{ background: team.color }} />
                {team.name}
              </p>
              {members.length === 0 ? (
                <p className="pl-4 text-xs text-muted">No one yet</p>
              ) : (
                <PlayerList players={members} onRemove={onRemovePlayer} />
              )}
            </div>
          );
        })}
        {unassigned.length > 0 && (
          <div>
            <p className="mb-1 text-sm text-muted">Choosing a team…</p>
            <PlayerList players={unassigned} onRemove={onRemovePlayer} />
          </div>
        )}
      </div>
    </aside>
  );
}

function PlayerList({ players, onRemove }: { players: Player[]; onRemove: (id: string) => void }) {
  return (
    <ul className="pl-4">
      {players.map((p) => (
        <li key={p.id} className="group flex items-center justify-between text-sm">
          <span className={p.connected ? "" : "text-muted line-through"}>{p.name}</span>
          <button
            className="text-xs text-muted opacity-0 transition hover:text-bad group-hover:opacity-100"
            onClick={() => onRemove(p.id)}
          >
            remove
          </button>
        </li>
      ))}
    </ul>
  );
}
