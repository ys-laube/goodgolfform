import {
  bettingLedgerStorageVersion,
  deserializeBettingRound,
  saveBettingRound,
  type BettingHoleResult,
  type BettingHoleScore,
  type BettingPlayer,
  type BettingRound,
  type StorageLike,
} from './bettingStorage';

export const bettingShareHashPrefix = 'fg=';
export const bettingShareHashTargetLength = 1_800;
export const bettingShareHashMaxLength = 2_200;

const bettingShareSnapshotVersion = 3;
const scoreEntryModes = ['manual', 'on-putt', 'hio'] as const;

type ShareHashFailureReason = 'encoding-unavailable' | 'payload-too-large';

export type BettingShareLabels = {
  readonly roundName: string;
  readonly courseName: string;
};

export type BettingShareSnapshot = {
  readonly round: BettingRound;
  readonly labels: BettingShareLabels;
};

export type BettingShareHashResult =
  | {
      readonly ok: true;
      readonly hash: string;
      readonly payloadLength: number;
      readonly withinTarget: boolean;
      readonly targetLength: typeof bettingShareHashTargetLength;
      readonly maxLength: typeof bettingShareHashMaxLength;
    }
  | {
      readonly ok: false;
      readonly reason: ShareHashFailureReason;
      readonly payloadLength: number;
      readonly targetLength: typeof bettingShareHashTargetLength;
      readonly maxLength: typeof bettingShareHashMaxLength;
    };

export type BettingShareRestoreResult =
  | { readonly restored: true; readonly round: BettingRound; readonly labels: BettingShareLabels; readonly payloadLength: number; readonly saved: boolean }
  | { readonly restored: false; readonly reason: 'empty' | 'unsupported' | 'payload-too-large' | 'invalid' | 'storage-unavailable'; readonly payloadLength: number };

type CompactPlayer = readonly [string, string, number];
type CompactSettings = readonly [number, number];
type CompactScore = readonly [number, number, number, number, number, number];
type CompactHole = readonly [number, number, number, number, readonly CompactScore[]];
type CompactLabels = readonly [string, string];
type CompactRound = readonly [string, string, string, readonly CompactPlayer[], CompactSettings, readonly CompactHole[]];
type CompactPayload = readonly [typeof bettingShareSnapshotVersion, CompactRound, CompactLabels];

const emptyShareLabels: BettingShareLabels = { roundName: '', courseName: '' };

export function createBettingRoundShareHash(round: BettingRound, labels: Partial<BettingShareLabels> = emptyShareLabels): BettingShareHashResult {
  const encodedPayload = encodeBase64Url(JSON.stringify(compactPayload(round, labels)));

  if (!encodedPayload) {
    return {
      ok: false,
      reason: 'encoding-unavailable',
      payloadLength: 0,
      targetLength: bettingShareHashTargetLength,
      maxLength: bettingShareHashMaxLength,
    };
  }

  const hash = `#${bettingShareHashPrefix}${encodedPayload}`;

  if (hash.length > bettingShareHashMaxLength) {
    return {
      ok: false,
      reason: 'payload-too-large',
      payloadLength: hash.length,
      targetLength: bettingShareHashTargetLength,
      maxLength: bettingShareHashMaxLength,
    };
  }

  return {
    ok: true,
    hash,
    payloadLength: hash.length,
    withinTarget: hash.length <= bettingShareHashTargetLength,
    targetLength: bettingShareHashTargetLength,
    maxLength: bettingShareHashMaxLength,
  };
}

export function parseBettingRoundShareHash(rawHash: string): BettingRound | null {
  return parseBettingRoundShareHashPayload(rawHash)?.round ?? null;
}

export function parseBettingRoundShareHashPayload(rawHash: string): BettingShareSnapshot | null {
  const encodedPayload = extractEncodedPayload(rawHash);

  if (!encodedPayload || encodedPayload.length + bettingShareHashPrefix.length + 1 > bettingShareHashMaxLength) {
    return null;
  }

  const decodedPayload = decodeBase64Url(encodedPayload);

  if (!decodedPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodedPayload) as unknown;
    return expandCompactPayload(parsed);
  } catch {
    return null;
  }
}

export function restoreBettingRoundShareHashToStorage(rawHash: string, storage: StorageLike | undefined): BettingShareRestoreResult {
  const payloadLength = rawHash.length;

  if (!rawHash.trim()) {
    return { restored: false, reason: 'empty', payloadLength };
  }

  if (!extractEncodedPayload(rawHash)) {
    return { restored: false, reason: 'unsupported', payloadLength };
  }

  if (payloadLength > bettingShareHashMaxLength) {
    return { restored: false, reason: 'payload-too-large', payloadLength };
  }

  const snapshot = parseBettingRoundShareHashPayload(rawHash);

  if (!snapshot) {
    return { restored: false, reason: 'invalid', payloadLength };
  }

  if (!storage) {
    return { restored: false, reason: 'storage-unavailable', payloadLength };
  }

  const saved = saveBettingRound(storage, snapshot.round);
  return saved
    ? { restored: true, round: snapshot.round, labels: snapshot.labels, payloadLength, saved }
    : { restored: false, reason: 'storage-unavailable', payloadLength };
}

function compactPayload(round: BettingRound, labels: Partial<BettingShareLabels>): CompactPayload {
  const playerIndex = new Map(round.players.map((player, index) => [player.id, index]));

  return [
    bettingShareSnapshotVersion,
    [
      round.id,
      round.createdAt,
      round.updatedAt,
      round.players.map(compactPlayer),
      [round.settings.holeCount, round.settings.unitAmount],
      round.holes.map((hole) => compactHole(hole, playerIndex)),
    ],
    compactLabels(labels),
  ];
}

function compactLabels(labels: Partial<BettingShareLabels>): CompactLabels {
  return [sanitizeShareLabel(labels.roundName), sanitizeShareLabel(labels.courseName)];
}

function sanitizeShareLabel(value: string | undefined): string {
  return (value ?? '').trim().slice(0, 80);
}

function compactPlayer(player: BettingPlayer): CompactPlayer {
  return [player.id, player.name, player.handicap];
}

function compactHole(hole: BettingHoleResult, playerIndex: ReadonlyMap<string, number>): CompactHole {
  const nearIndex = hole.nearPlayerId ? playerIndex.get(hole.nearPlayerId) : undefined;
  return [
    hole.holeNumber,
    hole.par,
    hole.backdoorOpen ? 1 : 0,
    nearIndex ?? -1,
    hole.scores.flatMap((score) => compactScore(score, playerIndex)),
  ];
}

function compactScore(score: BettingHoleScore, playerIndex: ReadonlyMap<string, number>): readonly CompactScore[] {
  const index = playerIndex.get(score.playerId);
  if (index === undefined) {
    return [];
  }
  const modeIndex = scoreEntryModes.indexOf(score.entryMode ?? 'manual');
  return [[
    index,
    score.strokes,
    Math.max(0, modeIndex),
    score.onGreenShots ?? 0,
    score.putts ?? 0,
    score.holeInOne ? 1 : 0,
  ]];
}

function expandCompactPayload(value: unknown): BettingShareSnapshot | null {
  if (!Array.isArray(value) || (value[0] !== 1 && value[0] !== 2 && value[0] !== bettingShareSnapshotVersion)) {
    return null;
  }

  if (value[0] === bettingShareSnapshotVersion) {
    if (value.length !== 3) {
      return null;
    }
    const round = expandCompactRound(value[1]);
    const parsedRound = round ? deserializeBettingRound(JSON.stringify({ version: bettingLedgerStorageVersion, round })) : null;
    const labels = expandLabels(value[2]);
    return parsedRound && labels ? { round: parsedRound, labels } : null;
  }

  return expandLegacyCompactPayload(value);
}

function expandCompactRound(value: unknown): BettingRound | null {
  if (!Array.isArray(value) || value.length !== 6) {
    return null;
  }

  const [id, createdAt, updatedAt, rawPlayers, rawSettings, rawHoles] = value;
  const players = expandPlayers(rawPlayers);
  const settings = expandSettings(rawSettings);
  const holes = expandHoles(rawHoles, players);

  if (typeof id !== 'string' || typeof createdAt !== 'string' || typeof updatedAt !== 'string' || !players || !settings || !holes) {
    return null;
  }

  return { id, createdAt, updatedAt, players, settings, holes };
}

function expandLegacyCompactPayload(value: readonly unknown[]): BettingShareSnapshot | null {
  if ((value[0] === 1 && value.length !== 2) || (value[0] === 2 && value.length !== 3)) {
    return null;
  }

  const rawRound = expandLegacyCompactRound(value[1]);
  const parsedRound = rawRound ? deserializeBettingRound(JSON.stringify({ version: 2, round: rawRound })) : null;
  const labels = value[0] === 2 ? expandLabels(value[2]) : emptyShareLabels;
  return parsedRound && labels ? { round: parsedRound, labels } : null;
}

function expandLegacyCompactRound(value: unknown): unknown | null {
  if (!Array.isArray(value) || value.length !== 8) {
    return null;
  }

  const [id, createdAt, updatedAt, rawPlayers, rawSettings, , rawGameUnits, rawHoles] = value;
  const players = expandPlayers(rawPlayers);
  if (typeof id !== 'string' || typeof createdAt !== 'string' || typeof updatedAt !== 'string' || !players || !Array.isArray(rawSettings)) {
    return null;
  }

  const holeCount = isInteger(rawSettings[0]) ? rawSettings[0] : 18;
  const strokeUnit = Array.isArray(rawGameUnits) && Array.isArray(rawGameUnits[0]) && isInteger(rawGameUnits[0][1]) ? rawGameUnits[0][1] : undefined;
  const holes = expandLegacyHoles(rawHoles, players);
  if (!holes) {
    return null;
  }

  return {
    id,
    createdAt,
    updatedAt,
    players,
    settings: { holeCount, unitAmount: strokeUnit },
    holes,
  };
}

function expandLabels(value: unknown): BettingShareLabels | null {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string') {
    return null;
  }

  return { roundName: sanitizeShareLabel(value[0]), courseName: sanitizeShareLabel(value[1]) };
}

function expandPlayers(value: unknown): readonly BettingPlayer[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const players = value.map((player): BettingPlayer | null => {
    if (!Array.isArray(player) || player.length !== 3 || typeof player[0] !== 'string' || typeof player[1] !== 'string' || !isInteger(player[2])) {
      return null;
    }

    return { id: player[0], name: player[1], handicap: player[2] };
  });

  return players.every((player): player is BettingPlayer => player !== null) ? players : null;
}

function expandSettings(value: unknown): { readonly holeCount: number; readonly unitAmount: number } | null {
  if (!Array.isArray(value) || value.length !== 2 || !isInteger(value[0]) || !isInteger(value[1])) {
    return null;
  }

  return { holeCount: value[0], unitAmount: value[1] };
}

function expandHoles(value: unknown, players: readonly BettingPlayer[] | null): readonly BettingHoleResult[] | null {
  if (!players || !Array.isArray(value)) {
    return null;
  }

  const holes = value.map((hole): BettingHoleResult | null => {
    if (!Array.isArray(hole) || hole.length !== 5 || !isInteger(hole[0]) || !isInteger(hole[1]) || !isInteger(hole[2]) || !isInteger(hole[3])) {
      return null;
    }

    const nearPlayer = players[hole[3]];
    const scores = expandScores(hole[4], players);
    return scores ? { holeNumber: hole[0], par: hole[1], backdoorOpen: Boolean(hole[2]), nearPlayerId: nearPlayer?.id ?? null, scores } : null;
  });

  return holes.every((hole): hole is BettingHoleResult => hole !== null) ? holes : null;
}

function expandScores(value: unknown, players: readonly BettingPlayer[]): readonly BettingHoleScore[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const scores = value.map((score): BettingHoleScore | null => {
    if (!Array.isArray(score) || score.length !== 6 || !score.every(isInteger)) {
      return null;
    }

    const player = players[score[0]];
    const mode = scoreEntryModes[score[2]];
    if (!player || !mode) {
      return null;
    }

    if ((mode === 'hio' || score[5] === 1) && score[1] === 1) {
      return { playerId: player.id, strokes: score[1], entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true };
    }

    if (mode === 'on-putt' && score[3] + score[4] === score[1]) {
      return { playerId: player.id, strokes: score[1], entryMode: 'on-putt', onGreenShots: score[3], putts: score[4], holeInOne: false };
    }

    return { playerId: player.id, strokes: score[1], entryMode: 'manual' };
  });

  return scores.every((score): score is BettingHoleScore => score !== null) ? scores : null;
}

function expandLegacyHoles(value: unknown, players: readonly BettingPlayer[]): readonly unknown[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const holes = value.map((hole): unknown | null => {
    if (!Array.isArray(hole) || (hole.length !== 4 && hole.length !== 6) || !isInteger(hole[0])) {
      return null;
    }

    const legacyCompactHole = hole.length === 4;
    const par = legacyCompactHole ? 4 : hole[1];
    const backdoorOpenFlag = legacyCompactHole ? 0 : hole[2];
    const rawScores = legacyCompactHole ? hole[1] : hole[3];
    const scores = expandLegacyScores(rawScores, players);

    return scores && isInteger(par) && isInteger(backdoorOpenFlag)
      ? { holeNumber: hole[0], par, backdoorOpen: Boolean(backdoorOpenFlag), scores }
      : null;
  });

  return holes.every((hole) => hole !== null) ? holes : null;
}

function expandLegacyScores(value: unknown, players: readonly BettingPlayer[]): readonly BettingHoleScore[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const scores = value.map((score): BettingHoleScore | null => {
    if (!Array.isArray(score) || score.length !== 2 || !isInteger(score[0]) || !isInteger(score[1])) {
      return null;
    }

    const player = players[score[0]];
    return player ? { playerId: player.id, strokes: score[1], entryMode: 'manual' } : null;
  });

  return scores.every((score): score is BettingHoleScore => score !== null) ? scores : null;
}

function extractEncodedPayload(rawHash: string): string | null {
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  return hash.startsWith(bettingShareHashPrefix) ? hash.slice(bettingShareHashPrefix.length) : null;
}

function encodeBase64Url(value: string): string | null {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const binary = bytes.reduce((result, byte) => `${result}${String.fromCharCode(byte)}`, '');

  try {
    return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return null;
  }

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  try {
    const binary = globalThis.atob(paddedBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}
