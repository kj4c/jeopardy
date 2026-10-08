"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatScore } from "@/lib/board";
import { emitAck, getSocket } from "@/lib/socket";
import type { RemoteSnapshot } from "@/lib/types";

type Status = "loading" | "ready" | "bad_key" | "not_found" | "revoked";

const storageKey = (slug: string) => `jeopardy:remote:${slug}`;

/** Keeps the phone awake while the remote is open, where the browser supports it. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } }).wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void lock?.release().catch(() => {});
    };
  }, []);
}

export default function RemotePage() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [snap, setSnap] = useState<RemoteSnapshot | null>(null);
  const [connected, setConnected] = useState(true);
  useWakeLock();

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("k");
    if (fromUrl) {
      localStorage.setItem(storageKey(slug), fromUrl);
      url.searchParams.delete("k");
      window.history.replaceState(null, "", url.pathname);
    }
    const key = fromUrl ?? localStorage.getItem(storageKey(slug));
    if (!key) {
      setStatus("bad_key");
      return;
    }
    const socket = getSocket();
    const join = () =>
      emitAck<{ snapshot?: RemoteSnapshot; error?: string }>("remote:join", { slug, key })
        .then((res) => {
          if (res.snapshot) {
            setSnap(res.snapshot);
            setStatus("ready");
          } else if (res.error === "bad_key") {
            localStorage.removeItem(storageKey(slug));
            setStatus("bad_key");
          } else setStatus("not_found");
        })
        .catch(() => {});
    const onConnect = () => {
      setConnected(true);
      join();
    };
    const onDisconnect = () => setConnected(false);
    const onRevoked = () => {
      localStorage.removeItem(storageKey(slug));
      setStatus("revoked");
    };
    const onClosed = () => setStatus("not_found");
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("remote:state", setSnap);
    socket.on("remote:revoked", onRevoked);
    socket.on("room:closed", onClosed);
    if (socket.connected) join();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("remote:state", setSnap);
      socket.off("remote:revoked", onRevoked);
      socket.off("room:closed", onClosed);
    };
  }, [slug]);

  const clueKey = snap?.phase.kind === "clue" ? snap.phase.question : snap?.phase.kind === "quickfire" ? snap.phase.index : null;
  useEffect(() => {
    if (clueKey !== null && clueKey !== undefined) navigator.vibrate?.(40);
  }, [clueKey]);

  if (status !== "ready" || !snap) {
    const message = {
      loading: ["Connecting…", ""],
      bad_key: ["This host link doesn't work", "On the big screen, open ⚙ Settings → Host phone → Connect and scan the QR again."],
      revoked: ["Host QR was changed", "On the big screen, open ⚙ Settings → Host phone → Connect and scan the new QR."],
      not_found: ["Room not found", "The game may have been deleted."],
      ready: ["Connecting…", ""],
    }[status];
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-4xl">{message[0]}</h1>
        {message[1] && <p className="max-w-sm text-muted">{message[1]}</p>}
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="label !text-coral">Host · answers</p>
        <p className="label flex items-center gap-2 truncate">
          {snap.roomName}
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-good" : "animate-pulse bg-bad"}`} />
        </p>
      </header>
      <section className="flex flex-1 flex-col gap-5 px-5 py-6">
        <PhaseView phase={snap.phase} />
      </section>
      <Scores teams={snap.teams} />
    </main>
  );
}

function TeamTag({ team }: { team?: { name: string; color: string } }) {
  if (!team) return null;
  return <span style={{ color: team.color }}>{team.name}</span>;
}

function Answer({ text, label = "Answer" }: { text: string; label?: string }) {
  return (
    <div className="animate-pop border-2 border-good/60 bg-good/10 px-5 py-4">
      <p className="label mb-1 !text-good">{label}</p>
      <p className="font-display text-4xl leading-tight text-cream">{text || <span className="text-muted">No answer set</span>}</p>
    </div>
  );
}

function Question({ text }: { text: string }) {
  return <p className="text-xl leading-snug text-cream/90">{text || <span className="text-muted">No question set</span>}</p>;
}

function PhaseView({ phase }: { phase: RemoteSnapshot["phase"] }) {
  if (phase.kind === "board") {
    return (
      <div className="m-auto text-center">
        <p className="font-display text-3xl">Waiting for a tile…</p>
        {phase.picking && (
          <p className="mt-2 text-muted">
            <TeamTag team={phase.picking} /> picks next
          </p>
        )}
        <p className="mt-6 text-sm text-muted">The answer shows up here as soon as a question is picked.</p>
      </div>
    );
  }

  if (phase.kind === "clue") {
    const dd = phase.dailyDouble;
    return (
      <div key={phase.question} className="animate-fade-up flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="label">
            {phase.category} · {dd ? "Daily Double" : formatScore(phase.value)}
          </p>
          {phase.revealed && <p className="label !text-muted">Revealed</p>}
        </div>
        {dd && (
          <p className="text-lg">
            <TeamTag team={dd.team} /> {dd.wager !== undefined ? `wagered ${formatScore(dd.wager)}` : "is making a wager…"}
          </p>
        )}
        <Answer text={phase.answer} />
        <Question text={phase.question} />
        {phase.media && <p className="text-sm text-muted">{phase.media === "video" ? "🎬 Has a video" : "🖼 Has a picture"} on the big screen</p>}
        {phase.hint && (
          <p className="border-l-2 border-[#ffd75e] pl-3 text-cream/90">
            <span className="label mr-2 !text-[#ffd75e]">💡 Hint</span>
            {phase.hint}
          </p>
        )}
        {phase.answering && !phase.revealed && (
          <p className="text-lg">
            <TeamTag team={phase.answering} /> is answering
          </p>
        )}
      </div>
    );
  }

  if (phase.kind === "final") {
    return (
      <div className="animate-fade-up flex flex-col gap-5">
        <p className="label">Final Kashpot! · {phase.category}</p>
        <Answer text={phase.answer} />
        <Question text={phase.question} />
        <div className="flex flex-col divide-y divide-line border border-line">
          {phase.responses.map((r) => (
            <div key={r.team.name} className="flex flex-col gap-1 px-4 py-3">
              <p className="flex items-center justify-between gap-3">
                <TeamTag team={r.team} />
                <span className="font-mono text-sm text-muted">
                  {r.wager !== undefined ? `wager ${formatScore(r.wager)}` : "no wager yet"}
                </span>
              </p>
              <p className={r.judged === true ? "text-good" : r.judged === false ? "text-bad" : "text-cream"}>
                {r.text ?? <span className="text-muted">{phase.step === "wager" ? "—" : "Writing…"}</span>}
                {r.judged !== undefined && (r.judged ? " ✓" : " ✕")}
              </p>
            </div>
          ))}
          {!phase.responses.length && <p className="px-4 py-3 text-muted">No teams playing.</p>}
        </div>
      </div>
    );
  }

  if (phase.kind === "quickfire") {
    if (phase.question === undefined) {
      return <p className="font-display m-auto text-3xl">Quickfire complete</p>;
    }
    return (
      <div key={phase.index} className="animate-fade-up flex flex-col gap-5">
        <p className="label">
          Quickfire · {phase.index + 1} of {phase.total}
        </p>
        <Answer text={phase.answer ?? ""} />
        <Question text={phase.question} />
        {phase.answering && (
          <p className="text-lg">
            <TeamTag team={phase.answering} /> buzzed in
          </p>
        )}
      </div>
    );
  }

  return <p className="font-display m-auto text-3xl">Game over</p>;
}

function Scores({ teams }: { teams: RemoteSnapshot["teams"] }) {
  return (
    <footer className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3">
      {teams.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-2 bg-ink px-4 py-2.5">
          <span className="truncate text-sm" style={{ color: t.color }}>
            {t.name}
          </span>
          <span className="font-mono text-sm tabular-nums">{formatScore(t.score)}</span>
        </div>
      ))}
    </footer>
  );
}
