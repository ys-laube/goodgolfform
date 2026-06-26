export const bettingLedgerStorageVersion = 3;
export const bettingLedgerStoragePrefix = 'golf-bet-ledger';
export const bettingActiveRoundStorageKey = `${bettingLedgerStoragePrefix}:active-round:v${bettingLedgerStorageVersion}`;
export const legacyBettingActiveRoundStorageKeyV2 = `${bettingLedgerStoragePrefix}:active-round:v2`;
export const legacyBettingActiveRoundStorageKeyV1 = `${bettingLedgerStoragePrefix}:active-round:v1`;
export const legacyShotAdvicePresetStorageKey = 'korean-caddie:preset-distances:v1';
export const knownLegacyShotAdviceStorageKeys = [legacyShotAdvicePresetStorageKey] as const;
export const bettingPlayerCountOptions = [2, 3, 4] as const;
export const maximumHoleScoreStrokes = 30;
export const defaultOjangUnitAmount = 5_000;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type BettingScoreEntryMode = 'on-putt' | 'hio' | 'manual';

export type BettingPlayer = {
  readonly id: string;
  readonly name: string;
  readonly handicap: number;
};

export type BettingRoundSettings = {
  readonly holeCount: number;
  readonly unitAmount: number;
};

export type BettingHoleScore = {
  readonly playerId: string;
  readonly strokes: number;
  readonly entryMode?: BettingScoreEntryMode;
  readonly onGreenShots?: number;
  readonly putts?: number;
  readonly holeInOne?: boolean;
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

const defaultPlayers: readonly BettingPlayer[] = [
  { id: 'player-1', name: '', handicap: 0 },
  { id: 'player-2', name: '', handicap: 0 },
  { id: 'player-3', name: '', handicap: 0 },
  { id: 'player-4', name: '', handicap: 0 },
];

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
    settings: { holeCount: 18, unitAmount: defaultOjangUnitAmount },
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

export function normalizeBettingRoundPayload(value: unknown): BettingRound | null {
  if (!isRecord(value) || !Array.isArray(value.players) || value.players.length < 2 || value.players.length > 4) {
    return null;
  }

  const players = normalizePlayers(value.players);
  if (!players || !hasUniquePlayerIds(players)) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : 'round-local-active';
  const createdAt = isIsoString(value.createdAt) ? value.createdAt : new Date(0).toISOString();
  const updatedAt = isIsoString(value.updatedAt) ? value.updatedAt : createdAt;
  const holeCount = normalizeHoleCount(isRecord(value.settings) ? value.settings.holeCount : undefined);
  const unitAmount = normalizeUnitAmount(value);
  const holes = normalizeHoles(Array.isArray(value.holes) ? value.holes : [], players, holeCount);

  return {
    id,
    createdAt,
    updatedAt,
    players,
    settings: { holeCount, unitAmount },
    holes,
  };
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

  return players.every((player): player is BettingPlayer => player !== null) ? players : null;
}

function normalizeHoles(values: readonly unknown[], players: readonly BettingPlayer[], holeCount: number): readonly BettingHoleResult[] {
  const playerIds = players.map((player) => player.id);
  return values
    .map((value): BettingHoleResult | null => {
      if (!isRecord(value) || !isIntegerInRange(value.holeNumber, 1, 18)) {
        return null;
      }

      const holeNumber = clampInteger(value.holeNumber, 1, holeCount);
      const par = normalizeHolePar(typeof value.par === 'number' ? value.par : 4);
      const nearPlayerId = typeof value.nearPlayerId === 'string' && playerIds.includes(value.nearPlayerId) ? value.nearPlayerId : null;
      const scores = Array.isArray(value.scores)
        ? value.scores.flatMap((score) => normalizeScore(score, playerIds))
        : [];

      return { holeNumber, par, backdoorOpen: value.backdoorOpen === true, nearPlayerId, scores };
    })
    .filter((hole): hole is BettingHoleResult => hole !== null)
    .sort((left, right) => left.holeNumber - right.holeNumber);
}

function normalizeScore(value: unknown, playerIds: readonly string[]): readonly BettingHoleScore[] {
  if (!isRecord(value) || !isPlayerId(value.playerId, playerIds) || !isIntegerInRange(value.strokes, 1, maximumHoleScoreStrokes)) {
    return [];
  }

  const playerId = value.playerId;
  if (value.holeInOne === true || value.entryMode === 'hio') {
    return [{ playerId, strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true }];
  }

  if (
    value.entryMode === 'on-putt' &&
    isIntegerInRange(value.onGreenShots, 1, 6) &&
    isIntegerInRange(value.putts, 0, 5) &&
    value.onGreenShots + value.putts === value.strokes
  ) {
    return [{ playerId, strokes: value.strokes, entryMode: 'on-putt', onGreenShots: value.onGreenShots, putts: value.putts, holeInOne: false }];
  }

  return [{ playerId, strokes: value.strokes, entryMode: 'manual' }];
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

function isPlayerId(value: unknown, playerIds: readonly string[]): value is string {
  return typeof value === 'string' && playerIds.includes(value);
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

function isSupportedStorageVersion(value: unknown): value is 1 | 2 | typeof bettingLedgerStorageVersion {
  return value === 1 || value === 2 || value === bettingLedgerStorageVersion;
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
