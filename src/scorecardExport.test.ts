import { describe, expect, it } from 'vitest';

import { applyHoleMemoMutation, applyHoleScoreMutation, buildScorecardView, createDefaultScorecardRound } from './domain/scorecard';
import { createScorecardExportSvg, scorecardExportFileName } from './scorecardExport';

describe('scorecard SVG export', () => {
  it('exports full scorecard language, relative cells, on/putt annotations, and non-empty memos', () => {
    let round = createDefaultScorecardRound({ now: '2026-06-27T00:00:00.000Z' });
    round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2 });
    round = applyHoleMemoMutation(round, 1, '첫 홀 안정적인 2온 2펏');

    const svg = createScorecardExportSvg({
      roundName: '주말 라운드',
      courseName: '남코스',
      generatedAt: '2026-06-27T00:00:00.000Z',
      view: buildScorecardView(round),
    });

    expect(svg).toContain('스코어카드');
    expect(svg).toContain('홀 메모');
    expect(svg).toContain('2온 2펏');
    expect(svg).toContain('온 2 · 펏 2');
    expect(svg).toContain('>0<');
    expect(svg).not.toContain('오장');
    expect(svg).not.toContain('QR');
  });

  it('creates Korean-safe SVG filenames', () => {
    expect(scorecardExportFileName('남서울 OUT', '2026-06-27T00:00:00.000Z')).toBe('남서울-OUT-2026-06-27.svg');
  });
});
