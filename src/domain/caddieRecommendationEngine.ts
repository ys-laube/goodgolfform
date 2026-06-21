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

export type CaddieClubSelection = {
  readonly selectedClub: CaddieClubDistance['club'];
  readonly carryMeters: number;
  readonly swingPercent: number;
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
  const selectedDistance = selectCaddieClubForPlayDistance(preset, playDistanceMeters);
  const distanceGap = Math.abs(selectedDistance.carryMeters - playDistanceMeters);
  const confidenceScore = clampScore(94 - distanceGap - riskConfidencePenalty[scenario.greenRisk]);
  const landingWindow = landingWindowFor(scenario);

  return {
    selectedClub: selectedDistance.selectedClub,
    clubLabel: formatClub(selectedDistance.selectedClub),
    targetDistanceMeters,
    playDistanceMeters,
    swingPercent: selectedDistance.swingPercent,
    confidenceScore,
    landingWindow,
    summary: `${formatClub(selectedDistance.selectedClub)} ${selectedDistance.swingPercent}% · ${playDistanceMeters} m 플레이 거리 · ${landingWindow}`,
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

export function selectCaddieClubForPlayDistance(
  preset: CaddieDistancePreset,
  playDistanceMeters: number,
  options: { readonly preferControl?: boolean } = {},
): CaddieClubSelection {
  const sortedDistances = [...preset.clubDistances].sort((a, b) => a.carryMeters - b.carryMeters);
  const candidates = sortedDistances
    .map((distance) => ({
      selectedClub: distance.club,
      carryMeters: distance.carryMeters,
      swingPercent: clampPercent(Math.round((clampMeters(playDistanceMeters) / distance.carryMeters) * 100)),
    }))
    .filter((candidate) => candidate.swingPercent >= 50 && candidate.swingPercent <= 104);

  if (options.preferControl) {
    const controlCandidates = candidates.filter((candidate) => candidate.swingPercent >= 80 && candidate.swingPercent <= 95);
    const pool = controlCandidates.length > 0 ? controlCandidates : candidates;
    return nearestSwingPercent(pool, 88);
  }

  return candidates.find((candidate) => candidate.carryMeters >= clampMeters(playDistanceMeters)) ?? candidates.at(-1) ?? { selectedClub: 'pw', carryMeters: 100, swingPercent: 100 };
}

function nearestSwingPercent(candidates: readonly CaddieClubSelection[], targetPercent: number): CaddieClubSelection {
  return [...candidates].sort((left, right) => {
    const leftGap = Math.abs(left.swingPercent - targetPercent);
    const rightGap = Math.abs(right.swingPercent - targetPercent);
    return leftGap - rightGap || left.carryMeters - right.carryMeters;
  })[0] ?? { selectedClub: 'pw', carryMeters: 100, swingPercent: 100 };
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
