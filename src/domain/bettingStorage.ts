export const bettingLedgerStorageVersion = 3;
export const bettingLedgerStoragePrefix = 'golf-bet-ledger';
export const bettingActiveRoundStorageKey = `${bettingLedgerStoragePrefix}:active-round:v${bettingLedgerStorageVersion}`;
export const legacyBettingActiveRoundStorageKeyV2 = `${bettingLedgerStoragePrefix}:active-round:v2`;
export const legacyBettingActiveRoundStorageKeyV1 = `${bettingLedgerStoragePrefix}:active-round:v1`;
export const legacyShotAdvicePresetStorageKey = 'korean-caddie:preset-distances:v1';
export const knownLegacyShotAdviceStorageKeys = [legacyShotAdvicePresetStorageKey] as const;
export const bettingPlayerCountOptions = [2, 3, 4] as const;
export const maximumHoleScoreStrokes = 30;
export const defaultOjangUnitAmount = 1_000;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type BettingGameKey = 'ojang';

export type BettingPlayer = {
  readonly id: string;
  readonly name: string;
  readonly handicap: number;
};

export type BettingRoundSettings = {
  readonly holeCount: number;
};

export type BettingHoleScore = {
  readonly playerId: string;
  readonly strokes: number;
};

export type BettingHoleResult = {
  readonly holeNumber: number;
  readonly par: number;
  readonly backdoorOpen: boolean;
  readonly nearPlayerId?: string | null;
  readonly scores: readonly BettingHoleScore[];
};

export type BettingRound = {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly players: readonly BettingPlayer[];
  readonly settings: BettingRoundSettings;
  readonly holes: readonly BettingHoleResult[];
};

type StoredBettingRoundPayload = {
  readonly version: 1 | 2 | typeof bettingLedgerStorageVersion;
  readonly round: unknown;
};

const defaultGameFlags: BettingGameFlags = { ojang: true };
const defaultGameUnits: BettingGameUnits = { ojang: { points: 1, money: 5000 } };

const defaultPlayers: readonly BettingPlayer[] = [
  { id: 'player-1', name: '', handicap: 0 },
  { id: 'player-2', name: '', handicap: 0 },
  { id: 'player-3', name: '', handicap: 0 },
  { id: 'player-4', name: '', handicap: 0 },
];

const bettingGameKeys: readonly BettingGameKey[] = ['ojang'];

export function createDefaultBettingPlayers(playerCount = 4): readonly BettingPlayer[] {
  const count = normalizePlayerCount(playerCount);
  return defaultPlayers.slice(0, count).map((player) => ({ ...player }));
}

export function createDefaultBettingRound(input: { readonly id?: string; readonly now?: string; readonly playerCount?: number } = {}): BettingRound {
  const now = input.now ?? new Date(0).toISOString();

  return {
    id: input.id?.trim() || 'round-local-active',
    createdAt: now,
    updatedAt: now,
    players: createDefaultBettingPlayers(input.playerCount ?? 4),
    settings: { holeCount: 18 },
    enabledGames: { ...defaultGameFlags },
    gameUnits: cloneGameUnits(defaultGameUnits),
    holes: [],
  };
}

export function serializeBettingRound(round: BettingRound): string {
  return JSON.stringify({ version: bettingLedgerStorageVersion, round: cloneBettingRound(round) });
}

export function deserializeBettingRound(raw: string | null): BettingRound | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredBettingRoundPayload>;
    return isSupportedStorageVersion(parsed.version) ? normalizeBettingRoundPayload(parsed.round) : null;
  } catch {
    return null;
  }
}

export function loadBettingRound(storage: StorageLike | undefined): BettingRound | null {
  if (!storage) {
    return null;
  }

  try {
    const activeRound = deserializeBettingRound(storage.getItem(bettingActiveRoundStorageKey));

    if (activeRound) {
      return activeRound;
    }

    for (const legacyKey of [legacyBettingActiveRoundStorageKeyV2, legacyBettingActiveRoundStorageKeyV1]) {
      const legacyRound = deserializeBettingRound(storage.getItem(legacyKey));
      if (legacyRound) {
        saveBettingRound(storage, legacyRound);
        return legacyRound;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function saveBettingRound(storage: StorageLike | undefined, round: BettingRound): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(bettingActiveRoundStorageKey, serializeBettingRound(round));
    return true;
  } catch {
    return false;
  }
}

export function clearBettingRound(storage: StorageLike | undefined): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(bettingActiveRoundStorageKey);
    storage.removeItem(legacyBettingActiveRoundStorageKeyV2);
    storage.removeItem(legacyBettingActiveRoundStorageKeyV1);
    return true;
  } catch {
    return false;
  }
}

export function purgeKnownLegacyShotAdviceStorage(storage: StorageLike | undefined): readonly string[] {
  if (!storage) {
    return [];
  }

  const purgedKeys: string[] = [];
  for (const key of knownLegacyShotAdviceStorageKeys) {
    try {
      storage.removeItem(key);
      purgedKeys.push(key);
    } catch {
      return purgedKeys;
    }
  }

  return purgedKeys;
}

export function cloneBettingRound(round: BettingRound): BettingRound {
  return {
    ...round,
    players: round.players.map((player) => ({ ...player })),
    settings: { ...round.settings },
    holes: round.holes.map(cloneHoleResult),
  };
}

function cloneGameUnits(units: BettingGameUnits): BettingGameUnits {
  return Object.fromEntries(bettingGameKeys.map((game) => [game, { ...units[game] }])) as BettingGameUnits;
}

function cloneHoleResult(hole: BettingHoleResult): BettingHoleResult {
  return {
    holeNumber: hole.holeNumber,
    par: normalizeHolePar(hole.par),
    backdoorOpen: hole.backdoorOpen === true,
    nearPlayerId: hole.nearPlayerId ?? null,
    scores: hole.scores.map((score) => ({ ...score })),
  };
}

function normalizePlayers(values: readonly unknown[]): readonly BettingPlayer[] | null {
  const players = values.map((value): BettingPlayer | null => {
    if (!isRecord(value) || !isNonEmptyString(value.id) || typeof value.name !== 'string' || !isIntegerInRange(value.handicap, -10, 54)) {
      return null;
    }

    return { id: value.id.trim(), name: value.name, handicap: value.handicap };
  });

  if (!isIntegerInRange(value.settings.holeCount, 1, 18)) {
    return null;
  }

  const holes = value.holes.map((hole) => readLegacyHole(hole, players));
  if (!holes.every((hole): hole is BettingHoleResult => hole !== null)) {
    return null;
  }

  const migrated: BettingRound = {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : 'round-local-active',
    createdAt: typeof value.createdAt === 'string' && isIsoString(value.createdAt) ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === 'string' && isIsoString(value.updatedAt) ? value.updatedAt : new Date(0).toISOString(),
    players,
    settings: { holeCount: value.settings.holeCount },
    enabledGames: { ...defaultGameFlags },
    gameUnits: { ...defaultGameUnits },
    holes,
  };

  return isBettingRound(migrated) ? cloneBettingRound(migrated) : null;
}

function normalizeHoles(values: readonly unknown[], players: readonly BettingPlayer[], holeCount: number): readonly BettingHoleResult[] | null {
  const playerIds = players.map((player) => player.id);
  const holes = values.map((value): BettingHoleResult | null => {
    if (!isRecord(value) || !isIntegerInRange(value.holeNumber, 1, 18)) {
      return null;
    }

    const holeNumber = clampInteger(value.holeNumber, 1, holeCount);
    const par = value.par === undefined ? 4 : isIntegerInRange(value.par, 3, 5) ? value.par : null;
    if (par === null) {
      return null;
    }

    const nearPlayerId = typeof value.nearPlayerId === 'string' && playerIds.includes(value.nearPlayerId) ? value.nearPlayerId : null;
    const scores = Array.isArray(value.scores) ? normalizeScores(value.scores, playerIds) : [];

    return scores ? { holeNumber, par, backdoorOpen: value.backdoorOpen === true, nearPlayerId, scores } : null;
  });

  return holes.every((hole): hole is BettingHoleResult => hole !== null)
    ? holes.sort((left, right) => left.holeNumber - right.holeNumber)
    : null;
}

function readLegacyHole(value: unknown, players: readonly BettingPlayer[]): BettingHoleResult | null {
  if (!isRecord(value) || !isIntegerInRange(value.holeNumber, 1, 18)) {
    return null;
  }

  const scores = Array.isArray(value.scores) ? value.scores.map((score) => readLegacyHoleScore(score, players)) : [];

  if (!scores.every((score): score is BettingHoleScore => score !== null)) {
    return null;
  }

  return {
    holeNumber: value.holeNumber,
    par: isIntegerInRange(value.par, 3, 5) ? value.par : 4,
    backdoorOpen: value.backdoorOpen === true,
    scores,
  };
}

function readLegacyHoleScore(value: unknown, players: readonly BettingPlayer[]): BettingHoleScore | null {
  if (!isRecord(value) || !isPlayerId(value.playerId, players) || !isIntegerInRange(value.strokes, 1, maximumHoleScoreStrokes)) {
    return null;
  }

  return { playerId: value.playerId, strokes: value.strokes };
}

function isBettingRound(value: unknown): value is BettingRound {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.entryMode === 'on-putt' &&
    isIntegerInRange(value.onGreenShots, 1, 6) &&
    isIntegerInRange(value.putts, 0, 5) &&
    value.onGreenShots + value.putts === value.strokes
  ) {
    return { playerId, strokes: value.strokes, entryMode: 'on-putt', onGreenShots: value.onGreenShots, putts: value.putts, holeInOne: false };
  }

  return { playerId, strokes: value.strokes, entryMode: 'manual' };
}

function normalizeUnitAmount(value: Record<string, unknown>): number {
  const settings = isRecord(value.settings) ? value.settings : undefined;
  if (isIntegerInRange(settings?.unitAmount, 1, 1_000_000)) {
    return settings.unitAmount;
  }

  const oldStrokeMoney = isRecord(value.gameUnits) && isRecord(value.gameUnits.stroke) ? value.gameUnits.stroke.money : undefined;
  return isIntegerInRange(oldStrokeMoney, 1, 1_000_000) ? oldStrokeMoney : defaultOjangUnitAmount;
}

function hasUniquePlayerIds(players: readonly BettingPlayer[]): boolean {
  return new Set(players.map((player) => player.id)).size === players.length;
}

function isBettingRoundSettings(value: unknown): value is BettingRoundSettings {
  return isRecord(value) && isIntegerInRange(value.holeCount, 1, 18);
}

function isBettingGameFlags(value: unknown): value is BettingGameFlags {
  return isRecord(value) && value.ojang === true;
}

function isBettingGameUnits(value: unknown): value is BettingGameUnits {
  return isRecord(value) && isBettingGameUnit(value.ojang);
}

function isBettingGameUnit(value: unknown): value is BettingGameUnit {
  return isRecord(value) && isIntegerInRange(value.points, 0, 100) && isIntegerInRange(value.money, 0, 1_000_000);
}

function isBettingHoleResult(value: unknown, players: readonly BettingPlayer[]): value is BettingHoleResult {
  if (!isRecord(value) || !isIntegerInRange(value.holeNumber, 1, 18)) {
    return false;
  }

  return (
    (value.par === undefined || isIntegerInRange(value.par, 3, 5)) &&
    (value.backdoorOpen === undefined || typeof value.backdoorOpen === 'boolean') &&
    Array.isArray(value.scores) &&
    value.scores.every((score) => isBettingHoleScore(score, players))
  );
}

function isBettingHoleScore(value: unknown, players: readonly BettingPlayer[]): value is BettingHoleScore {
  return isRecord(value) && isPlayerId(value.playerId, players) && isIntegerInRange(value.strokes, 1, maximumHoleScoreStrokes);
}

function isPlayerId(value: unknown, players: readonly BettingPlayer[]): value is string {
  return typeof value === 'string' && players.some((player) => player.id === value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isIsoString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePlayerCount(playerCount: number): 2 | 3 | 4 {
  const rounded = Number.isFinite(playerCount) ? Math.round(playerCount) : 4;
  return Math.min(4, Math.max(2, rounded)) as 2 | 3 | 4;
}

function normalizeHoleCount(value: unknown): number {
  return typeof value === 'number' ? clampInteger(value, 1, 18) : 18;
}

function normalizeHolePar(value: number): number {
  return clampInteger(value, 3, 5);
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}
