import { useMemo, useState } from 'react';
import { availableLocalStorage } from './browserEnvironment';
import {
  caddieClubOrder,
  createCaddieDistancePreset,
  loadCaddiePresets,
  replaceCaddieClubDistance,
  saveCaddiePresets,
  upsertCaddiePreset,
  type CaddieClubKey,
  type CaddieDistancePreset,
} from './domain/caddiePresets';

export type CaddieLie = 'tee' | 'fairway' | 'rough' | 'bunker';
export type CaddieStanceSlope = 'level' | 'uphill' | 'downhill' | 'ball-above-feet' | 'ball-below-feet';
export type CaddieSideSlope = 'none' | 'left-slope' | 'right-slope';
export type CaddieWindDirection = 'none' | 'headwind' | 'tailwind' | 'left-to-right' | 'right-to-left';
export type CaddieWindStrength = 'light' | 'medium' | 'strong';
export type CaddiePinPosition = 'front' | 'middle' | 'back';
export type CaddieGreenRisk = 'short-danger' | 'long-danger' | 'safe-middle';

export type CaddieScenario = {
  readonly targetDistanceMeters: number;
  readonly lie: CaddieLie;
  readonly stanceSlope: CaddieStanceSlope;
  readonly sideSlope: CaddieSideSlope;
  readonly windDirection: CaddieWindDirection;
  readonly windStrength: CaddieWindStrength;
  readonly pinPosition: CaddiePinPosition;
  readonly greenRisk: CaddieGreenRisk;
};

export type CaddieReasonCard = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
};

export type CaddieVisualCard = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly marker: 'aim-left' | 'aim-right' | 'aim-center' | 'slope-up' | 'slope-down' | 'slope-side';
};

export type CaddiePrescription = {
  readonly headline: string;
  readonly selectedClub: CaddieClubKey;
  readonly selectedClubLabel: string;
  readonly swingPercent: number;
  readonly playDistanceMeters: number;
  readonly aimText: string;
  readonly trajectoryText: string;
  readonly warningText: string;
  readonly reasonCards: readonly CaddieReasonCard[];
  readonly visualCards: readonly CaddieVisualCard[];
};

const defaultPreset = createCaddieDistancePreset({
  id: 'preset-default-local',
  name: '내 거리',
  anchorDistances: { driver: 210, sevenIron: 135, pitchingWedge: 105 },
});

const defaultScenario: CaddieScenario = {
  targetDistanceMeters: 100,
  lie: 'fairway',
  stanceSlope: 'ball-below-feet',
  sideSlope: 'left-slope',
  windDirection: 'headwind',
  windStrength: 'light',
  pinPosition: 'front',
  greenRisk: 'short-danger',
};

export const caddieClubLabels = {
  driver: '드라이버',
  '3w': '3W',
  '5w': '5W',
  '4i': '4번 아이언',
  '5i': '5번 아이언',
  '6i': '6번 아이언',
  '7i': '7번 아이언',
  '8i': '8번 아이언',
  '9i': '9번 아이언',
  pw: 'PW',
  gw: 'GW',
  sw: 'SW',
} satisfies Record<CaddieClubKey, string>;

export const lieLabels = {
  tee: '티',
  fairway: '페어웨이',
  rough: '러프',
  bunker: '벙커',
} satisfies Record<CaddieLie, string>;

export const stanceSlopeLabels = {
  level: '평지',
  uphill: '오르막',
  downhill: '내리막',
  'ball-above-feet': '발끝 오르막',
  'ball-below-feet': '발끝 내리막',
} satisfies Record<CaddieStanceSlope, string>;

export const sideSlopeLabels = {
  none: '없음',
  'left-slope': '좌측 경사',
  'right-slope': '우측 경사',
} satisfies Record<CaddieSideSlope, string>;

export const windDirectionLabels = {
  none: '무풍',
  headwind: '맞바람',
  tailwind: '뒷바람',
  'left-to-right': '좌→우',
  'right-to-left': '우→좌',
} satisfies Record<CaddieWindDirection, string>;

export const windStrengthLabels = {
  light: '약함',
  medium: '보통',
  strong: '강함',
} satisfies Record<CaddieWindStrength, string>;

export const pinPositionLabels = {
  front: '앞핀',
  middle: '중핀',
  back: '뒤핀',
} satisfies Record<CaddiePinPosition, string>;

export const greenRiskLabels = {
  'short-danger': '짧으면 위험',
  'long-danger': '길면 위험',
  'safe-middle': '안전 중앙',
} satisfies Record<CaddieGreenRisk, string>;

function initialSavedPresets(): readonly CaddieDistancePreset[] {
  return loadCaddiePresets(availableLocalStorage());
}

function initialStorageMessage(savedPresets: readonly CaddieDistancePreset[]): string {
  return savedPresets.length > 0
    ? `이 기기에서 거리 프리셋 ${savedPresets.length}개를 불러왔습니다.`
    : '기본 거리표가 준비되었습니다. 저장한 프리셋은 이 기기에서만 불러옵니다.';
}

function clonePreset(preset: CaddieDistancePreset): CaddieDistancePreset {
  return {
    ...preset,
    anchorDistances: { ...preset.anchorDistances },
    clubDistances: preset.clubDistances.map((distance) => ({ ...distance })),
  };
}

function distanceAdjustmentFor(scenario: CaddieScenario): number {
  const windBase = { none: 0, headwind: 6, tailwind: -5, 'left-to-right': 1, 'right-to-left': 1 }[scenario.windDirection];
  const windMultiplier = { light: 1, medium: 1.6, strong: 2.2 }[scenario.windStrength];
  const lieAdjustment = { tee: -1, fairway: 0, rough: 5, bunker: 8 }[scenario.lie];
  const stanceAdjustment = { level: 0, uphill: 5, downhill: -4, 'ball-above-feet': 1, 'ball-below-feet': -2 }[scenario.stanceSlope];
  const pinAdjustment = { front: -4, middle: 0, back: 4 }[scenario.pinPosition];
  const riskAdjustment = { 'short-danger': 3, 'long-danger': -3, 'safe-middle': 0 }[scenario.greenRisk];

  return Math.round(windBase * windMultiplier + lieAdjustment + stanceAdjustment + pinAdjustment + riskAdjustment);
}

function recommendClub(preset: CaddieDistancePreset, playDistanceMeters: number) {
  const sortedDistances = [...preset.clubDistances].sort((a, b) => a.carryMeters - b.carryMeters);
  return sortedDistances.find((distance) => distance.carryMeters >= playDistanceMeters) ?? sortedDistances.at(-1) ?? defaultPreset.clubDistances[0];
}

function aimTextFor(scenario: CaddieScenario): string {
  if (scenario.stanceSlope === 'ball-below-feet' || scenario.sideSlope === 'left-slope') {
    return '목표보다 살짝 오른쪽 조준';
  }

  if (scenario.stanceSlope === 'ball-above-feet' || scenario.sideSlope === 'right-slope') {
    return '목표보다 살짝 왼쪽 조준';
  }

  if (scenario.windDirection === 'left-to-right') {
    return '바람 시작점만큼 왼쪽 여유';
  }

  if (scenario.windDirection === 'right-to-left') {
    return '바람 시작점만큼 오른쪽 여유';
  }

  return '핀보다 안전한 중앙 조준';
}

function trajectoryTextFor(scenario: CaddieScenario): string {
  if (scenario.windDirection === 'headwind' || scenario.pinPosition === 'front' || scenario.greenRisk === 'short-danger') {
    return '낮게 컨트롤';
  }

  if (scenario.windDirection === 'tailwind' || scenario.greenRisk === 'long-danger') {
    return '부드럽게 떨어지는 탄도';
  }

  return '기본 탄도로 중앙 공략';
}

function warningTextFor(scenario: CaddieScenario): string {
  if (scenario.stanceSlope === 'ball-below-feet') {
    return '발끝 내리막 당김·토핑 주의';
  }

  if (scenario.stanceSlope === 'ball-above-feet') {
    return '발끝 오르막 훅성 당김 주의';
  }

  if (scenario.lie === 'rough') {
    return '러프에서 뜨는 거리 손실 주의';
  }

  if (scenario.lie === 'bunker') {
    return '벙커 턱과 짧은 미스 우선 주의';
  }

  return '핀보다 큰 미스 방향만 피하기';
}

function markerForAim(aimText: string): CaddieVisualCard['marker'] {
  if (aimText.includes('오른쪽')) {
    return 'aim-right';
  }

  if (aimText.includes('왼쪽')) {
    return 'aim-left';
  }

  return 'aim-center';
}

function markerForLie(scenario: CaddieScenario): CaddieVisualCard['marker'] {
  if (scenario.stanceSlope === 'uphill' || scenario.stanceSlope === 'ball-above-feet') {
    return 'slope-up';
  }

  if (scenario.stanceSlope === 'downhill' || scenario.stanceSlope === 'ball-below-feet') {
    return 'slope-down';
  }

  return scenario.sideSlope === 'none' ? 'aim-center' : 'slope-side';
}

function buildPrescription(preset: CaddieDistancePreset, scenario: CaddieScenario): CaddiePrescription {
  const targetDistanceMeters = clampMeters(scenario.targetDistanceMeters);
  const playDistanceMeters = clampMeters(targetDistanceMeters + distanceAdjustmentFor(scenario));
  const selectedClub = recommendClub(preset, playDistanceMeters);
  const controlTrouble =
    scenario.pinPosition === 'front' ||
    scenario.greenRisk === 'short-danger' ||
    scenario.windDirection === 'headwind' ||
    scenario.stanceSlope === 'ball-below-feet';
  const rawSwingPercent = Math.round((playDistanceMeters / selectedClub.carryMeters) * 100);
  const swingPercent = controlTrouble ? Math.min(88, Math.max(80, rawSwingPercent - 8)) : Math.min(100, Math.max(70, rawSwingPercent));
  const aimText = aimTextFor(scenario);
  const trajectoryText = trajectoryTextFor(scenario);
  const warningText = warningTextFor(scenario);
  const selectedClubLabel = caddieClubLabels[selectedClub.club];

  return {
    headline: `추천: ${selectedClubLabel} ${swingPercent}%, ${aimText}, ${trajectoryText} — ${warningText}.`,
    selectedClub: selectedClub.club,
    selectedClubLabel,
    swingPercent,
    playDistanceMeters,
    aimText,
    trajectoryText,
    warningText,
    reasonCards: [
      {
        id: 'club-swing',
        title: `${selectedClubLabel} ${swingPercent}%`,
        detail: `${targetDistanceMeters}m에 바람·라이·핀을 더해 ${playDistanceMeters}m처럼 보고 컨트롤 스윙을 고릅니다.`,
      },
      {
        id: 'aim-correction',
        title: aimText,
        detail: `${stanceSlopeLabels[scenario.stanceSlope]}과 ${sideSlopeLabels[scenario.sideSlope]} 때문에 시작 방향을 안전 쪽으로 둡니다.`,
      },
      {
        id: 'trajectory-control',
        title: trajectoryText,
        detail: `${windDirectionLabels[scenario.windDirection]} ${windStrengthLabels[scenario.windStrength]}·${pinPositionLabels[scenario.pinPosition]} 상황에서는 긴 설명보다 낮은 실행 처방이 빠릅니다.`,
      },
      {
        id: 'miss-warning',
        title: warningText,
        detail: `${lieLabels[scenario.lie]} 라이에서 가장 큰 미스 하나만 먼저 지웁니다.`,
      },
    ],
    visualCards: [
      {
        id: 'aim-mini-map',
        title: '조준 미니맵',
        detail: aimText,
        marker: markerForAim(aimText),
      },
      {
        id: 'lie-mini-card',
        title: '라이·스탠스',
        detail: `${lieLabels[scenario.lie]} · ${stanceSlopeLabels[scenario.stanceSlope]} · ${sideSlopeLabels[scenario.sideSlope]}`,
        marker: markerForLie(scenario),
      },
    ],
  };
}

function clampMeters(value: number): number {
  const numericValue = Number.isFinite(value) ? value : 100;
  return Math.min(330, Math.max(30, Math.round(numericValue)));
}

export function distanceFor(preset: CaddieDistancePreset, club: CaddieClubKey): number {
  return preset.clubDistances.find((distance) => distance.club === club)?.carryMeters ?? 0;
}

export function replaceClubDistance(
  preset: CaddieDistancePreset,
  club: CaddieClubKey,
  carryMeters: number,
): CaddieDistancePreset {
  const nextPreset = replaceCaddieClubDistance(preset, club, carryMeters);

  if (club === 'driver' || club === '7i' || club === 'pw') {
    return {
      ...nextPreset,
      anchorDistances: {
        ...nextPreset.anchorDistances,
        ...(club === 'driver' ? { driver: distanceFor(nextPreset, club) } : {}),
        ...(club === '7i' ? { sevenIron: distanceFor(nextPreset, club) } : {}),
        ...(club === 'pw' ? { pitchingWedge: distanceFor(nextPreset, club) } : {}),
      },
    };
  }

  return nextPreset;
}

export function useCaddieSession() {
  const [savedPresets, setSavedPresets] = useState<readonly CaddieDistancePreset[]>(initialSavedPresets);
  const [activePreset, setActivePreset] = useState<CaddieDistancePreset>(() => clonePreset(defaultPreset));
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPreset.id);
  const [scenario, setScenario] = useState<CaddieScenario>(defaultScenario);
  const [storageMessage, setStorageMessage] = useState(() => initialStorageMessage(initialSavedPresets()));

  const selectablePresets = useMemo(() => [defaultPreset, ...savedPresets], [savedPresets]);
  const prescription = useMemo(() => buildPrescription(activePreset, scenario), [activePreset, scenario]);

  function selectPreset(presetId: string) {
    const nextPreset = selectablePresets.find((preset) => preset.id === presetId) ?? defaultPreset;
    setSelectedPresetId(nextPreset.id);
    setActivePreset(clonePreset(nextPreset));
    setStorageMessage(`${nextPreset.name} 프리셋을 불러왔습니다.`);
  }

  function saveCurrentPreset() {
    const presetToSave: CaddieDistancePreset = {
      ...activePreset,
      id: activePreset.id === defaultPreset.id ? `saved-${activePreset.id}` : activePreset.id,
      name: activePreset.name.trim() || '내 거리 프리셋',
      updatedAt: new Date().toISOString(),
    };
    const nextSavedPresets = upsertCaddiePreset(savedPresets, presetToSave);
    const saved = saveCaddiePresets(availableLocalStorage(), nextSavedPresets);

    setSavedPresets(nextSavedPresets);
    setSelectedPresetId(presetToSave.id);
    setActivePreset(clonePreset(presetToSave));
    setStorageMessage(
      saved
        ? `${presetToSave.name} 거리 프리셋을 로컬에 저장했습니다.`
        : `${presetToSave.name} 거리 프리셋을 메모리에만 보관했습니다. 이 환경에서는 로컬 저장소를 사용할 수 없습니다.`,
    );
  }

  return {
    activePreset,
    caddieClubOrder,
    prescription,
    savedPresets,
    scenario,
    selectablePresets,
    selectedPresetId,
    setActivePreset,
    setScenario,
    selectPreset,
    saveCurrentPreset,
    storageMessage,
  };
}
