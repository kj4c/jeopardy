"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { GradientBackground } from "./GradientBackground";

export function UnlockBoard({
  slug,
  name,
  reason,
  onUnlocked,
}: {
  slug: string;
  name: string;
  reason?: string;
  onUnlocked: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <GradientBackground variant="hero" />
      <form
        className="panel corner-marks animate-fade-up w-full max-w-sm p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`/api/b/${slug}/login`, { method: "POST", json: { password } });
            onUnlocked();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <p className="label mb-3">{reason ?? "Board locked"}</p>
        <h1 className="font-display mb-1 text-4xl">{name}</h1>
        <p className="mb-6 font-mono text-xs text-muted">/b/{slug}</p>
        <input
          type="password"
          className="field"
          placeholder="Board password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        <button className="btn btn-primary mt-5 w-full" disabled={busy || !password}>
          {busy ? "Checking…" : "Unlock"}
        </button>
        <Link href="/boards" className="mt-4 block text-center text-sm text-muted hover:text-cream">
          Back to boards
        </Link>
      </form>
    </main>
  );
}
