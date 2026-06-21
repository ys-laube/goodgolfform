import type { CaddieClubDistance, CaddieDistancePreset } from './caddiePresets';

export type CaddieSlope = 'downhill' | 'level' | 'uphill';
export type CaddiePinPosition = 'front' | 'middle' | 'back';
export type CaddieGreenRisk = 'low' | 'medium' | 'high';

export type CaddieApproachScenario = {
  readonly targetDistanceMeters: number;
  readonly slope: CaddieSlope;
  readonly pinPosition: CaddiePinPosition;
  readonly greenRisk: CaddieGreenRisk;
};

export type CaddieRecommendationAdjustment = {
  readonly label: string;
  readonly meters: number;
  readonly reason: string;
};

export type CaddieApproachRecommendation = {
  readonly selectedClub: CaddieClubDistance['club'];
  readonly clubLabel: string;
  readonly targetDistanceMeters: number;
  readonly playDistanceMeters: number;
  readonly swingPercent: number;
  readonly confidenceScore: number;
  readonly landingWindow: string;
  readonly summary: string;
  readonly adjustments: readonly CaddieRecommendationAdjustment[];
};

const slopeMeters: Record<CaddieSlope, number> = {
  downhill: -5,
  level: 0,
  uphill: 6,
};

const pinMeters: Record<CaddiePinPosition, number> = {
  front: -3,
  middle: 0,
  back: 4,
};

const riskMeters: Record<CaddieGreenRisk, number> = {
  low: 0,
  medium: 2,
  high: 4,
};

const riskConfidencePenalty: Record<CaddieGreenRisk, number> = {
  low: 0,
  medium: 5,
  high: 11,
};

export function recommendCaddieApproach(
  preset: CaddieDistancePreset,
  scenario: CaddieApproachScenario,
): CaddieApproachRecommendation {
  const targetDistanceMeters = clampMeters(scenario.targetDistanceMeters);
  const adjustments = buildAdjustments(scenario);
  const playDistanceMeters = clampMeters(
    targetDistanceMeters + adjustments.reduce((sum, adjustment) => sum + adjustment.meters, 0),
  );
  const sortedDistances = [...preset.clubDistances].sort((a, b) => a.carryMeters - b.carryMeters);
  const selectedDistance = selectPlayableClub(sortedDistances, playDistanceMeters);
  const swingPercent = clampPercent(Math.round((playDistanceMeters / selectedDistance.carryMeters) * 100));
  const distanceGap = Math.abs(selectedDistance.carryMeters - playDistanceMeters);
  const confidenceScore = clampScore(94 - distanceGap - riskConfidencePenalty[scenario.greenRisk]);
  const landingWindow = landingWindowFor(scenario);

  return {
    selectedClub: selectedDistance.club,
    clubLabel: formatClub(selectedDistance.club),
    targetDistanceMeters,
    playDistanceMeters,
    swingPercent,
    confidenceScore,
    landingWindow,
    summary: `${formatClub(selectedDistance.club)} ${swingPercent}% · ${playDistanceMeters} m 플레이 거리 · ${landingWindow}`,
    adjustments,
  };
}

function buildAdjustments(scenario: CaddieApproachScenario): readonly CaddieRecommendationAdjustment[] {
  return [
    {
      label: '경사',
      meters: slopeMeters[scenario.slope],
      reason: `${slopeLabel(scenario.slope)} 보정`,
    },
    {
      label: '핀',
      meters: pinMeters[scenario.pinPosition],
      reason: `${pinLabel(scenario.pinPosition)} 핀 위치 보정`,
    },
    {
      label: '그린 리스크',
      meters: riskMeters[scenario.greenRisk],
      reason: `${riskLabel(scenario.greenRisk)} 그린 리스크 완충`,
    },
  ].filter((adjustment) => adjustment.meters !== 0);
}

function selectPlayableClub(
  distances: readonly CaddieClubDistance[],
  playDistanceMeters: number,
): CaddieClubDistance {
  const enoughCarry = distances.find((distance) => distance.carryMeters >= playDistanceMeters);
  return enoughCarry ?? distances.at(-1) ?? { club: 'pw', carryMeters: 100 };
}

function landingWindowFor(scenario: CaddieApproachScenario): string {
  if (scenario.greenRisk === 'high') {
    return scenario.pinPosition === 'front' ? '그린 앞쪽 안전 구역' : '그린 중앙 안전 구역';
  }

  if (scenario.pinPosition === 'back') {
    return '핀 뒤쪽 여유를 남긴 중앙-뒤 구역';
  }

  if (scenario.pinPosition === 'front') {
    return '앞핀 근처의 짧은 중앙 구역';
  }

  return '그린 중앙 구역';
}

function formatClub(club: CaddieClubDistance['club']): string {
  const labels = {
    driver: '드라이버',
    '3w': '3번 우드',
    '5w': '5번 우드',
    '4i': '4번 아이언',
    '5i': '5번 아이언',
    '6i': '6번 아이언',
    '7i': '7번 아이언',
    '8i': '8번 아이언',
    '9i': '9번 아이언',
    pw: '피칭 웨지',
    gw: '갭 웨지',
    sw: '샌드 웨지',
  } satisfies Record<CaddieClubDistance['club'], string>;

  return labels[club];
}

function slopeLabel(slope: CaddieSlope): string {
  return { downhill: '내리막', level: '평지', uphill: '오르막' }[slope];
}

function pinLabel(pinPosition: CaddiePinPosition): string {
  return { front: '앞핀', middle: '중핀', back: '뒤핀' }[pinPosition];
}

function riskLabel(greenRisk: CaddieGreenRisk): string {
  return { low: '낮은', medium: '중간', high: '높은' }[greenRisk];
}

function clampMeters(value: number): number {
  const numericValue = Number.isFinite(value) ? value : 100;
  return Math.min(330, Math.max(30, Math.round(numericValue)));
}

function clampPercent(value: number): number {
  return Math.min(104, Math.max(50, value));
}

function clampScore(value: number): number {
  return Math.min(96, Math.max(45, value));
}
