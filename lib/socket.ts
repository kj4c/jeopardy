"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: "/socket.io", transports: ["websocket", "polling"], withCredentials: true });
  }
  return socket;
}

export function emitAck<T>(event: string, data?: unknown, timeoutMs = 5000): Promise<T> {
  const s = getSocket();
  return s.timeout(timeoutMs).emitWithAck(event, data) as Promise<T>;
}

export function getPlayerId(): string {
  const key = "jeopardy_player_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}
