import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("Set SESSION_SECRET to a long random string before running in production.");
}
const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const COOKIE_PREFIX = "jb_";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function safeEqual(a: string | Buffer, b: string | Buffer) {
  const ab = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return true;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), 32);
  return safeEqual(actual, Buffer.from(hash, "base64url"));
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/** Signed against the current password hash, so changing or adding a password signs out every other device. */
export function boardSessionCookie(boardId: string, passwordHash: string | null): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const value = `${expires}.${sign(`${boardId}.${expires}.${passwordHash ?? ""}`)}`;
  return `${COOKIE_PREFIX}${boardId}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearBoardCookie(boardId: string): string {
  return `${COOKIE_PREFIX}${boardId}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function validCookie(boardId: string, value: string | undefined, passwordHash: string | null) {
  if (!value) return false;
  const [expires, sig] = value.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sig, sign(`${boardId}.${expires}.${passwordHash ?? ""}`));
}

/** Board ids this browser has unlocked (cookie signature still valid). */
export function unlockedBoardIds(
  cookieHeader: string | undefined,
  passwordHashOf: (boardId: string) => string | null,
): string[] {
  return Object.entries(parseCookies(cookieHeader))
    .filter(([name]) => name.startsWith(COOKIE_PREFIX))
    .map(([name, value]) => [name.slice(COOKIE_PREFIX.length), value] as const)
    .filter(([id, value]) => validCookie(id, value, passwordHashOf(id)))
    .map(([id]) => id);
}

export function hasBoardAccess(cookieHeader: string | undefined, boardId: string, passwordHash: string | null) {
  if (!passwordHash) return true;
  return validCookie(boardId, parseCookies(cookieHeader)[`${COOKIE_PREFIX}${boardId}`], passwordHash);
}

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

/** Returns false once a client has made too many wrong guesses for a board. */
export function allowAttempt(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) return true;
  return entry.count < MAX_ATTEMPTS;
}

export function recordFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count++;
}

export function clearFailures(key: string) {
  attempts.delete(key);
}
