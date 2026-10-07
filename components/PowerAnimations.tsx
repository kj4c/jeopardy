"use client";

import { useEffect, useState } from "react";
import { formatScore } from "@/lib/board";
import { POWERS } from "@/lib/powers";
import type { PowerNotice, PowerType, Team } from "@/lib/types";

/** Power-ups with a full-screen animation when used; the rest get a toast. */
export const ANIMATED_POWERS = new Set<PowerType>(["block", "double", "rng", "hint", "bet", "duel"]);

/** How long each animation stays up, in ms. */
export function animationLength(n: PowerNotice): number {
  if (n.kind === "settled") return 3800;
  return { block: 3400, double: 2800, rng: 5600, hint: 3000, bet: 3400, duel: 3600 }[n.power as string] ?? 3000;
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
  switch (notice.power) {
    case "block":
      return target ? <BlockAnim by={team} target={target} big={big} name={name} /> : null;
    case "double":
      return <DoubleAnim team={team} big={big} name={name} />;
    case "rng":
      return notice.rng && target ? <RngAnim by={team} target={target} rng={notice.rng} big={big} name={name} /> : null;
    case "hint":
      return <HintAnim team={team} big={big} name={name} />;
    case "bet":
      return <BetAnim by={team} others={teams.filter((t) => t.id !== team.id)} big={big} name={name} />;
    case "duel":
      return target ? <DuelAnim by={team} target={target} names={notice.duel} big={big} name={name} /> : null;
    default:
      return null;
  }
}

type Name = (t: Team) => string;

function Stage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[6vh] overflow-hidden bg-ink/90 px-6 backdrop-blur-sm ${className}`}>
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

function TeamCard({ team, name, big, style }: { team: Team; name: Name; big?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className={`flex items-center justify-center border-4 bg-ink text-center font-display leading-tight ${
        big ? "h-[min(26vh,14rem)] w-[min(30vw,24rem)] text-[clamp(2rem,4vw,4rem)]" : "h-28 w-36 text-2xl"
      }`}
      style={{ borderColor: team.color, boxShadow: `0 0 50px -10px ${team.color}`, color: team.color, ...style }}
    >
      <span className="px-3">{name(team)}</span>
    </div>
  );
}

function BlockAnim({ by, target, big, name }: { by: Team; target: Team; big?: boolean; name: Name }) {
  return (
    <Stage>
      <div className="flex items-center justify-center gap-[10vw]">
        <TeamCard team={by} name={name} big={big} style={{ animation: "windup 0.6s ease both" }} />
        <div className="relative">
          <TeamCard team={target} name={name} big={big} style={{ animation: "shake 0.45s ease 0.75s both" }} />
          <div
            className="absolute -inset-3 flex items-center justify-center border-4 border-ink font-display font-black tracking-wider text-ink"
            style={{
              background: "repeating-linear-gradient(45deg, #f5a14a 0 22px, #1a1410 22px 44px)",
              animation: "block-throw 0.85s cubic-bezier(0.3, 0.7, 0.4, 1) both",
            }}
          >
            <span className={`bg-[#f5a14a] px-3 py-1 ${big ? "text-[clamp(1.6rem,3vw,3rem)]" : "text-xl"}`}>⛔ BLOCKED</span>
          </div>
        </div>
      </div>
      <Caption big={big} delay={900}>
        <TeamName team={by} name={name} /> blocked <TeamName team={target} name={name} />!
      </Caption>
    </Stage>
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
function useRoulette<T>(items: T[], final: T, startMs: number, steps = 22) {
  const [value, setValue] = useState<T>(items[0] ?? final);
  const [state, setState] = useState<"waiting" | "spinning" | "done">("waiting");
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = startMs;
    timers.push(setTimeout(() => setState("spinning"), startMs));
    for (let k = 0; k < steps; k++) {
      const item = items.length ? items[(k * 7 + 3) % items.length] : final;
      timers.push(setTimeout(() => setValue(item), at));
      at += 45 + k * k * 0.9;
    }
    timers.push(
      setTimeout(() => {
        setValue(final);
        setState("done");
      }, at),
    );
    return () => timers.forEach(clearTimeout);
  }, [items, final, startMs, steps]);
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
  const category = useRoulette(rng.categories, rng.category, 300);
  const value = useRoulette(rng.values, rng.value, 2300, 18);
  const reel = `relative flex items-center justify-center overflow-hidden border-4 bg-ink ${big ? "h-[min(20vh,10rem)]" : "h-24"}`;
  return (
    <Stage>
      <p className={`label ${big ? "!text-xl" : ""}`}>
        {POWERS.rng.icon} <TeamName team={by} name={name} /> sent <TeamName team={target} name={name} /> a random question
      </p>
      <div className={`flex w-full max-w-5xl flex-col items-center gap-6 ${big ? "" : "px-2"}`}>
        <div
          className={`${reel} w-full`}
          style={{ borderColor: category.state === "done" ? "var(--color-coral)" : "var(--color-line-strong)" }}
        >
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
        <div className="flex items-center gap-4">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`${big ? "text-5xl" : "text-3xl"} ${value.state === "spinning" ? "animate-pulse" : ""}`}>
              🎰
            </span>
          ))}
        </div>
        <div
          className={`${reel} ${big ? "w-[min(40vw,28rem)]" : "w-56"} transition-opacity`}
          style={{
            borderColor: value.state === "done" ? "#f5a14a" : "var(--color-line-strong)",
            opacity: value.state === "waiting" ? 0.3 : 1,
          }}
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

function HintAnim({ team, big, name }: { team: Team; big?: boolean; name: Name }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[5vh] overflow-hidden bg-ink px-6">
      <div className="absolute left-1/2 top-[42%] h-[260vmax] w-[260vmax] -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-full w-full opacity-40"
          style={{
            background: "repeating-conic-gradient(from 0deg, #ffd75e 0deg 6deg, transparent 6deg 18deg)",
            animation: "spin-slow 14s linear infinite",
          }}
        />
      </div>
      <div
        className="absolute left-1/2 top-[42%] h-[220vmax] w-[220vmax] -ml-[110vmax] -mt-[110vmax] rounded-full"
        style={{
          background: "radial-gradient(circle, #fff6c9 0%, #ffd75e 12%, rgba(255,184,0,0.55) 30%, rgba(255,184,0,0) 55%)",
          animation: "hint-glow 1.4s ease-out 0.5s both",
        }}
      />
      <span className={`relative ${big ? "text-[min(30vh,16rem)]" : "text-[min(28vh,9rem)]"}`} style={{ animation: "flicker 0.9s ease both" }}>
        💡
      </span>
      <p
        className={`font-display animate-pop relative text-center leading-tight text-[#1a1208] ${big ? "text-[clamp(2.5rem,5vw,5rem)]" : "text-3xl"}`}
        style={{ animationDelay: "900ms" }}
      >
        <span className="bg-[#fff6c9]/70 px-4 py-1">
          <span style={{ color: team.color, filter: "brightness(0.75)" }}>{name(team)}</span> used Hint!
        </span>
      </p>
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

function Chips({ direction, count = 6 }: { direction: "right" | "left"; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="absolute h-[clamp(1.6rem,3.5vw,3rem)] w-[clamp(1.6rem,3.5vw,3rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-dashed border-white"
          style={{
            background: ["#ff4f9a", "#f5a14a", "#3b6bff", "#22d3a6"][i % 4],
            animation: `chip-fly-${direction} 0.75s cubic-bezier(0.4, 0, 0.3, 1) ${0.5 + i * 0.12}s both`,
          }}
        />
      ))}
    </>
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
    <Stage>
      <div className={`relative flex w-[min(92vw,64rem)] items-center justify-between ${big ? "h-[min(30vh,16rem)]" : "h-36"}`}>
        <TeamCard team={by} name={name} big={big} />
        <Chips direction="right" />
        <div
          className={`flex flex-col items-center justify-center border-4 border-dashed bg-ink text-center ${
            big ? "h-[min(26vh,14rem)] w-[min(30vw,24rem)]" : "h-28 w-36"
          }`}
          style={{ borderColor: mark?.color ?? "var(--color-line-strong)" }}
        >
          <span className={`font-display ${big ? "text-6xl" : "text-3xl"}`}>?</span>
          {mark && (
            <span key={mark.id} className={`font-display animate-pop ${big ? "text-3xl" : "text-lg"}`} style={{ color: mark.color }}>
              {name(mark)}
            </span>
          )}
        </div>
      </div>
      <Caption big={big} delay={600}>
        {POWERS.bet.icon} <TeamName team={by} name={name} /> bets against whoever answers next
      </Caption>
    </Stage>
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
  return (
    <Stage>
      <p className={`label ${big ? "!text-xl" : ""}`}>{POWERS.bet.icon} Bet against</p>
      <div className={`relative flex w-[min(92vw,64rem)] items-center justify-between ${big ? "h-[min(30vh,16rem)]" : "h-36"}`}>
        <TeamCard team={by} name={name} big={big} style={won ? undefined : { animation: "shake 0.45s ease 1.4s both" }} />
        <span className={`font-display text-muted ${big ? "text-5xl" : "text-2xl"}`}>vs</span>
        <TeamCard team={target} name={name} big={big} style={won ? { animation: "shake 0.45s ease 1.4s both" } : undefined} />
        <Chips direction={won ? "left" : "right"} />
      </div>
      <Caption big={big} delay={1300}>
        <TeamName team={by} name={name} /> {won ? "won" : "lost"} their bet against <TeamName team={target} name={name} />{" "}
        <span className={won ? "text-good" : "text-bad"}>
          {won ? "+" : "−"}
          {formatScore(amount)}
        </span>
      </Caption>
    </Stage>
  );
}
