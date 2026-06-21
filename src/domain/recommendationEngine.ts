import type {
  ClubDistance,
  GolferProfile,
  PathBias,
  RecommendationAdjustment,
  ShotScenario,
  SwingRecommendation,
  SwingTempo,
  TrajectoryBias,
  TrajectoryWindow,
} from './swingLabModels';

const minimumSwingSize = 62;
const maximumSwingSize = 108;

export function recommendShot(profile: GolferProfile, scenario: ShotScenario): SwingRecommendation {
  assertProfile(profile);
  assertScenario(scenario);

  const adjustments = buildDistanceAdjustments(scenario);
  const effectiveDistanceMeters = roundMeters(
    scenario.targetDistanceMeters + adjustments.reduce((total, adjustment) => total + adjustment.meters, 0),
  );
  const club = selectClub(profile.clubDistances, effectiveDistanceMeters);
  const rawSwingSize = (effectiveDistanceMeters / club.carryMeters) * 100;
  const swingSizePercent = clamp(Math.round(rawSwingSize), minimumSwingSize, maximumSwingSize);
  const distanceGapMeters = roundMeters(club.carryMeters - effectiveDistanceMeters);
  const tempo = selectTempo(profile.tempoPreference, scenario, swingSizePercent);
  const trajectoryBias = selectTrajectoryBias(profile.trajectoryPreference, scenario);
  const pathBias = selectPathBias(profile.shotShape, scenario.windDirection);
  const confidenceScore = scoreConfidence(profile, scenario, Math.abs(distanceGapMeters), swingSizePercent);

  return {
    recommendedClub: club.club,
    stockCarryMeters: club.carryMeters,
    effectiveDistanceMeters,
    distanceGapMeters,
    swingSizePercent,
    swingSizeLabel: labelSwingSize(swingSizePercent),
    tempo,
    tempoRating: tempoToRating(tempo),
    pathBias,
    trajectoryBias,
    trajectoryStrategy: describeTrajectory(trajectoryBias, scenario.desiredWindow),
    confidenceScore,
    adjustments,
    why: buildWhy(profile, scenario, club, effectiveDistanceMeters, swingSizePercent, tempo, trajectoryBias, pathBias),
  };
}

function assertProfile(profile: GolferProfile): void {
  if (!profile.clubDistances.length) {
    throw new Error('Recommendation requires at least one club distance.');
  }

  for (const distance of profile.clubDistances) {
    if (!distance.club.trim() || !Number.isFinite(distance.carryMeters) || distance.carryMeters <= 0) {
      throw new Error('Club distances must include a label and positive carry meters.');
    }
  }
}

function assertScenario(scenario: ShotScenario): void {
  if (!Number.isFinite(scenario.targetDistanceMeters) || scenario.targetDistanceMeters <= 0) {
    throw new Error('Target distance must be a positive meter value.');
  }

  if (!Number.isFinite(scenario.windStrengthKph) || scenario.windStrengthKph < 0) {
    throw new Error('Wind strength must be zero or a positive kph value.');
  }
}

function buildDistanceAdjustments(scenario: ShotScenario): readonly RecommendationAdjustment[] {
  const windMeters = (() => {
    switch (scenario.windDirection) {
      case 'headwind':
        return scenario.windStrengthKph * 0.9;
      case 'tailwind':
        return scenario.windStrengthKph * -0.55;
      case 'crosswind-left':
      case 'crosswind-right':
        return scenario.windStrengthKph * 0.25;
      case 'none':
        return 0;
    }
  })();

  const lieMeters = (() => {
    switch (scenario.lie) {
      case 'rough':
        return 7;
      case 'sand':
        return 10;
      case 'soft':
        return 4;
      case 'firm':
        return -3;
      case 'tee':
      case 'fairway':
        return 0;
    }
  })();

  return [
    { label: `wind:${scenario.windDirection}`, meters: roundMeters(windMeters) },
    { label: `lie:${scenario.lie}`, meters: lieMeters },
  ].filter((adjustment) => adjustment.meters !== 0);
}

function selectClub(clubDistances: readonly ClubDistance[], effectiveDistanceMeters: number): ClubDistance {
  return [...clubDistances]
    .sort((left, right) => left.carryMeters - right.carryMeters)
    .map((club) => {
      const swingPercent = (effectiveDistanceMeters / club.carryMeters) * 100;
      const playablePenalty = swingPercent < minimumSwingSize || swingPercent > maximumSwingSize ? 18 : 0;
      const comfortPenalty = Math.abs(swingPercent - 88) * 0.35;
      return { club, score: Math.abs(club.carryMeters - effectiveDistanceMeters) + playablePenalty + comfortPenalty };
    })
    .sort((left, right) => left.score - right.score || left.club.carryMeters - right.club.carryMeters)[0].club;
}

function selectTempo(preference: SwingTempo, scenario: ShotScenario, swingSizePercent: number): SwingTempo {
  if (scenario.windDirection === 'headwind' || scenario.lie === 'rough' || swingSizePercent >= 102) {
    return 'assertive';
  }

  if (scenario.windDirection === 'tailwind' || swingSizePercent <= 82) {
    return 'smooth';
  }

  return preference;
}

function selectTrajectoryBias(preference: TrajectoryWindow, scenario: ShotScenario): TrajectoryBias {
  if (scenario.windDirection === 'headwind' || scenario.desiredWindow === 'low') {
    return 'lower';
  }

  if (scenario.windDirection === 'tailwind' || scenario.desiredWindow === 'high') {
    return 'higher';
  }

  return preference === 'low' ? 'lower' : preference === 'high' ? 'higher' : 'standard';
}

function selectPathBias(shape: GolferProfile['shotShape'], windDirection: ShotScenario['windDirection']): PathBias {
  if (windDirection === 'crosswind-left') {
    return 'fade-biased';
  }

  if (windDirection === 'crosswind-right') {
    return 'draw-biased';
  }

  return shape === 'draw' ? 'draw-biased' : shape === 'fade' ? 'fade-biased' : 'neutral';
}

function labelSwingSize(percent: number): SwingRecommendation['swingSizeLabel'] {
  if (percent <= 78) {
    return 'feathered';
  }

  if (percent <= 92) {
    return 'controlled';
  }

  if (percent <= 101) {
    return 'stock';
  }

  return 'stretched';
}

function tempoToRating(tempo: SwingTempo): number {
  return tempo === 'smooth' ? 68 : tempo === 'neutral' ? 78 : 88;
}

function describeTrajectory(bias: TrajectoryBias, desiredWindow: TrajectoryWindow): string {
  if (bias === 'lower') {
    return `Flight window: lower ${desiredWindow === 'low' ? 'shape' : 'control'} with compact finish.`;
  }

  if (bias === 'higher') {
    return `Flight window: higher launch profile with fuller finish.`;
  }

  return 'Flight window: standard launch profile with balanced finish.';
}

function scoreConfidence(
  profile: GolferProfile,
  scenario: ShotScenario,
  absoluteGapMeters: number,
  swingSizePercent: number,
): number {
  const handicapPenalty = Math.min(14, Math.max(0, profile.handicap) * 0.45);
  const windPenalty = Math.min(12, scenario.windStrengthKph * 0.35);
  const gapPenalty = Math.min(10, absoluteGapMeters * 0.7);
  const swingPenalty = swingSizePercent > 102 || swingSizePercent < 70 ? 8 : 0;
  return clamp(Math.round(92 - handicapPenalty - windPenalty - gapPenalty - swingPenalty), 45, 96);
}

function buildWhy(
  profile: GolferProfile,
  scenario: ShotScenario,
  club: ClubDistance,
  effectiveDistanceMeters: number,
  swingSizePercent: number,
  tempo: SwingTempo,
  trajectoryBias: TrajectoryBias,
  pathBias: PathBias,
): readonly string[] {
  return [
    `${club.club} matches ${effectiveDistanceMeters} m adjusted distance against ${club.carryMeters} m stock carry.`,
    `${swingSizePercent}% swing size reflects ${scenario.lie} lie, ${scenario.windDirection} wind, and ${profile.archetype} profile tempo.`,
    `${tempo} tempo, ${trajectoryBias} trajectory, and ${pathBias} path bias keep the output in analysis-card language.`,
  ];
}

function roundMeters(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
