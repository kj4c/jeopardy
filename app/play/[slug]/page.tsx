"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatScore } from "@/lib/board";
import { emitAck, getPlayerId, getSocket } from "@/lib/socket";
import type { PublicSnapshot, Team } from "@/lib/types";

const NAME_KEY = "jeopardy_name";

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

export default function PlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [exists, setExists] = useState<boolean | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [snap, setSnap] = useState<PublicSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [changingTeam, setChangingTeam] = useState(false);
  const playerId = useRef("");

  useEffect(() => {
    playerId.current = getPlayerId();
    setName(localStorage.getItem(NAME_KEY) ?? "");
    fetch(`/api/public/rooms/${slug}`)
      .then((r) => setExists(r.ok))
      .catch(() => setExists(false));
  }, [slug]);

  useEffect(() => {
    if (!exists || !name) return;
    const socket = getSocket();
    let pingTimer: ReturnType<typeof setInterval>;

    const measure = async () => {
      const t0 = performance.now();
      try {
        await emitAck("ping:check", Date.now(), 3000);
        socket.emit("player:latency", { rtt: performance.now() - t0 });
      } catch {}
    };
    const join = async () => {
      const res = await emitAck<{ ok?: boolean; error?: string }>("player:join", {
        slug,
        playerId: playerId.current,
        name,
      }).catch(() => ({ error: "timeout" }));
      if (res.error === "not_found") setExists(false);
      else {
        setConnected(true);
        measure();
      }
    };
    const onConnect = () => join();
    const onDisconnect = () => setConnected(false);
    const onRemoved = () => setRemoved(true);
    const onClosed = () => setExists(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("public:state", setSnap);
    socket.on("player:removed", onRemoved);
    socket.on("room:closed", onClosed);
    if (socket.connected) join();
    pingTimer = setInterval(measure, 8000);
    return () => {
      clearInterval(pingTimer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("public:state", setSnap);
      socket.off("player:removed", onRemoved);
      socket.off("room:closed", onClosed);
    };
  }, [exists, name, slug]);

  if (exists === false) {
    return (
      <Shell>
        <p className="label mb-3">/play/{slug}</p>
        <h1 className="font-display text-5xl">Room not found.</h1>
        <p className="mt-3 text-muted">Check the room name with your host.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
          <Link href="/join" className="btn btn-ghost">
            Try another room
          </Link>
        </div>
      </Shell>
    );
  }
  if (removed) {
    return (
      <Shell>
        <h1 className="font-display text-5xl">You were removed from the room.</h1>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
          <button className="btn btn-ghost" onClick={() => window.location.reload()}>
            Rejoin
          </button>
        </div>
      </Shell>
    );
  }
  if (exists === null || name === null) return <Shell />;

  if (!name) {
    return (
      <NameForm
        onSubmit={(n) => {
          localStorage.setItem(NAME_KEY, n);
          setName(n);
        }}
      />
    );
  }
  if (!snap) {
    return (
      <Shell>
        <p className="font-display text-4xl text-muted">Joining…</p>
      </Shell>
    );
  }

  const me = snap.players.find((p) => p.id === playerId.current);
  const myTeam = snap.teams.find((t) => t.id === me?.teamId);

  if (!myTeam || changingTeam) {
    return (
      <TeamPicker
        snap={snap}
        name={name}
        current={myTeam?.id}
        onPick={(teamId) => {
          getSocket().emit("player:team", { teamId });
          setChangingTeam(false);
        }}
        onRename={() => {
          localStorage.removeItem(NAME_KEY);
          setName("");
        }}
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <GradientBackground variant="hero" accent={myTeam.color} waves={false} />
      <header className="flex items-center justify-between border-b border-line bg-ink/50 px-4 py-3 backdrop-blur-md">
        <div className="min-w-0">
          <p className="label truncate">{snap.name}</p>
          <p className="truncate font-medium">
            {name} · <span style={{ color: myTeam.color }}>{myTeam.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!connected && <span className="label !text-bad">offline</span>}
          <span className="text-xl font-bold tabular-nums">{formatScore(myTeam.score)}</span>
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={() => setChangingTeam(true)}>
            Team
          </button>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <PlayerStage snap={snap} myTeam={myTeam} playerId={playerId.current} />
      </div>
      <TeamStrip teams={snap.teams} myTeamId={myTeam.id} />
    </main>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <GradientBackground variant="hero" waves={false} />
      {children}
    </main>
  );
}

function NameForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Shell>
      <form
        className="animate-fade-up w-full max-w-sm text-left"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim().slice(0, 24));
        }}
      >
        <p className="label mb-3">Welcome, contestant</p>
        <h1 className="font-display mb-8 text-6xl">What&apos;s your name?</h1>
        <input
          className="field py-4 text-lg"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          autoFocus
        />
        <button className="btn btn-primary mt-4 w-full py-4 text-lg" disabled={!value.trim()}>
          Continue
        </button>
      </form>
    </Shell>
  );
}

function TeamPicker({
  snap,
  name,
  current,
  onPick,
  onRename,
}: {
  snap: PublicSnapshot;
  name: string;
  current?: string;
  onPick: (teamId: string) => void;
  onRename: () => void;
}) {
  return (
    <Shell>
      <div className="animate-fade-up w-full max-w-sm text-left">
        <p className="label mb-3">{snap.name}</p>
        <h1 className="font-display mb-2 text-5xl">Pick your team.</h1>
        <p className="mb-8 text-muted">
          Playing as <span className="text-cream">{name}</span> ·{" "}
          <button className="underline underline-offset-4" onClick={onRename}>
            change
          </button>
        </p>
        {snap.teams.length === 0 ? (
          <p className="text-muted">The host hasn&apos;t created any teams yet.</p>
        ) : (
          <div className="space-y-3">
            {snap.teams.map((t) => {
              const members = snap.players.filter((p) => p.teamId === t.id && p.connected);
              return (
                <button
                  key={t.id}
                  onClick={() => onPick(t.id)}
                  className={`panel flex w-full items-center gap-4 p-4 text-left transition active:scale-[0.99] ${
                    current === t.id ? "!border-coral" : ""
                  }`}
                >
                  <span className="h-10 w-2 shrink-0" style={{ background: t.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-medium">{t.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {members.length ? members.map((m) => m.name).join(", ") : "No players yet"}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-muted">{formatScore(t.score)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}

function TeamStrip({ teams, myTeamId }: { teams: Team[]; myTeamId: string }) {
  return (
    <div className="flex overflow-x-auto border-t border-line bg-ink/60 backdrop-blur-md">
      {teams.map((t) => (
        <div key={t.id} className={`min-w-28 flex-1 border-r border-line px-3 py-2 ${t.id === myTeamId ? "bg-cream/5" : ""}`}>
          <div className="mb-1 h-0.5 w-6" style={{ background: t.color }} />
          <p className="truncate text-xs text-muted">{t.name}</p>
          <p className="font-bold tabular-nums">{formatScore(t.score)}</p>
        </div>
      ))}
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function PlayerStage({ snap, myTeam, playerId }: { snap: PublicSnapshot; myTeam: Team; playerId: string }) {
  const { phase } = snap;

  if (snap.mode === "local") {
    return <Waiting title="In-person game" body="The host is running this one by hand. Watch the big screen." />;
  }
  if (phase.kind === "board") {
    return <Waiting title="Get ready." body="Waiting for the host to pick the next clue." />;
  }

  if (phase.kind === "clue") {
    const dd = phase.dailyDouble;
    if (dd) {
      const ddTeam = snap.teams.find((t) => t.id === dd.teamId);
      if (dd.teamId === myTeam.id && dd.wager === undefined) {
        return <WagerInput title="Daily Double!" max={dd.maxWager ?? 0} />;
      }
      return (
        <Waiting
          title="Daily Double"
          body={
            ddTeam
              ? dd.wager !== undefined
                ? `${ddTeam.name} wagered ${formatScore(dd.wager)}.`
                : `${ddTeam.name} is making a wager.`
              : "The host is choosing a team."
          }
        />
      );
    }
    if (phase.resolvedBy) {
      const winner = snap.teams.find((t) => t.id === phase.resolvedBy);
      return (
        <Waiting
          title={winner ? (winner.id === myTeam.id ? "Nailed it." : `${winner.name} got it.`) : "No one got it."}
          body="Waiting for the next clue."
        />
      );
    }
    return <Buzzer snap={snap} myTeam={myTeam} playerId={playerId} locked={phase.lockedTeams.includes(myTeam.id)} />;
  }

  const eligible = phase.eligible.includes(myTeam.id);
  if (phase.step === "wager") {
    if (!eligible) return <Waiting title="Final Jeopardy" body={`Category: ${phase.category}. Your team sits this one out.`} />;
    const wager = phase.wagers[myTeam.id];
    if (wager) return <Waiting title="Wager locked." body={`Submitted by ${wager.by ?? "the host"}.`} />;
    return <WagerInput title={phase.category || "Final Jeopardy"} label="Final Jeopardy" max={Math.max(myTeam.score, 0)} />;
  }
  if (phase.step === "clue") {
    if (!eligible) return <Waiting title="Final Jeopardy" body="Watch the screen." />;
    const answer = phase.answers[myTeam.id];
    if (answer) return <Waiting title="Response in." body={`Submitted by ${answer.by ?? "the host"}.`} />;
    return <FinalAnswerInput />;
  }
  return <Waiting title="Final Jeopardy" body="Eyes on the big screen." />;
}

function Waiting({ title, body }: { title: string; body: string }) {
  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-6xl">{title}</h1>
      <p className="mt-4 text-lg text-muted">{body}</p>
    </div>
  );
}

type BuzzFeedback = "early" | "penalty" | null;

function Buzzer({
  snap,
  myTeam,
  playerId,
  locked,
}: {
  snap: PublicSnapshot;
  myTeam: Team;
  playerId: string;
  locked: boolean;
}) {
  const { buzz } = snap;
  const [feedback, setFeedback] = useState<BuzzFeedback>(null);
  const [pending, setPending] = useState(false);
  const myIndex = buzz.buzzes.findIndex((b) => b.playerId === playerId);
  const firstOnTeam = buzz.buzzes.find((b) => b.teamId === myTeam.id);
  const armed = buzz.status === "armed";

  const prevStatus = useRef(buzz.status);
  useEffect(() => {
    if (buzz.status === "armed" && prevStatus.current !== "armed") vibrate(60);
    if (buzz.status !== "armed") setFeedback(null);
    prevStatus.current = buzz.status;
  }, [buzz.status]);

  const press = useCallback(async () => {
    if (pending || myIndex !== -1 || locked) return;
    setPending(true);
    try {
      const res = await emitAck<{ ok: boolean; reason?: string }>("player:buzz", {}, 3000);
      if (res.ok) vibrate([40, 30, 80]);
      else if (res.reason === "early" || res.reason === "penalty") {
        setFeedback(res.reason);
        vibrate(200);
      }
    } catch {
    } finally {
      setPending(false);
    }
  }, [pending, myIndex, locked]);

  const phase = snap.phase;
  const pickedBy =
    phase.kind === "clue" && snap.buzzMode === "countdown" && !phase.lockedTeams.includes(phase.pickedBy ?? "")
      ? phase.pickedBy
      : undefined;
  const pickedTeam = pickedBy ? snap.teams.find((t) => t.id === pickedBy) : undefined;
  let title: string;
  let sub = "";
  if (locked) {
    title = "Locked out";
    sub = "Your team answered wrong on this one.";
  } else if (myIndex !== -1) {
    title = `You buzzed ${ordinal(myIndex + 1)}`;
    sub =
      firstOnTeam?.playerId === playerId
        ? myIndex === 0
          ? "First in the room!"
          : `First on ${myTeam.name}`
        : `${firstOnTeam?.name} beat you on your team`;
  } else if (buzz.status === "countdown") {
    title = String(buzz.count ?? "");
    sub = feedback === "early" ? "Too early! Short penalty." : "Wait for it…";
  } else if (armed) {
    title = "BUZZ";
    sub =
      feedback === "penalty" ? "Penalty… hold on" : snap.buzzMode === "instant" ? "Buzzing hides the question!" : "";
  } else if (pickedTeam) {
    title = pickedTeam.id === myTeam.id ? "Your pick" : `${pickedTeam.name} first`;
    sub =
      pickedTeam.id === myTeam.id
        ? "Your team answers first. Say it out loud!"
        : "If they miss or pass, get ready for the countdown.";
  } else {
    title = buzz.buzzes.length
      ? "Buzzers closed"
      : snap.buzzMode === "instant"
        ? "Wait for the question"
        : "Wait for the countdown";
  }

  const live = armed && !locked && myIndex === -1;
  return (
    <div className="flex w-full flex-col items-center gap-8">
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          press();
        }}
        disabled={locked || myIndex !== -1}
        className="relative aspect-square w-[min(78vw,26rem)] touch-none select-none rounded-full transition-transform active:scale-95"
        style={{ animation: live ? "glow-pulse 1.4s ease-in-out infinite" : undefined }}
        aria-label="Buzz"
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #3b4bdc, #7a4fe0, #ff4f9a, #ff6fc8, #f5a14a, #ff4f9a, #3b4bdc)",
            animation: "spin-slow 8s linear infinite",
            opacity: live ? 1 : locked ? 0.15 : 0.35,
            filter: live ? "saturate(1.2)" : "grayscale(0.5)",
          }}
        />
        <span className="halftone absolute inset-0 rounded-full opacity-40" />
        <span className="grain absolute inset-0 rounded-full" />
        <span
          className="absolute inset-[6%] rounded-full border border-white/25"
          style={{ background: myIndex !== -1 ? myTeam.color + "55" : "transparent" }}
        />
        <span
          key={title}
          className={`font-display animate-pop relative z-10 flex h-full items-center justify-center px-6 text-center leading-none ${
            live ? "text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]" : ""
          } ${
            title.length <= 4 ? "text-[min(22vw,8rem)]" : "text-[min(10vw,3rem)]"
          }`}
        >
          {title}
        </span>
      </button>
      <p className="min-h-6 text-lg text-cream/80">{sub}</p>
    </div>
  );
}

function WagerInput({ title, label = "Daily Double", max }: { title: string; label?: string; max: number }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="animate-fade-up w-full max-w-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0 || amount > max) {
          setError(`Wager between $0 and ${formatScore(max)}`);
          return;
        }
        setBusy(true);
        const res = await emitAck<{ ok?: boolean; error?: string }>("player:wager", { amount }).catch(() => ({
          error: "timeout",
        }));
        setBusy(false);
        if (res.error) setError("Couldn't submit. A teammate may have already locked one in.");
      }}
    >
      <p className="label mb-3">{label}</p>
      <h1 className="font-display mb-2 text-5xl">{title}</h1>
      <p className="mb-6 text-muted">Wager up to {formatScore(max)}. Only one teammate needs to submit.</p>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        className="field py-4 text-center text-3xl"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        placeholder="$0"
        autoFocus
      />
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <button className="btn btn-primary mt-4 w-full py-4 text-lg" disabled={busy || value === ""}>
        Lock in wager
      </button>
    </form>
  );
}

function FinalAnswerInput() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="animate-fade-up w-full max-w-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await emitAck<{ ok?: boolean; error?: string }>("player:final-answer", { text: value }).catch(
          () => ({ error: "timeout" }),
        );
        setBusy(false);
        if (res.error) setError("Couldn't submit. A teammate may have already answered.");
      }}
    >
      <p className="label mb-3">Final Jeopardy</p>
      <h1 className="font-display mb-6 text-5xl">Your response</h1>
      <textarea
        className="field min-h-28 text-lg"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What is…"
        maxLength={200}
        autoFocus
      />
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <button className="btn btn-primary mt-4 w-full py-4 text-lg" disabled={busy || !value.trim()}>
        Submit response
      </button>
    </form>
  );
}
