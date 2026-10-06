"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BoardEditor } from "@/components/BoardEditor";
import { GradientBackground } from "@/components/GradientBackground";
import { UnlockBoard } from "@/components/UnlockBoard";
import { api, ApiError } from "@/lib/api";

type BoardStatus = { id: string; slug: string; name: string; hasPassword: boolean; authed: boolean };

export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<BoardStatus | "missing" | null>(null);

  const load = useCallback(() => {
    api<BoardStatus>(`/api/b/${slug}`)
      .then(setStatus)
      .catch((err) => setStatus(err instanceof ApiError && err.status === 404 ? "missing" : null));
  }, [slug]);
  useEffect(load, [load]);

  const onLocked = useCallback(() => setStatus((s) => (s && s !== "missing" ? { ...s, authed: false } : s)), []);

  if (status === null) return <main className="min-h-dvh"><GradientBackground /></main>;
  if (status === "missing") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <GradientBackground />
        <p className="label">/b/{slug}</p>
        <h1 className="font-display text-5xl">No board with that name.</h1>
        <p className="text-muted">Check the spelling, or create a new board with this name.</p>
        <div className="mt-4 flex gap-3">
          <Link href={`/boards?create=${encodeURIComponent(slug)}`} className="btn btn-primary">
            Create it
          </Link>
          <Link href="/" className="btn btn-ghost">
            Back to home
          </Link>
        </div>
      </main>
    );
  }
  if (!status.authed) return <UnlockBoard slug={status.slug} name={status.name} onUnlocked={load} />;
  return <BoardEditor id={status.id} onLocked={onLocked} />;
}
