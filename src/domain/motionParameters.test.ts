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
});
