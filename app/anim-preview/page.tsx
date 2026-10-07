"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PowerAnimation } from "@/components/PowerAnimations";
import { Standings } from "@/components/host/Standings";
import type { PowerNotice, Team } from "@/lib/types";

const teams: Team[] = [
  { id: "a", name: "Team 1", color: "#ff4f9a", score: 0 },
  { id: "b", name: "Team 2", color: "#3b6bff", score: 0 },
  { id: "c", name: "Team 3", color: "#f5a14a", score: 0 },
];

const notices: Record<string, PowerNotice> = {
  block: { id: "1", kind: "used", power: "block", teamId: "a", targetTeamId: "b" },
  double: { id: "2", kind: "used", power: "double", teamId: "a" },
  rng: {
    id: "3",
    kind: "used",
    power: "rng",
    teamId: "a",
    targetTeamId: "b",
    rng: { category: "World Capitals", value: 600, categories: ["Science", "World Capitals", "Movies", "Food", "Sport"], values: [200, 400, 600, 800, 1000] },
  },
  hint: { id: "4", kind: "used", power: "hint", teamId: "c" },
  second: { id: "10", kind: "used", power: "second", teamId: "a" },
  bet: { id: "5", kind: "used", power: "bet", teamId: "a" },
  duel: { id: "7", kind: "used", power: "duel", teamId: "a", targetTeamId: "c", duel: { name: "Jayden", targetName: "Jackie" } },
  settled: { id: "6", kind: "settled", power: "bet", teamId: "a", targetTeamId: "b", won: true, amount: 400 },
  steal: { id: "8", kind: "stolen", power: "steal", teamId: "c", targetTeamId: "b", amount: 600 },
  stealneg: { id: "9", kind: "stolen", power: "steal", teamId: "c", targetTeamId: "b", amount: -600 },
};

function Preview() {
  const a = useSearchParams().get("a") ?? "block";
  if (a === "standings") return <Standings teams={teams.map((t, i) => ({ ...t, score: [1800, -400, 2600][i] }))} />;
  return <PowerAnimation notice={notices[a]} teams={teams} big />;
}

export default function Page() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}
