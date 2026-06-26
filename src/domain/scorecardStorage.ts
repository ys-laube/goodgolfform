import { cloneScorecardRound, createDefaultScorecardRound, normalizeScorecardRoundPayload, type ScorecardRound } from './scorecard';

export const scorecardStorageVersion = 1;
export const scorecardActiveRoundStorageKey = `fungolf-scorecard:active-round:v${scorecardStorageVersion}`;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StoredScorecardRoundPayload = {
  readonly version: typeof scorecardStorageVersion;
  readonly round: unknown;
};

export function serializeScorecardRound(round: ScorecardRound): string {
  return JSON.stringify({ version: scorecardStorageVersion, round: cloneScorecardRound(round) });
}

export function deserializeScorecardRound(raw: string | null): ScorecardRound | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredScorecardRoundPayload>;
    return parsed.version === scorecardStorageVersion ? normalizeScorecardRoundPayload(parsed.round) : null;
  } catch {
    return null;
  }
}

export function loadScorecardRound(storage: StorageLike | undefined): ScorecardRound | null {
  if (!storage) {
    return null;
  }

  try {
    return deserializeScorecardRound(storage.getItem(scorecardActiveRoundStorageKey));
  } catch {
    return null;
  }
}

export function saveScorecardRound(storage: StorageLike | undefined, round: ScorecardRound): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(scorecardActiveRoundStorageKey, serializeScorecardRound(round));
    return true;
  } catch {
    return false;
  }
}

export function clearScorecardRound(storage: StorageLike | undefined): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(scorecardActiveRoundStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function createBlankStoredScorecardRound(now = new Date().toISOString()): ScorecardRound {
  return createDefaultScorecardRound({ now, playerCount: 1 });
}
