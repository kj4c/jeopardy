"use client";

import { useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/login", { method: "POST", json: { password } });
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next?.startsWith("/") ? next : "/boards";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <GradientBackground variant="hero" />
      <form onSubmit={submit} className="panel corner-marks animate-fade-up w-full max-w-sm p-8">
        <p className="label mb-3">Host access</p>
        <h1 className="font-display mb-6 text-4xl">Welcome back.</h1>
        <input
          type="password"
          className="field"
          placeholder="Host password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        <button className="btn btn-primary mt-5 w-full" disabled={busy || !password}>
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
