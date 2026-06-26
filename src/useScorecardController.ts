import { useState } from 'react';

import { maximumHoleScoreStrokes, type BettingHoleResult, type BettingRound } from './domain/bettingStorage';
import { parseEditableIntegerDraft } from './inputDrafts';

type ScorecardControllerOptions = {
  readonly round: BettingRound;
  readonly updateHoleSetup: (holeNumber: number, patch: Partial<Pick<BettingHoleResult, 'par' | 'backdoorOpen'>>) => void;
  readonly updateHoleScore: (holeNumber: number, playerId: string, strokes: number) => void;
  readonly markDirty: () => void;
};

export function useScorecardController({ round, updateHoleSetup, updateHoleScore, markDirty }: ScorecardControllerOptions) {
  const [currentHoleDraft, setCurrentHoleDraft] = useState('');
  const [parDraftsByHole, setParDraftsByHole] = useState<Record<number, string>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});

  const holeNumber = Math.min(round.settings.holeCount, Math.max(1, parseIntegerDraft(currentHoleDraft, 1)));
  const holeParDraft = parInputValue(holeNumber);
  const holePar = clampInteger(parseIntegerDraft(holeParDraft, 4), 3, 5);
  const scoreChoices = scoreChoicesForPar(holePar);
  const backdoorOpen = backdoorOpenForHole(holeNumber);
  const activeNine: 'front' | 'back' = holeNumber > 9 ? 'back' : 'front';
  const firstHoleInActiveNine = activeNine === 'front' ? 1 : 10;
  const visibleHoleNumbers = Array.from(
    { length: Math.max(0, Math.min(9, round.settings.holeCount - firstHoleInActiveNine + 1)) },
    (_, index) => firstHoleInActiveNine + index,
  );

  function storedHole(targetHoleNumber: number) {
    return round.holes.find((hole) => hole.holeNumber === targetHoleNumber);
  }

  function parInputValue(targetHoleNumber: number): string {
    return parDraftsByHole[targetHoleNumber] ?? (storedHole(targetHoleNumber)?.par ?? 4).toString();
  }

  function parForHole(targetHoleNumber: number): number {
    return clampInteger(parseIntegerDraft(parInputValue(targetHoleNumber), 4), 3, 5);
  }

  function backdoorOpenForHole(targetHoleNumber: number): boolean {
    return storedHole(targetHoleNumber)?.backdoorOpen ?? false;
  }

  function scoreInputValue(playerId: string): string {
    const draftKey = `${holeNumber}:${playerId}`;
    return scoreDrafts[draftKey] ?? scoreForPlayer(round, holeNumber, playerId)?.toString() ?? '';
  }

  function scorecardCellLabel(targetHoleNumber: number, playerId: string): string {
    const targetPar = parForHole(targetHoleNumber);
    const strokes = scoreForPlayer(round, targetHoleNumber, playerId);

    return strokes ? `${scoreChoiceLabel(strokes, targetPar)} · ${strokes}타` : '—';
  }

  function updateHoleDraft(value: string) {
    setCurrentHoleDraft(value);
    markDirty();
  }

  function updateParDraft(value: string) {
    updateParDraftForHole(holeNumber, value);
  }

  function updateParDraftForHole(targetHoleNumber: number, value: string) {
    setParDraftsByHole((current) => ({ ...current, [targetHoleNumber]: value }));
    setCurrentHoleDraft(targetHoleNumber.toString());
    markDirty();
    commitIntegerDraft(value, (par) => updateHoleSetup(targetHoleNumber, { par }));
  }

  function toggleBackdoorOpen() {
    toggleBackdoorOpenForHole(holeNumber);
  }

  function toggleBackdoorOpenForHole(targetHoleNumber: number) {
    setCurrentHoleDraft(targetHoleNumber.toString());
    markDirty();
    updateHoleSetup(targetHoleNumber, { backdoorOpen: !backdoorOpenForHole(targetHoleNumber) });
  }

  function updateScoreDraft(playerId: string, value: string) {
    const draftKey = `${holeNumber}:${playerId}`;
    setScoreDrafts((current) => ({ ...current, [draftKey]: value }));
    markDirty();

    if (value === '') {
      return;
    }

    if (/^\d{1,2}$/.test(value)) {
      const normalizedScore = clampInteger(parseIntegerDraft(value, holePar + 1), 1, maximumHoleScoreStrokes);
      setScoreDrafts((current) => ({ ...current, [draftKey]: normalizedScore.toString() }));
      updateHoleScore(holeNumber, playerId, normalizedScore);
    }
  }

  function updateScoreButton(playerId: string, strokes: number) {
    const normalizedScore = clampInteger(strokes, 1, maximumHoleScoreStrokes);
    const draftKey = `${holeNumber}:${playerId}`;
    setScoreDrafts((current) => ({ ...current, [draftKey]: normalizedScore.toString() }));
    markDirty();
    updateHoleScore(holeNumber, playerId, normalizedScore);
  }

  function resetScorecardDrafts() {
    setCurrentHoleDraft('');
    setParDraftsByHole({});
    setScoreDrafts({});
  }

  return {
    activeNine,
    backdoorOpen,
    backdoorOpenForHole,
    currentHoleDraft,
    holeNumber,
    holePar,
    holeParDraft,
    parForHole,
    parInputValue,
    resetScorecardDrafts,
    scoreChoices,
    scoreInputValue,
    scorecardCellLabel,
    toggleBackdoorOpen,
    toggleBackdoorOpenForHole,
    updateHoleDraft,
    updateParDraft,
    updateParDraftForHole,
    updateScoreButton,
    updateScoreDraft,
    visibleHoleNumbers,
  };
}

export function parseIntegerDraft(value: string, fallback: number): number {
  return parseEditableIntegerDraft(value) ?? fallback;
}

export function scoreForPlayer(round: BettingRound, holeNumber: number, playerId: string): number | undefined {
  return round.holes
    .find((hole) => hole.holeNumber === holeNumber)
    ?.scores.find((score) => score.playerId === playerId)?.strokes;
}

export function scoreChoiceLabel(strokes: number, holePar: number): string {
  return relativeScoreLabel(strokes - holePar);
}

export function scoreChoiceHint(strokes: number, holePar: number): string {
  if (strokes === 1) {
    return '홀인원 · 1타';
  }

  if (strokes === holePar * 2) {
    return `더블파 · ${strokes}타`;
  }

  return `${strokes}타`;
}

export function scoreSummary(strokes: number, holePar: number): string {
  if (strokes <= 0) {
    return '미입력';
  }

  const relativeLabel = relativeScoreLabel(strokes - holePar);

  if (strokes === holePar * 2) {
    return `${strokes}타 · ${relativeLabel} 더블파`;
  }

  if (strokes > holePar * 2) {
    return `${strokes}타 · 뒷문 ${relativeLabel}`;
  }

  return `${strokes}타 · ${relativeLabel}`;
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

function relativeScoreLabel(relativeScore: number): string {
  if (relativeScore === 0) {
    return '파';
  }

  return relativeScore > 0 ? `+${relativeScore}` : `${relativeScore}`;
}

function scoreChoicesForPar(holePar: number): readonly number[] {
  return Array.from({ length: holePar * 2 }, (_, index) => index + 1);
}
