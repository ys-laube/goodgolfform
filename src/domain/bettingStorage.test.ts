import { describe, expect, it } from 'vitest';

import {
  bettingActiveRoundStorageKey,
  bettingLedgerStoragePrefix,
  clearBettingRound,
  createDefaultBettingRound,
  deserializeBettingRound,
  knownLegacyShotAdviceStorageKeys,
  legacyBettingActiveRoundStorageKeyV1,
  legacyBettingActiveRoundStorageKeyV2,
  legacyShotAdvicePresetStorageKey,
  loadBettingRound,
  purgeKnownLegacyShotAdviceStorage,
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

describe('Ojang ledger local storage boundary', () => {
  it('serializes, saves, and loads active rounds through the fresh golf-bet-ledger namespace', () => {
    const storage = new MemoryStorage();
    const round = createDefaultBettingRound({ id: 'round-storage-test', now: '2026-06-25T00:00:00.000Z' });

    expect(bettingActiveRoundStorageKey).toBe('golf-bet-ledger:active-round:v3');
    expect(bettingActiveRoundStorageKey.startsWith(`${bettingLedgerStoragePrefix}:`)).toBe(true);
    expect(saveBettingRound(storage, round)).toBe(true);
    expect(storage.peek(bettingActiveRoundStorageKey)).toContain('round-storage-test');
    expect(loadBettingRound(storage)).toEqual(round);
  });

  it('creates default 2, 3, and 4 player Ojang rounds for setup flows', () => {
    expect(createDefaultBettingRound({ playerCount: 2 }).players).toHaveLength(2);
    expect(createDefaultBettingRound({ playerCount: 3 }).players).toHaveLength(3);
    expect(createDefaultBettingRound({ playerCount: 4 }).players).toHaveLength(4);
    expect(createDefaultBettingRound({ playerCount: 99 }).players).toHaveLength(4);
    expect(createDefaultBettingRound().players.map((player) => player.name)).toEqual(['', '', '', '']);
    expect(createDefaultBettingRound().players.map((player) => player.handicap)).toEqual([0, 0, 0, 0]);
    expect(createDefaultBettingRound().settings).toEqual({ holeCount: 18, unitAmount: 5000 });
  });

  it('round-trips intentionally blank player names for in-progress setup editing', () => {
    const round = createDefaultBettingRound({ id: 'round-blank-name', now: '2026-06-25T00:00:00.000Z' });
    const blankNameRound = {
      ...round,
      players: round.players.map((player, index) => (index === 0 ? { ...player, name: '' } : player)),
    };

    expect(deserializeBettingRound(serializeBettingRound(blankNameRound))).toEqual(blankNameRound);
  });

  it('persists per-hole par/backdoor/near metadata while defaulting older hole payloads', () => {
    const round = {
      ...createDefaultBettingRound({ id: 'round-hole-meta', now: '2026-06-25T00:00:00.000Z' }),
      holes: [
        {
          holeNumber: 1,
          par: 5,
          backdoorOpen: true,
          nearPlayerId: 'player-1',
          scores: [{ playerId: 'player-1', strokes: 9, entryMode: 'manual' as const }],
        },
      ],
    };
    const legacyRound = {
      ...round,
      holes: [{ holeNumber: 2, scores: [{ playerId: 'player-1', strokes: 4 }], events: [], missions: [] }],
    };

    expect(deserializeBettingRound(serializeBettingRound(round))).toEqual(round);
    expect(deserializeBettingRound(JSON.stringify({ version: 2, round: legacyRound }))?.holes[0]).toMatchObject({
      holeNumber: 2,
      par: 4,
      backdoorOpen: false,
      nearPlayerId: null,
      scores: [{ playerId: 'player-1', strokes: 4, entryMode: 'manual' }],
    });
  });

  it('preserves strokes as canonical truth when restored score metadata is inconsistent', () => {
    const round = {
      ...createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' }),
      holes: [{
        holeNumber: 1,
        par: 4,
        backdoorOpen: false,
        nearPlayerId: null,
        scores: [
          { playerId: 'player-1', strokes: 5, entryMode: 'hio' as const, onGreenShots: 1, putts: 0, holeInOne: true },
          { playerId: 'player-2', strokes: 4, entryMode: 'on-putt' as const, onGreenShots: 1, putts: 2, holeInOne: false },
        ],
      }],
    };

    expect(deserializeBettingRound(JSON.stringify({ version: 3, round }))?.holes[0]?.scores).toEqual([
      { playerId: 'player-1', strokes: 5, entryMode: 'manual' },
      { playerId: 'player-2', strokes: 4, entryMode: 'manual' },
    ]);
  });

  it('migrates previous betting round keys into the current explicit v3 Ojang shape', () => {
    const round = createDefaultBettingRound({ id: 'round-storage-v2', now: '2026-06-25T00:00:00.000Z' });
    const legacyPayload = {
      ...round,
      settings: { holeCount: 18 },
      gameUnits: {
        stroke: { points: 1, money: 2000 },
      },
    };
    const storage = new MemoryStorage({
      [legacyBettingActiveRoundStorageKeyV2]: JSON.stringify({ version: 2, round: legacyPayload }),
    });

    expect(loadBettingRound(storage)).toMatchObject({ id: 'round-storage-v2', settings: { holeCount: 18, unitAmount: 2000 } });
    expect(storage.calls).toEqual([
      `get:${bettingActiveRoundStorageKey}`,
      `get:${legacyBettingActiveRoundStorageKeyV2}`,
      `set:${bettingActiveRoundStorageKey}`,
    ]);
    expect(storage.peek(bettingActiveRoundStorageKey)).toContain('round-storage-v2');
  });

  it('never reads or migrates old Korean caddie presets into Ojang round state', () => {
    const storage = new MemoryStorage({
      [legacyShotAdvicePresetStorageKey]: JSON.stringify({ version: 1, presets: [{ name: '저장된 캐디 거리표' }] }),
    });

    expect(loadBettingRound(storage)).toBeNull();
    expect(storage.calls).toEqual([`get:${bettingActiveRoundStorageKey}`, `get:${legacyBettingActiveRoundStorageKeyV2}`, `get:${legacyBettingActiveRoundStorageKeyV1}`]);
    expect(storage.peek(legacyShotAdvicePresetStorageKey)).toContain('저장된 캐디 거리표');
  });

  it('purges only known old caddie keys when the user requests a legacy cleanup', () => {
    const unrelatedKey = 'golf-bet-ledger:recent-rounds:v1';
    const storage = new MemoryStorage({
      [legacyShotAdvicePresetStorageKey]: 'legacy caddie preset',
      [unrelatedKey]: 'keep me',
    });

    expect(purgeKnownLegacyShotAdviceStorage(storage)).toEqual(knownLegacyShotAdviceStorageKeys);
    expect(storage.peek(legacyShotAdvicePresetStorageKey)).toBeNull();
    expect(storage.peek(unrelatedKey)).toBe('keep me');
  });

  it('falls back for corrupt betting state without consulting old caddie keys', () => {
    const storage = new MemoryStorage({
      [bettingActiveRoundStorageKey]: '{bad json',
      [legacyShotAdvicePresetStorageKey]: 'do not touch',
    });

    expect(loadBettingRound(storage)).toBeNull();
    expect(storage.calls).toEqual([`get:${bettingActiveRoundStorageKey}`, `get:${legacyBettingActiveRoundStorageKeyV2}`, `get:${legacyBettingActiveRoundStorageKeyV1}`]);
    expect(storage.peek(legacyShotAdvicePresetStorageKey)).toBe('do not touch');
  });

  it('clears current and previous betting round keys without touching old caddie presets', () => {
    const storage = new MemoryStorage({
      [bettingActiveRoundStorageKey]: 'current betting state',
      [legacyBettingActiveRoundStorageKeyV2]: 'previous betting state',
      [legacyBettingActiveRoundStorageKeyV1]: 'old betting state',
      [legacyShotAdvicePresetStorageKey]: 'legacy caddie preset',
    });

    expect(clearBettingRound(storage)).toBe(true);
    expect(storage.calls).toEqual([`remove:${bettingActiveRoundStorageKey}`, `remove:${legacyBettingActiveRoundStorageKeyV2}`, `remove:${legacyBettingActiveRoundStorageKeyV1}`]);
    expect(storage.peek(bettingActiveRoundStorageKey)).toBeNull();
    expect(storage.peek(legacyBettingActiveRoundStorageKeyV2)).toBeNull();
    expect(storage.peek(legacyBettingActiveRoundStorageKeyV1)).toBeNull();
    expect(storage.peek(legacyShotAdvicePresetStorageKey)).toBe('legacy caddie preset');
  });

  it('rejects invalid saved payloads and unavailable storage safely', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const tooFewPlayers = { ...round, players: round.players.slice(0, 1) };
    const badHolePlayer = { ...round, holes: [{ holeNumber: 1, par: 4, backdoorOpen: false, nearPlayerId: null, scores: [{ playerId: 'ghost', strokes: 4 }] }] };
    const extendedBackdoorScore = { ...round, holes: [{ holeNumber: 1, par: 4, backdoorOpen: true, nearPlayerId: null, scores: [{ playerId: 'player-1', strokes: 30 }] }] };
    const tooHighBackdoorScore = { ...round, holes: [{ holeNumber: 1, par: 4, backdoorOpen: true, nearPlayerId: null, scores: [{ playerId: 'player-1', strokes: 31 }] }] };
    const badPar = { ...round, holes: [{ holeNumber: 1, par: 8, backdoorOpen: false, nearPlayerId: null, scores: [] }] };

    expect(deserializeBettingRound(JSON.stringify({ version: 999, round }))).toBeNull();
    expect(deserializeBettingRound(JSON.stringify({ version: 3, round: tooFewPlayers }))).toBeNull();
    expect(deserializeBettingRound(JSON.stringify({ version: 3, round: badHolePlayer }))).toBeNull();
    expect(deserializeBettingRound(JSON.stringify({ version: 3, round: extendedBackdoorScore }))).toEqual({
      ...extendedBackdoorScore,
      holes: [{ holeNumber: 1, par: 4, backdoorOpen: true, nearPlayerId: null, scores: [{ playerId: 'player-1', strokes: 30, entryMode: 'manual' }] }],
    });
    expect(deserializeBettingRound(JSON.stringify({ version: 3, round: tooHighBackdoorScore }))).toBeNull();
    expect(deserializeBettingRound(JSON.stringify({ version: 3, round: badPar }))).toBeNull();

    const throwingStorage = new ThrowingStorage();
    expect(loadBettingRound(throwingStorage)).toBeNull();
    expect(saveBettingRound(throwingStorage, round)).toBe(false);
    expect(clearBettingRound(throwingStorage)).toBe(false);
    expect(purgeKnownLegacyShotAdviceStorage(throwingStorage)).toEqual([]);
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
