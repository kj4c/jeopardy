import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { slugify } from "../lib/board";
import type { Board, GameState, Room, RoomMode, RoomSummary } from "../lib/types";

/** Railway sets RAILWAY_VOLUME_MOUNT_PATH when a volume is attached; prefer it so the mount path can't be wrong. */
export const DATA_DIR = path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || "./data");
export const DATA_IS_EPHEMERAL = !!process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH;
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
const DB_FILE = path.join(DATA_DIR, "jeopardy.db");
const KEEP_BACKUPS = 20;
mkdirSync(UPLOAD_DIR, { recursive: true });
mkdirSync(BACKUP_DIR, { recursive: true });

restoreRequestedBackup();

const db = new DatabaseSync(DB_FILE);
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
  CREATE TABLE IF NOT EXISTS remote_keys (
    slug TEXT PRIMARY KEY,
    key TEXT NOT NULL
  );
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

export function listAllBoards(): BoardSummary[] {
  const rows = db.prepare("SELECT id, slug, name, updated_at, password_hash FROM boards ORDER BY updated_at DESC").all() as BoardRow[];
  return rows.map(toBoardSummary);
}

export function listBoardsByIds(ids: string[]): BoardSummary[] {
  if (!ids.length) return [];
  const rows = db
    .prepare(
      `SELECT id, slug, name, updated_at, password_hash FROM boards WHERE id IN (${ids.map(() => "?").join(",")})
       ORDER BY updated_at DESC`,
    )
    .all(...ids) as BoardRow[];
  return rows.map(toBoardSummary);
}

function toBoardSummary(r: BoardRow): BoardSummary {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    updatedAt: r.updated_at,
    hasPassword: !!r.password_hash,
  };
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
  db.prepare("DELETE FROM remote_keys WHERE slug IN (SELECT slug FROM rooms WHERE board_id = ?)").run(id);
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

export function countBoards(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM boards").get() as { n: number }).n;
}

export function deleteRoom(slug: string) {
  db.prepare("DELETE FROM remote_keys WHERE slug = ?").run(slug);
  db.prepare("DELETE FROM rooms WHERE slug = ?").run(slug);
}

/** Secret that lets a phone open the host remote, which shows the answers. Made on first use. */
export function getRemoteKey(slug: string): string {
  const row = db.prepare("SELECT key FROM remote_keys WHERE slug = ?").get(slug) as { key: string } | undefined;
  return row?.key ?? resetRemoteKey(slug);
}

export function resetRemoteKey(slug: string): string {
  const key = randomBytes(18).toString("base64url");
  db.prepare("INSERT INTO remote_keys (slug, key) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET key = excluded.key").run(
    slug,
    key,
  );
  return key;
}

/** Changes whenever a board or room is added, edited or deleted, so unchanged data isn't backed up again. */
function dataSignature(): string {
  const row = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM boards) || ':' || (SELECT COUNT(*) FROM rooms) || ':' ||
              IFNULL((SELECT MAX(updated_at) FROM boards), 0) || ':' || IFNULL((SELECT MAX(updated_at) FROM rooms), 0) AS sig`,
    )
    .get() as { sig: string };
  return row.sig;
}

export function listBackups(): string[] {
  return readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("jeopardy-") && f.endsWith(".db"))
    .sort()
    .reverse();
}

export function backupDetails(): { name: string; size: number; createdAt: number }[] {
  return listBackups().map((name) => {
    const stat = statSync(path.join(BACKUP_DIR, name));
    return { name, size: stat.size, createdAt: stat.mtimeMs };
  });
}

/**
 * Copies the database into `backups/` (images in `uploads/` aren't included) and keeps the newest few.
 * Skipped when nothing changed since the last backup, unless `reason` is given.
 */
export function backupDatabase(reason?: string): string | null {
  const sigFile = path.join(BACKUP_DIR, ".last-signature");
  const sig = dataSignature();
  if (!reason && existsSync(sigFile) && readFileSync(sigFile, "utf8") === sig) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(BACKUP_DIR, `jeopardy-${stamp}${reason ? `-${reason}` : ""}.db`);
  db.prepare("VACUUM INTO ?").run(file);
  writeFileSync(sigFile, sig);
  for (const old of listBackups().slice(KEEP_BACKUPS)) rmSync(path.join(BACKUP_DIR, old), { force: true });
  return file;
}

/**
 * Set RESTORE_BACKUP to a file name in `backups/` and restart to roll the database back to it.
 * Runs once per backup, so leaving the variable set doesn't keep wiping newer changes.
 */
function restoreRequestedBackup() {
  const name = path.basename(process.env.RESTORE_BACKUP ?? "");
  if (!name) return;
  const source = path.join(BACKUP_DIR, name);
  const marker = path.join(BACKUP_DIR, `.restored-${name}`);
  if (!existsSync(source)) return console.warn(`> RESTORE_BACKUP: ${name} not found in ${BACKUP_DIR}`);
  if (existsSync(marker)) return;
  if (existsSync(DB_FILE)) {
    const current = new DatabaseSync(DB_FILE);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    current.prepare("VACUUM INTO ?").run(path.join(BACKUP_DIR, `jeopardy-${stamp}-before-restore.db`));
    current.close();
  }
  for (const suffix of ["-wal", "-shm"]) rmSync(DB_FILE + suffix, { force: true });
  copyFileSync(source, DB_FILE);
  writeFileSync(marker, new Date().toISOString());
  console.log(`> Restored the database from ${name}. Remove RESTORE_BACKUP when you're happy with it.`);
}
