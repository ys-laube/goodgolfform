import { MapShell } from './components/MapShell';
import { approximateDistanceDisclaimer, nonGoals, privacyNotes, productPrinciples } from './domain/copy';
import { sampleCourseTargets } from './domain/courseTargets';
import { targetDistances } from './domain/geo';
import { buildMockMapModel } from './domain/mapAdapter';
import { useCurrentLocation } from './hooks/useCurrentLocation';

const foundationCards = [
  {
    title: 'Create a round room',
    body: 'Start with a lightweight invite-link concept for friends sharing the same round context.',
  },
  {
    title: 'Add playful shot pins',
    body: 'Drop emoji notes for memorable shots without turning the app into scoring or social feed software.',
  },
  {
    title: 'Keep maps swappable',
    body: 'This foundation intentionally avoids provider-specific map SDKs so a later adapter can be selected safely.',
  },
] as const;

export function App() {
  const { state: locationState, requestLocation } = useCurrentLocation();
  const currentLocation =
    locationState.status === 'ready' || locationState.status === 'low_accuracy'
      ? locationState.sample
      : undefined;
  const mapModel = buildMockMapModel({ targets: sampleCourseTargets, currentLocation });
  const distances = currentLocation ? targetDistances(currentLocation, sampleCourseTargets) : [];

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="hero-card">
        <p className="eyebrow">Golf field GPS shot pins</p>
        <h1 id="app-title">FunGolf helps friends mark shots with approximate on-course context.</h1>
        <p className="hero-copy">{approximateDistanceDisclaimer}</p>
        <div className="hero-actions" aria-label="Foundation actions">
          <a href="#foundation" className="primary-action">
            View foundation
          </a>
          <a href="#privacy" className="secondary-action">
            Privacy notes
          </a>
        </div>
      </section>

      <section className="status-strip" aria-label="MVP foundation constraints">
        {productPrinciples.map((principle) => (
          <span key={principle}>{principle}</span>
        ))}
      </section>

      <section className="geo-panel" aria-labelledby="location-title">
        <div>
          <p className="eyebrow">G002 map/geolocation core</p>
          <h2 id="location-title">Current location states and manual course targets</h2>
          <p>{locationState.message}</p>
          <button type="button" className="primary-action button-action" onClick={() => void requestLocation()}>
            Use current location
          </button>
        </div>
        <div className={`location-badge ${locationState.status}`}>
          <span>Status</span>
          <strong>{locationState.status.replace('_', ' ')}</strong>
          {'sample' in locationState ? <small>Accuracy ≈ {Math.round(locationState.sample.accuracyMeters)} m</small> : null}
        </div>
      </section>

      <MapShell model={mapModel} />

      <section className="detail-panel" aria-labelledby="targets-title">
        <h2 id="targets-title">Sample/manual targets</h2>
        <p>Targets are local sample data for adapter and distance flows; no course database or backend is selected.</p>
        <ul className="target-list">
          {sampleCourseTargets.map((target) => {
            const distance = distances.find((item) => item.target.id === target.id);
            return (
              <li key={target.id}>
                <span>{target.type}</span>
                <strong>{target.label}</strong>
                <small>{distance ? distance.label : 'Request location for approximate distance'}</small>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="foundation" className="card-grid" aria-label="Foundation capabilities">
        {foundationCards.map((card) => (
          <article key={card.title} className="info-card">
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section id="privacy" className="detail-panel" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacy and implementation boundaries</h2>
        <ul>
          {privacyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="detail-panel muted" aria-labelledby="non-goals-title">
        <h2 id="non-goals-title">Non-goals for this foundation</h2>
        <ul>
          {nonGoals.map((nonGoal) => (
            <li key={nonGoal}>{nonGoal}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
