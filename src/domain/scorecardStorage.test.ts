import { describe, expect, it } from 'vitest';

import { createDefaultScorecardRound } from './scorecard';
import {
  clearScorecardRound,
  deserializeScorecardRound,
  loadScorecardRound,
  saveScorecardRound,
  scorecardActiveRoundStorageKey,
  serializeScorecardRound,
  type StorageLike,
} from './scorecardStorage';

class MemoryStorage implements StorageLike {
  readonly calls: string[] = [];
  private readonly values = new Map<string, string>();

  constructor(initialValues: Record<string, string> = {}) {
    Object.entries(initialValues).forEach(([key, value]) => this.values.set(key, value));
  }

  getItem(key: string): string | null {
    this.calls.push(`get:${key}`);
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.calls.push(`set:${key}`);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.calls.push(`remove:${key}`);
    this.values.delete(key);
  }

  peek(key: string): string | null {
    return this.values.get(key) ?? null;
  }
}

describe('scorecard local storage', () => {
  it('uses a scorecard-specific v1 active key', () => {
    expect(scorecardActiveRoundStorageKey).toBe('fungolf-scorecard:active-round:v1');
  });

  it('saves and loads only the scorecard payload', () => {
    const storage = new MemoryStorage();
    const round = createDefaultScorecardRound({ id: 'round-storage', now: '2026-06-27T00:00:00.000Z' });

    expect(saveScorecardRound(storage, round)).toBe(true);
    expect(storage.peek(scorecardActiveRoundStorageKey)).toContain('round-storage');
    expect(loadScorecardRound(storage)?.id).toBe('round-storage');
  });

  it('does not restore old betting ledger keys as scorecard data', () => {
    const oldRound = createDefaultScorecardRound({ id: 'old-ledger-like-round' });
    const storage = new MemoryStorage({
      'golf-bet-ledger:active-round:v3': serializeScorecardRound(oldRound),
      'golf-bet-ledger:active-round:v2': serializeScorecardRound(oldRound),
      'korean-caddie:preset-distances:v1': JSON.stringify({ presets: [{ name: '드라이버' }] }),
    });

    expect(loadScorecardRound(storage)).toBeNull();
    expect(storage.calls).toEqual([`get:${scorecardActiveRoundStorageKey}`]);
  });

  it('rejects invalid or mismatched versions', () => {
    expect(deserializeScorecardRound('{broken')).toBeNull();
    expect(deserializeScorecardRound(JSON.stringify({ version: 2, round: createDefaultScorecardRound() }))).toBeNull();
  });

  it('clears only the scorecard active key', () => {
    const storage = new MemoryStorage({ [scorecardActiveRoundStorageKey]: serializeScorecardRound(createDefaultScorecardRound()) });
    expect(clearScorecardRound(storage)).toBe(true);
    expect(storage.peek(scorecardActiveRoundStorageKey)).toBeNull();
  });
});
