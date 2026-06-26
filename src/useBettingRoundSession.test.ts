import { describe, expect, it } from 'vitest';

import {
  bettingActiveRoundStorageKey,
  createDefaultBettingRound,
  legacyShotAdvicePresetStorageKey,
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
  applyPlayerCountMutation,
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
      [legacyShotAdvicePresetStorageKey]: JSON.stringify({ presets: [{ name: '캐디 프리셋은 플레이어가 아님' }] }),
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

  it('allows player name drafts to be fully cleared instead of restoring the previous name', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const clearedRound = applyPlayerMutation(round, 'player-1', { name: '' }, '2026-06-25T01:01:00.000Z');

    expect(clearedRound.players[0]?.name).toBe('');
    expect(clearedRound.players[1]?.name).toBe(round.players[1]?.name);
  });

  it('resizes a round to 2–4 players, prunes inactive hole data, and disables Vegas below four players', () => {
    const round = {
      ...createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' }),
      holes: [
        {
          holeNumber: 1,
          scores: [
            { playerId: 'player-1', strokes: 4 },
            { playerId: 'player-2', strokes: 5 },
            { playerId: 'player-3', strokes: 6 },
          ],
          events: [{ id: 'event-1', playerId: 'player-3', event: 'near-pin' as const, points: 2 }],
          missions: [{ id: 'mission-1', playerId: 'player-4', missionId: 'fairway-keeper', title: '페어웨이 지킴이', points: 2, outcome: 'success' as const }],
        },
      ],
    };

    const twoPlayerRound = applyPlayerCountMutation(round, 2, '2026-06-25T01:00:00.000Z');
    const restoredRound = applyPlayerCountMutation(twoPlayerRound, 4, '2026-06-25T01:01:00.000Z');

    expect(twoPlayerRound.players.map((player) => player.id)).toEqual(['player-1', 'player-2']);
    expect(twoPlayerRound.enabledGames.vegas).toBe(false);
    expect(twoPlayerRound.holes[0]?.scores).toEqual([
      { playerId: 'player-1', strokes: 4 },
      { playerId: 'player-2', strokes: 5 },
    ]);
    expect(twoPlayerRound.holes[0]?.events).toEqual([]);
    expect(twoPlayerRound.holes[0]?.missions).toEqual([]);
    expect(restoredRound.players).toHaveLength(4);
    expect(new Set(restoredRound.players.map((player) => player.id))).toHaveProperty('size', 4);
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

  it('uses the same default event points as the ledger when points are omitted', () => {
    const round = createDefaultBettingRound({ now: '2026-06-25T00:00:00.000Z' });
    const eventRound = applyHoleEventToggleMutation(round, 1, 'near-pin', 'player-2', undefined, '2026-06-25T01:01:00.000Z');
    const penaltyRound = applyHoleEventToggleMutation(eventRound, 1, 'ob-penalty', 'player-1', undefined, '2026-06-25T01:02:00.000Z');

    expect(penaltyRound.holes[0]?.events).toEqual([
      { id: 'hole-1:near-pin:player-2', playerId: 'player-2', event: 'near-pin', points: 2 },
      { id: 'hole-1:ob-penalty:player-1', playerId: 'player-1', event: 'ob-penalty', points: -2 },
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
