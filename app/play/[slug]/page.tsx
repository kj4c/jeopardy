"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { PowerNoticeToast } from "@/components/PowerNoticeToast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatScore } from "@/lib/board";
import { POWER_TYPES, POWERS } from "@/lib/powers";
import { emitAck, getPlayerId, getSocket } from "@/lib/socket";
import type { Player, PowerType, PublicSnapshot, Team } from "@/lib/types";

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
      {snap.mode === "live" && me && <PowerPanel snap={snap} myTeam={myTeam} me={me} />}
      <TeamStrip teams={snap.teams} myTeamId={myTeam.id} />
      <PowerNoticeToast notice={snap.powerNotice} teams={snap.teams} />
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
    const duel = phase.effects?.duel;
    if (duel) {
      const mine = duel.find((d) => d.teamId === myTeam.id);
      const label = duel
        .map((d) => `${d.name ?? "anyone"} (${snap.teams.find((t) => t.id === d.teamId)?.name ?? "?"})`)
        .join(" vs ");
      if (!mine) return <Waiting title="1v1" body={`${label}. Sit tight and watch.`} />;
      if (mine.playerId && mine.playerId !== playerId) {
        return <Waiting title="1v1" body={`Only ${mine.name} can buzz for your team. ${label}.`} />;
      }
    }
    const blocker = phase.effects?.blocked.find((b) => b.teamId === myTeam.id)?.by;
    return (
      <Buzzer
        snap={snap}
        myTeam={myTeam}
        playerId={playerId}
        locked={phase.lockedTeams.includes(myTeam.id) || !!blocker}
        blockedBy={blocker ? snap.teams.find((t) => t.id === blocker)?.name ?? "another team" : undefined}
      />
    );
  }

  if (phase.kind === "ended") {
    const sorted = [...snap.teams].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const tied = sorted.length > 1 && sorted[1].score === winner?.score;
    return (
      <Waiting
        title={!winner ? "Game over." : tied ? "It's a tie!" : winner.id === myTeam.id ? "You won!" : `${winner.name} wins!`}
        body={`Game over. Your team finished with ${formatScore(myTeam.score)}.`}
      />
    );
  }

  if (phase.kind === "quickfire") {
    if (phase.index >= phase.total) return <Waiting title="Quickfire done." body="Eyes on the big screen." />;
    const label = `Quickfire · ${phase.index + 1} of ${phase.total} · ${formatScore(phase.points)}`;
    if (phase.resolvedBy) {
      const winner = snap.teams.find((t) => t.id === phase.resolvedBy);
      const missed = snap.teams.find((t) => t.id === phase.missedBy);
      return (
        <div>
          <p className="label mb-4">{label}</p>
          <Waiting
            title={
              winner
                ? winner.id === myTeam.id
                  ? "Nailed it."
                  : `${winner.name} got it.`
                : missed
                  ? missed.id === myTeam.id
                    ? "Not quite."
                    : `${missed.name} missed.`
                  : "No one got it."
            }
            body={missed && !winner ? "No steals in quickfire. Next question coming up." : "Next question coming up."}
          />
        </div>
      );
    }
    return (
      <div className="flex w-full flex-col items-center">
        <p className="label mb-6">{label}</p>
        <Buzzer key={phase.index} snap={snap} myTeam={myTeam} playerId={playerId} locked={false} />
      </div>
    );
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
  blockedBy,
}: {
  snap: PublicSnapshot;
  myTeam: Team;
  playerId: string;
  locked: boolean;
  blockedBy?: string;
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
  const forced = phase.kind === "clue" ? phase.forced : undefined;
  const pickedBy =
    phase.kind === "clue" &&
    (snap.buzzMode === "countdown" || forced) &&
    !phase.lockedTeams.includes(phase.pickedBy ?? "")
      ? phase.pickedBy
      : undefined;
  const pickedTeam = pickedBy ? snap.teams.find((t) => t.id === pickedBy) : undefined;
  const sender = forced ? snap.teams.find((t) => t.id === forced.by)?.name : undefined;
  let title: string;
  let sub = "";
  if (blockedBy) {
    title = "Blocked";
    sub = `${blockedBy} blocked your team from this question.`;
  } else if (locked) {
    title = "Locked out";
    sub = "Your team is out on this one.";
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
  } else if (pickedTeam && forced) {
    title = pickedTeam.id === myTeam.id ? "You're up" : `${pickedTeam.name} first`;
    sub =
      pickedTeam.id === myTeam.id
        ? `${sender ?? "Another team"} sent you this random question. You have to answer it!`
        : `${sender ?? "A team"} sent them a random question. You can buzz once they've answered.`;
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

function PowerPanel({ snap, myTeam, me }: { snap: PublicSnapshot; myTeam: Team; me: Player }) {
  const settings = snap.powerSettings;
  const owned = POWER_TYPES.filter((p) => (myTeam.powers?.[p] ?? 0) > 0);
  const queued = snap.queued.filter((q) => q.teamId === myTeam.id);
  const leader = snap.players.find((p) => p.teamId === myTeam.id && p.leader);
  const [error, setError] = useState("");
  const [targeting, setTargeting] = useState<PowerType | null>(null);

  const [busy, setBusy] = useState(false);

  const needsDraft = !!settings?.enabled.length && settings.draftCount > 0 && !myTeam.drafted;
  if (!needsDraft && !owned.length && !queued.length) return null;

  const phase = snap.phase;
  const fx = phase.kind === "clue" ? phase.effects : undefined;
  const myTurn = snap.answeringTeam === myTeam.id;
  const usable = (p: PowerType) => {
    if (POWERS[p].timing === "board") return phase.kind === "board" && !queued.some((q) => q.power === p);
    if (!myTurn) return false;
    if (p === "second") return !fx?.second.includes(myTeam.id) && !fx?.retried.includes(myTeam.id);
    return !fx?.hints.includes(myTeam.id);
  };

  async function use(power: PowerType, targetTeamId?: string, names?: { playerName: string; targetPlayerName: string }) {
    setBusy(true);
    setError("");
    const res = await emitAck<{ ok?: boolean; error?: string }>("player:power", {
      power,
      targetTeamId,
      ...names,
    }).catch(() => ({ error: "timeout" }));
    setBusy(false);
    setTargeting(null);
    if (res.error) setError(res.error === "not_your_turn" ? "Wait until your team is answering." : "Couldn't use that right now.");
    else vibrate(60);
  }

  if (needsDraft) {
    return me.leader ? (
      <DraftPicker enabled={settings!.enabled} count={settings!.draftCount} />
    ) : (
      <section className="border-t border-line bg-ink/60 px-4 py-3 text-center text-sm text-muted backdrop-blur-md">
        {leader ? `${leader.name} is picking your team's power-ups.` : "Your team leader picks power-ups."}
      </section>
    );
  }

  return (
    <section className="border-t border-line bg-ink/60 px-4 py-3 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <p className="label">Team power-ups</p>
        {!me.leader && leader && <p className="text-xs text-muted">Only {leader.name} can use them</p>}
      </div>
      {queued.length > 0 && (
        <p className="mb-2 text-sm text-coral">
          Ready for the next question:{" "}
          {queued
            .map((q) => `${POWERS[q.power].name}${q.targetTeamId ? ` → ${snap.teams.find((t) => t.id === q.targetTeamId)?.name ?? ""}` : ""}`)
            .join(", ")}
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {owned.map((p) => {
          const info = POWERS[p];
          const can = me.leader && usable(p) && !busy;
          return (
            <button
              key={p}
              disabled={!can}
              onClick={() => (POWERS[p].needsTarget ? setTargeting(targeting === p ? null : p) : use(p))}
              className={`flex min-w-36 shrink-0 flex-col items-start border p-2.5 text-left transition ${
                can ? "border-coral/70 bg-coral/10 active:scale-[0.98]" : "border-line-strong opacity-60"
              }`}
            >
              <span className="text-sm font-medium">
                {info.icon} {info.name} {(myTeam.powers?.[p] ?? 0) > 1 && <span className="text-muted">×{myTeam.powers?.[p]}</span>}
              </span>
              <span className="text-xs text-muted">
                {info.timing === "board" ? "Use before a question is picked" : "Use when your team is answering"}
              </span>
            </button>
          );
        })}
      </div>
      {(targeting === "block" || targeting === "rng") && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">
            {targeting === "block" ? "Block which team?" : "Send a random question to which team?"}
          </span>
          {snap.teams
            .filter((t) => t.id !== myTeam.id)
            .map((t) => (
              <button key={t.id} className="btn btn-ghost btn-sm" style={{ borderColor: t.color }} onClick={() => use(targeting, t.id)}>
                {t.name}
              </button>
            ))}
        </div>
      )}
      {targeting === "duel" && (
        <DuelPicker
          snap={snap}
          myTeamId={myTeam.id}
          busy={busy}
          onSubmit={(teamId, names) => use("duel", teamId, names)}
          onCancel={() => setTargeting(null)}
        />
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </section>
  );
}

function DuelPicker({
  snap,
  myTeamId,
  busy,
  onSubmit,
  onCancel,
}: {
  snap: PublicSnapshot;
  myTeamId: string;
  busy: boolean;
  onSubmit: (teamId: string, names: { playerName: string; targetPlayerName: string }) => void;
  onCancel: () => void;
}) {
  const [team, setTeam] = useState<string | null>(null);
  const [opponent, setOpponent] = useState("");
  const [mine, setMine] = useState("");
  const namesOn = (teamId: string) => snap.players.filter((p) => p.teamId === teamId).map((p) => p.name);
  const target = snap.teams.find((t) => t.id === team);

  if (!team || !target) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Challenge which team?</span>
        {snap.teams
          .filter((t) => t.id !== myTeamId)
          .map((t) => (
            <button key={t.id} className="btn btn-ghost btn-sm" style={{ borderColor: t.color }} onClick={() => setTeam(t.id)}>
              {t.name}
            </button>
          ))}
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (opponent.trim() && mine.trim()) onSubmit(team, { playerName: mine.trim(), targetPlayerName: opponent.trim() });
      }}
    >
      <input
        className="field py-2"
        placeholder={`Who answers for ${target.name}?`}
        value={opponent}
        onChange={(e) => setOpponent(e.target.value)}
        list="duel-opponents"
        maxLength={24}
        autoFocus
      />
      <datalist id="duel-opponents">
        {namesOn(team).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <input
        className="field py-2"
        placeholder="Who answers for your team?"
        value={mine}
        onChange={(e) => setMine(e.target.value)}
        list="duel-mine"
        maxLength={24}
      />
      <datalist id="duel-mine">
        {namesOn(myTeamId).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm flex-1" disabled={busy || !opponent.trim() || !mine.trim()}>
          Start 1v1
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTeam(null)}>
          Back
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function DraftPicker({ enabled, count }: { enabled: PowerType[]; count: number }) {
  const [picks, setPicks] = useState<PowerType[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const left = count - picks.length;
  const n = (p: PowerType) => picks.filter((x) => x === p).length;

  return (
    <section className="border-t border-line bg-ink/80 px-4 py-4 backdrop-blur-md">
      <p className="label mb-1">You&apos;re the team leader</p>
      <p className="font-display mb-3 text-2xl">
        Pick {count} power-up{count === 1 ? "" : "s"} <span className="text-muted">· {left} left</span>
      </p>
      <div className="max-h-[38vh] space-y-2 overflow-y-auto">
        {enabled.map((p) => {
          const info = POWERS[p];
          return (
            <div key={p} className="flex items-center gap-3 border border-line-strong p-2.5">
              <span className="text-2xl">{info.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{info.name}</span>
                <span className="block text-xs text-muted">{info.description}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  className="btn btn-ghost btn-sm px-2.5"
                  disabled={!n(p)}
                  onClick={() => {
                    const i = picks.indexOf(p);
                    setPicks(picks.filter((_, j) => j !== i));
                  }}
                >
                  −
                </button>
                <span className="w-5 text-center font-bold tabular-nums">{n(p)}</span>
                <button className="btn btn-ghost btn-sm px-2.5" disabled={left <= 0} onClick={() => setPicks([...picks, p])}>
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <button
        className="btn btn-primary mt-3 w-full"
        disabled={busy || left !== 0}
        onClick={async () => {
          setBusy(true);
          const res = await emitAck<{ ok?: boolean; error?: string }>("player:draft", { picks }).catch(() => ({ error: "timeout" }));
          setBusy(false);
          if (res.error) setError("Couldn't lock in. Try again.");
        }}
      >
        Lock in
      </button>
    </section>
  );
}
