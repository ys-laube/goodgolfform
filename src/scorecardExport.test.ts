import { describe, expect, it } from 'vitest';

import { createScorecardExportSvg, scorecardExportFileName } from './scorecardExport';

describe('local scorecard SVG export', () => {
  it('creates a deterministic local SVG artifact from scorecard data', () => {
    const svg = createScorecardExportSvg({
      roundName: '금요 <라운드>',
      courseName: '남서울 & OUT',
      summary: '민수 +₩10,000 / 지훈 -₩10,000',
      generatedAt: '2026-06-26T08:00:00.000Z',
      players: [
        { name: '민수', team: '청팀', balance: '+₩10,000' },
        { name: '지훈', team: '백팀', balance: '-₩10,000' },
      ],
      holes: [
        { holeNumber: 1, par: 4, backdoorOpen: false, playerScores: ['파 · 4타', '+1 · 5타'] },
        { holeNumber: 2, par: 5, backdoorOpen: true, playerScores: ['-1 · 4타', '뒷문 +5'] },
      ],
    });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('남서울 &amp; OUT');
    expect(svg).toContain('금요 &lt;라운드&gt;');
    expect(svg).toContain('전통 오장 스코어카드 · 로컬 내보내기');
    expect(svg).toContain('fill="#101828">1H');
    expect(svg).toContain('뒷문');
    expect(svg).toContain('오픈');
    expect(svg).toContain('파 · 4타');
    expect(svg).not.toContain('.cell{font-size:15px;font-weight:900;fill');
    expect(svg).not.toContain('펀골프 정산 장부');
    expect(svg).not.toContain('<script');
  });


  it('does not invent fallback player names when exported names are blank', () => {
    const svg = createScorecardExportSvg({
      roundName: '',
      courseName: '',
      summary: '1H 정산',
      generatedAt: '2026-06-26T08:00:00.000Z',
      players: [{ name: '', team: '청팀', balance: '₩0' }],
      holes: [{ holeNumber: 1, par: 4, backdoorOpen: false, playerScores: ['—'] }],
    });

    expect(svg).not.toContain('플레이어 1');
    expect(svg).toContain('> · 청팀 ₩0<');
  });

  it('creates a safe Korean-friendly file name', () => {
    expect(scorecardExportFileName('남서울 / OUT', '2026-06-26T08:00:00.000Z')).toBe('남서울-OUT-2026-06-26.svg');
    expect(scorecardExportFileName('', '2026-06-26T08:00:00.000Z')).toBe('fungolf-scorecard-2026-06-26.svg');
  });
});
