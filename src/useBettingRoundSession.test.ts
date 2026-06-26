import { describe, expect, it } from 'vitest';

import {
  bettingActiveRoundStorageKey,
  createDefaultBettingRound,
  legacyShotAdvicePresetStorageKey,
  saveBettingRound,
  type StorageLike,
} from './domain/bettingStorage';
import {
  applyHoleScoreMutation,
  applyHoleSetupMutation,
  applyNearPlayerMutation,
  applyPlayerMutation,
  applyPlayerCountMutation,
  applyRoundSetupMutation,
  createInitialBettingRoundSessionState,
} from './useBettingRoundSession';

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
}

describe('useBettingRoundSession local state helpers', () => {
  it('initializes from saved Ojang state and ignores stale caddie storage', () => {
    const savedRound = createDefaultBettingRound({ id: 'round-saved', now: '2026-06-25T00:00:00.000Z' });
    const storage = new MemoryStorage({
      [legacyShotAdvicePresetStorageKey]: JSON.stringify({ presets: [{ name: '캐디 프리셋은 플레이어가 아님' }] }),
    });

    expect(saveBettingRound(storage, savedRound)).toBe(true);
    storage.calls.length = 0;

    const sessionState = createInitialBettingRoundSessionState(storage, '2026-06-25T01:00:00.000Z');

    expect(sessionState.storageStatus).toBe('loaded');
    expect(sessionState.hasSavedRound).toBe(true);
    expect(sessionState.round.id).toBe('round-saved');
    expect(sessionState.round.settings.unitAmount).toBe(5000);
    expect(sessionState.round.players.map((player) => player.name)).not.toContain('캐디 프리셋은 플레이어가 아님');
    expect(storage.calls).toEqual([`get:${bettingActiveRoundStorageKey}`]);
  });

  it('falls back to a local-only default session when Ojang storage is corrupt or unavailable', () => {
    const corruptStorage = new MemoryStorage({ [bettingActiveRoundStorageKey]: '{broken' });
    const corruptState = createInitialBettingRoundSessionState(corruptStorage, '2026-06-25T02:00:00.000Z');
    const memoryState = createInitialBettingRoundSessionState(undefined, '2026-06-25T03:00:00.000Z');

    expect(corruptState.storageStatus).toBe('default');
    expect(corruptState.round.players).toHaveLength(4);
    expect(corruptState.round.createdAt).toBe('2026-06-25T02:00:00.000Z');
    expect(corruptState.round.settings.unitAmount).toBe(5000);
    expect(memoryState.storageStatus).toBe('memory-only');
    expect(memoryState.storageMessage).toContain('현재 세션 메모리');
  });

  it('mutates setup and players without changing stable player ids', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const playerIds = round.players.map((player) => player.id);
    const setupRound = applyRoundSetupMutation(round, { holeCount: 9, unitAmount: 2000 }, '2026-06-25T01:00:00.000Z');
    const playerRound = applyPlayerMutation(setupRound, 'player-1', { name: '태훈', handicap: 6 }, '2026-06-25T01:01:00.000Z');

    expect(playerRound.players.map((player) => player.id)).toEqual(playerIds);
    expect(playerRound.settings).toEqual({ holeCount: 9, unitAmount: 2000 });
    expect(playerRound.players[0]).toMatchObject({ id: 'player-1', name: '태훈', handicap: 6 });
    expect(playerRound.updatedAt).toBe('2026-06-25T01:01:00.000Z');
  });

  it('allows player name drafts to be fully cleared instead of restoring the previous name', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const clearedRound = applyPlayerMutation(round, 'player-1', { name: '' }, '2026-06-25T01:01:00.000Z');

    expect(clearedRound.players[0]?.name).toBe('');
    expect(clearedRound.players[1]?.name).toBe(round.players[1]?.name);
  });

  it('resizes a round to 2–4 players and prunes inactive hole data including near selection', () => {
    const round = {
      ...createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' }),
      holes: [
        {
          holeNumber: 1,
          par: 3,
          backdoorOpen: false,
          nearPlayerId: 'player-3',
          scores: [
            { playerId: 'player-1', strokes: 3, entryMode: 'manual' as const },
            { playerId: 'player-2', strokes: 4, entryMode: 'manual' as const },
            { playerId: 'player-3', strokes: 5, entryMode: 'manual' as const },
          ],
        },
      ],
    };

    const twoPlayerRound = applyPlayerCountMutation(round, 2, '2026-06-25T01:00:00.000Z');
    const restoredRound = applyPlayerCountMutation(twoPlayerRound, 4, '2026-06-25T01:01:00.000Z');

    expect(twoPlayerRound.players.map((player) => player.id)).toEqual(['player-1', 'player-2']);
    expect(twoPlayerRound.holes[0]?.nearPlayerId).toBeNull();
    expect(twoPlayerRound.holes[0]?.scores).toEqual([
      { playerId: 'player-1', strokes: 3, entryMode: 'manual' },
      { playerId: 'player-2', strokes: 4, entryMode: 'manual' },
    ]);
    expect(restoredRound.players).toHaveLength(4);
    expect(new Set(restoredRound.players.map((player) => player.id))).toHaveProperty('size', 4);
  });

  it('supports hole score, hole setup, and par-3 near-pin session mutations', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const setupRound = applyHoleSetupMutation(round, 1, { par: 3, backdoorOpen: true }, '2026-06-25T00:59:00.000Z');
    const scoredRound = applyHoleScoreMutation(setupRound, 1, 'player-1', { strokes: 3, entryMode: 'on-putt', onGreenShots: 1, putts: 2 }, '2026-06-25T01:00:00.000Z');
    const nearRound = applyNearPlayerMutation(scoredRound, 1, 'player-2', '2026-06-25T01:01:00.000Z');

    expect(nearRound.holes).toHaveLength(1);
    expect(nearRound.holes[0]).toMatchObject({ holeNumber: 1, par: 3, backdoorOpen: true, nearPlayerId: 'player-2' });
    expect(nearRound.holes[0]?.scores).toEqual([{ playerId: 'player-1', strokes: 3, entryMode: 'on-putt', onGreenShots: 1, putts: 2, holeInOne: false }]);
  });

  it('caps raw hole scores at the backdoor-open maximum and supports 홀인원', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const highScoreRound = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 99, entryMode: 'manual' }, '2026-06-25T01:00:00.000Z');
    const hioRound = applyHoleScoreMutation(highScoreRound, 1, 'player-2', { strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true }, '2026-06-25T01:01:00.000Z');

    expect(hioRound.holes[0]?.scores).toEqual([
      { playerId: 'player-1', strokes: 30, entryMode: 'manual' },
      { playerId: 'player-2', strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true },
    ]);
  });
});
