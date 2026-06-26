import { describe, expect, it } from 'vitest';

import {
  bettingActiveRoundStorageKey,
  createDefaultBettingRound,
  loadBettingRound,
  type StorageLike,
} from './bettingStorage';
import {
  bettingShareHashMaxLength,
  bettingShareHashPrefix,
  bettingShareHashTargetLength,
  createBettingRoundShareHash,
  parseBettingRoundShareHash,
  parseBettingRoundShareHashPayload,
  restoreBettingRoundShareHashToStorage,
} from './bettingShareSnapshot';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  peek(key: string): string | null {
    return this.values.get(key) ?? null;
  }
}

describe('betting URL hash share snapshots', () => {
  it('creates compact local-only result hashes within the target length for a normal round', () => {
    const round = {
      ...createDefaultBettingRound({ id: 'round-share', now: '2026-06-26T00:00:00.000Z' }),
      players: createDefaultBettingRound().players.map((player, index) => ({ ...player, name: ['민준', '서연', '도윤', '지우'][index] ?? player.name })),
      holes: [
        {
          holeNumber: 1,
          par: 5,
          backdoorOpen: true,
          scores: [
            { playerId: 'player-1', strokes: 4 },
            { playerId: 'player-2', strokes: 5 },
            { playerId: 'player-3', strokes: 4 },
            { playerId: 'player-4', strokes: 6 },
          ],
          events: [{ id: 'hole-1:near-pin:player-2', playerId: 'player-2', event: 'near-pin' as const, points: 2 }],
          missions: [
            {
              id: 'hole-1:mission:fairway:player-1',
              playerId: 'player-1',
              missionId: 'fairway',
              title: '페어웨이 지키기',
              points: 5,
              outcome: 'success' as const,
            },
          ],
        },
      ],
    };

    const result = createBettingRoundShareHash(round, { roundName: '금요 새벽 라운드', courseName: '남서울 OUT' });

    expect(result.ok).toBe(true);
    expect(result.ok && result.hash.startsWith(`#${bettingShareHashPrefix}`)).toBe(true);
    expect(result.payloadLength).toBeLessThanOrEqual(bettingShareHashTargetLength);
    expect(result.payloadLength).toBeLessThanOrEqual(bettingShareHashMaxLength);
    expect(result.ok && parseBettingRoundShareHash(result.hash)).toEqual(round);
    expect(result.ok && parseBettingRoundShareHashPayload(result.hash)?.labels).toEqual({
      roundName: '금요 새벽 라운드',
      courseName: '남서울 OUT',
    });
  });

  it('restores a valid hash into the existing local storage boundary', () => {
    const round = createDefaultBettingRound({ id: 'round-restored', now: '2026-06-26T01:00:00.000Z', playerCount: 3 });
    const hashResult = createBettingRoundShareHash(round, { roundName: '복원 라운드', courseName: '제주 동코스' });
    const storage = new MemoryStorage();

    expect(hashResult.ok).toBe(true);
    const restoreResult = restoreBettingRoundShareHashToStorage(hashResult.ok ? hashResult.hash : '', storage);

    expect(restoreResult).toMatchObject({
      restored: true,
      labels: { roundName: '복원 라운드', courseName: '제주 동코스' },
      payloadLength: hashResult.payloadLength,
      saved: true,
    });
    expect(storage.peek(bettingActiveRoundStorageKey)).toContain('round-restored');
    expect(loadBettingRound(storage)).toEqual(round);
  });

  it('rejects invalid, unsupported, and oversized share hashes without touching storage', () => {
    const storage = new MemoryStorage();
    const oversizedHash = `#${bettingShareHashPrefix}${'a'.repeat(bettingShareHashMaxLength)}`;

    expect(parseBettingRoundShareHash('#fg=not valid')).toBeNull();
    expect(restoreBettingRoundShareHashToStorage('', storage)).toEqual({ restored: false, reason: 'empty', payloadLength: 0 });
    expect(restoreBettingRoundShareHashToStorage('#other=abc', storage)).toEqual({ restored: false, reason: 'unsupported', payloadLength: 10 });
    expect(restoreBettingRoundShareHashToStorage(oversizedHash, storage)).toEqual({
      restored: false,
      reason: 'payload-too-large',
      payloadLength: oversizedHash.length,
    });
    expect(loadBettingRound(storage)).toBeNull();
  });

  it('uses the hard guard instead of emitting URL hashes over 2200 characters', () => {
    const round = {
      ...createDefaultBettingRound({ now: '2026-06-26T02:00:00.000Z' }),
      players: createDefaultBettingRound().players.map((player) => ({ ...player, name: `${player.name}-${'가'.repeat(900)}` })),
    };

    expect(createBettingRoundShareHash(round)).toMatchObject({
      ok: false,
      reason: 'payload-too-large',
      targetLength: bettingShareHashTargetLength,
      maxLength: bettingShareHashMaxLength,
    });
  });
});
