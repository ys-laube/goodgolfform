import { useMemo, useState } from 'react';

import { availableLocalStorage } from './browserEnvironment';
import {
  bettingActiveRoundStorageKey,
  clearBettingRound,
  cloneBettingRound,
  createDefaultBettingPlayers,
  createDefaultBettingRound,
  defaultOjangUnitAmount,
  loadBettingRound,
  maximumHoleScoreStrokes,
  purgeKnownLegacyShotAdviceStorage,
  saveBettingRound,
  type BettingHoleResult,
  type BettingHoleScore,
  type BettingPlayer,
  type BettingRound,
  type BettingRoundSettings,
  type StorageLike,
} from './domain/bettingStorage';

type SessionStorageStatus = 'loaded' | 'default' | 'memory-only' | 'saved' | 'cleared';

export type BettingRoundSessionState = {
  readonly round: BettingRound;
  readonly storageStatus: SessionStorageStatus;
  readonly storageMessage: string;
  readonly hasSavedRound: boolean;
};

export type BettingRoundSession = BettingRoundSessionState & {
  readonly updateRoundSetup: (patch: Partial<BettingRoundSettings>) => void;
  readonly updateUnitAmount: (unitAmount: number) => void;
  readonly setPlayerCount: (playerCount: number) => void;
  readonly updatePlayer: (playerId: string, patch: Partial<Pick<BettingPlayer, 'name' | 'handicap'>>) => void;
  readonly updateHoleSetup: (holeNumber: number, patch: Partial<Pick<BettingHoleResult, 'par' | 'backdoorOpen'>>) => void;
  readonly updateHoleScore: (holeNumber: number, playerId: string, score: BettingHoleScoreInput) => void;
  readonly setNearPlayer: (holeNumber: number, playerId: string | null) => void;
  readonly saveRound: () => boolean;
  readonly resetRound: () => void;
  readonly clearSavedRound: () => boolean;
  readonly purgeLegacyShotAdvicePresets: () => readonly string[];
};

export type BettingHoleScoreInput =
  | { readonly strokes: number; readonly entryMode?: 'manual' }
  | { readonly strokes: number; readonly entryMode: 'on-putt'; readonly onGreenShots: number; readonly putts: number }
  | { readonly strokes: 1; readonly entryMode: 'hio'; readonly onGreenShots: 1; readonly putts: 0; readonly holeInOne: true };

export function createInitialBettingRoundSessionState(storage: StorageLike | undefined, now = new Date().toISOString()): BettingRoundSessionState {
  const savedRound = loadBettingRound(storage);

  if (savedRound) {
    return {
      round: savedRound,
      storageStatus: 'loaded',
      storageMessage: '이 기기에 저장된 오장 라운드를 불러왔습니다.',
      hasSavedRound: true,
    };
  }

  const round = createDefaultBettingRound({ now });
  return {
    round,
    storageStatus: storage ? 'default' : 'memory-only',
    storageMessage: storage
      ? '새 오장 라운드를 시작합니다. 이 기기에만 저장됩니다.'
      : '브라우저 로컬 저장소를 사용할 수 없어 현재 세션 메모리에만 보관합니다.',
    hasSavedRound: false,
  };
}

export function applyRoundSetupMutation(
  round: BettingRound,
  patch: Partial<Pick<BettingRoundSettings, 'holeCount' | 'unitAmount'>>,
  now = new Date().toISOString(),
): BettingRound {
  const settings: BettingRoundSettings = {
    ...round.settings,
    holeCount: patch.holeCount === undefined ? round.settings.holeCount : clampInteger(patch.holeCount, 1, 18),
    unitAmount: patch.unitAmount === undefined ? round.settings.unitAmount : clampInteger(patch.unitAmount, 1, 1_000_000),
  };

  return stampRound({ ...round, settings }, now);
}

export function applyPlayerCountMutation(round: BettingRound, playerCount: number, now = new Date().toISOString()): BettingRound {
  const nextPlayerCount = clampInteger(playerCount, 2, 4);
  const defaultPlayers = createDefaultBettingPlayers(4);
  const usedPlayerIds = new Set<string>();
  const players = Array.from({ length: nextPlayerCount }, (_, index) => {
    const player = round.players[index] ?? defaultPlayers[index];
    const id = uniquePlayerId(player.id, usedPlayerIds, index + 1);
    usedPlayerIds.add(id);
    return { ...player, id };
  });
  const activePlayerIds = new Set(players.map((player) => player.id));
  const holes = round.holes.map((hole) => ({
    ...hole,
    nearPlayerId: hole.nearPlayerId && activePlayerIds.has(hole.nearPlayerId) ? hole.nearPlayerId : null,
    scores: hole.scores.filter((score) => activePlayerIds.has(score.playerId)),
  }));

  return stampRound({ ...round, players, holes }, now);
}

export function applyPlayerMutation(
  round: BettingRound,
  playerId: string,
  patch: Partial<Pick<BettingPlayer, 'name' | 'handicap'>>,
  now = new Date().toISOString(),
): BettingRound {
  return stampRound(
    {
      ...round,
      players: round.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name: patch.name === undefined ? player.name : normalizePlayerName(patch.name),
              handicap: patch.handicap === undefined ? player.handicap : clampInteger(patch.handicap, -10, 54),
            }
          : player,
      ),
    },
    now,
  );
}

export function applyHoleSetupMutation(
  round: BettingRound,
  holeNumber: number,
  patch: Partial<Pick<BettingHoleResult, 'par' | 'backdoorOpen'>>,
  now = new Date().toISOString(),
): BettingRound {
  return mutateHole(
    round,
    holeNumber,
    (hole) => ({
      ...hole,
      par: patch.par === undefined ? hole.par : clampInteger(patch.par, 3, 5),
      backdoorOpen: patch.backdoorOpen ?? hole.backdoorOpen,
      nearPlayerId: (patch.par !== undefined && clampInteger(patch.par, 3, 5) !== 3) ? null : hole.nearPlayerId,
    }),
    now,
  );
}

export function applyHoleScoreMutation(
  round: BettingRound,
  holeNumber: number,
  playerId: string,
  score: BettingHoleScoreInput,
  now = new Date().toISOString(),
): BettingRound {
  if (!hasPlayer(round, playerId)) {
    return round;
  }

  return mutateHole(
    round,
    holeNumber,
    (hole) => ({
      ...hole,
      scores: upsertByPlayer(hole.scores, playerId, sanitizeScore(playerId, score)),
    }),
    now,
  );
}

export function applyNearPlayerMutation(
  round: BettingRound,
  holeNumber: number,
  playerId: string | null,
  now = new Date().toISOString(),
): BettingRound {
  return mutateHole(
    round,
    holeNumber,
    (hole) => ({
      ...hole,
      nearPlayerId: hole.par === 3 && playerId && hasPlayer(round, playerId) ? playerId : null,
    }),
    now,
  );
}

export function useBettingRoundSession(storageProvider: () => StorageLike | undefined = availableLocalStorage): BettingRoundSession {
  const [sessionState, setSessionState] = useState<BettingRoundSessionState>(() => createInitialBettingRoundSessionState(storageProvider()));
  const stableState = useMemo(() => sessionState, [sessionState]);

  function commitRound(nextRound: BettingRound, successMessage: string) {
    const storage = storageProvider();
    const saved = saveBettingRound(storage, nextRound);

    setSessionState({
      round: nextRound,
      storageStatus: saved ? 'saved' : 'memory-only',
      storageMessage: saved ? successMessage : '로컬 저장소에 쓸 수 없어 현재 세션 메모리에만 반영했습니다.',
      hasSavedRound: saved || stableState.hasSavedRound,
    });
  }

  function mutateRound(mutator: (round: BettingRound) => BettingRound, message: string) {
    commitRound(mutator(stableState.round), message);
  }

  return {
    ...stableState,
    updateRoundSetup: (patch) => mutateRound((round) => applyRoundSetupMutation(round, patch), '오장 라운드 설정을 이 기기에 저장했습니다.'),
    updateUnitAmount: (unitAmount) => mutateRound((round) => applyRoundSetupMutation(round, { unitAmount }), '타당 금액을 이 기기에 저장했습니다.'),
    setPlayerCount: (playerCount) => mutateRound((round) => applyPlayerCountMutation(round, playerCount), '플레이어 수를 이 기기에 저장했습니다.'),
    updatePlayer: (playerId, patch) => mutateRound((round) => applyPlayerMutation(round, playerId, patch), '플레이어 설정을 이 기기에 저장했습니다.'),
    updateHoleSetup: (holeNumber, patch) => mutateRound((round) => applyHoleSetupMutation(round, holeNumber, patch), '홀 파와 뒷문오픈 설정을 이 기기에 저장했습니다.'),
    updateHoleScore: (holeNumber, playerId, score) =>
      mutateRound((round) => applyHoleScoreMutation(round, holeNumber, playerId, score), '홀 스코어를 이 기기에 저장했습니다.'),
    setNearPlayer: (holeNumber, playerId) => mutateRound((round) => applyNearPlayerMutation(round, holeNumber, playerId), '파3 니어를 이 기기에 저장했습니다.'),
    saveRound: () => {
      const saved = saveBettingRound(storageProvider(), stableState.round);
      setSessionState({
        ...stableState,
        storageStatus: saved ? 'saved' : 'memory-only',
        storageMessage: saved ? `현재 오장 라운드를 ${bettingActiveRoundStorageKey}에 저장했습니다.` : '로컬 저장소에 쓸 수 없어 현재 세션 메모리에만 보관합니다.',
        hasSavedRound: saved || stableState.hasSavedRound,
      });
      return saved;
    },
    resetRound: () => {
      const nextRound = createDefaultBettingRound({ now: new Date().toISOString() });
      commitRound(nextRound, '새 오장 라운드를 이 기기에 저장했습니다.');
    },
    clearSavedRound: () => {
      const cleared = clearBettingRound(storageProvider());
      setSessionState({
        ...stableState,
        storageStatus: cleared ? 'cleared' : 'memory-only',
        storageMessage: cleared ? '이 기기에 저장된 오장 라운드를 삭제했습니다.' : '삭제할 로컬 저장소를 사용할 수 없습니다.',
        hasSavedRound: cleared ? false : stableState.hasSavedRound,
      });
      return cleared;
    },
    purgeLegacyShotAdvicePresets: () => purgeKnownLegacyShotAdviceStorage(storageProvider()),
  };
}

function mutateHole(
  round: BettingRound,
  holeNumber: number,
  mutate: (hole: BettingHoleResult) => BettingHoleResult,
  now: string,
): BettingRound {
  const normalizedHoleNumber = clampInteger(holeNumber, 1, round.settings.holeCount);
  const existingHole = round.holes.find((hole) => hole.holeNumber === normalizedHoleNumber);
  const baseHole = existingHole ?? { holeNumber: normalizedHoleNumber, par: 4, backdoorOpen: false, nearPlayerId: null, scores: [] };
  const nextHole = mutate(baseHole);
  const holes = existingHole
    ? round.holes.map((hole) => (hole.holeNumber === normalizedHoleNumber ? nextHole : hole))
    : [...round.holes, nextHole].sort((a, b) => a.holeNumber - b.holeNumber);

  return stampRound({ ...round, holes }, now);
}

function upsertByPlayer<T extends { readonly playerId: string }>(items: readonly T[], playerId: string, item: T): readonly T[] {
  return items.some((value) => value.playerId === playerId)
    ? items.map((value) => (value.playerId === playerId ? item : value))
    : [...items, item];
}

function sanitizeScore(playerId: string, score: BettingHoleScoreInput): BettingHoleScore {
  if (score.entryMode === 'hio') {
    return { playerId, strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true };
  }

  if (score.entryMode === 'on-putt') {
    const onGreenShots = clampInteger(score.onGreenShots, 1, 6);
    const putts = clampInteger(score.putts, 0, 5);
    return { playerId, strokes: clampInteger(onGreenShots + putts, 1, maximumHoleScoreStrokes), entryMode: 'on-putt', onGreenShots, putts, holeInOne: false };
  }

  return { playerId, strokes: clampInteger(score.strokes, 1, maximumHoleScoreStrokes), entryMode: 'manual' };
}

function hasPlayer(round: BettingRound, playerId: string): boolean {
  return round.players.some((player) => player.id === playerId);
}

function stampRound(round: BettingRound, updatedAt: string): BettingRound {
  return cloneBettingRound({ ...round, updatedAt });
}

function normalizePlayerName(name: string): string {
  return name;
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}

function uniquePlayerId(preferredId: string, usedPlayerIds: ReadonlySet<string>, oneBasedIndex: number): string {
  const baseId = preferredId.trim() || `player-${oneBasedIndex}`;

  if (!usedPlayerIds.has(baseId)) {
    return baseId;
  }

  for (let suffix = 2; suffix <= 9; suffix += 1) {
    const candidate = `${baseId}-${suffix}`;
    if (!usedPlayerIds.has(candidate)) {
      return candidate;
    }
  }

  return `player-${oneBasedIndex}-${usedPlayerIds.size + 1}`;
}

export { defaultOjangUnitAmount };
