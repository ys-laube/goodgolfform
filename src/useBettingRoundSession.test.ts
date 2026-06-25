import { describe, expect, it } from 'vitest';

import {
  bettingActiveRoundStorageKey,
  createDefaultBettingRound,
  legacyCaddiePresetStorageKey,
  saveBettingRound,
  type BettingHoleMission,
  type StorageLike,
} from './domain/bettingStorage';
import {
  applyGameEnabledMutation,
  applyGameUnitMutation,
  applyHoleEventToggleMutation,
  applyHoleMissionMutation,
  applyHoleScoreMutation,
  applyMissionOutcomeMutation,
  applyPlayerMutation,
  applyRoundSetupMutation,
  bettingGameAvailability,
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
  it('initializes from saved betting state and ignores stale caddie storage', () => {
    const savedRound = createDefaultBettingRound({ id: 'round-saved', now: '2026-06-25T00:00:00.000Z' });
    const storage = new MemoryStorage({
      [legacyCaddiePresetStorageKey]: JSON.stringify({ presets: [{ name: '캐디 프리셋은 플레이어가 아님' }] }),
    });

    expect(saveBettingRound(storage, savedRound)).toBe(true);
    storage.calls.length = 0;

    const sessionState = createInitialBettingRoundSessionState(storage, '2026-06-25T01:00:00.000Z');

    expect(sessionState.storageStatus).toBe('loaded');
    expect(sessionState.hasSavedRound).toBe(true);
    expect(sessionState.round.id).toBe('round-saved');
    expect(sessionState.round.players.map((player) => player.name)).not.toContain('캐디 프리셋은 플레이어가 아님');
    expect(storage.calls).toEqual([`get:${bettingActiveRoundStorageKey}`]);
  });

  it('falls back to a local-only default session when betting storage is corrupt or unavailable', () => {
    const corruptStorage = new MemoryStorage({ [bettingActiveRoundStorageKey]: '{broken' });
    const corruptState = createInitialBettingRoundSessionState(corruptStorage, '2026-06-25T02:00:00.000Z');
    const memoryState = createInitialBettingRoundSessionState(undefined, '2026-06-25T03:00:00.000Z');

    expect(corruptState.storageStatus).toBe('default');
    expect(corruptState.round.players).toHaveLength(4);
    expect(corruptState.round.createdAt).toBe('2026-06-25T02:00:00.000Z');
    expect(memoryState.storageStatus).toBe('memory-only');
    expect(memoryState.storageMessage).toContain('현재 세션 메모리');
  });

  it('mutates setup, players, games, and units without changing stable player ids', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const playerIds = round.players.map((player) => player.id);
    const setupRound = applyRoundSetupMutation(
      round,
      { holeCount: 9, scoringMode: 'points', handicapMode: 'hole-allocation' },
      '2026-06-25T01:00:00.000Z',
    );
    const playerRound = applyPlayerMutation(setupRound, 'player-1', { name: '태훈', handicap: 6 }, '2026-06-25T01:01:00.000Z');
    const gameRound = applyGameEnabledMutation(playerRound, 'skins', false, '2026-06-25T01:02:00.000Z');
    const unitRound = applyGameUnitMutation(gameRound, 'stroke', { points: 4, money: 2000 }, '2026-06-25T01:03:00.000Z');

    expect(unitRound.players.map((player) => player.id)).toEqual(playerIds);
    expect(unitRound.settings).toEqual({ holeCount: 9, scoringMode: 'points', handicapMode: 'hole-allocation' });
    expect(unitRound.players[0]).toMatchObject({ id: 'player-1', name: '태훈', handicap: 6 });
    expect(unitRound.enabledGames.skins).toBe(false);
    expect(unitRound.gameUnits.stroke).toEqual({ points: 4, money: 2000 });
    expect(unitRound.updatedAt).toBe('2026-06-25T01:03:00.000Z');
  });

  it('supports hole score, event, and mission session mutations', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const scoredRound = applyHoleScoreMutation(round, 1, 'player-1', 4, '2026-06-25T01:00:00.000Z');
    const eventRound = applyHoleEventToggleMutation(scoredRound, 1, 'near-pin', 'player-2', 5, '2026-06-25T01:01:00.000Z');
    const mission: BettingHoleMission = {
      id: '',
      playerId: 'player-3',
      missionId: 'mission-pressure-putt',
      title: '압박 퍼트 성공',
      points: 7,
      outcome: 'pending',
    };
    const missionRound = applyHoleMissionMutation(eventRound, 1, mission, '2026-06-25T01:02:00.000Z');
    const outcomeRound = applyMissionOutcomeMutation(
      missionRound,
      1,
      'mission-pressure-putt',
      'player-3',
      'success',
      '2026-06-25T01:03:00.000Z',
    );

    expect(outcomeRound.holes).toHaveLength(1);
    expect(outcomeRound.holes[0]?.scores).toEqual([{ playerId: 'player-1', strokes: 4 }]);
    expect(outcomeRound.holes[0]?.events).toEqual([{ id: 'hole-1:near-pin:player-2', playerId: 'player-2', event: 'near-pin', points: 5 }]);
    expect(outcomeRound.holes[0]?.missions).toEqual([
      {
        id: 'hole-1:mission:mission-pressure-putt:player-3',
        playerId: 'player-3',
        missionId: 'mission-pressure-putt',
        title: '압박 퍼트 성공',
        points: 7,
        outcome: 'success',
      },
    ]);
  });

  it('keeps Vegas unavailable for non-four-player sessions', () => {
    const round = { ...createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' }), players: createDefaultBettingRound().players.slice(0, 3) };
    const nextRound = applyGameEnabledMutation(round, 'vegas', true, '2026-06-25T01:00:00.000Z');
    const availability = bettingGameAvailability(nextRound);

    expect(nextRound.enabledGames.vegas).toBe(false);
    expect(availability.vegas.available).toBe(false);
    expect(availability.vegas.reason).toContain('4명');
  });
});
