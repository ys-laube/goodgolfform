import { useMemo, useState } from 'react';

import { availableLocalStorage } from './browserEnvironment';
import {
  applyHoleMemoMutation,
  applyHoleScoreMutation,
  applyHoleSetupMutation,
  applyPlayerCountMutation,
  applyPlayerMutation,
  applyRoundSetupMutation,
  createDefaultScorecardRound,
  type ScorecardHoleScoreInput,
  type ScorecardPlayer,
  type ScorecardRound,
  type ScorecardRoundSettings,
} from './domain/scorecard';
import {
  clearScorecardRound,
  createBlankStoredScorecardRound,
  loadScorecardRound,
  saveScorecardRound,
  type StorageLike,
} from './domain/scorecardStorage';

type SessionStorageStatus = 'loaded' | 'default' | 'memory-only' | 'saved' | 'cleared';

export type ScorecardRoundSessionState = {
  readonly round: ScorecardRound;
  readonly storageStatus: SessionStorageStatus;
  readonly storageMessage: string;
  readonly hasSavedRound: boolean;
};

export type ScorecardRoundSession = ScorecardRoundSessionState & {
  readonly updateRoundSetup: (patch: Partial<Pick<ScorecardRoundSettings, 'holeCount'>>) => void;
  readonly setPlayerCount: (playerCount: number) => void;
  readonly updatePlayer: (playerId: string, patch: Partial<Pick<ScorecardPlayer, 'name'>>) => void;
  readonly updateHoleSetup: (holeNumber: number, patch: { readonly par?: number }) => void;
  readonly updateHoleScore: (holeNumber: number, playerId: string, score: ScorecardHoleScoreInput | null) => void;
  readonly updateHoleMemo: (holeNumber: number, memo: string) => void;
  readonly saveRound: () => boolean;
  readonly resetRound: () => void;
  readonly clearSavedRound: () => boolean;
};

export function createInitialScorecardRoundSessionState(storage: StorageLike | undefined, now = new Date().toISOString()): ScorecardRoundSessionState {
  const savedRound = loadScorecardRound(storage);

  if (savedRound) {
    return {
      round: savedRound,
      storageStatus: 'loaded',
      storageMessage: '이 기기에 저장된 스코어카드를 불러왔습니다.',
      hasSavedRound: true,
    };
  }

  const round = createDefaultScorecardRound({ now, playerCount: 1 });
  return {
    round,
    storageStatus: storage ? 'default' : 'memory-only',
    storageMessage: storage ? '새 스코어카드를 시작합니다. 입력 내용은 이 기기에만 저장됩니다.' : '로컬 저장소를 사용할 수 없어 현재 화면에만 보관합니다.',
    hasSavedRound: false,
  };
}

export function useScorecardSession(inputStorage?: StorageLike): ScorecardRoundSession {
  const storage = useMemo(() => inputStorage ?? availableLocalStorage(), [inputStorage]);
  const [state, setState] = useState(() => createInitialScorecardRoundSessionState(storage));

  function commitRound(nextRound: ScorecardRound) {
    const saved = saveScorecardRound(storage, nextRound);
    setState({
      round: nextRound,
      storageStatus: saved ? 'saved' : storage ? 'default' : 'memory-only',
      storageMessage: saved ? '입력 내용을 이 기기에 저장했습니다.' : '현재 화면에는 반영됐지만 자동 저장은 사용할 수 없습니다.',
      hasSavedRound: saved || state.hasSavedRound,
    });
  }

  function updateRoundSetup(patch: Partial<Pick<ScorecardRoundSettings, 'holeCount'>>) {
    commitRound(applyRoundSetupMutation(state.round, patch));
  }

  function setPlayerCount(playerCount: number) {
    commitRound(applyPlayerCountMutation(state.round, playerCount));
  }

  function updatePlayer(playerId: string, patch: Partial<Pick<ScorecardPlayer, 'name'>>) {
    commitRound(applyPlayerMutation(state.round, playerId, patch));
  }

  function updateHoleSetup(holeNumber: number, patch: { readonly par?: number }) {
    commitRound(applyHoleSetupMutation(state.round, holeNumber, patch));
  }

  function updateHoleScore(holeNumber: number, playerId: string, score: ScorecardHoleScoreInput | null) {
    commitRound(applyHoleScoreMutation(state.round, holeNumber, playerId, score));
  }

  function updateHoleMemo(holeNumber: number, memo: string) {
    commitRound(applyHoleMemoMutation(state.round, holeNumber, memo));
  }

  function saveRound(): boolean {
    const saved = saveScorecardRound(storage, state.round);
    setState((current) => ({
      ...current,
      storageStatus: saved ? 'saved' : current.storageStatus,
      storageMessage: saved ? '현재 스코어카드를 이 기기에 저장했습니다.' : '로컬 저장소 저장에 실패했습니다.',
      hasSavedRound: saved || current.hasSavedRound,
    }));
    return saved;
  }

  function resetRound() {
    const nextRound = createBlankStoredScorecardRound(new Date().toISOString());
    saveScorecardRound(storage, nextRound);
    setState({
      round: nextRound,
      storageStatus: storage ? 'cleared' : 'memory-only',
      storageMessage: '새 라운드를 시작했습니다. 이름, 점수, 메모를 모두 비웠습니다.',
      hasSavedRound: Boolean(storage),
    });
  }

  function clearSavedRound(): boolean {
    const cleared = clearScorecardRound(storage);
    const nextRound = createBlankStoredScorecardRound(new Date().toISOString());
    setState({
      round: nextRound,
      storageStatus: cleared ? 'cleared' : 'memory-only',
      storageMessage: cleared ? '저장된 스코어카드를 지우고 빈 라운드로 돌아왔습니다.' : '저장된 스코어카드를 지우지 못했습니다.',
      hasSavedRound: false,
    });
    return cleared;
  }

  return {
    ...state,
    updateRoundSetup,
    setPlayerCount,
    updatePlayer,
    updateHoleSetup,
    updateHoleScore,
    updateHoleMemo,
    saveRound,
    resetRound,
    clearSavedRound,
  };
}
