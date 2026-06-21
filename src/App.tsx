import { useMemo, useState } from 'react';
import {
  builtInProfilePresets,
  loadSavedProfilePresets,
  saveProfilePresets,
  upsertProfilePreset,
  type StorageLike,
} from './domain/profilePresets';
import { recommendShot } from './domain/recommendationEngine';
import type {
  ClubKey,
  GolferLevel,
  LieCondition,
  ShotScenario,
  ShotShape,
  ShotWindow,
  SwingLabProfile,
  TempoPreference,
  TrajectoryTendency,
  WindDirection,
  WindStrength,
} from './domain/swingLabModels';

const defaultScenario: ShotScenario = {
  targetDistanceMeters: 145,
  windDirection: 'none',
  windStrength: 'calm',
  lie: 'fairway',
  desiredWindow: 'standard',
};

const levelOptions: readonly GolferLevel[] = ['beginner', 'developing', 'single-digit', 'scratch'];
const shotShapeOptions: readonly ShotShape[] = ['straight', 'draw', 'fade'];
const trajectoryOptions: readonly TrajectoryTendency[] = ['low', 'mid', 'high'];
const tempoOptions: readonly TempoPreference[] = ['smooth', 'neutral', 'assertive'];
const windDirections: readonly WindDirection[] = ['none', 'headwind', 'tailwind', 'left-to-right', 'right-to-left'];
const windStrengths: readonly WindStrength[] = ['calm', 'light', 'steady', 'strong'];
const lieOptions: readonly LieCondition[] = ['tee', 'fairway', 'rough', 'bunker'];
const windowOptions: readonly ShotWindow[] = ['standard', 'low', 'high'];
const editableClubKeys: readonly ClubKey[] = ['driver', '7i', 'pw'];

function browserStorage(): StorageLike | undefined {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  if (!windowDescriptor || !('value' in windowDescriptor)) {
    return undefined;
  }

  try {
    return (windowDescriptor.value as Window).localStorage;
  } catch {
    return undefined;
  }
}

function initialSavedProfiles(): readonly SwingLabProfile[] {
  return loadSavedProfilePresets(browserStorage());
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

function replaceClubDistance(profile: SwingLabProfile, club: ClubKey, carryMeters: number): SwingLabProfile {
  return {
    ...profile,
    clubDistances: profile.clubDistances.map((distance) =>
      distance.club === club ? { ...distance, carryMeters: Math.max(30, Math.round(carryMeters)) } : distance,
    ),
  };
}

function distanceFor(profile: SwingLabProfile, club: ClubKey): number {
  return profile.clubDistances.find((distance) => distance.club === club)?.carryMeters ?? 0;
}

function presetSummary(profile: SwingLabProfile): string {
  return `${profile.level} · ${profile.shotShape} · ${profile.trajectoryTendency} flight · ${profile.tempoPreference} tempo`;
}

export function App() {
  const [savedProfiles, setSavedProfiles] = useState<readonly SwingLabProfile[]>(initialSavedProfiles);
  const [activeProfile, setActiveProfile] = useState<SwingLabProfile>(() => cloneProfile(builtInProfilePresets[0]));
  const [selectedPresetId, setSelectedPresetId] = useState(builtInProfilePresets[0].id);
  const [scenario, setScenario] = useState<ShotScenario>(defaultScenario);
  const [storageMessage, setStorageMessage] = useState(() => initialStorageMessage(initialSavedProfiles()));

  const selectableProfiles = useMemo(() => [...builtInProfilePresets, ...savedProfiles], [savedProfiles]);
  const recommendation = useMemo(() => recommendShot(activeProfile, scenario), [activeProfile, scenario]);

  function selectProfile(profileId: string) {
    const nextProfile = selectableProfiles.find((profile) => profile.id === profileId) ?? builtInProfilePresets[0];
    setSelectedPresetId(profileId);
    setActiveProfile(cloneProfile(nextProfile));
    setStorageMessage(`${nextProfile.name} loaded into the profile editor.`);
  }

  function saveCurrentProfile() {
    const storage = browserStorage();
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

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="hero-card swing-hero">
        <p className="eyebrow">Serious Golf Swing Lab</p>
        <h1 id="app-title">Preset a player. Build the shot. Read the swing card.</h1>
        <p className="hero-copy">
          A mobile-first practice lab for golf friends: choose a saved profile, tune core tendencies, type the shot in front of you,
          and get a deterministic analysis card without GPS, maps, weather feeds, rooms, auth, or backend setup.
        </p>
        <div className="hero-actions" aria-label="Primary swing lab actions">
          <a href="#profile-panel" className="primary-action">
            Edit profile
          </a>
          <a href="#scenario-panel" className="secondary-action">
            Enter shot
          </a>
        </div>
      </section>

      <section className="status-strip" aria-label="Swing lab constraints">
        <span>No login, GPS, map, weather, room, or backend dependency</span>
        <span>Versioned local presets stay on this device</span>
        <span>Manual scenario inputs recompute the analysis instantly</span>
      </section>

      <section id="profile-panel" className="lab-panel" aria-labelledby="profile-title">
        <div className="section-heading">
          <p className="eyebrow">Step 1 · Profile preset</p>
          <h2 id="profile-title">Load, edit, and save a golfer profile</h2>
          <p>{storageMessage}</p>
        </div>

        <label>
          Profile preset
          <select value={selectedPresetId} onChange={(event) => selectProfile(event.target.value)}>
            <optgroup label="Built-in presets">
              {builtInProfilePresets.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} — {presetSummary(profile)}
                </option>
              ))}
            </optgroup>
            {savedProfiles.length > 0 ? (
              <optgroup label="Saved on this device">
                {savedProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} — {presetSummary(profile)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        <div className="form-grid two-column">
          <label>
            Profile name
            <input value={activeProfile.name} onChange={(event) => setActiveProfile({ ...activeProfile, name: event.target.value })} />
          </label>
          <label>
            Archetype note
            <input value={activeProfile.archetype} onChange={(event) => setActiveProfile({ ...activeProfile, archetype: event.target.value })} />
          </label>
          <label>
            Height (cm)
            <input
              type="number"
              min="120"
              max="230"
              value={activeProfile.heightCm}
              onChange={(event) => setActiveProfile({ ...activeProfile, heightCm: Number(event.target.value) })}
            />
          </label>
          <label>
            Weight (kg)
            <input
              type="number"
              min="40"
              max="160"
              value={activeProfile.weightKg}
              onChange={(event) => setActiveProfile({ ...activeProfile, weightKg: Number(event.target.value) })}
            />
          </label>
          <label>
            Handicap
            <input
              type="number"
              min="-5"
              max="54"
              value={activeProfile.handicap}
              onChange={(event) => setActiveProfile({ ...activeProfile, handicap: Number(event.target.value) })}
            />
          </label>
          <label>
            Level
            <select
              value={activeProfile.level}
              onChange={(event) => setActiveProfile({ ...activeProfile, level: event.target.value as GolferLevel })}
            >
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shot shape
            <select
              value={activeProfile.shotShape}
              onChange={(event) => setActiveProfile({ ...activeProfile, shotShape: event.target.value as ShotShape })}
            >
              {shotShapeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trajectory tendency
            <select
              value={activeProfile.trajectoryTendency}
              onChange={(event) => setActiveProfile({ ...activeProfile, trajectoryTendency: event.target.value as TrajectoryTendency })}
            >
              {trajectoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tempo preference
            <select
              value={activeProfile.tempoPreference}
              onChange={(event) => setActiveProfile({ ...activeProfile, tempoPreference: event.target.value as TempoPreference })}
            >
              {tempoOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="club-grid" aria-label="Editable carry distances">
          {editableClubKeys.map((club) => (
            <label key={club}>
              {club.toUpperCase()} carry (m)
              <input
                type="number"
                min="30"
                max="330"
                value={distanceFor(activeProfile, club)}
                onChange={(event) => setActiveProfile(replaceClubDistance(activeProfile, club, Number(event.target.value)))}
              />
            </label>
          ))}
        </div>

        <button type="button" className="primary-action button-action sticky-action" onClick={saveCurrentProfile}>
          Save profile locally
        </button>
      </section>

      <section id="scenario-panel" className="lab-panel" aria-labelledby="scenario-title">
        <div className="section-heading">
          <p className="eyebrow">Step 2 · Manual shot scenario</p>
          <h2 id="scenario-title">Type the shot conditions</h2>
          <p>Every input is manual and deterministic, so the primary flow works offline and in a static smoke test.</p>
        </div>

        <div className="form-grid two-column">
          <label>
            Target distance (m)
            <input
              type="number"
              min="30"
              max="330"
              value={scenario.targetDistanceMeters}
              onChange={(event) => setScenario({ ...scenario, targetDistanceMeters: Number(event.target.value) })}
            />
          </label>
          <label>
            Wind direction
            <select
              value={scenario.windDirection}
              onChange={(event) => setScenario({ ...scenario, windDirection: event.target.value as WindDirection })}
            >
              {windDirections.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Wind strength
            <select
              value={scenario.windStrength}
              onChange={(event) => setScenario({ ...scenario, windStrength: event.target.value as WindStrength })}
            >
              {windStrengths.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lie
            <select value={scenario.lie} onChange={(event) => setScenario({ ...scenario, lie: event.target.value as LieCondition })}>
              {lieOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desired window
            <select
              value={scenario.desiredWindow}
              onChange={(event) => setScenario({ ...scenario, desiredWindow: event.target.value as ShotWindow })}
            >
              {windowOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="analysis-preview" aria-labelledby="analysis-title">
        <div>
          <p className="eyebrow">Live analysis preview</p>
          <h2 id="analysis-title">{recommendation.clubLabel} · {recommendation.swingSizeLabel}</h2>
          <p>{recommendation.distanceFeel}</p>
        </div>
        <div className="metric-grid">
          <span>
            <strong>{recommendation.gameMetricLabel}</strong>
            Plausibility
          </span>
          <span>
            <strong>{recommendation.tempo}</strong>
            Tempo
          </span>
          <span>
            <strong>{recommendation.trajectoryStrategy}</strong>
            Flight read
          </span>
        </div>
        <ul className="why-list">
          {recommendation.why.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
