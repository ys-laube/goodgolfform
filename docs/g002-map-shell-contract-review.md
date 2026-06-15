# G002 Map Shell UI Contract Review

This review captures the provider-neutral UI contract for `G002-map-geo-distance` without selecting a map SDK or mutating `.omx/ultragoal` state.

## Provider-neutral contract

The map shell should expose app-owned data and state labels before any provider SDK is introduced:

- **Current location states**
  - `idle`: location has not been requested yet; show a clear action to request it.
  - `requesting`: browser permission or sensor lookup is in progress; avoid implying live tracking has started.
  - `ready`: show latitude/longitude context only with browser-reported accuracy and timestamp metadata.
  - `denied`: explain that permission was denied and keep manual/sample target review usable.
  - `unavailable`: explain that the browser/device cannot provide a fix and keep the shell stable.
  - `low-accuracy`: keep distances visible only as approximate context when accuracy is above the product threshold.
- **Distance labels**
  - Every distance shown from browser GPS must remain approximate-by-copy and approximate-by-format.
  - Labels should avoid rangefinder, ruling, safety, betting, or tournament language.
  - Accuracy metadata should be adjacent to the current-location state, not hidden in settings.
- **Sample/manual course targets**
  - Seed targets may be static sample data or manually entered room targets.
  - Target data must be app-owned `lat`/`lng` plus label/type fields, not provider-specific place objects.
  - The shell should still render useful sample targets when geolocation is denied or unavailable.
- **Adapter boundary**
  - UI components should depend on app-owned coordinate, target, and location-state contracts.
  - Map providers may be wrapped later behind an adapter that accepts app-owned markers and viewport data.
  - No component should import Mapbox, Google Maps, MapLibre, Kakao Maps, Leaflet, or provider SDK globals directly in G002.

## Review checklist for implementation integration

- [ ] Current-location UI has explicit denied, unavailable, requesting, ready, and low-accuracy states.
- [ ] Approximate distance copy is visible near any distance value.
- [ ] Sample/manual targets render independently from geolocation success.
- [ ] Target and marker props use app-owned coordinates and labels.
- [ ] Provider SDK packages are absent from `dependencies` and `devDependencies` until an adapter decision is approved.
- [ ] Any future provider selection documents API keys, quota/billing, regional coverage, and adapter ownership.

## Non-conflicting test coverage added

`src/domain/providerNeutralMapContract.test.ts` guards the package manifest against accidental provider SDK coupling while worker-1 owns the implementation lane.
