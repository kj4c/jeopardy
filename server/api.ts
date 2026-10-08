import { randomUUID } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { defaultBoard, findClue, initialGameState, newId, slugify, TEAM_COLORS } from "../lib/board";
import type { Board, GameState, RoomMode } from "../lib/types";
import {
  allowAttempt,
  boardSessionCookie,
  clearBoardCookie,
  clearFailures,
  hasBoardAccess,
  hashPassword,
  recordFailure,
  unlockedBoardIds,
  verifyPassword,
} from "./auth";
import * as db from "./db";
import { GenerateError, generateBoard } from "./generate";
import { dropRoom, getLiveState, publicSnapshot, revokeRemotes, syncBoard, syncRoom, withoutSecrets } from "./rooms";

/** Sends games back to the board if the clue they had open was deleted in the editor. */
function closeDeletedClues(board: Board) {
  for (const summary of db.listRooms(board.id)) {
    const state = getLiveState(summary.slug) ?? db.getRoom(summary.slug)?.state;
    if (state?.phase.kind !== "clue" || findClue(board, state.phase.clueId)) continue;
    const next: GameState = { ...state, phase: { kind: "board" } };
    db.updateRoom(summary.slug, { state: next });
    syncRoom(summary.slug, { state: next });
  }
}

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const EXT_TYPES: Record<string, string> = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([k, v]) => [v, k]));

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, "Payload too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const buf = await readBody(req, MAX_JSON_BYTES);
  try {
    return JSON.parse(buf.toString("utf8") || "{}") as T;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

/** Throws 401 unless this browser has unlocked the board (boards without a password are open). */
function requireBoard(req: IncomingMessage, boardId: string | undefined): Board {
  const board = boardId ? db.getBoard(boardId) : null;
  if (!board) throw new HttpError(404, "Board not found");
  if (!hasBoardAccess(req.headers.cookie, board.id, db.getPasswordHash(board.id))) {
    throw new HttpError(401, "This board is locked");
  }
  return board;
}

function clientKey(req: IncomingMessage, slug: string) {
  const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return `${forwarded || req.socket.remoteAddress}:${slug}`;
}

function sanitizeBoard(input: Partial<Board>, existing: Pick<Board, "id" | "slug">): Board {
  if (!Array.isArray(input.categories) || !Array.isArray(input.rowValues)) {
    throw new HttpError(400, "Invalid board");
  }
  return {
    id: existing.id,
    slug: existing.slug,
    name: String(input.name ?? "Untitled board").slice(0, 120) || "Untitled board",
    rowValues: input.rowValues.map((v) => Math.round(Number(v) || 0)),
    categories: input.categories,
    finalJeopardy: input.finalJeopardy,
    quickfire: input.quickfire
      ? {
          points: Math.round(Number(input.quickfire.points) || 0),
          penalty: !!input.quickfire.penalty,
          questions: Array.isArray(input.quickfire.questions) ? input.quickfire.questions : [],
        }
      : undefined,
  };
}

function uniqueBoardSlug(base: string) {
  let slug = base;
  for (let n = 2; db.boardSlugTaken(slug); n++) slug = `${base}-${n}`;
  return slug;
}

function uniqueSlug(base: string) {
  let slug = base || "room";
  let n = 2;
  while (db.getRoom(slug)) slug = `${base}-${n++}`;
  return slug;
}

export function serveUpload(req: IncomingMessage, res: ServerResponse, pathname: string) {
  const name = path.basename(decodeURIComponent(pathname.slice("/uploads/".length)));
  const file = path.join(db.UPLOAD_DIR, name);
  const type = EXT_TYPES[path.extname(name).toLowerCase()];
  try {
    const stat = statSync(file);
    if (!stat.isFile() || !type) throw new Error();
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string) {
  try {
    await route(req, res, pathname);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: "Server error" });
  }
}

async function route(req: IncomingMessage, res: ServerResponse, pathname: string) {
  const method = req.method ?? "GET";
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const [resource, id, sub] = parts;

  if (resource === "b" && id) {
    const board = db.getBoardBySlug(id);
    if (!board) throw new HttpError(404, "Board not found");
    const hash = db.getPasswordHash(board.id);
    if (!sub && method === "GET") {
      return send(
        res,
        200,
        {
          id: board.id,
          slug: board.slug,
          name: board.name,
          hasPassword: !!hash,
          authed: hasBoardAccess(req.headers.cookie, board.id, hash),
        },
        // Open boards have nothing to unlock, so remember them on this device as soon as they're visited.
        hash ? {} : { "Set-Cookie": boardSessionCookie(board.id, null) },
      );
    }
    if (sub === "login" && method === "POST") {
      const key = clientKey(req, board.slug);
      if (!allowAttempt(key)) throw new HttpError(429, "Too many attempts. Try again in a few minutes.");
      const { password } = await readJson<{ password?: string }>(req);
      if (!verifyPassword(String(password ?? ""), hash)) {
        recordFailure(key);
        throw new HttpError(401, "Wrong password");
      }
      clearFailures(key);
      return send(res, 200, { id: board.id }, { "Set-Cookie": boardSessionCookie(board.id, hash) });
    }
    if (sub === "logout" && method === "POST") {
      return send(res, 200, { ok: true }, { "Set-Cookie": clearBoardCookie(board.id) });
    }
  }

  if (resource === "public" && id === "info" && method === "GET") {
    const port = (req.headers.host ?? "").split(":")[1] ?? process.env.PORT ?? "3000";
    const lan = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === "IPv4" && !i.internal)
      .map((i) => `http://${i!.address}:${port}`);
    return send(res, 200, { lan });
  }

  if (resource === "public" && id === "rooms" && sub && method === "GET") {
    const room = db.getRoom(sub);
    if (!room) throw new HttpError(404, "Room not found");
    const board = db.getBoard(room.boardId);
    if (!board) throw new HttpError(404, "Board not found");
    const state = getLiveState(room.slug) ?? room.state;
    return send(res, 200, publicSnapshot({ room: { ...room, state }, board, buzz: { status: "idle", buzzes: [] } }));
  }

  if (resource === "upload" && method === "POST") {
    const boardId = new URL(req.url ?? "", "http://x").searchParams.get("board") ?? undefined;
    requireBoard(req, boardId);
    const type = (req.headers["content-type"] ?? "").split(";")[0].trim();
    const ext = IMAGE_TYPES[type];
    if (!ext) throw new HttpError(415, "Unsupported image type");
    const body = await readBody(req, MAX_UPLOAD_BYTES);
    const name = `${randomUUID()}${ext}`;
    await writeFile(path.join(db.UPLOAD_DIR, name), body);
    return send(res, 200, { url: `/uploads/${name}` });
  }

  if (resource === "boards") {
    if (!id) {
      if (method === "GET") {
        const boards = db.listBoardsByIds(unlockedBoardIds(req.headers.cookie, db.getPasswordHash));
        const rooms = db.listRooms();
        return send(
          res,
          200,
          boards.map((b) => ({ ...b, rooms: rooms.filter((r) => r.boardId === b.id) })),
        );
      }
      if (method === "POST") {
        const body = await readJson<{ name?: string; password?: string }>(req);
        const name = String(body.name ?? "").trim().slice(0, 120);
        const password = String(body.password ?? "");
        const slug = slugify(name);
        if (!slug) throw new HttpError(400, "Give your board a name");
        if (db.boardSlugTaken(slug)) throw new HttpError(409, "That board name is taken. Try another.");
        const hash = password ? hashPassword(password) : null;
        const board = db.insertBoard({ ...defaultBoard(name), id: newId("b_"), slug }, hash);
        return send(res, 201, board, { "Set-Cookie": boardSessionCookie(board.id, hash) });
      }
    } else {
      const board = requireBoard(req, id);
      if (sub === "duplicate" && method === "POST") {
        const hash = db.getPasswordHash(board.id);
        const copy = db.insertBoard(
          { ...board, id: newId("b_"), slug: uniqueBoardSlug(`${board.slug}-copy`), name: `${board.name} (copy)` },
          hash,
        );
        return send(res, 201, copy, { "Set-Cookie": boardSessionCookie(copy.id, hash) });
      }
      if (sub === "password" && method === "POST") {
        const password = String((await readJson<{ password?: string }>(req)).password ?? "");
        const hash = password ? hashPassword(password) : null;
        db.setPasswordHash(board.id, hash);
        return send(res, 200, { ok: true }, { "Set-Cookie": boardSessionCookie(board.id, hash) });
      }
      if (sub === "rooms" && method === "GET") return send(res, 200, db.listRooms(board.id));
      if (sub === "generate" && method === "POST") {
        try {
          return send(res, 200, await generateBoard(board.id, await readJson(req)));
        } catch (err) {
          if (err instanceof GenerateError) throw new HttpError(err.status, err.message);
          throw err;
        }
      }
      if (!sub && method === "GET") return send(res, 200, board);
      if (!sub && method === "PUT") {
        const saved = db.updateBoard(sanitizeBoard(await readJson<Partial<Board>>(req), board));
        if (saved) {
          syncBoard(saved);
          closeDeletedClues(saved);
        }
        return send(res, 200, saved);
      }
      if (!sub && method === "DELETE") {
        for (const room of db.listRooms(board.id)) dropRoom(room.slug);
        db.deleteBoard(board.id);
        return send(res, 200, { ok: true }, { "Set-Cookie": clearBoardCookie(board.id) });
      }
    }
  }

  if (resource === "rooms") {
    if (!id) {
      if (method === "POST") {
        const body = await readJson<{
          name?: string;
          boardId?: string;
          mode?: RoomMode;
          teams?: { name: string; color?: string }[];
        }>(req);
        const name = String(body.name ?? "").trim().slice(0, 80);
        if (!name) throw new HttpError(400, "Room name is required");
        requireBoard(req, body.boardId);
        const slug = uniqueSlug(slugify(name));
        const teams = (body.teams ?? [])
          .filter((t) => t.name?.trim())
          .map((t, i) => ({ name: t.name.trim().slice(0, 40), color: t.color || TEAM_COLORS[i % TEAM_COLORS.length] }));
        const room = db.insertRoom({
          slug,
          name,
          boardId: body.boardId!,
          mode: body.mode === "local" ? "local" : "live",
          state: initialGameState(teams),
        });
        return send(res, 201, room);
      }
    } else {
      const room = db.getRoom(id);
      if (!room) throw new HttpError(404, "Room not found");
      const roomBoard = db.getBoard(room.boardId);
      if (!roomBoard) throw new HttpError(404, "Board not found");
      if (!hasBoardAccess(req.headers.cookie, roomBoard.id, db.getPasswordHash(roomBoard.id))) {
        return send(res, 401, { error: "This board is locked", board: { slug: roomBoard.slug, name: roomBoard.name } });
      }
      if (!sub && method === "GET") {
        const state = getLiveState(id) ?? room.state;
        return send(res, 200, { room: { ...room, state: room.mode === "live" ? withoutSecrets(state) : state }, board: roomBoard });
      }
      if (sub === "state" && method === "PUT") {
        const { state } = await readJson<{ state: GameState }>(req);
        if (!state || !Array.isArray(state.teams) || !Array.isArray(state.used) || !state.phase) {
          throw new HttpError(400, "Invalid state");
        }
        const saved = db.updateRoom(id, { state });
        syncRoom(id, { state });
        return send(res, 200, { updatedAt: saved?.updatedAt });
      }
      if (!sub && method === "PATCH") {
        const body = await readJson<{ name?: string; mode?: RoomMode }>(req);
        const patch: { name?: string; mode?: RoomMode; state?: GameState } = {};
        if (body.name?.trim()) patch.name = body.name.trim().slice(0, 80);
        if (body.mode === "live" || body.mode === "local") patch.mode = body.mode;
        const liveState = getLiveState(id);
        if (liveState) patch.state = liveState;
        const saved = db.updateRoom(id, patch);
        syncRoom(id, patch);
        return send(res, 200, saved);
      }
      if (sub === "remote-key" && method === "GET") {
        return send(res, 200, { key: db.getRemoteKey(id) });
      }
      if (sub === "remote-key" && method === "POST") {
        const key = db.resetRemoteKey(id);
        revokeRemotes(id);
        return send(res, 200, { key });
      }
      if (sub === "reset" && method === "POST") {
        const state: GameState = {
          teams: (getLiveState(id) ?? room.state).teams.map((t) => ({ ...t, score: 0 })),
          used: [],
          phase: { kind: "board" },
        };
        db.updateRoom(id, { state });
        syncRoom(id, { state });
        return send(res, 200, { ok: true });
      }
      if (!sub && method === "DELETE") {
        dropRoom(id);
        db.deleteRoom(id);
        return send(res, 200, { ok: true });
      }
    }
  }

  throw new HttpError(404, "Not found");
}
