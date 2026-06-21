import type {
  ClubDistance,
  PathBias,
  RecommendationAdjustment,
  ShotScenario,
  SwingLabProfile,
  SwingRecommendation,
  SwingTempo,
  TrajectoryStrategy,
} from './swingLabModels';

const windAdjustments = {
  calm: 0,
  light: 4,
  steady: 8,
  strong: 14,
} as const;

const lieAdjustments = {
  tee: -2,
  fairway: 0,
  rough: 6,
  bunker: 12,
} as const;

export function recommendShot(profile: SwingLabProfile, scenario: ShotScenario): SwingRecommendation {
  const adjustments = buildAdjustments(profile, scenario);
  const adjustedDistanceMeters = Math.max(
    30,
    Math.round(scenario.targetDistanceMeters + adjustments.reduce((sum, adjustment) => sum + adjustment.meters, 0)),
  );
  const sortedDistances = [...profile.clubDistances].sort((a, b) => a.carryMeters - b.carryMeters);
  const selectedDistance = selectClubDistance(sortedDistances, adjustedDistanceMeters);
  const swingSizePercent = clamp(Math.round((adjustedDistanceMeters / selectedDistance.carryMeters) * 100), 58, 104);
  const tempo = resolveTempo(profile, scenario, swingSizePercent);
  const pathBias = resolvePathBias(profile, scenario);
  const trajectoryStrategy = resolveTrajectoryStrategy(profile, scenario);
  const confidenceScore = clamp(
    92 - Math.abs(selectedDistance.carryMeters - adjustedDistanceMeters) - (scenario.lie === 'bunker' ? 10 : 0),
    52,
    96,
  );

  return {
    selectedClub: selectedDistance.club,
    clubLabel: formatClub(selectedDistance.club),
    adjustedDistanceMeters,
    distanceFeel: `${formatClub(selectedDistance.club)} ${swingSizePercent}% window for ${adjustedDistanceMeters} m adjusted play`,
    swingSizePercent,
    swingSizeLabel: labelSwingSize(swingSizePercent),
    tempo,
    tempoRating: tempoRating(tempo),
    pathBias,
    trajectoryStrategy,
    confidenceScore,
    gameMetricLabel: `${confidenceScore} fit score`,
    why: buildWhy(profile, scenario, selectedDistance, adjustedDistanceMeters, swingSizePercent, trajectoryStrategy, pathBias),
    adjustments,
  };
}

function buildAdjustments(profile: SwingLabProfile, scenario: ShotScenario): readonly RecommendationAdjustment[] {
  const windMeters = resolveWindMeters(scenario);
  const windowMeters = scenario.desiredWindow === 'low' ? -3 : scenario.desiredWindow === 'high' ? 4 : 0;
  const tendencyMeters = profile.trajectoryTendency === 'low' && scenario.desiredWindow === 'high' ? 3 : 0;

  return [
    { label: 'Wind', meters: windMeters, reason: windReason(scenario.windDirection, windMeters) },
    { label: 'Lie', meters: lieAdjustments[scenario.lie], reason: `${scenario.lie} lie changes carry planning by ${lieAdjustments[scenario.lie]} m` },
    { label: 'Window', meters: windowMeters + tendencyMeters, reason: `${scenario.desiredWindow} window blended with ${profile.trajectoryTendency} profile tendency` },
  ].filter((adjustment) => adjustment.meters !== 0);
}

function resolveWindMeters(scenario: ShotScenario): number {
  const strength = windAdjustments[scenario.windStrength];
  switch (scenario.windDirection) {
    case 'headwind':
      return strength;
    case 'tailwind':
      return -Math.round(strength * 0.7);
    case 'left-to-right':
    case 'right-to-left':
      return Math.round(strength * 0.35);
    case 'none':
      return 0;
  }
}

function selectClubDistance(distances: readonly ClubDistance[], adjustedDistanceMeters: number): ClubDistance {
  const enoughClub = distances.find((candidate) => candidate.carryMeters >= adjustedDistanceMeters);
  return enoughClub ?? distances.at(-1) ?? { club: '7i', carryMeters: 140 };
}

function resolveTempo(profile: SwingLabProfile, scenario: ShotScenario, swingSizePercent: number): SwingTempo {
  if (profile.tempoPreference === 'smooth' || scenario.windDirection === 'headwind') {
    return 'smooth';
  }

  if (profile.tempoPreference === 'assertive' || swingSizePercent >= 98) {
    return 'assertive';
  }

  return 'neutral';
}

function resolvePathBias(profile: SwingLabProfile, scenario: ShotScenario): PathBias {
  if (scenario.windDirection === 'left-to-right' || profile.shotShape === 'draw') {
    return 'draw-biased';
  }

  if (scenario.windDirection === 'right-to-left' || profile.shotShape === 'fade') {
    return 'fade-biased';
  }

  return 'neutral';
}

function resolveTrajectoryStrategy(profile: SwingLabProfile, scenario: ShotScenario): TrajectoryStrategy {
  if (scenario.windDirection === 'headwind' || scenario.desiredWindow === 'low') {
    return 'flighted';
  }

  if (scenario.desiredWindow === 'high' || profile.trajectoryTendency === 'high') {
    return 'launch-higher';
  }

  if (profile.trajectoryTendency === 'low') {
    return 'flighted';
  }

  return 'standard-window';
}

function buildWhy(
  profile: SwingLabProfile,
  scenario: ShotScenario,
  selectedDistance: ClubDistance,
  adjustedDistanceMeters: number,
  swingSizePercent: number,
  trajectoryStrategy: TrajectoryStrategy,
  pathBias: PathBias,
): readonly string[] {
  return [
    `${profile.name} carries ${formatClub(selectedDistance.club)} around ${selectedDistance.carryMeters} m, matching the ${adjustedDistanceMeters} m adjusted target at ${swingSizePercent}%.`,
    `${scenario.windStrength} ${scenario.windDirection} and ${scenario.lie} lie nudge the card toward a ${trajectoryStrategy} trajectory.`,
    `${profile.shotShape} shape maps to a ${pathBias} path read for a coherent motion-viewer state.`,
  ];
}

function labelSwingSize(swingSizePercent: number): string {
  if (swingSizePercent < 75) {
    return 'three-quarter';
  }

  if (swingSizePercent < 97) {
    return 'controlled';
  }

  return 'fuller stock';
}

function tempoRating(tempo: SwingTempo): number {
  return tempo === 'smooth' ? 72 : tempo === 'neutral' ? 84 : 96;
}

function windReason(direction: ShotScenario['windDirection'], meters: number): string {
  return direction === 'none' ? 'Calm wind keeps the base number intact' : `${direction} changes adjusted play by ${meters} m`;
}

function formatClub(club: ClubDistance['club']): string {
  return club.replace('i', ' iron').replace('w', ' wood').toUpperCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
