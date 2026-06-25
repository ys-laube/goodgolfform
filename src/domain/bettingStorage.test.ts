import { describe, expect, it } from 'vitest';

import {
  bettingActiveRoundStorageKey,
  bettingLedgerStoragePrefix,
  clearBettingRound,
  createDefaultBettingRound,
  deserializeBettingRound,
  knownLegacyCaddieStorageKeys,
  legacyCaddiePresetStorageKey,
  loadBettingRound,
  purgeKnownLegacyCaddieStorage,
  saveBettingRound,
  serializeBettingRound,
  type StorageLike,
} from './bettingStorage';

class MemoryStorage implements StorageLike {
  readonly calls: string[] = [];
  private readonly values = new Map<string, string>();

  constructor(initialValues: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialValues)) {
      this.values.set(key, value);
    }
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

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('blocked read');
  }

  setItem(): void {
    throw new Error('blocked write');
  }

  removeItem(): void {
    throw new Error('blocked remove');
  }
}

describe('betting ledger local storage boundary', () => {
  it('serializes, saves, and loads active rounds through the fresh golf-bet-ledger namespace', () => {
    const storage = new MemoryStorage();
    const round = createDefaultBettingRound({ id: 'round-storage-test', now: '2026-06-25T00:00:00.000Z' });

    expect(bettingActiveRoundStorageKey).toBe('golf-bet-ledger:active-round:v1');
    expect(bettingActiveRoundStorageKey.startsWith(`${bettingLedgerStoragePrefix}:`)).toBe(true);
    expect(saveBettingRound(storage, round)).toBe(true);
    expect(storage.peek(bettingActiveRoundStorageKey)).toContain('round-storage-test');
    expect(loadBettingRound(storage)).toEqual(round);
  });

  it('never reads or migrates old Korean caddie presets into betting round state', () => {
    const storage = new MemoryStorage({
      [legacyCaddiePresetStorageKey]: JSON.stringify({ version: 1, presets: [{ name: '저장된 캐디 거리표' }] }),
    });

    expect(loadBettingRound(storage)).toBeNull();
    expect(storage.calls).toEqual([`get:${bettingActiveRoundStorageKey}`]);
    expect(storage.peek(legacyCaddiePresetStorageKey)).toContain('저장된 캐디 거리표');
  });

  it('purges only known old caddie keys when the user requests a legacy cleanup', () => {
    const unrelatedKey = 'golf-bet-ledger:recent-rounds:v1';
    const storage = new MemoryStorage({
      [legacyCaddiePresetStorageKey]: 'legacy caddie preset',
      [unrelatedKey]: 'keep me',
    });

    expect(purgeKnownLegacyCaddieStorage(storage)).toEqual(knownLegacyCaddieStorageKeys);
    expect(storage.peek(legacyCaddiePresetStorageKey)).toBeNull();
    expect(storage.peek(unrelatedKey)).toBe('keep me');
  });

  it('falls back for corrupt betting state without consulting old caddie keys', () => {
    const storage = new MemoryStorage({
      [bettingActiveRoundStorageKey]: '{bad json',
      [legacyCaddiePresetStorageKey]: 'do not touch',
    });

    expect(loadBettingRound(storage)).toBeNull();
    expect(storage.calls).toEqual([`get:${bettingActiveRoundStorageKey}`]);
    expect(storage.peek(legacyCaddiePresetStorageKey)).toBe('do not touch');
  });

  it('rejects invalid saved payloads and unavailable storage safely', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const tooFewPlayers = { ...round, players: round.players.slice(0, 1) };
    const badHolePlayer = { ...round, holes: [{ holeNumber: 1, scores: [{ playerId: 'ghost', strokes: 4 }], events: [], missions: [] }] };

    expect(deserializeBettingRound(JSON.stringify({ version: 999, round }))).toBeNull();
    expect(deserializeBettingRound(JSON.stringify({ version: 1, round: tooFewPlayers }))).toBeNull();
    expect(deserializeBettingRound(JSON.stringify({ version: 1, round: badHolePlayer }))).toBeNull();

    const throwingStorage = new ThrowingStorage();
    expect(loadBettingRound(throwingStorage)).toBeNull();
    expect(saveBettingRound(throwingStorage, round)).toBe(false);
    expect(clearBettingRound(throwingStorage)).toBe(false);
    expect(purgeKnownLegacyCaddieStorage(throwingStorage)).toEqual([]);
  });

  it('returns cloned rounds so callers cannot mutate storage-owned data by reference', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const parsed = deserializeBettingRound(serializeBettingRound(round));

    expect(parsed).toEqual(round);
    expect(parsed).not.toBe(round);
    expect(parsed?.players).not.toBe(round.players);
    expect(parsed?.holes).not.toBe(round.holes);
  });
});
