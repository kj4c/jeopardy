"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { slugify } from "@/lib/board";

export default function JoinPage() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const slug = slugify(room);

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <GradientBackground variant="hero" />
      <form
        className="animate-fade-up mx-auto w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (slug) router.push(`/play/${slug}`);
        }}
      >
        <p className="label mb-3">Join a game</p>
        <h1 className="font-display mb-8 text-6xl">What&apos;s the room?</h1>
        <input
          className="field py-4 text-lg"
          placeholder="Room name"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button className="btn btn-primary mt-4 w-full py-4 text-lg" disabled={!slug}>
          Join
        </button>
      </form>
    </main>
  );
}
