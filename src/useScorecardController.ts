import { useState } from 'react';

import {
  buildScorecardView,
  holeForNumber,
  maximumScorecardStrokes,
  relativeScoreLabel,
  scoreForPlayer,
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

  const parsedHoleNumber = parseIntegerDraft(currentHoleDraft, 1);
  const holeNumber = Math.min(round.settings.holeCount, Math.max(1, parsedHoleNumber));
  const activeNine: 'front' | 'back' = holeNumber > 9 ? 'back' : 'front';
  const firstHoleInActiveNine = activeNine === 'front' ? 1 : 10;
  const visibleHoleNumbers = Array.from(
    { length: Math.max(0, Math.min(9, round.settings.holeCount - firstHoleInActiveNine + 1)) },
    (_, index) => firstHoleInActiveNine + index,
  );
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
    setParDraftsByHole((current) => ({ ...current, [targetHoleNumber]: value }));
    selectHole(targetHoleNumber);
    commitIntegerDraft(value, (par) => session.updateHoleSetup(targetHoleNumber, { par }));
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
    session.updateHoleScore(holeNumber, playerId, { strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true });
  }

  function clearPlayerScore(playerId: string) {
    session.updateHoleScore(holeNumber, playerId, null);
  }

  function commitManualScore(playerId: string, value: string) {
    const parsedValue = parseEditableIntegerDraft(value);
    if (parsedValue !== null) {
      session.updateHoleScore(holeNumber, playerId, { strokes: clampInteger(parsedValue, 1, maximumScorecardStrokes), entryMode: 'manual' });
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
    const strokes = clampInteger(onGreenShots + putts, 1, maximumScorecardStrokes);
    session.updateHoleScore(holeNumber, playerId, { strokes, entryMode: 'on-putt', onGreenShots, putts });
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
    updatePutts,
    clearPlayerScore,
    visibleHoleNumbers,
  };
}

export function parseIntegerDraft(value: string, defaultValue: number): number {
  return parseEditableIntegerDraft(value) ?? defaultValue;
}

function commitIntegerDraft(value: string, commit: (parsedValue: number) => void) {
  const parsedValue = parseEditableIntegerDraft(value);

  if (parsedValue !== null) {
    commit(parsedValue);
  }
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}
