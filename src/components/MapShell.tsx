import type { ProviderNeutralMapModel } from '../domain/mapAdapter';

const markerGlyph: Record<string, string> = {
  'current-location': '📍',
  tee: '🏌️',
  green: '⛳',
  pin: '🚩',
  hazard: '⚠️',
  custom: '⭐',
};

export function MapShell({ model }: { readonly model: ProviderNeutralMapModel }) {
  return (
    <section className="map-shell" aria-labelledby="map-shell-title">
      <div>
        <p className="eyebrow">Live course map</p>
        <h2 id="map-shell-title">Golf course context with approximate pins</h2>
        <p>
          Center {model.viewport.center.lat.toFixed(5)}, {model.viewport.center.lng.toFixed(5)} · zoom{' '}
          {model.viewport.zoom} · {model.viewport.zoomHint} view
        </p>
      </div>

      <div className="tile-map" role="img" aria-label="Golf course map with current location and course target markers">
        {model.tiles.map((tile) => (
          <img
            key={tile.id}
            alt=""
            className="tile-map-tile"
            src={tile.url}
            style={{ left: `${tile.leftPercent}%`, top: `${tile.topPercent}%` }}
            loading="lazy"
            draggable={false}
          />
        ))}
        {model.markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className={`tile-map-marker ${marker.kind}`}
            style={{ left: `${marker.screen.xPercent}%`, top: `${marker.screen.yPercent}%` }}
            aria-label={`${marker.label}: ${marker.coordinate.lat.toFixed(5)}, ${marker.coordinate.lng.toFixed(5)}`}
            title={`${marker.label} · ${marker.coordinate.lat.toFixed(5)}, ${marker.coordinate.lng.toFixed(5)}`}
          >
            <span aria-hidden="true">{markerGlyph[marker.kind]}</span>
          </button>
        ))}
      </div>

      <ul className="marker-list" aria-label="Map markers">
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
