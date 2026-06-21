import type { MotionParameters, SwingRecommendation } from './swingLabModels';

export function motionParametersFromRecommendation(recommendation: SwingRecommendation): MotionParameters {
  const arcDegrees = Math.round(62 + recommendation.swingSizePercent * 0.86);
  const animationDurationMs = Math.round(2800 - recommendation.tempoRating * 12);
  const pathOffset = recommendation.pathBias === 'draw-biased' ? -18 : recommendation.pathBias === 'fade-biased' ? 18 : 0;
  const planeTiltDegrees = recommendation.trajectoryStrategy === 'flighted' ? 43 : recommendation.trajectoryStrategy === 'launch-higher' ? 56 : 50;
  const launchAngleDegrees = recommendation.trajectoryStrategy === 'flighted' ? 12 : recommendation.trajectoryStrategy === 'launch-higher' ? 24 : 17;
  const followThroughHeight = Math.round(42 + recommendation.swingSizePercent * 0.58 + launchAngleDegrees * 0.7);

  return {
    arcDegrees,
    animationDurationMs,
    tempoRating: recommendation.tempoRating,
    pathOffset,
    planeTiltDegrees,
    launchAngleDegrees,
    followThroughHeight,
    reducedMotionPose: recommendation.swingSizePercent < 76 ? 'compact' : recommendation.swingSizePercent > 94 ? 'extended' : 'balanced',
    accessibleSummary: `${recommendation.swingSizeLabel} ${recommendation.tempo} tempo, ${recommendation.pathBias} path, ${recommendation.trajectoryStrategy} launch`,
  };
}
