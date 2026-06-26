import {
  bettingLedgerStorageVersion,
  deserializeBettingRound,
  saveBettingRound,
  type BettingEventKey,
  type BettingGameKey,
  type BettingGameUnits,
  type BettingHandicapMode,
  type BettingHoleEvent,
  type BettingHoleResult,
  type BettingPlayer,
  type BettingRound,
  type BettingRoundSettings,
  type BettingScoringMode,
  type StorageLike,
} from './bettingStorage';

export const bettingShareHashPrefix = 'fg=';
export const bettingShareHashTargetLength = 1_800;
export const bettingShareHashMaxLength = 2_200;

const bettingShareSnapshotVersion = 3;
const gameKeys = ['ojang'] as const satisfies readonly BettingGameKey[];
const eventKeys = ['near-pin'] as const satisfies readonly BettingEventKey[];
const scoringModes = ['points', 'money'] as const satisfies readonly BettingScoringMode[];
const handicapModes = ['final-total', 'hole-allocation'] as const satisfies readonly BettingHandicapMode[];

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
type CompactSettings = readonly [number, number, number];
type CompactGameUnit = readonly [number, number];
type CompactHoleScore = readonly [number, number];
type CompactHoleEvent = readonly [string, number, number, number];
type CompactHole = readonly [number, number, number, readonly CompactHoleScore[], readonly CompactHoleEvent[]];
type CompactLabels = readonly [string, string];
type CompactRound = readonly [
  string,
  string,
  string,
  readonly CompactPlayer[],
  CompactSettings,
  number,
  readonly CompactGameUnit[],
  readonly CompactHole[],
];
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
      [round.settings.holeCount, scoringModes.indexOf(round.settings.scoringMode), handicapModes.indexOf(round.settings.handicapMode)],
      enabledGameMask(round),
      gameKeys.map((game) => [round.gameUnits[game].points, round.gameUnits[game].money]),
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
  return [
    hole.holeNumber,
    hole.par,
    hole.backdoorOpen ? 1 : 0,
    hole.scores.flatMap((score) => {
      const index = playerIndex.get(score.playerId);
      return index === undefined ? [] : ([[index, score.strokes]] satisfies CompactHoleScore[]);
    }),
    hole.events.flatMap((event) => compactEvent(event, playerIndex)),
  ];
}

function compactEvent(event: BettingHoleEvent, playerIndex: ReadonlyMap<string, number>): readonly CompactHoleEvent[] {
  const index = playerIndex.get(event.playerId);
  const eventIndex = eventKeys.indexOf(event.event);
  return index === undefined || eventIndex < 0 ? [] : [[event.id, index, eventIndex, event.points]];
}

function enabledGameMask(round: BettingRound): number {
  return gameKeys.reduce((mask, game, index) => (round.enabledGames[game] ? mask | (1 << index) : mask), 0);
}

function expandCompactPayload(value: unknown): BettingShareSnapshot | null {
  if (!Array.isArray(value) || value.length !== 3 || value[0] !== bettingShareSnapshotVersion) {
    return null;
  }

  const round = expandCompactRound(value[1]);
  const parsedRound = round ? deserializeBettingRound(JSON.stringify({ version: bettingLedgerStorageVersion, round })) : null;
  const labels = expandLabels(value[2]);

  return parsedRound && labels ? { round: parsedRound, labels } : null;
}

function expandLabels(value: unknown): BettingShareLabels | null {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string') {
    return null;
  }

  return { roundName: sanitizeShareLabel(value[0]), courseName: sanitizeShareLabel(value[1]) };
}

function expandCompactRound(value: unknown): BettingRound | null {
  if (!Array.isArray(value) || value.length !== 8) {
    return null;
  }

  const [id, createdAt, updatedAt, rawPlayers, rawSettings, rawEnabledMask, rawGameUnits, rawHoles] = value;
  const players = expandPlayers(rawPlayers);
  const settings = expandSettings(rawSettings);
  const enabledGames = expandEnabledGames(rawEnabledMask);
  const gameUnits = expandGameUnits(rawGameUnits);
  const holes = expandHoles(rawHoles, players);

  if (
    typeof id !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string' ||
    !players ||
    !settings ||
    !enabledGames ||
    !gameUnits ||
    !holes
  ) {
    return null;
  }

  return { id, createdAt, updatedAt, players, settings, enabledGames, gameUnits, holes };
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

function expandSettings(value: unknown): BettingRoundSettings | null {
  if (!Array.isArray(value) || value.length !== 3 || !isInteger(value[0]) || !isInteger(value[1]) || !isInteger(value[2])) {
    return null;
  }

  const scoringMode = scoringModes[value[1]];
  const handicapMode = handicapModes[value[2]];

  return scoringMode && handicapMode ? { holeCount: value[0], scoringMode, handicapMode } : null;
}

function expandEnabledGames(value: unknown): Record<BettingGameKey, boolean> | null {
  if (!isInteger(value) || value < 0) {
    return null;
  }

  return { ojang: Boolean(value & 1) };
}

function expandGameUnits(value: unknown): BettingGameUnits | null {
  if (!Array.isArray(value) || value.length !== gameKeys.length) {
    return null;
  }

  const unit = value[0];
  return Array.isArray(unit) && unit.length === 2 && isInteger(unit[0]) && isInteger(unit[1])
    ? { ojang: { points: unit[0], money: unit[1] } }
    : null;
}

function expandHoles(value: unknown, players: readonly BettingPlayer[] | null): readonly BettingHoleResult[] | null {
  if (!players || !Array.isArray(value)) {
    return null;
  }

  const holes = value.map((hole): BettingHoleResult | null => {
    if (!Array.isArray(hole) || hole.length !== 5 || !isInteger(hole[0]) || !isInteger(hole[1]) || !isInteger(hole[2])) {
      return null;
    }

    const scores = expandScores(hole[3], players);
    const events = expandEvents(hole[4], players);

    return scores && events
      ? { holeNumber: hole[0], par: hole[1], backdoorOpen: Boolean(hole[2]), scores, events }
      : null;
  });

  return holes.every((hole): hole is BettingHoleResult => hole !== null) ? holes : null;
}

function expandScores(value: unknown, players: readonly BettingPlayer[]): readonly { readonly playerId: string; readonly strokes: number }[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const scores = value.map((score) => {
    if (!Array.isArray(score) || score.length !== 2 || !isInteger(score[0]) || !isInteger(score[1])) {
      return null;
    }

    const player = players[score[0]];
    return player ? { playerId: player.id, strokes: score[1] } : null;
  });

  return scores.every((score): score is { readonly playerId: string; readonly strokes: number } => score !== null) ? scores : null;
}

function expandEvents(value: unknown, players: readonly BettingPlayer[]): readonly BettingHoleEvent[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const events = value.map((event): BettingHoleEvent | null => {
    if (
      !Array.isArray(event) ||
      event.length !== 4 ||
      typeof event[0] !== 'string' ||
      !isInteger(event[1]) ||
      !isInteger(event[2]) ||
      !isInteger(event[3])
    ) {
      return null;
    }

    const player = players[event[1]];
    const eventKey = eventKeys[event[2]];
    return player && eventKey ? { id: event[0], playerId: player.id, event: eventKey, points: event[3] } : null;
  });

  return events.every((event): event is BettingHoleEvent => event !== null) ? events : null;
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
