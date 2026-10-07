"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GradientBackground } from "@/components/GradientBackground";
import { BuzzModeToggle } from "@/components/host/BuzzModeToggle";
import { ClueView } from "@/components/host/ClueView";
import { CountdownOverlay } from "@/components/host/CountdownOverlay";
import { EndedView } from "@/components/host/EndedView";
import { FinalView } from "@/components/host/FinalView";
import { PowerupsDialog } from "@/components/host/PowerupsDialog";
import { PowerNoticeToast } from "@/components/PowerNoticeToast";
import { JoinPanel } from "@/components/host/JoinPanel";
import { PlayBoard } from "@/components/host/PlayBoard";
import { QuickfireView } from "@/components/host/QuickfireView";
import { Scoreboard } from "@/components/host/Scoreboard";
import { TurnOrderDialog } from "@/components/host/TurnOrderDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UnlockBoard } from "@/components/UnlockBoard";
import { MusicControl } from "@/components/host/MusicControl";
import { WelcomeIntro } from "@/components/host/WelcomeIntro";
import { findClue } from "@/lib/board";
import { isOut, turnTeam } from "@/lib/gameReducer";
import { sounds } from "@/lib/sound";
import type { GameAction } from "@/lib/types";
import { useHostGame } from "@/lib/useHostGame";
import { useMusic } from "@/lib/useMusic";

export default function HostPage() {
  const { slug } = useParams<{ slug: string }>();
  const game = useHostGame(slug);
  const { room, board, buzz, players, dispatch: rawDispatch } = game;
  const [showJoin, setShowJoin] = useState(true);
  const [powersOpen, setPowersOpen] = useState(false);
  const [turnsOpen, setTurnsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [intro, setIntro] = useState(false);
  const endIntro = useCallback(() => setIntro(false), []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("intro")) return;
    setIntro(true);
    url.searchParams.delete("intro");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setSettingsOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSettingsOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [settingsOpen]);
  const [localCount, setLocalCount] = useState<number | undefined>();
  const [goFlash, setGoFlash] = useState(false);
  const localTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dispatch = useCallback(
    (action: GameAction) => {
      if (action.type === "clue:judge" || action.type === "final:judge") {
        (action.correct ? sounds.correct : sounds.wrong)();
      }
      rawDispatch(action);
    },
    [rawDispatch],
  );

  const flashGo = useCallback(() => {
    setGoFlash(true);
    sounds.go();
    setTimeout(() => setGoFlash(false), 700);
  }, []);

  const runLocalCountdown = useCallback(() => {
    localTimers.current.forEach(clearTimeout);
    setLocalCount(3);
    sounds.tick();
    localTimers.current = [
      setTimeout(() => (setLocalCount(2), sounds.tick()), 1000),
      setTimeout(() => (setLocalCount(1), sounds.tick()), 2000),
      setTimeout(() => (setLocalCount(undefined), flashGo()), 3000),
    ];
  }, [flashGo]);

  const prevBuzz = useRef(buzz);
  useEffect(() => {
    const prev = prevBuzz.current;
    prevBuzz.current = buzz;
    if (buzz.status === "countdown" && buzz.count !== prev.count) sounds.tick();
    if (buzz.status === "armed" && prev.status === "countdown") flashGo();
    if (buzz.buzzes.length > 0 && prev.buzzes.length === 0) sounds.buzz();
  }, [buzz, flashGo]);

  const phase = room?.state.phase;
  const ddClueId = phase?.kind === "clue" && phase.dailyDouble ? phase.clueId : null;
  useEffect(() => {
    if (ddClueId) sounds.dailyDouble();
  }, [ddClueId]);

  const openClue = phase?.kind === "clue" && board ? findClue(board, phase.clueId)?.clue : undefined;
  const videoPlaying =
    phase?.kind === "clue" &&
    (openClue?.media?.type === "youtube" || (phase.revealed && openClue?.answerMedia?.type === "youtube"));
  const showingStandings =
    phase?.kind === "ended" ||
    (phase?.kind === "final" && phase.step === "done") ||
    (phase?.kind === "quickfire" && phase.index >= (board?.quickfire?.questions.length ?? 0));
  const music = useMusic(
    (phase?.kind === "final" || phase?.kind === "quickfire") && !showingStandings ? "countdown" : "lobby",
    videoPlaying ? 0 : phase?.kind === "clue" ? 0.35 : showingStandings ? 0.5 : 1,
  );

  if (game.status === "loading") return <main className="min-h-dvh"><GradientBackground /></main>;
  if (game.status === "locked" && game.lockedBoard) {
    return (
      <UnlockBoard
        slug={game.lockedBoard.slug}
        name={game.lockedBoard.name}
        reason="Enter the board password to host"
        onUnlocked={game.reload}
      />
    );
  }
  if (game.status !== "ready" || !room || !board || !phase) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <GradientBackground />
        <p className="font-display text-5xl">{game.status === "not_found" ? "Room not found." : "Something went wrong."}</p>
        <div className="flex gap-3">
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
          <Link href="/boards" className="btn btn-ghost">
            Back to boards
          </Link>
        </div>
      </main>
    );
  }

  const live = room.mode === "live";
  const step = board.rowValues.length ? Math.min(...board.rowValues.filter((v) => v > 0), 100) : 100;
  const currentBuzz =
    phase.kind === "clue" && live && !phase.dailyDouble && !phase.resolvedBy
      ? buzz.buzzes.find((b) => !isOut(phase, b.teamId))
      : undefined;
  const accent = currentBuzz ? room.state.teams.find((t) => t.id === currentBuzz.teamId)?.color : undefined;
  const allUsed = board.categories.every((c) => c.clues.every((cl) => room.state.used.includes(cl.id)));
  const quickfireTotal = board.quickfire?.questions.length ?? 0;
  const quickfireLeft = quickfireTotal - Math.min(room.state.quickfireNext ?? 0, quickfireTotal);
  const canFinal = !!board.finalJeopardy?.question;
  const countdownMode = (room.state.buzzMode ?? "countdown") === "countdown";
  const nextTurn = room.state.teams.find((t) => t.id === turnTeam(room.state));
  const powersOn = room.state.powerSettings?.enabled.length ?? 0;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <GradientBackground accent={accent} variant={phase.kind === "board" ? "subtle" : "hero"} />

      <header ref={headerRef} className="host-bar relative z-40 flex flex-wrap items-center gap-3 border-b border-line bg-ink/60 px-4 py-2.5 backdrop-blur-md">
        <Link href="/boards" className="btn btn-ghost btn-sm">
          ←
        </Link>
        <div className="mr-auto min-w-0">
          <p className="font-display truncate text-2xl leading-none">{room.name}</p>
          <p className="label mt-1 truncate">
            {board.name}
            {live && ` · /play/${room.slug}`}
            {!game.connected && <span className="!text-bad"> · reconnecting…</span>}
            {game.saveError && <span className="!text-bad"> · not saved</span>}
          </p>
        </div>
        {quickfireTotal > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ type: "quickfire:start" })}
            title={quickfireLeft ? `${quickfireLeft} of ${quickfireTotal} questions left` : "All quickfire questions played"}
          >
            Quickfire{quickfireLeft < quickfireTotal ? ` (${quickfireLeft} left)` : ""}
          </button>
        )}
        <button
          className={`btn btn-primary btn-sm ${allUsed ? "animate-pulse" : ""}`}
          onClick={() => dispatch({ type: "final:start" })}
        >
          Final Jeopardy
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => confirm("End the game and show final standings?") && dispatch({ type: "game:end" })}
        >
          End game
        </button>
        <button
          className="btn btn-ghost btn-sm gap-2 !border-g-violet/80 hover:!border-g-violet"
          onClick={() => setPowersOpen(true)}
          title="Choose power-ups and manage each team's"
        >
          <span aria-hidden>⚡</span> Power-ups
          {powersOn > 0 && (
            <span className="bg-g-violet px-1.5 text-xs font-bold leading-5 text-white">{powersOn}</span>
          )}
        </button>
        <button
          className={`btn btn-ghost btn-sm relative ${settingsOpen ? "!border-coral text-cream" : ""}`}
          onClick={() => setSettingsOpen(!settingsOpen)}
          title={music.blocked ? "Settings · click anywhere to start the music" : "Settings"}
          aria-expanded={settingsOpen}
        >
          <span className={`inline-block text-base leading-none transition-transform duration-300 ${settingsOpen ? "rotate-90" : ""}`}>
            ⚙
          </span>
          {music.blocked && <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-coral" />}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
          }
          title="Fullscreen"
        >
          ⛶
        </button>

        {settingsOpen && (
          <div
            className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-[0_24px_48px_-20px_rgba(0,0,0,0.6)]"
            style={{ animation: "drop-down 0.25s cubic-bezier(0.2, 0.9, 0.3, 1) both" }}
          >
            <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-4 py-4">
              <Setting label="Room">
                <div className="flex border border-line-strong text-sm">
                  {(["live", "local"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => m !== room.mode && game.setMode(m)}
                      className={`px-3 py-1.5 transition ${room.mode === m ? "bg-coral/20 text-cream" : "text-muted hover:text-cream"}`}
                    >
                      {m === "live" ? "Live room" : "In person"}
                    </button>
                  ))}
                </div>
                {live && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowJoin(!showJoin)}>
                    {showJoin ? "Hide QR" : "Show QR"}
                  </button>
                )}
              </Setting>
              <Setting label="Buzzers">
                <BuzzModeToggle mode={room.state.buzzMode ?? "countdown"} dispatch={dispatch} />
                {countdownMode && (
                  <button className="btn btn-ghost btn-sm" onClick={() => (setTurnsOpen(true), setSettingsOpen(false))} title="Set the order teams pick tiles in">
                    {nextTurn ? (
                      <>
                        Turn: <span style={{ color: nextTurn.color }}>{nextTurn.name}</span>
                      </>
                    ) : (
                      "Turn order"
                    )}
                  </button>
                )}
              </Setting>
              <Setting label="Music">
                <MusicControl
                  lobby={music.lobby}
                  muted={music.muted}
                  volume={music.volume}
                  onLobby={music.setLobby}
                  onMute={music.setMuted}
                  onVolume={music.setVolume}
                />
              </Setting>
              <Setting label="Theme">
                <ThemeToggle />
              </Setting>
              <Setting label="Board">
                <Link href={`/b/${board.slug}?room=${encodeURIComponent(room.slug)}`} className="btn btn-ghost btn-sm">
                  Edit board
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => confirm("Reset all scores and tiles?") && dispatch({ type: "game:reset" })}
                >
                  Reset game
                </button>
              </Setting>
            </div>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 p-3 md:p-5">
          <PlayBoard
            board={board}
            used={room.state.used}
            onOpen={(clueId) => dispatch({ type: "clue:open", clueId })}
            onUnuse={(clueId) => dispatch({ type: "clue:unuse", clueId })}
          />
        </div>
        {live && showJoin && (
          <JoinPanel
            slug={room.slug}
            teams={room.state.teams}
            players={players}
            onRemovePlayer={game.removePlayer}
            onClose={() => setShowJoin(false)}
          />
        )}
      </div>

      <Scoreboard
        teams={room.state.teams}
        players={live ? players : undefined}
        step={step}
        dispatch={dispatch}
        highlight={currentBuzz?.teamId}
        queued={room.state.queued}
      />

      {phase.kind === "clue" && (
        <ClueView
          board={board}
          phase={phase}
          teams={room.state.teams}
          mode={room.mode}
          buzzMode={room.state.buzzMode ?? "countdown"}
          buzz={buzz}
          dispatch={dispatch}
          onCountdown={live ? game.countdown : runLocalCountdown}
          onResetBuzz={game.resetBuzz}
          onOpenPowerups={() => setPowersOpen(true)}
        />
      )}
      {phase.kind === "final" && (
        <FinalView
          board={board}
          phase={phase}
          teams={room.state.teams}
          mode={room.mode}
          canQuickfire={quickfireLeft > 0}
          dispatch={dispatch}
        />
      )}
      {phase.kind === "quickfire" && (
        <QuickfireView
          board={board}
          phase={phase}
          teams={room.state.teams}
          mode={room.mode}
          buzz={buzz}
          canFinal={canFinal}
          dispatch={dispatch}
        />
      )}
      {phase.kind === "ended" && <EndedView teams={room.state.teams} dispatch={dispatch} />}
      {powersOpen && (
        <PowerupsDialog
          settings={room.state.powerSettings}
          teams={room.state.teams}
          players={live ? players : undefined}
          dispatch={dispatch}
          onClose={() => setPowersOpen(false)}
        />
      )}
      {turnsOpen && (
        <TurnOrderDialog
          teams={room.state.teams}
          order={room.state.turnOrder ?? []}
          nextTeamId={nextTurn?.id}
          dispatch={dispatch}
          onClose={() => setTurnsOpen(false)}
        />
      )}
      <PowerNoticeToast notices={room.state.powerNotices} teams={room.state.teams} big />
      <CountdownOverlay count={live ? (buzz.status === "countdown" ? buzz.count : undefined) : localCount} go={goFlash} />
      {intro && <WelcomeIntro boardName={board.name} onDone={endIntro} />}
    </main>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="label">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
