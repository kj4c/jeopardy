import type { Server, Socket } from "socket.io";
import { findClue } from "../lib/board";
import { answeringTeam, ddMaxWager, finalMaxWager, forcedTeam, gameReducer, isOut } from "../lib/gameReducer";
import { isPowerType, POWERS } from "../lib/powers";
import type {
  Board,
  BuzzState,
  GameAction,
  GameState,
  HostSnapshot,
  Player,
  PublicSnapshot,
  Room,
} from "../lib/types";
import { hasBoardAccess } from "./auth";
import { getBoard, getPasswordHash, getRoom, updateRoom } from "./db";

type LivePlayer = Player & { sockets: Set<string>; latency: number; penaltyUntil: number; teamJoinedAt: number };

type LiveRoom = {
  room: Room;
  board: Board;
  players: Map<string, LivePlayer>;
  buzz: BuzzState;
  armAt: number;
  armedAt: number;
  countdownToken: number;
  saveTimer?: NodeJS.Timeout;
  emptySince?: number;
};

const MAX_LATENCY_CREDIT_MS = 150;
const FALSE_START_PENALTY_MS = 500;
const IDLE_UNLOAD_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const live = new Map<string, LiveRoom>();
let io: Server;

function load(slug: string): LiveRoom | null {
  const cached = live.get(slug);
  if (cached) return cached;
  const room = getRoom(slug);
  if (!room) return null;
  const board = getBoard(room.boardId);
  if (!board) return null;
  const entry: LiveRoom = {
    room,
    board,
    players: new Map(),
    buzz: { status: "idle", buzzes: [] },
    armAt: 0,
    armedAt: 0,
    countdownToken: 0,
  };
  refreshBuzz(entry);
  live.set(slug, entry);
  return entry;
}

/** First player to join the team, preferring someone who's still connected. */
function leaderOf(lr: LiveRoom, teamId: string): LivePlayer | undefined {
  const members = [...lr.players.values()]
    .filter((p) => p.teamId === teamId)
    .sort((a, b) => a.teamJoinedAt - b.teamJoinedAt);
  return members.find((p) => p.connected) ?? members[0];
}

/** Player on the team whose name matches, so a typed 1v1 name can limit buzzing to their phone. */
function findByName(lr: LiveRoom, teamId: string, name: string): string | undefined {
  const wanted = name.toLowerCase();
  return [...lr.players.values()].find((p) => p.teamId === teamId && p.name.trim().toLowerCase() === wanted)?.id;
}

function playersList(lr: LiveRoom): Player[] {
  const leaders = new Set(lr.room.state.teams.map((t) => leaderOf(lr, t.id)?.id));
  return [...lr.players.values()].map(({ id, name, teamId, connected }) => ({
    id,
    name,
    teamId,
    connected,
    leader: leaders.has(id),
  }));
}

function hostSnapshot(lr: LiveRoom): HostSnapshot {
  return { room: lr.room, board: lr.board, players: playersList(lr), buzz: lr.buzz };
}

export function publicSnapshot(lr: Pick<LiveRoom, "room" | "board" | "buzz"> & { players?: Player[] }): PublicSnapshot {
  const { room, board } = lr;
  const { state } = room;
  let phase: PublicSnapshot["phase"] = { kind: "board" };
  if (state.phase.kind === "clue") {
    const found = findClue(board, state.phase.clueId);
    const dd = state.phase.dailyDouble;
    phase = {
      kind: "clue",
      category: found?.category.title ?? "",
      value: found?.value ?? 0,
      lockedTeams: state.phase.lockedTeams,
      revealed: state.phase.revealed,
      resolvedBy: state.phase.resolvedBy,
      pickedBy: state.phase.pickedBy,
      forced: state.phase.forced,
      effects: state.phase.effects,
      powerFoundBy: state.phase.powerFoundBy,
      dailyDouble: dd
        ? {
            ...dd,
            maxWager: dd.teamId ? ddMaxWager(board, state.teams.find((t) => t.id === dd.teamId)) : undefined,
          }
        : undefined,
    };
  } else if (state.phase.kind === "final") {
    const p = state.phase;
    const showAmounts = p.step === "reveal" || p.step === "done";
    phase = {
      kind: "final",
      step: p.step,
      category: board.finalJeopardy?.category ?? "",
      eligible: p.eligible,
      wagers: Object.fromEntries(
        Object.entries(p.wagers).map(([k, v]) => [
          k,
          { by: v.by, amount: showAmounts && p.revealed.includes(k) ? v.amount : undefined },
        ]),
      ),
      answers: Object.fromEntries(Object.entries(p.answers).map(([k, v]) => [k, { by: v.by }])),
    };
  } else if (state.phase.kind === "quickfire") {
    phase = {
      kind: "quickfire",
      index: state.phase.index,
      total: board.quickfire?.questions.length ?? 0,
      points: board.quickfire?.points ?? 0,
      resolvedBy: state.phase.resolvedBy,
      missedBy: state.phase.missedBy,
    };
  } else if (state.phase.kind === "ended") {
    phase = { kind: "ended" };
  }
  return {
    slug: room.slug,
    name: room.name,
    mode: room.mode,
    buzzMode: state.buzzMode ?? "countdown",
    teams: state.teams,
    players: lr.players ?? [],
    buzz: lr.buzz,
    phase,
    powerSettings: state.powerSettings,
    queued: state.queued ?? [],
    powerNotice: state.powerNotice,
    answeringTeam: answeringTeam(state, lr.buzz, room.mode),
  };
}

function broadcast(lr: LiveRoom) {
  const slug = lr.room.slug;
  io.to(`host:${slug}`).emit("host:state", hostSnapshot(lr));
  io.to(`play:${slug}`).emit("public:state", publicSnapshot({ ...lr, players: playersList(lr) }));
}

function scheduleSave(lr: LiveRoom) {
  clearTimeout(lr.saveTimer);
  lr.saveTimer = setTimeout(() => {
    const saved = updateRoom(lr.room.slug, { state: lr.room.state });
    if (saved) lr.room.updatedAt = saved.updatedAt;
  }, 250);
}

function resetBuzz(lr: LiveRoom) {
  lr.countdownToken++;
  lr.buzz = { status: "idle", buzzes: [] };
}

function armBuzzers(lr: LiveRoom) {
  lr.countdownToken++;
  lr.armedAt = Date.now();
  for (const p of lr.players.values()) p.penaltyUntil = 0;
  lr.buzz = { status: "armed", buzzes: [] };
}

/** Clears buzzes, then reopens buzzers straight away if the room is in instant mode with a clue up. */
function refreshBuzz(lr: LiveRoom) {
  const { phase, buzzMode } = lr.room.state;
  const canBuzz = phase.kind === "clue" && !phase.resolvedBy && !phase.dailyDouble && !forcedTeam(phase);
  const quickfireOpen =
    phase.kind === "quickfire" && !phase.resolvedBy && phase.index < (lr.board.quickfire?.questions.length ?? 0);
  if (lr.room.mode === "live" && ((buzzMode === "instant" && canBuzz) || quickfireOpen)) armBuzzers(lr);
  else resetBuzz(lr);
}

function applyAction(lr: LiveRoom, action: GameAction) {
  const before = lr.room.state;
  const after = gameReducer(before, action, lr.board);
  if (after === before) return false;
  const clueChanged =
    before.phase.kind !== after.phase.kind ||
    (before.phase.kind === "clue" && after.phase.kind === "clue" && before.phase.clueId !== after.phase.clueId) ||
    (before.phase.kind === "quickfire" && after.phase.kind === "quickfire" && before.phase.index !== after.phase.index);
  lr.room.state = after;
  const reshown = action.type === "clue:question" && !action.hidden && after.buzzMode === "instant";
  const forcedDone =
    before.phase.kind === "clue" && after.phase.kind === "clue" && !!forcedTeam(before.phase) && !forcedTeam(after.phase);
  if (clueChanged || reshown || forcedDone || action.type === "settings:buzz-mode") refreshBuzz(lr);
  if ((after.phase.kind === "clue" || after.phase.kind === "quickfire") && after.phase.resolvedBy) {
    lr.countdownToken++;
    lr.buzz = { ...lr.buzz, status: "idle", count: undefined };
  }
  scheduleSave(lr);
  return true;
}

function startCountdown(lr: LiveRoom) {
  const phase = lr.room.state.phase;
  if (lr.room.mode !== "live" || phase.kind !== "clue" || phase.resolvedBy || phase.dailyDouble) return;
  if (lr.buzz.status === "countdown") return;
  const token = ++lr.countdownToken;
  lr.armAt = Date.now() + 3000;
  for (const p of lr.players.values()) p.penaltyUntil = 0;
  lr.buzz = { status: "countdown", count: 3, buzzes: [] };
  broadcast(lr);
  const tick = (count: number) => {
    if (lr.countdownToken !== token) return;
    if (count > 0) {
      lr.buzz = { ...lr.buzz, count };
    } else {
      lr.armedAt = Date.now();
      lr.buzz = { status: "armed", buzzes: [] };
    }
    broadcast(lr);
  };
  setTimeout(() => tick(2), 1000);
  setTimeout(() => tick(1), 2000);
  setTimeout(() => tick(0), 3000);
}

type BuzzResult = { ok: boolean; reason?: "early" | "penalty" | "locked" | "closed" | "duplicate" | "noteam" };

function handleBuzz(lr: LiveRoom, player: LivePlayer): BuzzResult {
  const now = Date.now();
  const phase = lr.room.state.phase;
  const quickfire = phase.kind === "quickfire";
  if (quickfire) {
    if (phase.resolvedBy || phase.index >= (lr.board.quickfire?.questions.length ?? 0)) {
      return { ok: false, reason: "closed" };
    }
  } else if (phase.kind !== "clue" || phase.resolvedBy || phase.dailyDouble) {
    return { ok: false, reason: "closed" };
  }
  if (!player.teamId || !lr.room.state.teams.some((t) => t.id === player.teamId)) {
    return { ok: false, reason: "noteam" };
  }
  if (phase.kind === "clue" && isOut(phase, player.teamId)) return { ok: false, reason: "locked" };
  if (phase.kind === "clue" && forcedTeam(phase)) return { ok: false, reason: "closed" };
  const duelist = phase.kind === "clue" ? phase.effects?.duel?.find((d) => d.teamId === player.teamId) : undefined;
  if (duelist?.playerId && duelist.playerId !== player.id) return { ok: false, reason: "locked" };
  if (lr.buzz.status === "countdown") {
    player.penaltyUntil = lr.armAt + FALSE_START_PENALTY_MS;
    return { ok: false, reason: "early" };
  }
  if (lr.buzz.status !== "armed") return { ok: false, reason: "closed" };
  if (now < player.penaltyUntil) return { ok: false, reason: "penalty" };
  if (lr.buzz.buzzes.some((b) => b.playerId === player.id)) return { ok: false, reason: "duplicate" };
  const credit = Math.min(player.latency, MAX_LATENCY_CREDIT_MS);
  const time = Math.max(0, now - lr.armedAt - credit);
  const buzzes = [...lr.buzz.buzzes, { playerId: player.id, name: player.name, teamId: player.teamId, time }];
  buzzes.sort((a, b) => a.time - b.time);
  lr.buzz = { ...lr.buzz, buzzes };
  if (phase.kind === "clue" && lr.room.state.buzzMode === "instant" && !phase.questionHidden && !phase.revealed) {
    lr.room.state = { ...lr.room.state, phase: { ...phase, questionHidden: true } };
    scheduleSave(lr);
  }
  return { ok: true };
}

/** Called by the REST API so live rooms stay in sync with edits made elsewhere. */
export function syncBoard(board: Board) {
  for (const lr of live.values()) {
    if (lr.board.id === board.id) {
      lr.board = board;
      broadcast(lr);
    }
  }
}

export function syncRoom(slug: string, patch: Partial<Pick<Room, "name" | "mode" | "state">>) {
  const lr = live.get(slug);
  if (!lr) return;
  const prevPhase = lr.room.state.phase;
  lr.room = { ...lr.room, ...patch };
  if (patch.mode || (patch.state && patch.state.phase !== prevPhase)) refreshBuzz(lr);
  broadcast(lr);
}

export function dropRoom(slug: string) {
  const lr = live.get(slug);
  if (!lr) return;
  io.to(`play:${slug}`).emit("room:closed");
  io.to(`host:${slug}`).emit("room:closed");
  live.delete(slug);
}

/** Frees rooms nobody has been connected to for a while. Scores and tiles are already in the database. */
function sweepIdleRooms() {
  const now = Date.now();
  for (const [slug, lr] of live) {
    const connected =
      (io.sockets.adapter.rooms.get(`play:${slug}`)?.size ?? 0) +
      (io.sockets.adapter.rooms.get(`host:${slug}`)?.size ?? 0);
    if (connected > 0) {
      lr.emptySince = undefined;
    } else if (lr.emptySince === undefined) {
      lr.emptySince = now;
    } else if (now - lr.emptySince >= IDLE_UNLOAD_MS) {
      if (lr.saveTimer) {
        clearTimeout(lr.saveTimer);
        updateRoom(slug, { state: lr.room.state });
      }
      lr.countdownToken++;
      live.delete(slug);
    }
  }
}

export function getLiveState(slug: string): GameState | null {
  return live.get(slug)?.room.state ?? null;
}

export function attachRooms(server: Server) {
  io = server;
  setInterval(sweepIdleRooms, SWEEP_INTERVAL_MS).unref();

  io.on("connection", (socket: Socket) => {
    let slug: string | null = null;
    let playerId: string | null = null;
    let isHostSocket = false;

    socket.on("ping:check", (_t: number, ack?: (now: number) => void) => {
      if (typeof ack === "function") ack(Date.now());
    });

    socket.on("host:join", (data: { slug: string }, ack?: (res: unknown) => void) => {
      const lr = load(String(data?.slug ?? ""));
      if (!lr) return ack?.({ error: "not_found" });
      if (!hasBoardAccess(socket.handshake.headers.cookie, lr.board.id, getPasswordHash(lr.board.id))) {
        return ack?.({ error: "unauthorized" });
      }
      slug = lr.room.slug;
      isHostSocket = true;
      socket.join(`host:${slug}`);
      ack?.({ snapshot: hostSnapshot(lr) });
    });

    socket.on("host:action", (action: GameAction) => {
      if (!isHostSocket || !slug) return;
      const lr = live.get(slug);
      if (lr && action && typeof action.type === "string" && applyAction(lr, action)) broadcast(lr);
    });

    socket.on("host:countdown", () => {
      if (!isHostSocket || !slug) return;
      const lr = live.get(slug);
      if (lr) startCountdown(lr);
    });

    socket.on("host:buzz-reset", () => {
      if (!isHostSocket || !slug) return;
      const lr = live.get(slug);
      if (!lr) return;
      refreshBuzz(lr);
      broadcast(lr);
    });

    socket.on("host:player-remove", (data: { playerId: string }) => {
      if (!isHostSocket || !slug) return;
      const lr = live.get(slug);
      const p = lr?.players.get(data?.playerId);
      if (!lr || !p) return;
      for (const sid of p.sockets) io.sockets.sockets.get(sid)?.emit("player:removed");
      lr.players.delete(p.id);
      broadcast(lr);
    });

    socket.on(
      "player:join",
      (data: { slug: string; playerId: string; name: string }, ack?: (res: unknown) => void) => {
        const lr = load(String(data?.slug ?? ""));
        if (!lr) return ack?.({ error: "not_found" });
        const id = String(data.playerId ?? "").slice(0, 64);
        const name = String(data.name ?? "").trim().slice(0, 24);
        if (!id || !name) return ack?.({ error: "invalid" });
        slug = lr.room.slug;
        playerId = id;
        socket.join(`play:${slug}`);
        const existing = lr.players.get(id);
        if (existing) {
          existing.name = name;
          existing.connected = true;
          existing.sockets.add(socket.id);
        } else {
          lr.players.set(id, {
            id,
            name,
            teamId: null,
            connected: true,
            sockets: new Set([socket.id]),
            latency: 0,
            penaltyUntil: 0,
            teamJoinedAt: 0,
          });
        }
        ack?.({ ok: true });
        broadcast(lr);
      },
    );

    const currentPlayer = () => {
      if (!slug || !playerId) return null;
      const lr = live.get(slug);
      const player = lr?.players.get(playerId);
      return lr && player ? { lr, player } : null;
    };

    socket.on("player:team", (data: { teamId: string | null }) => {
      const cur = currentPlayer();
      if (!cur) return;
      const teamId = data?.teamId ?? null;
      if (teamId && !cur.lr.room.state.teams.some((t) => t.id === teamId)) return;
      if (cur.player.teamId !== teamId) cur.player.teamJoinedAt = Date.now();
      cur.player.teamId = teamId;
      broadcast(cur.lr);
    });

    socket.on("player:latency", (data: { rtt: number }) => {
      const cur = currentPlayer();
      const rtt = Number(data?.rtt);
      if (!cur || !Number.isFinite(rtt) || rtt < 0) return;
      const oneWay = rtt / 2;
      cur.player.latency = cur.player.latency ? cur.player.latency * 0.6 + oneWay * 0.4 : oneWay;
    });

    socket.on("player:buzz", (_data: unknown, ack?: (res: BuzzResult) => void) => {
      const cur = currentPlayer();
      if (!cur) return ack?.({ ok: false, reason: "closed" });
      const result = handleBuzz(cur.lr, cur.player);
      if (typeof ack === "function") ack(result);
      if (result.ok) broadcast(cur.lr);
    });

    socket.on("player:wager", (data: { amount: number }, ack?: (res: unknown) => void) => {
      const cur = currentPlayer();
      const teamId = cur?.player.teamId;
      if (!cur || !teamId) return ack?.({ error: "noteam" });
      const { lr, player } = cur;
      const phase = lr.room.state.phase;
      const amount = Number(data?.amount);
      let changed = false;
      if (phase.kind === "clue" && phase.dailyDouble?.teamId === teamId && phase.dailyDouble.wager === undefined) {
        changed = applyAction(lr, { type: "dd:wager", amount });
      } else if (phase.kind === "final" && phase.step === "wager" && !phase.wagers[teamId]) {
        const team = lr.room.state.teams.find((t) => t.id === teamId);
        if (amount > finalMaxWager(team)) return ack?.({ error: "too_high" });
        changed = applyAction(lr, { type: "final:wager", teamId, amount, by: player.name });
      }
      ack?.(changed ? { ok: true } : { error: "not_accepted" });
      if (changed) broadcast(lr);
    });

    const currentLeader = () => {
      const cur = currentPlayer();
      const teamId = cur?.player.teamId;
      if (!cur || !teamId || leaderOf(cur.lr, teamId)?.id !== cur.player.id) return null;
      return { ...cur, teamId };
    };

    socket.on("player:draft", (data: { picks: unknown[] }, ack?: (res: unknown) => void) => {
      const cur = currentLeader();
      if (!cur) return ack?.({ error: "not_leader" });
      const picks = Array.isArray(data?.picks) ? data.picks.filter(isPowerType) : [];
      const changed = applyAction(cur.lr, { type: "power:draft", teamId: cur.teamId, picks });
      ack?.(changed ? { ok: true } : { error: "not_accepted" });
      if (changed) broadcast(cur.lr);
    });

    socket.on(
      "player:power",
      (
        data: { power: unknown; targetTeamId?: string; playerName?: string; targetPlayerName?: string },
        ack?: (res: unknown) => void,
      ) => {
      const cur = currentLeader();
      if (!cur) return ack?.({ error: "not_leader" });
      const power = data?.power;
      if (!isPowerType(power)) return ack?.({ error: "invalid" });
      const { lr, teamId } = cur;
      if (POWERS[power].timing === "answer" && answeringTeam(lr.room.state, lr.buzz, lr.room.mode) !== teamId) {
        return ack?.({ error: "not_your_turn" });
      }
      const targetTeamId = typeof data.targetTeamId === "string" ? data.targetTeamId : undefined;
      let duel: Extract<GameAction, { type: "power:use" }>["duel"];
      if (power === "duel") {
        const playerName = String(data.playerName ?? "").trim().slice(0, 24);
        const targetPlayerName = String(data.targetPlayerName ?? "").trim().slice(0, 24);
        if (!playerName || !targetPlayerName) return ack?.({ error: "invalid_players" });
        const playerId = findByName(lr, teamId, playerName);
        const targetPlayerId = targetTeamId ? findByName(lr, targetTeamId, targetPlayerName) : undefined;
        duel = {
          playerId,
          targetPlayerId,
          playerName: (playerId && lr.players.get(playerId)?.name) || playerName,
          targetPlayerName: (targetPlayerId && lr.players.get(targetPlayerId)?.name) || targetPlayerName,
        };
      }
      const changed = applyAction(lr, { type: "power:use", teamId, power, targetTeamId, duel });
      ack?.(changed ? { ok: true } : { error: "not_accepted" });
      if (changed) broadcast(lr);
      },
    );

    socket.on("player:final-answer", (data: { text: string }, ack?: (res: unknown) => void) => {
      const cur = currentPlayer();
      const teamId = cur?.player.teamId;
      if (!cur || !teamId) return ack?.({ error: "noteam" });
      const { lr, player } = cur;
      const phase = lr.room.state.phase;
      if (phase.kind !== "final" || phase.step !== "clue" || phase.answers[teamId]) {
        return ack?.({ error: "not_accepted" });
      }
      const text = String(data?.text ?? "").trim();
      if (!text) return ack?.({ error: "empty" });
      const changed = applyAction(lr, { type: "final:answer", teamId, text, by: player.name });
      ack?.(changed ? { ok: true } : { error: "not_accepted" });
      if (changed) broadcast(lr);
    });

    socket.on("disconnect", () => {
      const cur = currentPlayer();
      if (!cur) return;
      cur.player.sockets.delete(socket.id);
      if (cur.player.sockets.size === 0) {
        cur.player.connected = false;
        broadcast(cur.lr);
      }
    });
  });
}
