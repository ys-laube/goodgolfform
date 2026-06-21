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
    expect(recommendation.distanceFeel).toMatch(/7 IRON 100% window/i);
    expect(recommendation.swingSizeLabel).toBe('fuller stock');
    expect(recommendation.trajectoryStrategy).toBe('standard-window');
    expect(recommendation.why.join(' ')).toMatch(/adjusted target/i);
    expect(recommendation.gameMetricLabel).toMatch(/fit score/i);
  });

  it('adjusts swing size for between-club distances', () => {
    const recommendation = recommendShot(builtInProfilePresets[0], {
      ...baselineScenario,
      targetDistanceMeters: 135,
    });

    expect(recommendation.selectedClub).toBe('7i');
    expect(recommendation.swingSizePercent).toBeLessThan(100);
    expect(recommendation.swingSizeLabel).toBe('controlled');
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

    expect(copy).not.toMatch(/\b(must|guarantee|exact)\b/i);
  });
});
