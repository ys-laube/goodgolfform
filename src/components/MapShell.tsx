import type { ProviderNeutralMapModel } from '../domain/mapAdapter';

export function MapShell({ model }: { readonly model: ProviderNeutralMapModel }) {
  return (
    <section className="map-shell" aria-labelledby="map-shell-title">
      <div>
        <p className="eyebrow">Provider-neutral map shell</p>
        <h2 id="map-shell-title">Course context without SDK coupling</h2>
        <p>
          Center {model.viewport.center.lat.toFixed(5)}, {model.viewport.center.lng.toFixed(5)} ·{' '}
          {model.viewport.zoomHint} view
        </p>
      </div>
      <ul className="marker-list" aria-label="Map shell markers">
        {model.markers.map((marker) => (
          <li key={marker.id}>
            <span>{marker.kind}</span>
            <strong>{marker.label}</strong>
            <small>
              {marker.coordinate.lat.toFixed(5)}, {marker.coordinate.lng.toFixed(5)}
            </small>
          </li>
        ))}
      </ul>
      <p className="map-attribution">{model.attribution}</p>
    </section>
  );
}
