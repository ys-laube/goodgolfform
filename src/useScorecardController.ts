import { useState } from 'react';

import {
  buildScorecardView,
  holeForNumber,
  maximumScorecardStrokes,
  relativeScoreLabel,
  scoreForPlayer,
  type ScorecardHoleScoreInput,
  type ScorecardHoleScore,
  type ScorecardRound,
} from './domain/scorecard';
import { parseEditableIntegerDraft } from './inputDrafts';
import type { ScorecardRoundSession } from './useScorecardSession';

type ScorecardControllerOptions = {
  readonly round: ScorecardRound;
  readonly session: Pick<ScorecardRoundSession, 'updateHoleSetup' | 'updateHoleScore' | 'updateHoleMemo'>;
};

export function useScorecardController({ round, session }: ScorecardControllerOptions) {
  const [currentHoleDraft, setCurrentHoleDraft] = useState('1');
  const [parDraftsByHole, setParDraftsByHole] = useState<Record<number, string>>({});
  const [memoDraftsByHole, setMemoDraftsByHole] = useState<Record<number, string>>({});

  const navigation = scorecardNavigationState(currentHoleDraft, round.settings.holeCount);
  const { activeNine, holeNumber, visibleHoleNumbers } = navigation;
  const roundView = buildScorecardView(round);

  function selectHole(targetHoleNumber: number) {
    setCurrentHoleDraft(Math.min(round.settings.holeCount, Math.max(1, targetHoleNumber)).toString());
  }

  function parInputValue(targetHoleNumber: number): string {
    return parDraftsByHole[targetHoleNumber] ?? holeForNumber(round, targetHoleNumber).par.toString();
  }

  function parForHole(targetHoleNumber: number): number {
    return clampInteger(parseIntegerDraft(parInputValue(targetHoleNumber), 4), 3, 5);
  }

  function updateParDraftForHole(targetHoleNumber: number, value: string) {
    selectHole(targetHoleNumber);
    const normalizedPar = normalizeParDraft(value);
    if (normalizedPar === null) {
      setParDraftsByHole((current) => ({ ...current, [targetHoleNumber]: value }));
      return;
    }
    setParDraftsByHole((current) => ({ ...current, [targetHoleNumber]: normalizedPar.toString() }));
    session.updateHoleSetup(targetHoleNumber, { par: normalizedPar });
  }

  function normalizeParDraftForHole(targetHoleNumber: number) {
    setParDraftsByHole((current) => ({ ...current, [targetHoleNumber]: holeForNumber(round, targetHoleNumber).par.toString() }));
  }

  function memoInputValue(targetHoleNumber = holeNumber): string {
    return memoDraftsByHole[targetHoleNumber] ?? holeForNumber(round, targetHoleNumber).memo;
  }

  function updateMemoDraft(targetHoleNumber: number, value: string) {
    setMemoDraftsByHole((current) => ({ ...current, [targetHoleNumber]: value }));
    selectHole(targetHoleNumber);
    session.updateHoleMemo(targetHoleNumber, value);
  }

  function updateOnGreenShots(playerId: string, onGreenShots: number) {
    const currentScore = scoreForPlayer(round, holeNumber, playerId);
    const normalizedOn = clampInteger(onGreenShots, 1, 9);
    const putts = currentScore?.entryMode === 'on-putt' && currentScore.putts !== undefined ? currentScore.putts : 2;
    commitOnPuttScore(playerId, normalizedOn, putts);
  }

  function updatePutts(playerId: string, putts: number) {
    const currentScore = scoreForPlayer(round, holeNumber, playerId);
    const onGreenShots = currentScore?.entryMode === 'on-putt' && currentScore.onGreenShots !== undefined ? currentScore.onGreenShots : 2;
    commitOnPuttScore(playerId, onGreenShots, clampInteger(putts, 0, 9));
  }

  function updateHoleInOne(playerId: string) {
    session.updateHoleScore(holeNumber, playerId, holeInOneScoreInput());
  }

  function clearPlayerScore(playerId: string) {
    session.updateHoleScore(holeNumber, playerId, null);
  }

  function commitManualScore(playerId: string, value: string) {
    const score = manualScoreInputFromDraft(value);
    if (score !== null) {
      session.updateHoleScore(holeNumber, playerId, score);
    }
  }

  function scorecardCellLabel(targetHoleNumber: number, playerId: string): string {
    return roundView.holes.find((hole) => hole.holeNumber === targetHoleNumber)?.cells.find((cell) => cell.playerId === playerId)?.main ?? '—';
  }

  function scorecardCellSubLabel(targetHoleNumber: number, playerId: string): string {
    return roundView.holes.find((hole) => hole.holeNumber === targetHoleNumber)?.cells.find((cell) => cell.playerId === playerId)?.sub ?? '';
  }

  function relativeScoreForPlayer(targetHoleNumber: number, playerId: string): string {
    const score = scoreForPlayer(round, targetHoleNumber, playerId);
    if (!score) {
      return '—';
    }
    return relativeScoreLabel(score.strokes - parForHole(targetHoleNumber));
  }

  function commitOnPuttScore(playerId: string, onGreenShots: number, putts: number) {
    session.updateHoleScore(holeNumber, playerId, onPuttScoreInput(onGreenShots, putts));
  }

  function resetScorecardDrafts() {
    setCurrentHoleDraft('1');
    setParDraftsByHole({});
    setMemoDraftsByHole({});
  }

  return {
    activeNine,
    currentHoleDraft,
    holeNumber,
    memoInputValue,
    parForHole,
    parInputValue,
    relativeScoreForPlayer,
    resetScorecardDrafts,
    roundView,
    scoreForPlayer: (targetHoleNumber: number, playerId: string): ScorecardHoleScore | undefined => scoreForPlayer(round, targetHoleNumber, playerId),
    scorecardCellLabel,
    scorecardCellSubLabel,
    selectHole,
    updateHoleDraft: (value: string) => setCurrentHoleDraft(value),
    updateHoleInOne,
    updateManualScore: commitManualScore,
    updateMemoDraft,
    updateOnGreenShots,
    updateParDraftForHole,
    normalizeParDraftForHole,
    updatePutts,
    clearPlayerScore,
    visibleHoleNumbers,
  };
}

export type ScorecardNavigationState = {
  readonly activeNine: 'front' | 'back';
  readonly holeNumber: number;
  readonly visibleHoleNumbers: readonly number[];
};

export function scorecardNavigationState(currentHoleDraft: string, holeCount: number): ScorecardNavigationState {
  const normalizedHoleCount = clampInteger(holeCount, 1, 18);
  const parsedHoleNumber = parseIntegerDraft(currentHoleDraft, 1);
  const holeNumber = clampInteger(parsedHoleNumber, 1, normalizedHoleCount);
  const activeNine: 'front' | 'back' = holeNumber > 9 ? 'back' : 'front';
  const firstHoleInActiveNine = activeNine === 'front' ? 1 : 10;
  const visibleHoleNumbers = Array.from(
    { length: Math.max(0, Math.min(9, normalizedHoleCount - firstHoleInActiveNine + 1)) },
    (_, index) => firstHoleInActiveNine + index,
  );

  return { activeNine, holeNumber, visibleHoleNumbers };
}

export function parseIntegerDraft(value: string, defaultValue: number): number {
  return parseEditableIntegerDraft(value) ?? defaultValue;
}

export function normalizeParDraft(value: string): number | null {
  const parsedValue = parseEditableIntegerDraft(value);
  return parsedValue === null ? null : clampInteger(parsedValue, 3, 5);
}

export function onPuttScoreInput(onGreenShots: number, putts: number): ScorecardHoleScoreInput {
  const normalizedOnGreenShots = clampInteger(onGreenShots, 1, 9);
  const normalizedPutts = clampInteger(putts, 0, 9);
  const strokes = clampInteger(normalizedOnGreenShots + normalizedPutts, 1, maximumScorecardStrokes);
  return { strokes, entryMode: 'on-putt', onGreenShots: normalizedOnGreenShots, putts: normalizedPutts };
}

export function holeInOneScoreInput(): ScorecardHoleScoreInput {
  return { strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true };
}

export function manualScoreInputFromDraft(value: string): ScorecardHoleScoreInput | null {
  const parsedValue = parseEditableIntegerDraft(value);
  return parsedValue === null ? null : { strokes: clampInteger(parsedValue, 1, maximumScorecardStrokes), entryMode: 'manual' };
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}
