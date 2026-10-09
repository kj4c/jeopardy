"use client";

import { useEffect, useState } from "react";
import { formatScore } from "@/lib/board";
import { POWERS } from "@/lib/powers";
import { sfx } from "@/lib/sfx";
import type { PowerNotice, PowerType, Team } from "@/lib/types";

/** Power-ups with a full-screen animation when used; the rest get a toast. */
export const ANIMATED_POWERS = new Set<PowerType>(["block", "double", "rng", "hint", "second", "bet", "duel", "phone"]);

/** How long each animation stays up, in ms. */
export function animationLength(n: PowerNotice): number {
  if (n.kind === "settled") return 3800;
  if (n.kind === "stolen") return 4400;
  return { block: 3400, double: 2800, rng: 5600, hint: 3000, second: 3200, bet: 3400, duel: 3600, phone: 4000 }[n.power as string] ?? 3000;
}

type Props = { notice: PowerNotice; teams: Team[]; big?: boolean; myTeamId?: string };

export function PowerAnimation({ notice, teams, big, myTeamId }: Props) {
  const team = teams.find((t) => t.id === notice.teamId);
  const target = teams.find((t) => t.id === notice.targetTeamId);
  if (!team) return null;
  const name = (t: Team) => (t.id === myTeamId ? "Your team" : t.name);
  if (notice.kind === "settled") {
    return target ? <BetResult by={team} target={target} won={!!notice.won} amount={notice.amount ?? 0} big={big} name={name} /> : null;
  }
  if (notice.kind === "stolen") {
    return target ? <StealAnim thief={team} target={target} amount={notice.amount ?? 0} big={big} name={name} /> : null;
  }
  switch (notice.power) {
    case "block":
      return target ? <BlockAnim by={team} target={target} big={big} name={name} /> : null;
    case "double":
      return <DoubleAnim team={team} big={big} name={name} />;
    case "rng":
      return notice.rng && target ? <RngAnim by={team} target={target} rng={notice.rng} big={big} name={name} /> : null;
    case "second":
      return <ExtraLifeAnim team={team} big={big} name={name} />;
    case "hint":
      return <HintAnim team={team} big={big} name={name} />;
    case "phone":
      return <PhoneAnim team={team} big={big} name={name} />;
    case "bet":
      return <BetAnim by={team} others={teams.filter((t) => t.id !== team.id)} big={big} name={name} />;
    case "duel":
      return target ? <DuelAnim by={team} target={target} names={notice.duel} big={big} name={name} /> : null;
    default:
      return null;
  }
}

type Name = (t: Team) => string;

function Stage({ children, className = "", bg = "bg-ink/90" }: { children: React.ReactNode; className?: string; bg?: string }) {
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[6vh] overflow-hidden px-6 backdrop-blur-sm ${bg} ${className}`}>
      {children}
    </div>
  );
}

function Caption({ children, big, delay = 0 }: { children: React.ReactNode; big?: boolean; delay?: number }) {
  return (
    <p
      className={`font-display animate-pop relative z-10 max-w-5xl text-center leading-tight ${big ? "text-[clamp(2.5rem,5vw,5rem)]" : "text-3xl"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </p>
  );
}

function TeamName({ team, name }: { team: Team; name: Name }) {
  return <span style={{ color: team.color }}>{name(team)}</span>;
}

function BlockAnim({ by, target, big, name }: { by: Team; target: Team; big?: boolean; name: Name }) {
  const teamText = `font-display font-black italic leading-none ${big ? "text-[clamp(2.5rem,6vw,6.5rem)]" : "text-4xl"}`;
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-ink">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 45% 60% at 20% 50%, ${by.color}88 0%, transparent 70%), radial-gradient(ellipse 45% 60% at 80% 50%, ${target.color}88 0%, transparent 70%)`,
        }}
      />
      <p className={`label animate-pop absolute inset-x-0 top-[14%] text-center ${big ? "!text-xl" : ""}`}>
        {POWERS.block.icon} Block
      </p>
      <p
        className={`${teamText} absolute left-[5%] top-1/2 max-w-[30%] -translate-y-1/2`}
        style={{ color: by.color, textShadow: `0 0 40px ${by.color}99`, animation: "steal-win 0.5s ease 0.75s both" }}
      >
        {name(by)}
      </p>
      <div className="absolute right-[5%] top-1/2 max-w-[30%] -translate-y-1/2">
        <p
          className={`${teamText} text-right`}
          style={{ color: target.color, textShadow: `0 0 40px ${target.color}99`, animation: "shake 0.45s ease 0.6s both, steal-dim 0.6s ease 0.8s both" }}
        >
          {name(target)}
        </p>
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative" style={{ animation: "shush-pop 0.55s cubic-bezier(0.3, 1.5, 0.5, 1) 0.15s both" }}>
          <img
            src="/powers/shush.png"
            alt=""
            className={`aspect-square rounded-2xl object-cover ${big ? "h-[min(40vh,26vw)]" : "h-[min(30vh,32vw)]"}`}
            style={{ boxShadow: `0 20px 60px -10px rgba(0,0,0,0.7), 0 0 0 3px ${by.color}, 0 0 60px -5px ${by.color}` }}
          />
          <span
            className={`font-display absolute -bottom-[0.45em] left-1/2 -translate-x-1/2 -rotate-6 whitespace-nowrap rounded-full bg-cream px-[0.6em] py-[0.1em] font-black italic text-ink ${
              big ? "text-[clamp(1.8rem,3.5vw,3.2rem)]" : "text-2xl"
            }`}
            style={{ animation: "vs-slam 0.4s cubic-bezier(0.3, 1.4, 0.5, 1) 0.6s both" }}
          >
            SHHH 🤫
          </span>
        </div>
      </div>
      <p
        className={`font-display animate-pop absolute inset-x-0 bottom-[12%] px-6 text-center leading-tight ${
          big ? "text-[clamp(2rem,4vw,4rem)]" : "text-2xl"
        }`}
        style={{ animationDelay: "1000ms" }}
      >
        <TeamName team={by} name={name} /> blocked <TeamName team={target} name={name} /> from buzzing
      </p>
    </div>
  );
}

function DoubleAnim({ team, big, name }: { team: Team; big?: boolean; name: Name }) {
  const rows = Array.from({ length: 11 });
  return (
    <div
      className="fixed inset-0 z-[60] overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${team.color}, #ff6fc8 55%, #f5a14a)`, animation: "wipe-diag 0.35s ease-out both" }}
    >
      <div
        className="absolute left-1/2 top-1/2 flex w-[320vmax] flex-col"
        style={{ transform: "translate(-50%, -50%) rotate(-24deg)" }}
      >
        {rows.map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap font-display text-[15vmin] font-black italic leading-[0.92]"
            style={{
              animation: `${i % 2 ? "marquee-right" : "marquee-left"} ${0.7 + (i % 3) * 0.15}s linear infinite`,
              color: i % 2 ? "transparent" : "#fff",
              WebkitTextStroke: i % 2 ? "3px rgba(255,255,255,0.85)" : undefined,
            }}
          >
            {"DOUBLE ".repeat(24)}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="animate-pop border-4 border-white bg-ink px-8 py-5 text-center" style={{ animationDelay: "350ms" }}>
          <p className={`font-display leading-tight ${big ? "text-[clamp(2.5rem,5vw,5rem)]" : "text-3xl"}`}>
            <TeamName team={team} name={name} /> went 2×!
          </p>
          <p className={`text-muted ${big ? "text-2xl" : "text-base"}`}>Double points if right, double loss if wrong</p>
        </div>
      </div>
    </div>
  );
}

/** Flicks through `items`, slowing down, and lands on `final` after `startMs`. */
function useRoulette<T>(items: T[], final: T, startMs: number, steps = 22, sound?: "land" | "jackpot") {
  const [value, setValue] = useState<T>(items[0] ?? final);
  const [state, setState] = useState<"waiting" | "spinning" | "done">("waiting");
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = startMs;
    timers.push(setTimeout(() => setState("spinning"), startMs));
    for (let k = 0; k < steps; k++) {
      const item = items.length ? items[(k * 7 + 3) % items.length] : final;
      timers.push(
        setTimeout(() => {
          setValue(item);
          if (sound) sfx.tick();
        }, at),
      );
      at += 45 + k * k * 0.9;
    }
    timers.push(
      setTimeout(() => {
        setValue(final);
        setState("done");
        if (sound) sfx[sound]();
      }, at),
    );
    return () => timers.forEach(clearTimeout);
  }, [items, final, startMs, steps, sound]);
  return { value, state };
}

function RngAnim({
  by,
  target,
  rng,
  big,
  name,
}: {
  by: Team;
  target: Team;
  rng: NonNullable<PowerNotice["rng"]>;
  big?: boolean;
  name: Name;
}) {
  const category = useRoulette(rng.categories, rng.category, 300, 22, big ? "land" : undefined);
  const value = useRoulette(rng.values, rng.value, 2300, 18, big ? "jackpot" : undefined);
  const reel = `relative flex items-center justify-center overflow-hidden ${big ? "h-[min(20vh,10rem)]" : "h-24"}`;
  const glow = { textShadow: "0 4px 30px rgba(0,0,0,0.6)" };
  return (
    <Stage bg="bg-black/55">
      <p className={`label !text-cream/85 ${big ? "!text-xl" : ""}`} style={glow}>
        {POWERS.rng.icon} <TeamName team={by} name={name} /> sent <TeamName team={target} name={name} /> a random question
      </p>
      <div className={`flex w-full max-w-5xl flex-col items-center gap-2 ${big ? "" : "px-2"}`} style={glow}>
        <div className={`${reel} w-full`}>
          <span
            key={category.value + category.state}
            className={`font-display px-6 text-center leading-tight ${big ? "text-[clamp(2rem,5vw,5rem)]" : "text-3xl"} ${
              category.state === "done" ? "animate-pop text-coral" : ""
            }`}
            style={category.state === "done" ? undefined : { animation: "slot-tick 0.08s linear both" }}
          >
            {category.value}
          </span>
        </div>
        <div
          className={`${reel} ${big ? "w-[min(40vw,28rem)]" : "w-56"} transition-opacity`}
          style={{ opacity: value.state === "waiting" ? 0.3 : 1 }}
        >
          <span
            key={String(value.value) + value.state}
            className={`font-display tabular-nums ${big ? "text-[clamp(3rem,7vw,7rem)]" : "text-5xl"} ${
              value.state === "done" ? "animate-pop text-g-orange" : ""
            }`}
            style={value.state === "spinning" ? { animation: "slot-tick 0.08s linear both" } : undefined}
          >
            {value.state === "waiting" ? "$???" : formatScore(value.value)}
          </span>
        </div>
      </div>
      <div className="min-h-[1.2em]">
        {value.state === "done" && (
          <Caption big={big} delay={250}>
            <TeamName team={target} name={name} />, you&apos;re up!
          </Caption>
        )}
      </div>
    </Stage>
  );
}

const HEART = [".XX...XX.", "XXXX.XXXX", "XXXXXXXXX", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "...XXX...", "....X...."];
const HEART_SHINE = new Set(["1,1", "2,1", "1,2"]);

function PixelHeart({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 9 8" shapeRendering="crispEdges" className={className} style={style} aria-hidden>
      {HEART.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "X" ? <rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={HEART_SHINE.has(`${x},${y}`) ? "#ffd6de" : "#ff2e55"} /> : null,
        ),
      )}
    </svg>
  );
}

function ExtraLifeAnim({ team, big, name }: { team: Team; big?: boolean; name: Name }) {
  const size = big ? "w-[min(18vw,11rem)]" : "w-24";
  const heart = { filter: "drop-shadow(0 0 18px rgba(255,46,85,0.65))" };
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[4vh] overflow-hidden px-6">
      <div
        className="absolute left-1/2 top-1/2 -ml-[40vmin] -mt-[30vmin] h-[60vmin] w-[80vmin]"
        style={{ background: "radial-gradient(ellipse closest-side, rgba(14,10,8,0.85) 35%, rgba(14,10,8,0) 100%)" }}
      />
      <div className="relative flex items-end gap-[3vw]">
        <div style={{ animation: "heart-in 0.4s steps(4) both" }}>
          <PixelHeart className={size} style={{ ...heart, animation: "heart-beat 0.8s steps(2) 1.4s infinite" }} />
        </div>
        <div className="relative" style={{ animation: "heart-in 0.5s steps(5) 0.8s both" }}>
          <PixelHeart className={size} style={{ ...heart, animation: "heart-beat 0.8s steps(2) 1.4s infinite" }} />
          <span
            className={`absolute inset-x-0 -top-[0.2em] text-center font-mono font-bold text-[#7dff8a] ${big ? "text-[clamp(1.5rem,3vw,3rem)]" : "text-xl"}`}
            style={{ textShadow: "0 0 12px rgba(125,255,138,0.7)", animation: "one-up 1.2s steps(8) 1s both" }}
          >
            +1 UP
          </span>
        </div>
      </div>
      <p
        className={`font-display animate-pop relative text-center leading-tight text-cream ${big ? "text-[clamp(2.5rem,5vw,5rem)]" : "text-3xl"}`}
        style={{ animationDelay: "1100ms", textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}
      >
        <TeamName team={team} name={name} /> got an extra life!
      </p>
    </div>
  );
}

function HintAnim({ team, big, name }: { team: Team; big?: boolean; name: Name }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[3vh] overflow-hidden px-6">
      <div
        className={`absolute left-1/2 top-[42%] rounded-full ${big ? "-ml-[35vmin] -mt-[35vmin] h-[70vmin] w-[70vmin]" : "-ml-[30vmin] -mt-[30vmin] h-[60vmin] w-[60vmin]"}`}
        style={{ animation: "hint-glow 1s ease-out 0.4s both" }}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,246,201,0.95) 0%, rgba(255,215,94,0.7) 18%, rgba(255,184,0,0.3) 42%, rgba(255,184,0,0) 70%)",
            animation: "hint-pulse 1.6s ease-in-out 1.4s infinite",
          }}
        />
      </div>
      <span
        className={`relative ${big ? "text-[min(26vh,14rem)]" : "text-[min(22vh,8rem)]"}`}
        style={{ animation: "flicker 0.9s ease both", filter: "drop-shadow(0 0 30px rgba(255,215,94,0.9))" }}
      >
        💡
      </span>
      <p
        className={`font-display animate-pop relative text-center leading-tight text-cream ${big ? "text-[clamp(2.5rem,5vw,5rem)]" : "text-3xl"}`}
        style={{ animationDelay: "900ms", textShadow: "0 2px 18px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)" }}
      >
        <span
          className="absolute -inset-x-[15%] -inset-y-[60%] -z-10"
          style={{ background: "radial-gradient(ellipse closest-side, rgba(14,10,8,0.8) 40%, rgba(14,10,8,0) 100%)" }}
        />
        <span style={{ color: team.color }}>{name(team)}</span> used Hint!
      </p>
    </div>
  );
}

const RINGS_AT = [300, 1300];
const PICKUP_AT = 2300;

function PhoneAnim({ team, big, name }: { team: Team; big?: boolean; name: Name }) {
  const [answered, setAnswered] = useState(false);
  useEffect(() => {
    const timers = [
      ...(big ? RINGS_AT.map((at) => setTimeout(() => sfx.ring(), at)) : []),
      setTimeout(() => setAnswered(true), PICKUP_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [big]);
  const phoneSize = big ? "text-[min(30vh,16rem)]" : "text-[min(24vh,8rem)]";
  const bubble = `font-display absolute whitespace-nowrap rounded-full bg-cream px-[0.6em] py-[0.15em] font-black italic text-ink ${
    big ? "text-[clamp(1.6rem,3vw,3rem)]" : "text-xl"
  }`;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[4vh] overflow-hidden bg-ink/85 px-6 backdrop-blur-sm">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 55% 60% at 50% 42%, ${team.color}66 0%, transparent 70%)` }} />
      <div className="relative flex items-center justify-center">
        {!answered &&
          RINGS_AT.flatMap((at) =>
            [0, 250].map((d) => (
              <span
                key={`${at}-${d}`}
                className="absolute inset-[-10%] rounded-full border-4"
                style={{ borderColor: team.color, animation: `ring-wave 0.9s ease-out ${at + d}ms both` }}
              />
            )),
          )}
        <span
          className={`relative block leading-none ${phoneSize}`}
          style={{
            filter: `drop-shadow(0 0 40px ${team.color}aa)`,
            animation: answered
              ? "pop 0.4s cubic-bezier(0.3, 1.5, 0.5, 1) both"
              : `shush-pop 0.4s cubic-bezier(0.3, 1.5, 0.5, 1) both, ${RINGS_AT.map((at) => `phone-ring 1s linear ${at}ms`).join(", ")}`,
          }}
        >
          {answered ? "📞" : "☎️"}
        </span>
        {!answered && (
          <>
            <span className={`${bubble} -left-[65%] top-0`} style={{ "--tilt": "-10deg", animation: `ring-bubble 1s ease ${RINGS_AT[0]}ms both` } as React.CSSProperties}>
              RING!
            </span>
            <span className={`${bubble} -right-[65%] top-[10%]`} style={{ "--tilt": "8deg", animation: `ring-bubble 1s ease ${RINGS_AT[1]}ms both` } as React.CSSProperties}>
              RING!
            </span>
          </>
        )}
        {answered && (
          <span className={`${bubble} animate-pop -right-[55%] -top-[5%]`}>
            Hello? 👋
          </span>
        )}
      </div>
      <div className="relative min-h-[2.5em] text-center">
        {answered && (
          <>
            <p
              className={`font-display animate-pop leading-tight text-cream ${big ? "text-[clamp(2.5rem,5vw,5rem)]" : "text-3xl"}`}
              style={{ textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}
            >
              <TeamName team={team} name={name} /> is phoning a friend!
            </p>
            <p className={`animate-pop mt-2 text-cream/80 ${big ? "text-2xl" : "text-base"}`} style={{ animationDelay: "250ms" }}>
              Anyone outside the team can help
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function DuelAnim({
  by,
  target,
  names,
  big,
  name,
}: {
  by: Team;
  target: Team;
  names?: PowerNotice["duel"];
  big?: boolean;
  name: Name;
}) {
  const side = (team: Team, player: string | undefined, align: "left" | "right") => (
    <div className={`absolute top-1/2 -translate-y-1/2 ${align === "left" ? "left-[5%] text-left" : "right-[5%] text-right"} max-w-[38%]`}>
      <p className={`font-display font-black italic leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${big ? "text-[clamp(3rem,7vw,8rem)]" : "text-4xl"}`}>
        {player || name(team)}
      </p>
      {player && <p className={`mt-2 font-semibold text-white/85 ${big ? "text-3xl" : "text-lg"}`}>{name(team)}</p>}
    </div>
  );
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-ink" style={{ animation: "shake 0.4s ease 0.85s" }}>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 75% at 22% 45%, ${by.color}cc 0%, transparent 75%), linear-gradient(170deg, ${by.color}99 0%, ${by.color}40 100%)`,
          clipPath: "polygon(0 0, 58% 0, 42% 100%, 0 100%)",
          animation: "slam-left 0.45s cubic-bezier(0.2, 0.9, 0.3, 1) both",
        }}
      >
        {side(by, names?.name, "left")}
      </div>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 75% at 78% 55%, ${target.color}cc 0%, transparent 75%), linear-gradient(170deg, ${target.color}99 0%, ${target.color}40 100%)`,
          clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)",
          animation: "slam-right 0.45s cubic-bezier(0.2, 0.9, 0.3, 1) both",
        }}
      >
        {side(target, names?.targetName, "right")}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-display relative px-[0.15em] font-black italic text-white ${big ? "text-[min(34vh,18rem)]" : "text-8xl"}`}
          style={{
            textShadow: "0 0 50px rgba(255,255,255,0.45), 0 6px 24px rgba(0,0,0,0.45)",
            animation: "vs-slam 0.5s cubic-bezier(0.3, 1.4, 0.5, 1) 0.45s both",
          }}
        >
          VS
        </span>
      </div>
      <p
        className={`font-display animate-pop absolute inset-x-0 bottom-[8%] text-center text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] ${big ? "text-4xl" : "text-xl"}`}
        style={{ animationDelay: "1100ms" }}
      >
        1v1 · only these two can buzz in
      </p>
    </div>
  );
}

function StealAnim({ thief, target, amount, big, name }: { thief: Team; target: Team; amount: number; big?: boolean; name: Name }) {
  const gain = amount > 0;
  const money = `${gain ? "+" : "−"}${formatScore(Math.abs(amount))}`;
  const teamText = `font-display font-black italic leading-none ${big ? "text-[clamp(2.5rem,6vw,6.5rem)]" : "text-4xl"}`;
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-ink">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 45% 60% at 20% 50%, ${thief.color}88 0%, transparent 70%), radial-gradient(ellipse 45% 60% at 80% 50%, ${target.color}88 0%, transparent 70%)`,
        }}
      />
      <p className={`label animate-pop absolute inset-x-0 top-[14%] text-center ${big ? "!text-xl" : ""}`}>
        {POWERS.steal.icon} Secret Steal!
      </p>
      <p
        className={`${teamText} absolute left-[6%] top-1/2 max-w-[38%] -translate-y-1/2`}
        style={{ color: thief.color, textShadow: `0 0 40px ${thief.color}99`, animation: "steal-win 0.5s ease 1.9s both" }}
      >
        {name(thief)}
      </p>
      <p
        className={`${teamText} absolute right-[6%] top-1/2 max-w-[38%] -translate-y-1/2 text-right`}
        style={{ color: target.color, textShadow: `0 0 40px ${target.color}99`, animation: "steal-dim 0.6s ease 1.4s both" }}
      >
        {name(target)}
      </p>
      <div className="absolute left-1/2 top-1/2">
        <div style={{ animation: "steal-carry 2.2s cubic-bezier(0.6, 0, 0.3, 1) 0.2s both" }}>
          <span
            className={`font-display block -translate-x-1/2 -translate-y-1/2 whitespace-nowrap ${big ? "text-[clamp(3rem,6vw,6rem)]" : "text-5xl"} ${
              gain ? "text-good" : "text-bad"
            }`}
            style={{ textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}
          >
            {money}
          </span>
        </div>
        <div style={{ animation: "ninja-swoop 2.2s cubic-bezier(0.6, 0, 0.3, 1) 0.2s both" }}>
          <span className={`block -translate-x-1/2 -translate-y-1/2 ${big ? "text-[min(16vh,8rem)]" : "text-6xl"}`}>
            {POWERS.steal.icon}
          </span>
        </div>
      </div>
      <p
        className={`font-display animate-pop absolute inset-x-0 bottom-[12%] px-6 text-center leading-tight ${
          big ? "text-[clamp(2rem,4vw,4rem)]" : "text-2xl"
        }`}
        style={{ animationDelay: "2300ms" }}
      >
        <TeamName team={thief} name={name} /> {gain ? "stole" : "took"} <TeamName team={target} name={name} />
        &apos;s <span className={gain ? "text-good" : "text-bad"}>{money}</span>
        {!gain && " 😬"}
      </p>
    </div>
  );
}

function Chips({ direction, count = 6, delay = 0.5 }: { direction: "right" | "left"; count?: number; delay?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="absolute h-[clamp(1.4rem,3vw,2.6rem)] w-[clamp(1.4rem,3vw,2.6rem)] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${["#ff4f9a", "#f5a14a", "#7a4fe0", "#22d3a6"][i % 4]} 45%, rgba(255,255,255,0.9) 47% 55%, ${
              ["#ff4f9a", "#f5a14a", "#7a4fe0", "#22d3a6"][i % 4]
            } 57%)`,
            boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
            animation: `chip-fly-${direction} 0.75s cubic-bezier(0.4, 0, 0.3, 1) ${delay + i * 0.12}s both`,
          }}
        />
      ))}
    </>
  );
}

/** Two sides glowing in their team colours, with big names and a caption underneath. */
function Duo({
  left,
  right,
  leftName,
  rightName,
  leftStyle,
  rightStyle,
  label,
  caption,
  captionDelay,
  big,
  children,
}: {
  left: string;
  right: string;
  leftName: React.ReactNode;
  rightName: React.ReactNode;
  leftStyle?: React.CSSProperties;
  rightStyle?: React.CSSProperties;
  label: React.ReactNode;
  caption: React.ReactNode;
  captionDelay: number;
  big?: boolean;
  children?: React.ReactNode;
}) {
  const teamText = `font-display font-black italic leading-none ${big ? "text-[clamp(2.5rem,6vw,6.5rem)]" : "text-4xl"}`;
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-ink">
      <div
        className="absolute inset-0 transition-[background] duration-200"
        style={{
          background: `radial-gradient(ellipse 45% 60% at 20% 50%, ${left}88 0%, transparent 70%), radial-gradient(ellipse 45% 60% at 80% 50%, ${right}88 0%, transparent 70%)`,
        }}
      />
      <p className={`label animate-pop absolute inset-x-0 top-[14%] text-center ${big ? "!text-xl" : ""}`}>{label}</p>
      <div
        className={`${teamText} absolute left-[6%] top-1/2 max-w-[38%] -translate-y-1/2`}
        style={{ color: left, textShadow: `0 0 40px ${left}99`, ...leftStyle }}
      >
        {leftName}
      </div>
      <div
        className={`${teamText} absolute right-[6%] top-1/2 max-w-[38%] -translate-y-1/2 text-right`}
        style={{ color: right, textShadow: `0 0 40px ${right}99`, ...rightStyle }}
      >
        {rightName}
      </div>
      {children}
      <p
        className={`font-display animate-pop absolute inset-x-0 bottom-[12%] px-6 text-center leading-tight ${
          big ? "text-[clamp(2rem,4vw,4rem)]" : "text-2xl"
        }`}
        style={{ animationDelay: `${captionDelay}ms` }}
      >
        {caption}
      </p>
    </div>
  );
}

function BetAnim({ by, others, big, name }: { by: Team; others: Team[]; big?: boolean; name: Name }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (others.length < 2) return;
    const t = setInterval(() => setI((n) => n + 1), 220);
    return () => clearInterval(t);
  }, [others.length]);
  const mark = others[i % Math.max(others.length, 1)];
  return (
    <Duo
      big={big}
      left={by.color}
      right={mark?.color ?? "#c2b6ae"}
      leftName={name(by)}
      rightName={
        <span className="flex flex-col items-end">
          <span className={big ? "text-[clamp(4rem,9vw,9rem)]" : "text-6xl"}>?</span>
          {mark && (
            <span key={mark.id} className={`animate-pop not-italic ${big ? "text-[clamp(1.4rem,2.5vw,2.5rem)]" : "text-lg"}`}>
              {name(mark)}
            </span>
          )}
        </span>
      }
      label={`${POWERS.bet.icon} Bet against`}
      caption={
        <>
          <TeamName team={by} name={name} /> bets against whoever answers next
        </>
      }
      captionDelay={600}
    >
      <ChipLane direction="right" />
    </Duo>
  );
}

function ChipLane({ direction, delay }: { direction: "right" | "left"; delay?: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] h-[24%]">
      <Chips direction={direction} delay={delay} />
    </div>
  );
}

function BetResult({
  by,
  target,
  won,
  amount,
  big,
  name,
}: {
  by: Team;
  target: Team;
  won: boolean;
  amount: number;
  big?: boolean;
  name: Name;
}) {
  const loser = { animation: "shake 0.45s ease 1.4s both, steal-dim 0.6s ease 1.6s both" };
  const winner = { animation: "steal-win 0.5s ease 1.5s both" };
  return (
    <Duo
      big={big}
      left={by.color}
      right={target.color}
      leftName={name(by)}
      rightName={name(target)}
      leftStyle={won ? winner : loser}
      rightStyle={won ? loser : winner}
      label={`${POWERS.bet.icon} Bet against`}
      caption={
        <>
          <TeamName team={by} name={name} /> {won ? "won" : "lost"} their bet against <TeamName team={target} name={name} />{" "}
          <span className={won ? "text-good" : "text-bad"}>
            {won ? "+" : "−"}
            {formatScore(amount)}
          </span>
        </>
      }
      captionDelay={1300}
    >
      <ChipLane direction={won ? "left" : "right"} />
    </Duo>
  );
}
