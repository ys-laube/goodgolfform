import { describe, expect, it } from 'vitest';
import { builtInProfilePresets } from './profilePresets';
import { recommendShot } from './recommendationEngine';
import type { ShotScenario } from './swingLabModels';

const baselineScenario: ShotScenario = {
  targetDistanceMeters: 142,
  windDirection: 'none',
  windStrength: 'calm',
  lie: 'fairway',
  desiredWindow: 'standard',
};

describe('recommendation engine', () => {
  it('chooses a plausible baseline club and emits required analysis fields', () => {
    const recommendation = recommendShot(builtInProfilePresets[0], baselineScenario);

    expect(recommendation.selectedClub).toBe('7i');
    expect(recommendation.distanceFeel).toMatch(/7번 아이언 100% 프로필 거리창/);
    expect(recommendation.swingSizeLabel).toBe('풀 스톡');
    expect(recommendation.trajectoryStrategy).toBe('standard-window');
    expect(recommendation.why.join(' ')).toMatch(/보정 목표/i);
    expect(recommendation.gameMetricLabel).toMatch(/적합도/i);
    expect(recommendation.distanceFeel).toContain(recommendation.clubLabel);
    expect(recommendation.swingSizeLabel).toBeTruthy();
    expect(recommendation.tempoRating).toBeGreaterThan(0);
    expect(recommendation.confidenceScore).toBeGreaterThanOrEqual(52);
    expect(recommendation.why).toHaveLength(3);
  });

  it('adjusts swing size for between-club distances', () => {
    const recommendation = recommendShot(builtInProfilePresets[0], {
      ...baselineScenario,
      targetDistanceMeters: 135,
    });

    expect(recommendation.selectedClub).toBe('7i');
    expect(recommendation.swingSizePercent).toBeLessThan(100);
    expect(recommendation.swingSizeLabel).toBe('컨트롤');
  });

  it('changes trajectory and tempo for headwind, tailwind, and crosswind scenarios', () => {
    const headwind = recommendShot(builtInProfilePresets[0], {
      ...baselineScenario,
      windDirection: 'headwind',
      windStrength: 'strong',
      desiredWindow: 'low',
    });
    const tailwind = recommendShot(builtInProfilePresets[0], {
      ...baselineScenario,
      windDirection: 'tailwind',
      windStrength: 'steady',
      desiredWindow: 'high',
    });
    const crosswind = recommendShot(builtInProfilePresets[0], {
      ...baselineScenario,
      windDirection: 'left-to-right',
      windStrength: 'steady',
    });

    expect(headwind.adjustedDistanceMeters).toBeGreaterThan(tailwind.adjustedDistanceMeters);
    expect(headwind.tempo).toBe('smooth');
    expect(headwind.trajectoryStrategy).toBe('flighted');
    expect(tailwind.trajectoryStrategy).toBe('launch-higher');
    expect(crosswind.pathBias).toBe('draw-biased');
  });

  it('responds to representative profile and scenario changes', () => {
    const baseline = recommendShot(builtInProfilePresets[0], baselineScenario);
    const longHeadwind = recommendShot(builtInProfilePresets[0], {
      ...baselineScenario,
      targetDistanceMeters: 165,
      windDirection: 'headwind',
      windStrength: 'steady',
    });
    const smoothDraw = recommendShot(builtInProfilePresets[1], {
      ...baselineScenario,
      targetDistanceMeters: 135,
      windDirection: 'right-to-left',
      windStrength: 'light',
      desiredWindow: 'high',
    });

    expect(new Set([baseline.selectedClub, longHeadwind.selectedClub, smoothDraw.selectedClub]).size).toBeGreaterThan(1);
    expect(new Set([baseline.tempo, longHeadwind.tempo, smoothDraw.tempo]).size).toBeGreaterThan(1);
    expect(new Set([baseline.trajectoryStrategy, longHeadwind.trajectoryStrategy, smoothDraw.trajectoryStrategy]).size).toBeGreaterThan(1);
  });

  it('avoids command-like exact-prediction wording in engine output', () => {
    const recommendation = recommendShot(builtInProfilePresets[2], {
      ...baselineScenario,
      targetDistanceMeters: 160,
      lie: 'rough',
    });

    const copy = [
      recommendation.distanceFeel,
      recommendation.gameMetricLabel,
      ...recommendation.why,
      ...recommendation.adjustments.map((adjustment) => adjustment.reason),
    ].join(' ');

    expect(copy).not.toMatch(/\b(coach|caddie|caddy|command|instruct|order)\b|캐디|코치/i);
    expect(copy).not.toMatch(/\b(must|should|need to|try|try to|take|play|hit|aim|choose|use|recommend|guarantee|exact)\b|반드시|쳐야|겨냥|추천|보장|정확/i);
    expect(copy).not.toMatch(/\b(club up|club down|go for)\b/i);
  });
});
