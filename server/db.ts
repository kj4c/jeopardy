import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { slugify } from "../lib/board";
import type { Board, GameState, Room, RoomMode, RoomSummary } from "../lib/types";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "jeopardy.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rooms (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    board_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS rooms_board ON rooms(board_id);
`);

const boardColumns = (db.prepare("PRAGMA table_info(boards)").all() as { name: string }[]).map((c) => c.name);
if (!boardColumns.includes("slug")) {
  db.exec("ALTER TABLE boards ADD COLUMN slug TEXT");
  db.exec("ALTER TABLE boards ADD COLUMN password_hash TEXT");
  const rows = db.prepare("SELECT id, name FROM boards").all() as { id: string; name: string }[];
  const taken = new Set<string>();
  for (const row of rows) {
    const base = slugify(row.name) || "board";
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    db.prepare("UPDATE boards SET slug = ? WHERE id = ?").run(slug, row.id);
  }
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS boards_slug ON boards(slug)");

type BoardRow = {
  id: string;
  slug: string;
  name: string;
  data: string;
  updated_at: number;
  password_hash: string | null;
};
type RoomRow = {
  slug: string;
  name: string;
  board_id: string;
  mode: string;
  state: string;
  created_at: number;
  updated_at: number;
};

function toSummary(row: RoomRow): RoomSummary {
  return {
    slug: row.slug,
    name: row.name,
    boardId: row.board_id,
    mode: row.mode as RoomMode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type BoardSummary = { id: string; slug: string; name: string; updatedAt: number; hasPassword: boolean };

export function listBoardsByIds(ids: string[]): BoardSummary[] {
  if (!ids.length) return [];
  const rows = db
    .prepare(
      `SELECT id, slug, name, updated_at, password_hash FROM boards WHERE id IN (${ids.map(() => "?").join(",")})
       ORDER BY updated_at DESC`,
    )
    .all(...ids) as BoardRow[];
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    updatedAt: r.updated_at,
    hasPassword: !!r.password_hash,
  }));
}

function rowToBoard(row: BoardRow): Board {
  const data = JSON.parse(row.data) as Board;
  return {
    ...data,
    id: row.id,
    slug: row.slug,
    name: row.name,
    updatedAt: row.updated_at,
    hasPassword: !!row.password_hash,
  };
}

export function getBoard(id: string): Board | null {
  const row = db.prepare("SELECT * FROM boards WHERE id = ?").get(id) as BoardRow | undefined;
  return row ? rowToBoard(row) : null;
}

export function getBoardBySlug(slug: string): Board | null {
  const row = db.prepare("SELECT * FROM boards WHERE slug = ?").get(slug) as BoardRow | undefined;
  return row ? rowToBoard(row) : null;
}

export function getPasswordHash(id: string): string | null {
  const row = db.prepare("SELECT password_hash FROM boards WHERE id = ?").get(id) as
    | { password_hash: string | null }
    | undefined;
  return row?.password_hash ?? null;
}

export function setPasswordHash(id: string, hash: string | null) {
  db.prepare("UPDATE boards SET password_hash = ? WHERE id = ?").run(hash, id);
}

export function boardSlugTaken(slug: string) {
  return !!db.prepare("SELECT 1 FROM boards WHERE slug = ?").get(slug);
}

function boardData(board: Board) {
  const { id: _id, slug: _slug, name: _name, updatedAt: _u, hasPassword: _p, ...data } = board;
  return JSON.stringify(data);
}

export function insertBoard(board: Board, passwordHash: string | null): Board {
  const updatedAt = Date.now();
  db.prepare(
    "INSERT INTO boards (id, slug, name, data, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(board.id, board.slug, board.name, boardData(board), updatedAt, passwordHash);
  return { ...board, updatedAt, hasPassword: !!passwordHash };
}

export function updateBoard(board: Board): Board | null {
  const updatedAt = Date.now();
  db.prepare("UPDATE boards SET name = ?, data = ?, updated_at = ? WHERE id = ?").run(
    board.name,
    boardData(board),
    updatedAt,
    board.id,
  );
  return getBoard(board.id);
}

export function deleteBoard(id: string) {
  db.prepare("DELETE FROM rooms WHERE board_id = ?").run(id);
  db.prepare("DELETE FROM boards WHERE id = ?").run(id);
}

export function listRooms(boardId?: string): RoomSummary[] {
  const rows = (
    boardId
      ? db.prepare("SELECT * FROM rooms WHERE board_id = ? ORDER BY updated_at DESC").all(boardId)
      : db.prepare("SELECT * FROM rooms ORDER BY updated_at DESC").all()
  ) as RoomRow[];
  return rows.map(toSummary);
}

export function getRoom(slug: string): Room | null {
  const row = db.prepare("SELECT * FROM rooms WHERE slug = ?").get(slug) as RoomRow | undefined;
  if (!row) return null;
  return { ...toSummary(row), state: JSON.parse(row.state) as GameState };
}

export function insertRoom(room: Omit<Room, "createdAt" | "updatedAt">): Room {
  const now = Date.now();
  db.prepare(
    "INSERT INTO rooms (slug, name, board_id, mode, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(room.slug, room.name, room.boardId, room.mode, JSON.stringify(room.state), now, now);
  return { ...room, createdAt: now, updatedAt: now };
}

export function updateRoom(slug: string, patch: { name?: string; mode?: RoomMode; state?: GameState }) {
  const current = getRoom(slug);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: Date.now() };
  db.prepare("UPDATE rooms SET name = ?, mode = ?, state = ?, updated_at = ? WHERE slug = ?").run(
    next.name,
    next.mode,
    JSON.stringify(next.state),
    next.updatedAt,
    slug,
  );
  return next;
}

export function deleteRoom(slug: string) {
  db.prepare("DELETE FROM rooms WHERE slug = ?").run(slug);
}
