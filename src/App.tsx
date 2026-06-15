import {
  approximateDistanceDisclaimer,
  nonGoals,
  privacyNotes,
  productPrinciples,
} from './domain/copy';

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
