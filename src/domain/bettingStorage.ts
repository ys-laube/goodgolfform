export const bettingLedgerStorageVersion = 3;
export const bettingLedgerStoragePrefix = 'golf-bet-ledger';
export const bettingActiveRoundStorageKey = `${bettingLedgerStoragePrefix}:active-round:v${bettingLedgerStorageVersion}`;
export const legacyBettingActiveRoundStorageKeyV2 = `${bettingLedgerStoragePrefix}:active-round:v2`;
export const legacyBettingActiveRoundStorageKeyV1 = `${bettingLedgerStoragePrefix}:active-round:v1`;
export const legacyShotAdvicePresetStorageKey = 'korean-caddie:preset-distances:v1';
export const knownLegacyShotAdviceStorageKeys = [legacyShotAdvicePresetStorageKey] as const;
export const bettingPlayerCountOptions = [2, 3, 4] as const;
export const maximumHoleScoreStrokes = 30;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type BettingScoringMode = 'points' | 'money';
export type BettingHandicapMode = 'final-total' | 'hole-allocation';
export type BettingGameKey = 'ojang';
export type BettingEventKey = 'near-pin';

export type BettingPlayer = {
  readonly id: string;
  readonly name: string;
  readonly handicap: number;
};

export type BettingRoundSettings = {
  readonly holeCount: number;
  readonly scoringMode: BettingScoringMode;
  readonly handicapMode: BettingHandicapMode;
};

export type BettingGameFlags = Record<BettingGameKey, boolean>;

export type BettingGameUnit = {
  readonly points: number;
  readonly money: number;
};

export type BettingGameUnits = Record<BettingGameKey, BettingGameUnit>;

export type BettingHoleScore = {
  readonly playerId: string;
  readonly strokes: number;
};

export type BettingHoleEvent = {
  readonly id: string;
  readonly playerId: string;
  readonly event: BettingEventKey;
  readonly points: number;
};

export type BettingHoleResult = {
  readonly holeNumber: number;
  readonly par: number;
  readonly backdoorOpen: boolean;
  readonly scores: readonly BettingHoleScore[];
  readonly events: readonly BettingHoleEvent[];
};

export type BettingRound = {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly players: readonly BettingPlayer[];
  readonly settings: BettingRoundSettings;
  readonly enabledGames: BettingGameFlags;
  readonly gameUnits: BettingGameUnits;
  readonly holes: readonly BettingHoleResult[];
};

type StoredBettingRoundPayload = {
  readonly version: 1 | 2 | typeof bettingLedgerStorageVersion;
  readonly round: unknown;
};

const defaultGameFlags: BettingGameFlags = {
  ojang: true,
};

const defaultGameUnits: BettingGameUnits = {
  ojang: { points: 1, money: 5000 },
};

const defaultPlayers: readonly BettingPlayer[] = [
  { id: 'player-1', name: '', handicap: 0 },
  { id: 'player-2', name: '', handicap: 0 },
  { id: 'player-3', name: '', handicap: 0 },
  { id: 'player-4', name: '', handicap: 0 },
];

const bettingGameKeys: readonly BettingGameKey[] = ['ojang'];
const bettingEventKeys: readonly BettingEventKey[] = ['near-pin'];
const scoringModes: readonly BettingScoringMode[] = ['points', 'money'];
const handicapModes: readonly BettingHandicapMode[] = ['final-total', 'hole-allocation'];

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
    settings: { holeCount: 18, scoringMode: 'money', handicapMode: 'final-total' },
    enabledGames: { ...defaultGameFlags },
    gameUnits: cloneGameUnits(defaultGameUnits),
    holes: [],
  };
}

export function serializeBettingRound(round: BettingRound): string {
  return JSON.stringify({ version: bettingLedgerStorageVersion, round });
}

export function deserializeBettingRound(raw: string | null): BettingRound | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredBettingRoundPayload>;

    if (parsed.version === bettingLedgerStorageVersion && isBettingRound(parsed.round)) {
      return cloneBettingRound(parsed.round);
    }

    if ((parsed.version === 1 || parsed.version === 2) && parsed.round) {
      return migrateLegacyBettingRound(parsed.round);
    }

    return null;
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
    enabledGames: { ...round.enabledGames },
    gameUnits: cloneGameUnits(round.gameUnits),
    holes: round.holes.map(cloneHoleResult),
  };
}

function cloneGameUnits(units: BettingGameUnits): BettingGameUnits {
  return Object.fromEntries(
    bettingGameKeys.map((game) => [game, { ...units[game] }]),
  ) as BettingGameUnits;
}

function cloneHoleResult(hole: BettingHoleResult): BettingHoleResult {
  return {
    holeNumber: hole.holeNumber,
    par: normalizeHolePar(hole.par),
    backdoorOpen: hole.backdoorOpen === true,
    scores: hole.scores.map((score) => ({ ...score })),
    events: hole.events.map((event) => ({ ...event })),
  };
}

function migrateLegacyBettingRound(value: unknown): BettingRound | null {
  if (!isRecord(value) || !Array.isArray(value.players) || !Array.isArray(value.holes) || !isRecord(value.settings)) {
    return null;
  }

  const players = value.players.map(readLegacyPlayer);
  if (!players.every((player): player is BettingPlayer => player !== null) || players.length < 2 || players.length > 4 || !hasUniquePlayerIds(players)) {
    return null;
  }

  const settings = readLegacySettings(value.settings);
  if (!settings) {
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
    settings,
    enabledGames: { ...defaultGameFlags },
    gameUnits: { ...defaultGameUnits },
    holes,
  };

  return isBettingRound(migrated) ? cloneBettingRound(migrated) : null;
}

function readLegacyPlayer(value: unknown): BettingPlayer | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) || typeof value.name !== 'string' || !isIntegerInRange(value.handicap, -10, 54)) {
    return null;
  }

  return { id: value.id, name: value.name, handicap: value.handicap };
}

function readLegacySettings(value: Record<string, unknown>): BettingRoundSettings | null {
  if (!isIntegerInRange(value.holeCount, 1, 18) || !includesValue(scoringModes, value.scoringMode) || !includesValue(handicapModes, value.handicapMode)) {
    return null;
  }

  return { holeCount: value.holeCount, scoringMode: value.scoringMode, handicapMode: value.handicapMode };
}

function readLegacyHole(value: unknown, players: readonly BettingPlayer[]): BettingHoleResult | null {
  if (!isRecord(value) || !isIntegerInRange(value.holeNumber, 1, 18)) {
    return null;
  }

  const scores = Array.isArray(value.scores)
    ? value.scores.map((score) => readLegacyHoleScore(score, players))
    : [];
  const events = Array.isArray(value.events)
    ? value.events.map((event) => readLegacyHoleEvent(event, players)).filter((event): event is BettingHoleEvent => event !== null)
    : [];

  if (!scores.every((score): score is BettingHoleScore => score !== null)) {
    return null;
  }

  return {
    holeNumber: value.holeNumber,
    par: isIntegerInRange(value.par, 3, 5) ? value.par : 4,
    backdoorOpen: value.backdoorOpen === true,
    scores,
    events,
  };
}

function readLegacyHoleScore(value: unknown, players: readonly BettingPlayer[]): BettingHoleScore | null {
  if (!isRecord(value) || !isPlayerId(value.playerId, players) || !isIntegerInRange(value.strokes, 1, maximumHoleScoreStrokes)) {
    return null;
  }

  return { playerId: value.playerId, strokes: value.strokes };
}

function readLegacyHoleEvent(value: unknown, players: readonly BettingPlayer[]): BettingHoleEvent | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isPlayerId(value.playerId, players) || value.event !== 'near-pin' || !isIntegerInRange(value.points, -100, 100)) {
    return null;
  }

  return { id: value.id, playerId: value.playerId, event: 'near-pin', points: value.points };
}

function isBettingRound(value: unknown): value is BettingRound {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !Array.isArray(value.players) ||
    value.players.length < 2 ||
    value.players.length > 4 ||
    !value.players.every(isBettingPlayer) ||
    !hasUniquePlayerIds(value.players)
  ) {
    return false;
  }

  const players = value.players;

  return (
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    isIsoString(value.createdAt) &&
    isIsoString(value.updatedAt) &&
    isBettingRoundSettings(value.settings) &&
    isBettingGameFlags(value.enabledGames) &&
    isBettingGameUnits(value.gameUnits) &&
    Array.isArray(value.holes) &&
    value.holes.every((hole) => isBettingHoleResult(hole, players))
  );
}

function isBettingPlayer(value: unknown): value is BettingPlayer {
  return isRecord(value) && isNonEmptyString(value.id) && typeof value.name === 'string' && isIntegerInRange(value.handicap, -10, 54);
}

function hasUniquePlayerIds(players: readonly BettingPlayer[]): boolean {
  return new Set(players.map((player) => player.id)).size === players.length;
}

function isBettingRoundSettings(value: unknown): value is BettingRoundSettings {
  return (
    isRecord(value) &&
    isIntegerInRange(value.holeCount, 1, 18) &&
    includesValue(scoringModes, value.scoringMode) &&
    includesValue(handicapModes, value.handicapMode)
  );
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
    value.scores.every((score) => isBettingHoleScore(score, players)) &&
    Array.isArray(value.events) &&
    value.events.every((event) => isBettingHoleEvent(event, players))
  );
}

function isBettingHoleScore(value: unknown, players: readonly BettingPlayer[]): value is BettingHoleScore {
  return isRecord(value) && isPlayerId(value.playerId, players) && isIntegerInRange(value.strokes, 1, maximumHoleScoreStrokes);
}

function isBettingHoleEvent(value: unknown, players: readonly BettingPlayer[]): value is BettingHoleEvent {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isPlayerId(value.playerId, players) &&
    includesValue(bettingEventKeys, value.event) &&
    isIntegerInRange(value.points, -100, 100)
  );
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

function includesValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function normalizePlayerCount(playerCount: number): 2 | 3 | 4 {
  const rounded = Number.isFinite(playerCount) ? Math.round(playerCount) : 4;
  return Math.min(4, Math.max(2, rounded)) as 2 | 3 | 4;
}

function normalizeHolePar(value: number): number {
  const rounded = Number.isFinite(value) ? Math.round(value) : 4;
  return Math.min(5, Math.max(3, rounded));
}
