export const bettingLedgerStorageVersion = 1;
export const bettingLedgerStoragePrefix = 'golf-bet-ledger';
export const bettingActiveRoundStorageKey = `${bettingLedgerStoragePrefix}:active-round:v${bettingLedgerStorageVersion}`;
export const legacyShotAdvicePresetStorageKey = 'korean-caddie:preset-distances:v1';
export const knownLegacyShotAdviceStorageKeys = [legacyShotAdvicePresetStorageKey] as const;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type BettingScoringMode = 'points' | 'money';
export type BettingHandicapMode = 'final-total' | 'hole-allocation';
export type BettingGameKey = 'stroke' | 'skins' | 'vegas' | 'events' | 'missions';
export type BettingEventKey = 'near-pin' | 'longest-drive' | 'birdie' | 'ob-penalty';
export type BettingMissionOutcome = 'pending' | 'success' | 'fail';

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

export type BettingHoleMission = {
  readonly id: string;
  readonly playerId: string;
  readonly missionId: string;
  readonly title: string;
  readonly points: number;
  readonly outcome: BettingMissionOutcome;
};

export type BettingHoleResult = {
  readonly holeNumber: number;
  readonly scores: readonly BettingHoleScore[];
  readonly events: readonly BettingHoleEvent[];
  readonly missions: readonly BettingHoleMission[];
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
  readonly version: typeof bettingLedgerStorageVersion;
  readonly round: BettingRound;
};

const defaultGameFlags: BettingGameFlags = {
  stroke: true,
  skins: true,
  vegas: true,
  events: true,
  missions: true,
};

const defaultGameUnits: BettingGameUnits = {
  stroke: { points: 1, money: 1000 },
  skins: { points: 2, money: 1000 },
  vegas: { points: 1, money: 500 },
  events: { points: 3, money: 1000 },
  missions: { points: 5, money: 1000 },
};

const defaultPlayers: readonly BettingPlayer[] = [
  { id: 'player-1', name: '민준', handicap: 8 },
  { id: 'player-2', name: '서연', handicap: 14 },
  { id: 'player-3', name: '도윤', handicap: 10 },
  { id: 'player-4', name: '지우', handicap: 18 },
];

const bettingGameKeys: readonly BettingGameKey[] = ['stroke', 'skins', 'vegas', 'events', 'missions'];
const bettingEventKeys: readonly BettingEventKey[] = ['near-pin', 'longest-drive', 'birdie', 'ob-penalty'];
const missionOutcomes: readonly BettingMissionOutcome[] = ['pending', 'success', 'fail'];
const scoringModes: readonly BettingScoringMode[] = ['points', 'money'];
const handicapModes: readonly BettingHandicapMode[] = ['final-total', 'hole-allocation'];

export function createDefaultBettingRound(input: { readonly id?: string; readonly now?: string } = {}): BettingRound {
  const now = input.now ?? new Date(0).toISOString();

  return {
    id: input.id?.trim() || 'round-local-active',
    createdAt: now,
    updatedAt: now,
    players: defaultPlayers.map((player) => ({ ...player })),
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
    return parsed.version === bettingLedgerStorageVersion && isBettingRound(parsed.round) ? cloneBettingRound(parsed.round) : null;
  } catch {
    return null;
  }
}

export function loadBettingRound(storage: StorageLike | undefined): BettingRound | null {
  if (!storage) {
    return null;
  }

  try {
    return deserializeBettingRound(storage.getItem(bettingActiveRoundStorageKey));
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
    scores: hole.scores.map((score) => ({ ...score })),
    events: hole.events.map((event) => ({ ...event })),
    missions: hole.missions.map((mission) => ({ ...mission })),
  };
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
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name) && isIntegerInRange(value.handicap, -10, 54);
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
  return isRecord(value) && bettingGameKeys.every((game) => typeof value[game] === 'boolean');
}

function isBettingGameUnits(value: unknown): value is BettingGameUnits {
  return isRecord(value) && bettingGameKeys.every((game) => isBettingGameUnit(value[game]));
}

function isBettingGameUnit(value: unknown): value is BettingGameUnit {
  return isRecord(value) && isIntegerInRange(value.points, 0, 100) && isIntegerInRange(value.money, 0, 1_000_000);
}

function isBettingHoleResult(value: unknown, players: readonly BettingPlayer[]): value is BettingHoleResult {
  if (!isRecord(value) || !isIntegerInRange(value.holeNumber, 1, 18)) {
    return false;
  }

  return (
    Array.isArray(value.scores) &&
    value.scores.every((score) => isBettingHoleScore(score, players)) &&
    Array.isArray(value.events) &&
    value.events.every((event) => isBettingHoleEvent(event, players)) &&
    Array.isArray(value.missions) &&
    value.missions.every((mission) => isBettingHoleMission(mission, players))
  );
}

function isBettingHoleScore(value: unknown, players: readonly BettingPlayer[]): value is BettingHoleScore {
  return isRecord(value) && isPlayerId(value.playerId, players) && isIntegerInRange(value.strokes, 1, 20);
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

function isBettingHoleMission(value: unknown, players: readonly BettingPlayer[]): value is BettingHoleMission {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isPlayerId(value.playerId, players) &&
    isNonEmptyString(value.missionId) &&
    isNonEmptyString(value.title) &&
    isIntegerInRange(value.points, -100, 100) &&
    includesValue(missionOutcomes, value.outcome)
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
