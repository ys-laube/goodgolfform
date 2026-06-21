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

function formatCardText(value: string): string {
  return value.replaceAll('-', ' ');
}

function analysisCardsFor(recommendation: SwingRecommendation): readonly AnalysisCard[] {
  return [
    {
      id: 'club-distance-feel',
      label: 'Club · distance feel',
      title: recommendation.clubLabel,
      detail: recommendation.distanceFeel,
      meta: `${recommendation.adjustedDistanceMeters} m adjusted context`,
    },
    {
      id: 'swing-size-tempo',
      label: 'Swing size · tempo',
      title: `${recommendation.swingSizePercent}% ${recommendation.swingSizeLabel}`,
      detail: `${formatCardText(recommendation.tempo)} tempo profile with ${recommendation.tempoRating} rhythm rating`,
      meta: 'Motion meter',
    },
    {
      id: 'trajectory-strategy',
      label: 'Trajectory strategy',
      title: formatCardText(recommendation.trajectoryStrategy),
      detail: `${formatCardText(recommendation.pathBias)} path read shaped by window, wind, and player tendency`,
      meta: 'Flight lane',
    },
    {
      id: 'plausibility-game-metrics',
      label: 'Plausibility · game metrics',
      title: recommendation.gameMetricLabel,
      detail: `${recommendation.confidenceScore}/100 fit score for this profile and scenario blend`,
      meta: 'Scenario fit',
    },
  ];
}

function initialSavedProfiles(): readonly SwingLabProfile[] {
  return loadSavedProfilePresets(availableLocalStorage());
}

function initialStorageMessage(profiles: readonly SwingLabProfile[]): string {
  return profiles.length > 0
    ? `${profiles.length} saved profile${profiles.length === 1 ? '' : 's'} restored from this device.`
    : 'Built-in profiles are ready. Saved profiles load on this device only.';
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
  return `${profile.level} · ${profile.shotShape} · ${profile.trajectoryTendency} flight · ${profile.tempoPreference} tempo`;
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
    setStorageMessage(`${nextProfile.name} loaded into the profile editor.`);
  }

  function saveCurrentProfile() {
    const storage = availableLocalStorage();
    const profileToSave: SwingLabProfile = {
      ...activeProfile,
      id: activeProfile.id.startsWith('preset-') ? `saved-${activeProfile.id}` : activeProfile.id,
      name: activeProfile.name.trim() || 'Custom Swing Lab Profile',
      archetype: activeProfile.archetype.trim() || 'Saved local player profile',
    };
    const nextSavedProfiles = upsertProfilePreset(savedProfiles, profileToSave);
    const saved = saveProfilePresets(storage, nextSavedProfiles);
    setSavedProfiles(nextSavedProfiles);
    setSelectedPresetId(profileToSave.id);
    setActiveProfile(cloneProfile(profileToSave));
    setStorageMessage(
      saved
        ? `${profileToSave.name} saved locally and can be loaded from this preset list.`
        : `${profileToSave.name} is staged in memory. Local storage is not available in this environment.`,
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
