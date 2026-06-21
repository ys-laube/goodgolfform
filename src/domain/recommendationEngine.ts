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
    distanceFeel: `${formatClub(selectedDistance.club)} ${swingSizePercent}% 프로필 거리창 · 보정 거리 ${adjustedDistanceMeters} m`,
    swingSizePercent,
    swingSizeLabel: labelSwingSize(swingSizePercent),
    tempo,
    tempoRating: tempoRating(tempo),
    pathBias,
    trajectoryStrategy,
    confidenceScore,
    gameMetricLabel: `적합도 ${confidenceScore}점`,
    why: buildWhy(profile, scenario, selectedDistance, adjustedDistanceMeters, swingSizePercent, trajectoryStrategy, pathBias),
    adjustments,
  };
}

function buildAdjustments(profile: SwingLabProfile, scenario: ShotScenario): readonly RecommendationAdjustment[] {
  const windMeters = resolveWindMeters(scenario);
  const windowMeters = scenario.desiredWindow === 'low' ? -3 : scenario.desiredWindow === 'high' ? 4 : 0;
  const tendencyMeters = profile.trajectoryTendency === 'low' && scenario.desiredWindow === 'high' ? 3 : 0;

  return [
    { label: '바람', meters: windMeters, reason: windReason(scenario.windDirection, windMeters) },
    { label: '라이', meters: lieAdjustments[scenario.lie], reason: `${lieLabel(scenario.lie)} 라이가 상황 거리를 ${lieAdjustments[scenario.lie]} m 조정합니다` },
    { label: '탄도창', meters: windowMeters + tendencyMeters, reason: `${windowLabel(scenario.desiredWindow)}과 ${trajectoryLabel(profile.trajectoryTendency)} 프로필 성향을 함께 반영합니다` },
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
    `${profile.name} 프로필은 ${formatClub(selectedDistance.club)} 캐리 ${selectedDistance.carryMeters} m 기준이며, 보정 목표 ${adjustedDistanceMeters} m와 ${swingSizePercent}%로 맞물립니다.`,
    `${windStrengthLabel(scenario.windStrength)} ${windDirectionLabel(scenario.windDirection)}와 ${lieLabel(scenario.lie)} 라이가 ${trajectoryStrategyLabel(trajectoryStrategy)} 탄도 읽기와 연결됩니다.`,
    `${shotShapeLabel(profile.shotShape)} 구질은 ${pathBiasLabel(pathBias)} 경로 읽기로 이어져 모션 뷰어 상태와 일관됩니다.`,
  ];
}

function labelSwingSize(swingSizePercent: number): string {
  if (swingSizePercent < 75) {
    return '스리쿼터';
  }

  if (swingSizePercent < 97) {
    return '컨트롤';
  }

  return '풀 스톡';
}

function tempoRating(tempo: SwingTempo): number {
  return tempo === 'smooth' ? 72 : tempo === 'neutral' ? 84 : 96;
}

function windReason(direction: ShotScenario['windDirection'], meters: number): string {
  return direction === 'none' ? '잔잔한 바람은 기준 거리를 그대로 둡니다' : `${windDirectionLabel(direction)}이 상황 거리를 ${meters} m 조정합니다`;
}

function formatClub(club: ClubDistance['club']): string {
  const labels = { driver: '드라이버', '3w': '3번 우드', '5w': '5번 우드', '4i': '4번 아이언', '5i': '5번 아이언', '6i': '6번 아이언', '7i': '7번 아이언', '8i': '8번 아이언', '9i': '9번 아이언', pw: '피칭 웨지', gw: '갭 웨지', sw: '샌드 웨지' } satisfies Record<ClubDistance['club'], string>;
  return labels[club];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}


function windDirectionLabel(direction: ShotScenario['windDirection']): string {
  return {
    none: '무풍',
    headwind: '맞바람',
    tailwind: '뒷바람',
    'left-to-right': '왼쪽에서 오른쪽 바람',
    'right-to-left': '오른쪽에서 왼쪽 바람',
  }[direction];
}

function windStrengthLabel(strength: ShotScenario['windStrength']): string {
  return { calm: '잔잔한', light: '약한', steady: '꾸준한', strong: '강한' }[strength];
}

function lieLabel(lie: ShotScenario['lie']): string {
  return { tee: '티', fairway: '페어웨이', rough: '러프', bunker: '벙커' }[lie];
}

function windowLabel(window: ShotScenario['desiredWindow']): string {
  return { standard: '표준 탄도창', low: '낮은 탄도창', high: '높은 탄도창' }[window];
}

function trajectoryLabel(tendency: SwingLabProfile['trajectoryTendency']): string {
  return { low: '낮은 탄도', mid: '중간 탄도', high: '높은 탄도' }[tendency];
}

function shotShapeLabel(shape: SwingLabProfile['shotShape']): string {
  return { straight: '스트레이트', draw: '드로', fade: '페이드' }[shape];
}

function pathBiasLabel(pathBias: PathBias): string {
  return { neutral: '중립', 'draw-biased': '드로 성향', 'fade-biased': '페이드 성향' }[pathBias];
}

function trajectoryStrategyLabel(strategy: TrajectoryStrategy): string {
  return { flighted: '낮게 눌러 가는', 'standard-window': '표준', 'launch-higher': '높게 띄우는' }[strategy];
}
