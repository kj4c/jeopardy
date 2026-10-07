"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LobbyStyle = "upbeat" | "lofi";
export type MusicScene = "lobby" | "countdown";
type Track = LobbyStyle | "countdown";

const SRC: Record<Track, string> = {
  upbeat: "/music/upbeat.mp3",
  lofi: "/music/lofi.mp3",
  countdown: "/music/countdown.mp3",
};
const DEFAULT_VOLUME = 0.45;
/** Each loop fades out over its last seconds and back in over its first. */
const LOOP_FADE_S = 2;
/** Switching tracks or muting fades over this long. */
const SWITCH_FADE_S = 0.8;
const STORAGE_KEY = "jeopardy:music";

type Settings = { lobby: LobbyStyle; muted: boolean; volume: number };

/** Every track this page has made, so a remounted player can silence ones it lost track of. */
const liveAudio = new Set<HTMLAudioElement>();
const tabId = Math.random().toString(36).slice(2);

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const volume = typeof saved.volume === "number" ? Math.max(0, Math.min(1, saved.volume)) : DEFAULT_VOLUME;
    return { lobby: saved.lobby === "lofi" ? "lofi" : "upbeat", muted: !!saved.muted, volume };
  } catch {
    return { lobby: "upbeat", muted: false, volume: DEFAULT_VOLUME };
  }
}

function loopEnvelope(el: HTMLAudioElement) {
  const d = el.duration;
  if (!Number.isFinite(d) || d <= LOOP_FADE_S * 3) return 1;
  const t = el.currentTime;
  return Math.max(0, Math.min(1, t / LOOP_FADE_S, (d - t) / LOOP_FADE_S));
}

/**
 * Background music for the host screen. `duck` (0–1) turns it down, e.g. while a clue is up.
 * Browsers block audio until the page is clicked, so playback starts on the first interaction if needed.
 */
export function useMusic(scene: MusicScene, duck = 1) {
  const [settings, setSettings] = useState<Settings>({ lobby: "upbeat", muted: false, volume: DEFAULT_VOLUME });
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  /** Another host tab is playing, so this one stays quiet until someone uses its music menu. */
  const [yielded, setYielded] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const mountedAt = useRef(0);
  const els = useRef<Partial<Record<Track, HTMLAudioElement>>>({});
  const presence = useRef<Record<Track, number>>({ upbeat: 0, lofi: 0, countdown: 0 });
  const target = useRef<{ track: Track; muted: boolean; duck: number; volume: number }>({
    track: "upbeat",
    muted: true,
    duck,
    volume: DEFAULT_VOLUME,
  });

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const track: Track = scene === "countdown" ? "countdown" : settings.lobby;
  const silent = settings.muted || yielded || !loaded;
  target.current = { track, muted: silent, duck, volume: settings.volume };

  const element = useCallback((t: Track) => {
    let el = els.current[t];
    if (!el) {
      el = new Audio(SRC[t]);
      el.loop = true;
      el.preload = "auto";
      el.volume = 0;
      els.current[t] = el;
      liveAudio.add(el);
    }
    return el;
  }, []);

  const start = useCallback(
    (t: Track) => {
      const el = element(t);
      if (!el.paused) return;
      if (t === "countdown" && presence.current.countdown === 0) el.currentTime = 0;
      el.play().then(
        () => {
          setBlocked(false);
          channelRef.current?.postMessage({ type: "claim", id: tabId, at: mountedAt.current });
        },
        () => setBlocked(true),
      );
    },
    [element],
  );

  useEffect(() => {
    if (!silent) start(track);
  }, [silent, track, start]);

  useEffect(() => {
    if (!blocked) return;
    const retry = () => {
      const { track: t, muted } = target.current;
      if (!muted) start(t);
    };
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [blocked, start]);

  useEffect(() => {
    let last = performance.now();
    let duckNow = target.current.duck;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      const { track: active, muted, duck: duckTarget, volume } = target.current;
      duckNow += Math.sign(duckTarget - duckNow) * Math.min(Math.abs(duckTarget - duckNow), dt / SWITCH_FADE_S);
      for (const t of Object.keys(SRC) as Track[]) {
        const el = els.current[t];
        if (!el) continue;
        const want = t === active && !muted ? 1 : 0;
        const p = presence.current[t];
        presence.current[t] = p + Math.sign(want - p) * Math.min(Math.abs(want - p), dt / SWITCH_FADE_S);
        el.volume = Math.min(1, volume * presence.current[t] * loopEnvelope(el) * duckNow);
        if (presence.current[t] === 0 && !el.paused) el.pause();
      }
    };
    const timer = setInterval(tick, 40);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const all = els.current;
    for (const el of liveAudio) if (!Object.values(all).includes(el)) el.pause();
    return () => Object.values(all).forEach((el) => el?.pause());
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("jeopardy-music");
    channelRef.current = channel;
    mountedAt.current = Date.now();
    channel.onmessage = (e) => {
      const msg = e.data;
      if (msg?.type !== "claim" || msg.id === tabId) return;
      if (msg.manual || msg.at >= mountedAt.current) {
        setYielded(true);
      } else if (!target.current.muted) {
        channel.postMessage({ type: "claim", id: tabId, at: mountedAt.current });
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const takeOver = () => {
    setYielded(false);
    channelRef.current?.postMessage({ type: "claim", id: tabId, at: Date.now(), manual: true });
  };

  return {
    lobby: settings.lobby,
    volume: settings.volume,
    muted: settings.muted || yielded,
    blocked: blocked && !silent,
    setLobby: (lobby: LobbyStyle) => {
      takeOver();
      update({ lobby, muted: false });
    },
    setMuted: (muted: boolean) => {
      if (!muted) takeOver();
      else setYielded(false);
      update({ muted });
    },
    setVolume: (volume: number) => {
      takeOver();
      update({ volume, muted: false });
    },
  };
}
