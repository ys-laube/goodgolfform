import { describe, expect, it } from 'vitest';
import { recommendShot } from './recommendationEngine';
import type { GolferProfile, ShotScenario, SwingRecommendation } from './swingLabModels';

const baselineProfile: GolferProfile = {
  id: 'profile-serious-friend',
  name: 'Serious friend',
  archetype: 'balanced striker',
  handicap: 11,
  tempoPreference: 'neutral',
  shotShape: 'draw',
  trajectoryPreference: 'standard',
  clubDistances: [
    { club: 'PW', carryMeters: 105 },
    { club: '9i', carryMeters: 118 },
    { club: '8i', carryMeters: 132 },
    { club: '7i', carryMeters: 146 },
    { club: '6i', carryMeters: 160 },
    { club: '5i', carryMeters: 174 },
  ],
};

const neutralScenario: ShotScenario = {
  targetDistanceMeters: 145,
  windDirection: 'none',
  windStrengthKph: 0,
  lie: 'fairway',
  desiredWindow: 'standard',
};

describe('swing-lab recommendation engine representative cases', () => {
  it('selects a plausible stock club with analysis-card contract fields for a neutral fairway shot', () => {
    const recommendation = recommendShot(baselineProfile, neutralScenario);

    expect(recommendation).toMatchObject({
      recommendedClub: '7i',
      stockCarryMeters: 146,
      effectiveDistanceMeters: 145,
      swingSizeLabel: 'stock',
      tempo: 'neutral',
      pathBias: 'draw-biased',
      trajectoryBias: 'standard',
    });
    expect(recommendation.swingSizePercent).toBeGreaterThanOrEqual(98);
    expect(recommendation.confidenceScore).toBeGreaterThan(80);
    expect(recommendation.trajectoryStrategy).toMatch(/flight window/i);
    expect(recommendation.why).toHaveLength(3);
  });

  it('changes club, tempo, trajectory, confidence, and why text for a headwind rough case', () => {
    const neutral = recommendShot(baselineProfile, neutralScenario);
    const headwindRough = recommendShot(baselineProfile, {
      targetDistanceMeters: 145,
      windDirection: 'headwind',
      windStrengthKph: 18,
      lie: 'rough',
      desiredWindow: 'low',
    });

    expect(headwindRough.recommendedClub).not.toBe(neutral.recommendedClub);
    expect(headwindRough.effectiveDistanceMeters).toBeGreaterThan(neutral.effectiveDistanceMeters);
    expect(headwindRough.tempo).toBe('assertive');
    expect(headwindRough.trajectoryBias).toBe('lower');
    expect(headwindRough.confidenceScore).toBeLessThan(neutral.confidenceScore);
    expect(headwindRough.adjustments.map((adjustment) => adjustment.label)).toEqual([
      'wind:headwind',
      'lie:rough',
    ]);
    expect(headwindRough.why.join(' ')).toMatch(/rough lie/i);
  });

  it('changes swing size, path bias, and trajectory for a tailwind cross-window profile variant', () => {
    const fadeProfile = { ...baselineProfile, shotShape: 'fade' as const, tempoPreference: 'smooth' as const };
    const recommendation = recommendShot(fadeProfile, {
      targetDistanceMeters: 138,
      windDirection: 'tailwind',
      windStrengthKph: 14,
      lie: 'firm',
      desiredWindow: 'high',
    });

    expect(recommendation.recommendedClub).toBe('8i');
    expect(recommendation.swingSizeLabel).toBe('stock');
    expect(recommendation.tempo).toBe('smooth');
    expect(recommendation.pathBias).toBe('fade-biased');
    expect(recommendation.trajectoryBias).toBe('higher');
    expect(recommendation.effectiveDistanceMeters).toBeLessThan(128);
  });
});

describe('recommendation integration contracts', () => {
  it('is deterministic, side-effect free, and keeps outputs provider/backend independent', () => {
    const first = recommendShot(baselineProfile, neutralScenario);
    const second = recommendShot(structuredClone(baselineProfile), structuredClone(neutralScenario));

    expect(second).toEqual(first);
    expect(Object.keys(first).sort()).toEqual([
      'adjustments',
      'confidenceScore',
      'distanceGapMeters',
      'effectiveDistanceMeters',
      'pathBias',
      'recommendedClub',
      'stockCarryMeters',
      'swingSizeLabel',
      'swingSizePercent',
      'tempo',
      'tempoRating',
      'trajectoryBias',
      'trajectoryStrategy',
      'why',
    ].sort());
  });

  it('guards the no-visible-disclaimer tone by avoiding command-like or guarantee copy', () => {
    const recommendation = recommendShot(baselineProfile, {
      targetDistanceMeters: 168,
      windDirection: 'crosswind-left',
      windStrengthKph: 20,
      lie: 'soft',
      desiredWindow: 'standard',
    });

    const copy = recommendationCopy(recommendation);

    expect(copy).toMatch(/analysis-card/i);
    expect(copy).not.toMatch(/\b(must|guarantee|guaranteed|exact|official|disclaimer|legal notice)\b/i);
  });

  it('rejects malformed profile and scenario inputs before creating a recommendation', () => {
    expect(() => recommendShot({ ...baselineProfile, clubDistances: [] }, neutralScenario)).toThrow(/club distance/i);
    expect(() => recommendShot(baselineProfile, { ...neutralScenario, targetDistanceMeters: 0 })).toThrow(/target distance/i);
    expect(() => recommendShot(baselineProfile, { ...neutralScenario, windStrengthKph: -1 })).toThrow(/wind strength/i);
  });
});

function recommendationCopy(recommendation: SwingRecommendation): string {
  return [
    recommendation.trajectoryStrategy,
    recommendation.swingSizeLabel,
    recommendation.tempo,
    recommendation.pathBias,
    ...recommendation.why,
  ].join(' ');
}
