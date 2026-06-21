import { describe, expect, it } from 'vitest';
import { motionParametersFromRecommendation } from './motionParameters';
import { builtInProfilePresets } from './profilePresets';
import { recommendShot } from './recommendationEngine';
import type { ShotScenario } from './swingLabModels';

const scenario: ShotScenario = {
  targetDistanceMeters: 142,
  windDirection: 'none',
  windStrength: 'calm',
  lie: 'fairway',
  desiredWindow: 'standard',
};

describe('motion parameters', () => {
  it('keeps the default recommendation stable as a deterministic motion view-model seed', () => {
    const parameters = motionParametersFromRecommendation(recommendShot(builtInProfilePresets[0], scenario));

    expect(parameters).toEqual({
      arcDegrees: 148,
      animationDurationMs: 1792,
      tempoRating: 84,
      pathOffset: 0,
      planeTiltDegrees: 50,
      launchAngleDegrees: 17,
      followThroughHeight: 100,
      reducedMotionPose: 'balanced',
      accessibleSummary: 'controlled neutral tempo, neutral path, standard-window launch',
    });
  });

  it('maps swing size to arc amplitude and reduced-motion pose', () => {
    const compact = motionParametersFromRecommendation(
      recommendShot(builtInProfilePresets[0], { ...scenario, targetDistanceMeters: 58 }),
    );
    const extended = motionParametersFromRecommendation(
      recommendShot(builtInProfilePresets[0], { ...scenario, targetDistanceMeters: 142 }),
    );

    expect(compact.arcDegrees).toBeLessThan(extended.arcDegrees);
    expect(compact.reducedMotionPose).toBe('compact');
    expect(extended.reducedMotionPose).toBe('extended');
  });

  it('maps tempo to animation duration and rating', () => {
    const smooth = motionParametersFromRecommendation(
      recommendShot(builtInProfilePresets[0], { ...scenario, windDirection: 'headwind', windStrength: 'strong' }),
    );
    const assertive = motionParametersFromRecommendation(recommendShot(builtInProfilePresets[2], scenario));

    expect(smooth.tempoRating).toBeLessThan(assertive.tempoRating);
    expect(smooth.animationDurationMs).toBeGreaterThan(assertive.animationDurationMs);
  });

  it('maps path and trajectory strategy to visible plane/path parameters', () => {
    const drawFlighted = motionParametersFromRecommendation(
      recommendShot(builtInProfilePresets[1], {
        ...scenario,
        windDirection: 'left-to-right',
        windStrength: 'steady',
        desiredWindow: 'low',
      }),
    );
    const fadeHigh = motionParametersFromRecommendation(
      recommendShot(builtInProfilePresets[2], {
        ...scenario,
        windDirection: 'right-to-left',
        windStrength: 'steady',
        desiredWindow: 'high',
      }),
    );

    expect(drawFlighted.pathOffset).toBeLessThan(0);
    expect(fadeHigh.pathOffset).toBeGreaterThan(0);
    expect(drawFlighted.planeTiltDegrees).toBeLessThan(fadeHigh.planeTiltDegrees);
    expect(drawFlighted.launchAngleDegrees).toBeLessThan(fadeHigh.launchAngleDegrees);
  });

  it('produces different motion params for different recommendations with accessible summaries', () => {
    const neutral = motionParametersFromRecommendation(recommendShot(builtInProfilePresets[0], scenario));
    const windy = motionParametersFromRecommendation(
      recommendShot(builtInProfilePresets[0], {
        ...scenario,
        targetDistanceMeters: 165,
        windDirection: 'headwind',
        windStrength: 'strong',
        desiredWindow: 'low',
      }),
    );
    const shaped = motionParametersFromRecommendation(
      recommendShot(builtInProfilePresets[1], {
        ...scenario,
        targetDistanceMeters: 135,
        windDirection: 'left-to-right',
        windStrength: 'steady',
      }),
    );

    expect(new Set([neutral.arcDegrees, windy.arcDegrees, shaped.arcDegrees]).size).toBeGreaterThan(1);
    expect(new Set([neutral.pathOffset, windy.pathOffset, shaped.pathOffset]).size).toBeGreaterThan(1);
    expect(neutral.accessibleSummary).toMatch(/tempo/i);
  });

  it('keeps motion-viewer values bounded for compact and forceful edge cases', () => {
    const cases = [
      motionParametersFromRecommendation(
        recommendShot(builtInProfilePresets[0], {
          ...scenario,
          targetDistanceMeters: 30,
          desiredWindow: 'low',
        }),
      ),
      motionParametersFromRecommendation(
        recommendShot(builtInProfilePresets[2], {
          ...scenario,
          targetDistanceMeters: 330,
          windDirection: 'headwind',
          windStrength: 'strong',
          lie: 'bunker',
          desiredWindow: 'high',
        }),
      ),
    ];

    for (const parameters of cases) {
      expect(parameters.arcDegrees).toBeGreaterThanOrEqual(112);
      expect(parameters.arcDegrees).toBeLessThanOrEqual(151);
      expect(parameters.animationDurationMs).toBeGreaterThanOrEqual(1648);
      expect(parameters.animationDurationMs).toBeLessThanOrEqual(1936);
      expect(parameters.pathOffset).toBeGreaterThanOrEqual(-18);
      expect(parameters.pathOffset).toBeLessThanOrEqual(18);
      expect(parameters.planeTiltDegrees).toBeGreaterThanOrEqual(43);
      expect(parameters.planeTiltDegrees).toBeLessThanOrEqual(56);
      expect(parameters.launchAngleDegrees).toBeGreaterThanOrEqual(12);
      expect(parameters.launchAngleDegrees).toBeLessThanOrEqual(24);
      expect(parameters.followThroughHeight).toBeGreaterThanOrEqual(84);
      expect(parameters.followThroughHeight).toBeLessThanOrEqual(119);
      expect(parameters.accessibleSummary).toMatch(/tempo, .+ path, .+ launch/);
    }
  });
});
