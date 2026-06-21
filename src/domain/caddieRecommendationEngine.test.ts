import { describe, expect, it } from 'vitest';
import { createCaddieDistancePreset } from './caddiePresets';
import { recommendCaddieApproach, selectCaddieClubForPlayDistance, type CaddieApproachScenario } from './caddieRecommendationEngine';

const preset = createCaddieDistancePreset({
  id: 'preset-task-3-100m',
  name: '100m 검증 거리',
  anchorDistances: { driver: 220, sevenIron: 140, pitchingWedge: 100 },
  updatedAt: '2026-06-21T00:00:00.000Z',
});

const baseline100m: CaddieApproachScenario = {
  targetDistanceMeters: 100,
  slope: 'level',
  pinPosition: 'middle',
  greenRisk: 'low',
};

describe('caddie approach recommendation engine', () => {
  it('returns a representative 100m recommendation from local distance presets', () => {
    const recommendation = recommendCaddieApproach(preset, baseline100m);

    expect(recommendation.targetDistanceMeters).toBe(100);
    expect(recommendation.playDistanceMeters).toBe(100);
    expect(recommendation.selectedClub).toBe('pw');
    expect(recommendation.clubLabel).toBe('피칭 웨지');
    expect(recommendation.swingPercent).toBe(100);
    expect(recommendation.summary).toContain('100 m 플레이 거리');
    expect(recommendation.landingWindow).toBe('그린 중앙 구역');
    expect(recommendation.adjustments).toEqual([]);
  });



  it('selects a control club whose swing percent stays close to the play distance', () => {
    const selection = selectCaddieClubForPlayDistance(preset, 103, { preferControl: true });
    const carriedMeters = Math.round((selection.carryMeters * selection.swingPercent) / 100);

    expect(selection.selectedClub).toBe('9i');
    expect(selection.swingPercent).toBeGreaterThanOrEqual(88);
    expect(selection.swingPercent).toBeLessThanOrEqual(92);
    expect(Math.abs(carriedMeters - 103)).toBeLessThanOrEqual(2);
  });

  it('moves play distance longer for uphill/back/high-risk greens and lowers confidence', () => {
    const baseline = recommendCaddieApproach(preset, baseline100m);
    const guardedBack = recommendCaddieApproach(preset, {
      targetDistanceMeters: 100,
      slope: 'uphill',
      pinPosition: 'back',
      greenRisk: 'high',
    });

    expect(guardedBack.playDistanceMeters).toBe(114);
    expect(guardedBack.playDistanceMeters).toBeGreaterThan(baseline.playDistanceMeters);
    expect(guardedBack.selectedClub).toBe('8i');
    expect(guardedBack.confidenceScore).toBeLessThan(baseline.confidenceScore);
    expect(guardedBack.landingWindow).toBe('그린 중앙 안전 구역');
    expect(guardedBack.adjustments.map((adjustment) => adjustment.label)).toEqual(['경사', '핀', '그린 리스크']);
  });

  it('moves play distance shorter for downhill/front pins while preserving risk landing behavior', () => {
    const frontRisk = recommendCaddieApproach(preset, {
      targetDistanceMeters: 100,
      slope: 'downhill',
      pinPosition: 'front',
      greenRisk: 'high',
    });

    expect(frontRisk.playDistanceMeters).toBe(96);
    expect(frontRisk.selectedClub).toBe('pw');
    expect(frontRisk.swingPercent).toBe(96);
    expect(frontRisk.landingWindow).toBe('그린 앞쪽 안전 구역');
    expect(frontRisk.adjustments).toEqual([
      { label: '경사', meters: -5, reason: '내리막 보정' },
      { label: '핀', meters: -3, reason: '앞핀 핀 위치 보정' },
      { label: '그린 리스크', meters: 4, reason: '높은 그린 리스크 완충' },
    ]);
  });

  it('clamps abnormal target distances into the supported approach range', () => {
    expect(recommendCaddieApproach(preset, { ...baseline100m, targetDistanceMeters: Number.NaN }).targetDistanceMeters).toBe(100);
    expect(recommendCaddieApproach(preset, { ...baseline100m, targetDistanceMeters: 12 }).targetDistanceMeters).toBe(30);
    expect(recommendCaddieApproach(preset, { ...baseline100m, targetDistanceMeters: 400 }).targetDistanceMeters).toBe(330);
  });
});
