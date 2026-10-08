"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { gameReducer } from "./gameReducer";
import { emitAck, getSocket } from "./socket";
import type { Board, BuzzState, GameAction, HostSnapshot, Player, Room, RoomMode } from "./types";

type Status = "loading" | "ready" | "not_found" | "locked" | "error";

const IDLE_BUZZ: BuzzState = { status: "idle", buzzes: [] };

/** Waits for the server instead of updating the screen straight away: the server may refuse these or make new ids. */
const SERVER_ONLY = new Set<GameAction["type"]>(["team:add", "power:use", "power:draft"]);

export function useHostGame(slug: string) {
  const [status, setStatus] = useState<Status>("loading");
  const [room, setRoom] = useState<Room | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [buzz, setBuzz] = useState<BuzzState>(IDLE_BUZZ);
  const [connected, setConnected] = useState(true);
  const [remotes, setRemotes] = useState<number | undefined>(undefined);
  const [saveError, setSaveError] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const boardRef = useRef<Board | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [reloadKey, setReloadKey] = useState(0);
  const [lockedBoard, setLockedBoard] = useState<{ slug: string; name: string } | null>(null);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  /** Host actions sent but not yet confirmed; the screen already shows their result. */
  const pending = useRef(0);
  const deferred = useRef<HostSnapshot | null>(null);

  const applyFull = useCallback((snap: HostSnapshot) => {
    roomRef.current = snap.room;
    boardRef.current = snap.board;
    setRoom(snap.room);
    setBoard(snap.board);
    setPlayers(snap.players);
    setBuzz(snap.buzz);
    setRemotes(snap.remotes);
  }, []);

  const applySnapshot = useCallback(
    (snap: HostSnapshot) => {
      if (pending.current === 0) return applyFull(snap);
      // An older state would undo clicks the server hasn't seen yet, so hold it until they're confirmed.
      deferred.current = snap;
      setPlayers(snap.players);
      setBuzz(snap.buzz);
      setRemotes(snap.remotes);
    },
    [applyFull],
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    api<{ room: Room; board: Board }>(`/api/rooms/${slug}`)
      .then(({ room, board }) => {
        if (cancelled) return;
        roomRef.current = room;
        boardRef.current = board;
        setRoom(room);
        setBoard(board);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          setLockedBoard(err.data.board);
          setStatus("locked");
        } else setStatus(err.status === 404 ? "not_found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

  const mode = room?.mode;

  useEffect(() => {
    if (status !== "ready" || mode !== "live") return;
    const socket = getSocket();
    const join = () =>
      emitAck<{ snapshot?: HostSnapshot; error?: string }>("host:join", { slug })
        .then((res) => res.snapshot && applySnapshot(res.snapshot))
        .catch(() => {});
    const onConnect = () => {
      setConnected(true);
      join();
    };
    const onDisconnect = () => setConnected(false);
    const onClosed = () => setStatus("not_found");
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("host:state", applySnapshot);
    socket.on("room:closed", onClosed);
    if (socket.connected) join();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("host:state", applySnapshot);
      socket.off("room:closed", onClosed);
    };
  }, [status, mode, slug, applySnapshot]);

  const persistLocal = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const current = roomRef.current;
      if (!current) return;
      try {
        await api(`/api/rooms/${slug}/state`, { method: "PUT", json: { state: current.state } });
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    }, 200);
  }, [slug]);

  const dispatch = useCallback(
    (action: GameAction) => {
      const current = roomRef.current;
      const b = boardRef.current;
      if (!current || !b) return;
      if (current.mode === "live") {
        pending.current++;
        getSocket()
          .timeout(8000)
          .emit("host:action", action, (err: Error | null, res?: { snapshot?: HostSnapshot }) => {
            pending.current = Math.max(0, pending.current - 1);
            if (!err && res?.snapshot) deferred.current = res.snapshot;
            if (pending.current === 0 && deferred.current) {
              applyFull(deferred.current);
              deferred.current = null;
            }
          });
        if (!SERVER_ONLY.has(action.type)) {
          const state = gameReducer(current.state, action, b);
          if (state !== current.state) {
            const next = { ...current, state: { ...state, powerNotices: current.state.powerNotices } };
            roomRef.current = next;
            setRoom(next);
          }
        }
        return;
      }
      const state = gameReducer(current.state, action, b);
      if (state === current.state) return;
      const next = { ...current, state };
      roomRef.current = next;
      setRoom(next);
      persistLocal();
    },
    [persistLocal, applyFull],
  );

  const countdown = useCallback(() => getSocket().emit("host:countdown"), []);
  const resetBuzz = useCallback(() => getSocket().emit("host:buzz-reset"), []);
  const startAnswerTimer = useCallback(() => getSocket().emit("host:answer-timer"), []);
  const removePlayer = useCallback((playerId: string) => getSocket().emit("host:player-remove", { playerId }), []);

  const setMode = useCallback(
    async (next: RoomMode) => {
      clearTimeout(saveTimer.current);
      if (roomRef.current?.mode === "local") {
        await api(`/api/rooms/${slug}/state`, { method: "PUT", json: { state: roomRef.current.state } });
      }
      await api(`/api/rooms/${slug}`, { method: "PATCH", json: { mode: next } });
      setBuzz(IDLE_BUZZ);
      setPlayers([]);
      setReloadKey((k) => k + 1);
    },
    [slug],
  );

  return {
    status,
    lockedBoard,
    reload,
    room,
    board,
    players,
    buzz,
    remotes: mode === "live" ? remotes : undefined,
    connected: mode === "live" ? connected : true,
    saveError,
    dispatch,
    countdown,
    resetBuzz,
    startAnswerTimer,
    removePlayer,
    setMode,
  };
}
