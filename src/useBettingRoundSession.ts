import { useMemo, useState } from 'react';

import { availableLocalStorage } from './browserEnvironment';
import { eventBasePoints, type BettingEventType } from './domain/bettingLedger';
import {
  bettingActiveRoundStorageKey,
  clearBettingRound,
  cloneBettingRound,
  createDefaultBettingPlayers,
  createDefaultBettingRound,
  loadBettingRound,
  maximumHoleScoreStrokes,
  purgeKnownLegacyShotAdviceStorage,
  saveBettingRound,
  type BettingEventKey,
  type BettingGameKey,
  type BettingGameUnit,
  type BettingHandicapMode,
  type BettingHoleMission,
  type BettingHoleResult,
  type BettingMissionOutcome,
  type BettingPlayer,
  type BettingRound,
  type BettingRoundSettings,
  type BettingScoringMode,
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
  readonly gameAvailability: Record<BettingGameKey, { readonly available: boolean; readonly reason: string | null }>;
  readonly updateRoundSetup: (patch: Partial<BettingRoundSettings>) => void;
  readonly setPlayerCount: (playerCount: number) => void;
  readonly updatePlayer: (playerId: string, patch: Partial<Pick<BettingPlayer, 'name' | 'handicap'>>) => void;
  readonly setGameEnabled: (game: BettingGameKey, enabled: boolean) => void;
  readonly updateGameUnit: (game: BettingGameKey, patch: Partial<BettingGameUnit>) => void;
  readonly updateHoleScore: (holeNumber: number, playerId: string, strokes: number) => void;
  readonly toggleHoleEvent: (holeNumber: number, event: BettingEventKey, playerId: string, points?: number) => void;
  readonly setHoleMission: (holeNumber: number, mission: BettingHoleMission) => void;
  readonly setMissionOutcome: (holeNumber: number, missionId: string, playerId: string, outcome: BettingMissionOutcome) => void;
  readonly saveRound: () => boolean;
  readonly resetRound: () => void;
  readonly clearSavedRound: () => boolean;
  readonly purgeLegacyShotAdvicePresets: () => readonly string[];
};

export function createInitialBettingRoundSessionState(storage: StorageLike | undefined, now = new Date().toISOString()): BettingRoundSessionState {
  const savedRound = loadBettingRound(storage);

  if (savedRound) {
    return {
      round: savedRound,
      storageStatus: 'loaded',
      storageMessage: '이 기기에 저장된 골프 내기 라운드를 불러왔습니다.',
      hasSavedRound: true,
    };
  }

  const round = createDefaultBettingRound({ now });
  return {
    round,
    storageStatus: storage ? 'default' : 'memory-only',
    storageMessage: storage
      ? '새 골프 내기 라운드를 시작합니다. 이 기기에만 저장됩니다.'
      : '브라우저 로컬 저장소를 사용할 수 없어 현재 세션 메모리에만 보관합니다.',
    hasSavedRound: false,
  };
}

export function applyRoundSetupMutation(
  round: BettingRound,
  patch: Partial<Pick<BettingRoundSettings, 'holeCount' | 'scoringMode' | 'handicapMode'>>,
  now = new Date().toISOString(),
): BettingRound {
  const settings: BettingRoundSettings = {
    ...round.settings,
    holeCount: patch.holeCount === undefined ? round.settings.holeCount : clampInteger(patch.holeCount, 1, 18),
    scoringMode: patch.scoringMode ?? round.settings.scoringMode,
    handicapMode: patch.handicapMode ?? round.settings.handicapMode,
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
    scores: hole.scores.filter((score) => activePlayerIds.has(score.playerId)),
    events: hole.events.filter((event) => activePlayerIds.has(event.playerId)),
    missions: hole.missions.filter((mission) => activePlayerIds.has(mission.playerId)),
  }));

  return stampRound(
    {
      ...round,
      players,
      enabledGames: {
        ...round.enabledGames,
        vegas: nextPlayerCount === 4 ? round.enabledGames.vegas : false,
      },
      holes,
    },
    now,
  );
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

export function applyGameEnabledMutation(round: BettingRound, game: BettingGameKey, enabled: boolean, now = new Date().toISOString()): BettingRound {
  const nextEnabledGames = { ...round.enabledGames, [game]: enabled };

  if (game === 'vegas' && round.players.length !== 4) {
    nextEnabledGames.vegas = false;
  }

  return stampRound({ ...round, enabledGames: nextEnabledGames }, now);
}

export function applyGameUnitMutation(
  round: BettingRound,
  game: BettingGameKey,
  patch: Partial<BettingGameUnit>,
  now = new Date().toISOString(),
): BettingRound {
  return stampRound(
    {
      ...round,
      gameUnits: {
        ...round.gameUnits,
        [game]: {
          ...round.gameUnits[game],
          points: patch.points === undefined ? round.gameUnits[game].points : clampInteger(patch.points, 0, 100),
          money: patch.money === undefined ? round.gameUnits[game].money : clampInteger(patch.money, 0, 1_000_000),
        },
      },
    },
    now,
  );
}

export function applyHoleScoreMutation(
  round: BettingRound,
  holeNumber: number,
  playerId: string,
  strokes: number,
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
      scores: upsertByPlayer(hole.scores, playerId, { playerId, strokes: clampInteger(strokes, 1, maximumHoleScoreStrokes) }),
    }),
    now,
  );
}

export function applyHoleEventToggleMutation(
  round: BettingRound,
  holeNumber: number,
  event: BettingEventKey,
  playerId: string,
  points = defaultEventPoints(event),
  now = new Date().toISOString(),
): BettingRound {
  if (!hasPlayer(round, playerId)) {
    return round;
  }

  return mutateHole(
    round,
    holeNumber,
    (hole) => {
      const id = eventId(hole.holeNumber, event, playerId);
      const exists = hole.events.some((item) => item.id === id);

      return {
        ...hole,
        events: exists
          ? hole.events.filter((item) => item.id !== id)
          : [...hole.events, { id, playerId, event, points: clampInteger(points, -100, 100) }],
      };
    },
    now,
  );
}

export function applyHoleMissionMutation(
  round: BettingRound,
  holeNumber: number,
  mission: BettingHoleMission,
  now = new Date().toISOString(),
): BettingRound {
  if (!hasPlayer(round, mission.playerId)) {
    return round;
  }

  return mutateHole(
    round,
    holeNumber,
    (hole) => ({
      ...hole,
      missions: upsertMission(hole.missions, sanitizeMission(hole.holeNumber, mission)),
    }),
    now,
  );
}

export function applyMissionOutcomeMutation(
  round: BettingRound,
  holeNumber: number,
  missionId: string,
  playerId: string,
  outcome: BettingMissionOutcome,
  now = new Date().toISOString(),
): BettingRound {
  return mutateHole(
    round,
    holeNumber,
    (hole) => ({
      ...hole,
      missions: hole.missions.map((mission) =>
        mission.missionId === missionId && mission.playerId === playerId ? { ...mission, outcome } : mission,
      ),
    }),
    now,
  );
}

export function bettingGameAvailability(round: BettingRound): Record<BettingGameKey, { readonly available: boolean; readonly reason: string | null }> {
  return {
    stroke: { available: true, reason: null },
    skins: { available: true, reason: null },
    vegas: {
      available: round.players.length === 4,
      reason: round.players.length === 4 ? null : '베가스 팀전은 4명 라운드에서만 사용할 수 있습니다.',
    },
    events: { available: true, reason: null },
    missions: { available: true, reason: null },
  };
}

export function useBettingRoundSession(storageProvider: () => StorageLike | undefined = availableLocalStorage): BettingRoundSession {
  const [sessionState, setSessionState] = useState<BettingRoundSessionState>(() => createInitialBettingRoundSessionState(storageProvider()));
  const gameAvailability = useMemo(() => bettingGameAvailability(sessionState.round), [sessionState.round]);

  function commitRound(nextRound: BettingRound, successMessage: string) {
    const storage = storageProvider();
    const saved = saveBettingRound(storage, nextRound);

    setSessionState({
      round: nextRound,
      storageStatus: saved ? 'saved' : 'memory-only',
      storageMessage: saved ? successMessage : '로컬 저장소에 쓸 수 없어 현재 세션 메모리에만 반영했습니다.',
      hasSavedRound: saved || sessionState.hasSavedRound,
    });
  }

  function mutateRound(mutator: (round: BettingRound) => BettingRound, message: string) {
    commitRound(mutator(sessionState.round), message);
  }

  return {
    ...sessionState,
    gameAvailability,
    updateRoundSetup: (patch) => mutateRound((round) => applyRoundSetupMutation(round, patch), '라운드 설정을 이 기기에 저장했습니다.'),
    setPlayerCount: (playerCount) => mutateRound((round) => applyPlayerCountMutation(round, playerCount), '플레이어 수를 이 기기에 저장했습니다.'),
    updatePlayer: (playerId, patch) => mutateRound((round) => applyPlayerMutation(round, playerId, patch), '플레이어 설정을 이 기기에 저장했습니다.'),
    setGameEnabled: (game, enabled) => mutateRound((round) => applyGameEnabledMutation(round, game, enabled), '게임 구성을 이 기기에 저장했습니다.'),
    updateGameUnit: (game, patch) => mutateRound((round) => applyGameUnitMutation(round, game, patch), '게임 단위를 이 기기에 저장했습니다.'),
    updateHoleScore: (holeNumber, playerId, strokes) =>
      mutateRound((round) => applyHoleScoreMutation(round, holeNumber, playerId, strokes), '홀 스코어를 이 기기에 저장했습니다.'),
    toggleHoleEvent: (holeNumber, event, playerId, points) =>
      mutateRound((round) => applyHoleEventToggleMutation(round, holeNumber, event, playerId, points), '홀 이벤트를 이 기기에 저장했습니다.'),
    setHoleMission: (holeNumber, mission) => mutateRound((round) => applyHoleMissionMutation(round, holeNumber, mission), '미션 결과를 이 기기에 저장했습니다.'),
    setMissionOutcome: (holeNumber, missionId, playerId, outcome) =>
      mutateRound((round) => applyMissionOutcomeMutation(round, holeNumber, missionId, playerId, outcome), '미션 결과를 이 기기에 저장했습니다.'),
    saveRound: () => {
      const saved = saveBettingRound(storageProvider(), sessionState.round);
      setSessionState({
        ...sessionState,
        storageStatus: saved ? 'saved' : 'memory-only',
        storageMessage: saved ? `현재 라운드를 ${bettingActiveRoundStorageKey}에 저장했습니다.` : '로컬 저장소에 쓸 수 없어 현재 세션 메모리에만 보관합니다.',
        hasSavedRound: saved || sessionState.hasSavedRound,
      });
      return saved;
    },
    resetRound: () => {
      const nextRound = createDefaultBettingRound({ now: new Date().toISOString() });
      commitRound(nextRound, '새 골프 내기 라운드를 이 기기에 저장했습니다.');
    },
    clearSavedRound: () => {
      const cleared = clearBettingRound(storageProvider());
      setSessionState({
        ...sessionState,
        storageStatus: cleared ? 'cleared' : 'memory-only',
        storageMessage: cleared ? '이 기기에 저장된 골프 내기 라운드를 삭제했습니다.' : '삭제할 로컬 저장소를 사용할 수 없습니다.',
        hasSavedRound: cleared ? false : sessionState.hasSavedRound,
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
  const baseHole = existingHole ?? { holeNumber: normalizedHoleNumber, scores: [], events: [], missions: [] };
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

function upsertMission(missions: readonly BettingHoleMission[], mission: BettingHoleMission): readonly BettingHoleMission[] {
  return missions.some((item) => item.id === mission.id)
    ? missions.map((item) => (item.id === mission.id ? mission : item))
    : [...missions, mission];
}

function sanitizeMission(holeNumber: number, mission: BettingHoleMission): BettingHoleMission {
  const missionId = mission.missionId.trim() || 'mission-local';
  return {
    id: mission.id.trim() || missionEventId(holeNumber, missionId, mission.playerId),
    playerId: mission.playerId,
    missionId,
    title: mission.title.trim() || '오늘의 미션',
    points: clampInteger(mission.points, -100, 100),
    outcome: mission.outcome,
  };
}

function eventId(holeNumber: number, event: BettingEventKey, playerId: string): string {
  return `hole-${holeNumber}:${event}:${playerId}`;
}

function missionEventId(holeNumber: number, missionId: string, playerId: string): string {
  return `hole-${holeNumber}:mission:${missionId}:${playerId}`;
}

function defaultEventPoints(event: BettingEventKey): number {
  return eventBasePoints[event as BettingEventType];
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

export type { BettingEventKey, BettingGameKey, BettingHandicapMode, BettingMissionOutcome, BettingScoringMode };
