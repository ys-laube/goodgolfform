import { SwingMotionViewer } from './components/SwingMotionViewer';
import { builtInProfilePresets } from './domain/profilePresets';
import type {
  ClubKey,
  GolferLevel,
  LieCondition,
  ShotShape,
  ShotWindow,
  TempoPreference,
  TrajectoryTendency,
  WindDirection,
  WindStrength,
} from './domain/swingLabModels';
import { distanceFor, presetSummary, replaceClubDistance, useSwingLabSession } from './useSwingLabSession';

const levelOptions: readonly GolferLevel[] = ['beginner', 'developing', 'single-digit', 'scratch'];
const shotShapeOptions: readonly ShotShape[] = ['straight', 'draw', 'fade'];
const trajectoryOptions: readonly TrajectoryTendency[] = ['low', 'mid', 'high'];
const tempoOptions: readonly TempoPreference[] = ['smooth', 'neutral', 'assertive'];
const windDirections: readonly WindDirection[] = ['none', 'headwind', 'tailwind', 'left-to-right', 'right-to-left'];
const windStrengths: readonly WindStrength[] = ['calm', 'light', 'steady', 'strong'];
const lieOptions: readonly LieCondition[] = ['tee', 'fairway', 'rough', 'bunker'];
const windowOptions: readonly ShotWindow[] = ['standard', 'low', 'high'];
const editableClubKeys: readonly ClubKey[] = ['driver', '7i', 'pw'];

export function App() {
  const {
    activeProfile,
    analysisCards,
    motionParameters,
    recommendation,
    savedProfiles,
    scenario,
    selectedPresetId,
    setActiveProfile,
    setScenario,
    selectProfile,
    saveCurrentProfile,
    storageMessage,
  } = useSwingLabSession();

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="hero-card swing-hero">
        <p className="eyebrow">Serious Golf Swing Lab</p>
        <h1 id="app-title">Player profile in. Scenario context out. Analysis card ready.</h1>
        <p className="hero-copy">
          A mobile-first practice lab for golf friends: saved profiles, core tendencies, and manual shot context produce
          a deterministic analysis card, motion-viewer state, and serious practice read.
        </p>
        <div className="hero-actions" aria-label="Primary swing lab actions">
          <a href="#profile-panel" className="primary-action">
            Profile panel
          </a>
          <a href="#scenario-panel" className="secondary-action">
            Scenario panel
          </a>
        </div>
      </section>

      <section id="profile-panel" className="lab-panel" aria-labelledby="profile-title">
        <div className="section-heading">
          <p className="eyebrow">Step 1 · Profile preset</p>
          <h2 id="profile-title">Golfer profile details</h2>
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
          <h2 id="scenario-title">Manual shot conditions</h2>
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
        <div className="section-heading">
          <p className="eyebrow">Live analysis report</p>
          <h2 id="analysis-title">{recommendation.clubLabel} · {recommendation.swingSizeLabel}</h2>
          <p>
            Serious game-card reads from the deterministic shot model: distance feel, swing load, flight lane, and scenario fit stay
            profile-aware without prescriptive wording.
          </p>
        </div>

        <div className="analysis-card-grid" aria-label="Analysis report cards">
          {analysisCards.map((card) => (
            <article className="analysis-card" key={card.id}>
              <p className="card-label">{card.label}</p>
              <strong>{card.title}</strong>
              <p>{card.detail}</p>
              <span>{card.meta}</span>
            </article>
          ))}
        </div>

        {recommendation.adjustments.length > 0 ? (
          <div className="adjustment-strip" aria-label="Scenario adjustment reads">
            {recommendation.adjustments.map((adjustment) => (
              <span key={adjustment.label}>
                <strong>{adjustment.label}</strong> {adjustment.meters > 0 ? '+' : ''}{adjustment.meters} m · {adjustment.reason}
              </span>
            ))}
          </div>
        ) : null}

        <div className="why-panel" aria-labelledby="why-title">
          <p className="card-label" id="why-title">
            Why this card
          </p>
          <ul className="why-list">
            {recommendation.why.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </section>

      <SwingMotionViewer parameters={motionParameters} recommendation={recommendation} />
    </main>
  );
}
