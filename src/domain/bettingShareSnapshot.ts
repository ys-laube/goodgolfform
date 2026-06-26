import {
  bettingLedgerStorageVersion,
  deserializeBettingRound,
  saveBettingRound,
  type BettingEventKey,
  type BettingGameKey,
  type BettingGameUnits,
  type BettingHandicapMode,
  type BettingHoleEvent,
  type BettingHoleMission,
  type BettingHoleResult,
  type BettingMissionOutcome,
  type BettingPlayer,
  type BettingRound,
  type BettingRoundSettings,
  type BettingScoringMode,
  type StorageLike,
} from './bettingStorage';

export const bettingShareHashPrefix = 'fg=';
export const bettingShareHashTargetLength = 1_800;
export const bettingShareHashMaxLength = 2_200;

const bettingShareSnapshotVersion = 1;
const gameKeys = ['stroke', 'skins', 'vegas', 'events', 'missions'] as const satisfies readonly BettingGameKey[];
const eventKeys = ['near-pin', 'longest-drive', 'birdie', 'ob-penalty'] as const satisfies readonly BettingEventKey[];
const scoringModes = ['points', 'money'] as const satisfies readonly BettingScoringMode[];
const handicapModes = ['final-total', 'hole-allocation'] as const satisfies readonly BettingHandicapMode[];
const missionOutcomes = ['pending', 'success', 'fail'] as const satisfies readonly BettingMissionOutcome[];

type ShareHashFailureReason = 'encoding-unavailable' | 'payload-too-large';

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
  | { readonly restored: true; readonly round: BettingRound; readonly payloadLength: number; readonly saved: boolean }
  | { readonly restored: false; readonly reason: 'empty' | 'unsupported' | 'payload-too-large' | 'invalid' | 'storage-unavailable'; readonly payloadLength: number };

type CompactPlayer = readonly [string, string, number];
type CompactSettings = readonly [number, number, number];
type CompactGameUnit = readonly [number, number];
type CompactHoleScore = readonly [number, number];
type CompactHoleEvent = readonly [string, number, number, number];
type CompactHoleMission = readonly [string, number, string, string, number, number];
type CompactHole = readonly [number, readonly CompactHoleScore[], readonly CompactHoleEvent[], readonly CompactHoleMission[]];
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
type CompactPayload = readonly [typeof bettingShareSnapshotVersion, CompactRound];

export function createBettingRoundShareHash(round: BettingRound): BettingShareHashResult {
  const encodedPayload = encodeBase64Url(JSON.stringify(compactPayload(round)));

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

  const round = parseBettingRoundShareHash(rawHash);

  if (!round) {
    return { restored: false, reason: 'invalid', payloadLength };
  }

  if (!storage) {
    return { restored: false, reason: 'storage-unavailable', payloadLength };
  }

  return { restored: true, round, payloadLength, saved: saveBettingRound(storage, round) };
}

function compactPayload(round: BettingRound): CompactPayload {
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
  ];
}

function compactPlayer(player: BettingPlayer): CompactPlayer {
  return [player.id, player.name, player.handicap];
}

function compactHole(hole: BettingHoleResult, playerIndex: ReadonlyMap<string, number>): CompactHole {
  return [
    hole.holeNumber,
    hole.scores.flatMap((score) => {
      const index = playerIndex.get(score.playerId);
      return index === undefined ? [] : ([[index, score.strokes]] satisfies CompactHoleScore[]);
    }),
    hole.events.flatMap((event) => compactEvent(event, playerIndex)),
    hole.missions.flatMap((mission) => compactMission(mission, playerIndex)),
  ];
}

function compactEvent(event: BettingHoleEvent, playerIndex: ReadonlyMap<string, number>): readonly CompactHoleEvent[] {
  const index = playerIndex.get(event.playerId);
  const eventIndex = eventKeys.indexOf(event.event);
  return index === undefined || eventIndex < 0 ? [] : [[event.id, index, eventIndex, event.points]];
}

function compactMission(mission: BettingHoleMission, playerIndex: ReadonlyMap<string, number>): readonly CompactHoleMission[] {
  const index = playerIndex.get(mission.playerId);
  const outcomeIndex = missionOutcomes.indexOf(mission.outcome);
  return index === undefined || outcomeIndex < 0
    ? []
    : [[mission.id, index, mission.missionId, mission.title, mission.points, outcomeIndex]];
}

function enabledGameMask(round: BettingRound): number {
  return gameKeys.reduce((mask, game, index) => (round.enabledGames[game] ? mask | (1 << index) : mask), 0);
}

function expandCompactPayload(value: unknown): BettingRound | null {
  if (!Array.isArray(value) || value.length !== 2 || value[0] !== bettingShareSnapshotVersion) {
    return null;
  }

  const round = expandCompactRound(value[1]);
  return round ? deserializeBettingRound(JSON.stringify({ version: bettingLedgerStorageVersion, round })) : null;
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

  return Object.fromEntries(gameKeys.map((game, index) => [game, Boolean(value & (1 << index))])) as Record<BettingGameKey, boolean>;
}

function expandGameUnits(value: unknown): BettingGameUnits | null {
  if (!Array.isArray(value) || value.length !== gameKeys.length) {
    return null;
  }

  const entries = gameKeys.map((game, index) => {
    const unit = value[index];
    return Array.isArray(unit) && unit.length === 2 && isInteger(unit[0]) && isInteger(unit[1]) ? [game, { points: unit[0], money: unit[1] }] : null;
  });

  return entries.every((entry): entry is [BettingGameKey, { readonly points: number; readonly money: number }] => entry !== null)
    ? Object.fromEntries(entries) as BettingGameUnits
    : null;
}

function expandHoles(value: unknown, players: readonly BettingPlayer[] | null): readonly BettingHoleResult[] | null {
  if (!players || !Array.isArray(value)) {
    return null;
  }

  const holes = value.map((hole): BettingHoleResult | null => {
    if (!Array.isArray(hole) || hole.length !== 4 || !isInteger(hole[0])) {
      return null;
    }

    const scores = expandScores(hole[1], players);
    const events = expandEvents(hole[2], players);
    const missions = expandMissions(hole[3], players);

    return scores && events && missions ? { holeNumber: hole[0], scores, events, missions } : null;
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

function expandMissions(value: unknown, players: readonly BettingPlayer[]): readonly BettingHoleMission[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const missions = value.map((mission): BettingHoleMission | null => {
    if (
      !Array.isArray(mission) ||
      mission.length !== 6 ||
      typeof mission[0] !== 'string' ||
      !isInteger(mission[1]) ||
      typeof mission[2] !== 'string' ||
      typeof mission[3] !== 'string' ||
      !isInteger(mission[4]) ||
      !isInteger(mission[5])
    ) {
      return null;
    }

    const player = players[mission[1]];
    const outcome = missionOutcomes[mission[5]];
    return player && outcome
      ? { id: mission[0], playerId: player.id, missionId: mission[2], title: mission[3], points: mission[4], outcome }
      : null;
  });

  return missions.every((mission): mission is BettingHoleMission => mission !== null) ? missions : null;
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
