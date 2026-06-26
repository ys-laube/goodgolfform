import { describe, expect, it } from 'vitest';

import {
  holeInOneScoreInput,
  manualScoreInputFromDraft,
  normalizeParDraft,
  onPuttScoreInput,
  scorecardNavigationState,
} from './useScorecardController';

describe('scorecard controller pure behavior', () => {
  it('normalizes selected-hole navigation into front/back visible holes', () => {
    expect(scorecardNavigationState('1', 18)).toEqual({ activeNine: 'front', holeNumber: 1, visibleHoleNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(scorecardNavigationState('12', 18)).toEqual({ activeNine: 'back', holeNumber: 12, visibleHoleNumbers: [10, 11, 12, 13, 14, 15, 16, 17, 18] });
    expect(scorecardNavigationState('99', 12)).toEqual({ activeNine: 'back', holeNumber: 12, visibleHoleNumbers: [10, 11, 12] });
  });

  it('keeps par draft clearing possible while clamping numeric values', () => {
    expect(normalizeParDraft('')).toBeNull();
    expect(normalizeParDraft('2')).toBe(3);
    expect(normalizeParDraft('4')).toBe(4);
    expect(normalizeParDraft('9')).toBe(5);
  });

  it('builds normalized on/putt, hole-in-one, and manual score inputs', () => {
    expect(onPuttScoreInput(2, 2)).toEqual({ strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2 });
    expect(onPuttScoreInput(0, 99)).toEqual({ strokes: 10, entryMode: 'on-putt', onGreenShots: 1, putts: 9 });
    expect(holeInOneScoreInput()).toEqual({ strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true });
    expect(manualScoreInputFromDraft('')).toBeNull();
    expect(manualScoreInputFromDraft('99')).toEqual({ strokes: 20, entryMode: 'manual' });
  });
});
