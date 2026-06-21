import { useMemo, useState } from 'react';
import { availableLocalStorage } from './browserEnvironment';
import {
  builtInProfilePresets,
  loadSavedProfilePresets,
  saveProfilePresets,
  upsertProfilePreset,
} from './domain/profilePresets';
import { motionParametersFromRecommendation } from './domain/motionParameters';
import { recommendShot } from './domain/recommendationEngine';
import type { ClubKey, ShotScenario, SwingLabProfile, SwingRecommendation } from './domain/swingLabModels';

const defaultScenario: ShotScenario = {
  targetDistanceMeters: 145,
  windDirection: 'none',
  windStrength: 'calm',
  lie: 'fairway',
  desiredWindow: 'standard',
};

type AnalysisCard = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly detail: string;
  readonly meta: string;
};

function tempoLabel(value: SwingRecommendation['tempo']): string {
  return { smooth: '부드러운', neutral: '중립', assertive: '과감한' }[value];
}

function pathBiasLabel(value: SwingRecommendation['pathBias']): string {
  return { neutral: '중립', 'draw-biased': '드로 성향', 'fade-biased': '페이드 성향' }[value];
}

function trajectoryLabel(value: SwingRecommendation['trajectoryStrategy']): string {
  return { flighted: '낮은 탄도', 'standard-window': '표준 탄도창', 'launch-higher': '높은 탄도' }[value];
}

function analysisCardsFor(recommendation: SwingRecommendation): readonly AnalysisCard[] {
  return [
    {
      id: 'club-distance-feel',
      label: '클럽 · 거리감',
      title: recommendation.clubLabel,
      detail: recommendation.distanceFeel,
      meta: `${recommendation.adjustedDistanceMeters} m 보정 상황`,
    },
    {
      id: 'swing-size-tempo',
      label: '스윙 크기 · 템포',
      title: `${recommendation.swingSizePercent}% ${recommendation.swingSizeLabel}`,
      detail: `${tempoLabel(recommendation.tempo)} 템포 프로필 · 리듬 지수 ${recommendation.tempoRating}`,
      meta: '모션 미터',
    },
    {
      id: 'trajectory-strategy',
      label: '탄도 전략',
      title: trajectoryLabel(recommendation.trajectoryStrategy),
      detail: `${pathBiasLabel(recommendation.pathBias)} 경로 읽기 · 탄도창, 바람, 플레이어 성향 반영`,
      meta: '비행 라인',
    },
    {
      id: 'plausibility-game-metrics',
      label: '개연성 · 게임 지표',
      title: recommendation.gameMetricLabel,
      detail: `프로필과 상황 조합의 적합도 ${recommendation.confidenceScore}/100`,
      meta: '상황 적합도',
    },
  ];
}

function initialSavedProfiles(): readonly SwingLabProfile[] {
  return loadSavedProfilePresets(availableLocalStorage());
}

function initialStorageMessage(profiles: readonly SwingLabProfile[]): string {
  return profiles.length > 0
    ? `이 기기에서 저장 프로필 ${profiles.length}개를 불러왔습니다.`
    : '기본 프로필이 준비되었습니다. 저장 프로필은 이 기기에서만 불러옵니다.';
}

function cloneProfile(profile: SwingLabProfile): SwingLabProfile {
  return {
    ...profile,
    clubDistances: profile.clubDistances.map((distance) => ({ ...distance })),
  };
}

export function replaceClubDistance(profile: SwingLabProfile, club: ClubKey, carryMeters: number): SwingLabProfile {
  return {
    ...profile,
    clubDistances: profile.clubDistances.map((distance) =>
      distance.club === club ? { ...distance, carryMeters: Math.max(30, Math.round(carryMeters)) } : distance,
    ),
  };
}

export function distanceFor(profile: SwingLabProfile, club: ClubKey): number {
  return profile.clubDistances.find((distance) => distance.club === club)?.carryMeters ?? 0;
}

export function presetSummary(profile: SwingLabProfile): string {
  return `${profile.level} · ${profile.shotShape} · ${profile.trajectoryTendency} 탄도 · ${profile.tempoPreference} 템포`;
}

export function useSwingLabSession() {
  const [savedProfiles, setSavedProfiles] = useState<readonly SwingLabProfile[]>(initialSavedProfiles);
  const [activeProfile, setActiveProfile] = useState<SwingLabProfile>(() => cloneProfile(builtInProfilePresets[0]));
  const [selectedPresetId, setSelectedPresetId] = useState(builtInProfilePresets[0].id);
  const [scenario, setScenario] = useState<ShotScenario>(defaultScenario);
  const [storageMessage, setStorageMessage] = useState(() => initialStorageMessage(initialSavedProfiles()));

  const selectableProfiles = useMemo(() => [...builtInProfilePresets, ...savedProfiles], [savedProfiles]);
  const recommendation = useMemo(() => recommendShot(activeProfile, scenario), [activeProfile, scenario]);
  const analysisCards = useMemo(() => analysisCardsFor(recommendation), [recommendation]);
  const motionParameters = useMemo(() => motionParametersFromRecommendation(recommendation), [recommendation]);

  function selectProfile(profileId: string) {
    const nextProfile = selectableProfiles.find((profile) => profile.id === profileId) ?? builtInProfilePresets[0];
    setSelectedPresetId(profileId);
    setActiveProfile(cloneProfile(nextProfile));
    setStorageMessage(`${nextProfile.name} 프로필을 편집기에 불러왔습니다.`);
  }

  function saveCurrentProfile() {
    const storage = availableLocalStorage();
    const profileToSave: SwingLabProfile = {
      ...activeProfile,
      id: activeProfile.id.startsWith('preset-') ? `saved-${activeProfile.id}` : activeProfile.id,
      name: activeProfile.name.trim() || '나만의 스윙 랩 프로필',
      archetype: activeProfile.archetype.trim() || '저장된 로컬 플레이어 프로필',
    };
    const nextSavedProfiles = upsertProfilePreset(savedProfiles, profileToSave);
    const saved = saveProfilePresets(storage, nextSavedProfiles);
    setSavedProfiles(nextSavedProfiles);
    setSelectedPresetId(profileToSave.id);
    setActiveProfile(cloneProfile(profileToSave));
    setStorageMessage(
      saved
        ? `${profileToSave.name} 프로필을 로컬에 저장했으며 프리셋 목록에서 불러올 수 있습니다.`
        : `${profileToSave.name} 프로필을 메모리에만 보관했습니다. 이 환경에서는 로컬 저장소를 사용할 수 없습니다.`,
    );
  }

  return {
    activeProfile,
    analysisCards,
    motionParameters,
    recommendation,
    savedProfiles,
    scenario,
    selectableProfiles,
    selectedPresetId,
    setActiveProfile,
    setScenario,
    selectProfile,
    saveCurrentProfile,
    storageMessage,
  };
}
