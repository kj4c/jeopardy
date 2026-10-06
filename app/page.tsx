"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { ThemeToggle } from "@/components/ThemeToggle";
import { slugify } from "@/lib/board";

export default function Home() {
  const router = useRouter();
  const [room, setRoom] = useState("");

  return (
    <main className="relative flex min-h-dvh flex-col">
      <GradientBackground variant="hero" pixels />
      <TopBar />
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16 md:px-10">
        <p className="label animate-fade-up mb-6">Live trivia · phone buzzers · your own boards</p>
        <h1 className="font-display animate-fade-up max-w-3xl text-6xl md:text-8xl">
          This is <em className="font-thin-serif gradient-text pr-2 text-[1.12em] not-italic">Jeopardy.</em>
        </h1>
        <p className="animate-fade-up mt-6 max-w-xl text-lg text-cream/80 md:text-xl">
          Build boards with images and video, then run the game on a big screen while everyone buzzes in from their
          phones.
        </p>
        <div className="animate-fade-up mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link href="/boards" className="btn btn-primary px-8 py-3.5 text-base">
            Host a game
          </Link>
          <form
            className="flex w-full max-w-sm items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              const slug = slugify(room);
              if (slug) router.push(`/play/${slug}`);
            }}
          >
            <input
              className="field rounded-r-none border-r-0"
              placeholder="Room name"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button className="btn btn-ghost rounded-l-none" type="submit" disabled={!slugify(room)}>
              Join
            </button>
          </form>
        </div>
      </section>
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-line px-6 md:grid-cols-3 md:divide-x md:divide-y-0 md:px-10">
          {[
            ["01", "Build", "Add categories and rows, upload images, embed YouTube clips."],
            ["02", "Host", "Open a named room on any board. Play live with phones or run it in person."],
            ["03", "Buzz", "Countdown 3-2-1, then every player races to buzz. See who was first."],
          ].map(([n, title, body]) => (
            <div key={n} className="py-6 md:px-6 md:first:pl-0">
              <p className="label mb-2">{n}</p>
              <p className="font-display text-2xl">{title}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}

function TopBar() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="font-display text-2xl">
          Jeopardy<span className="text-coral">.</span>
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/join" className="btn btn-ghost btn-sm">
            Join a room
          </Link>
          <Link href="/boards" className="btn btn-primary btn-sm">
            My boards
          </Link>
        </nav>
      </div>
    </header>
  );
}
