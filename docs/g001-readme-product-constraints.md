# G001 README Product Constraints Draft

This document is a README-ready content draft for the Golf Field GPS Shot Pins G001 foundation. It is intentionally separate from `README.md` to avoid conflicts with the app scaffold lane.

## Suggested README sections

### Concept

Golf Field GPS Shot Pins is a mobile-first web app for small friend groups during a golf round. It helps a room of invited players view approximate on-course position context, compare rough distances to manually configured course targets, and leave lightweight shared shot pins with an emoji and short comment.

The G001 foundation should stay provider-neutral: it may include a map shell, domain model, utility tests, and setup instructions, but it should not hard-code a map provider, backend provider, API key workflow, or course database commitment.

### G001 scope

G001 is the foundation slice only:

- Scaffold a TypeScript mobile web app.
- Document the concept, setup, privacy expectations, and product boundaries.
- Add baseline test tooling for domain and utility tests.
- Keep map/provider and hosted persistence choices behind future adapters or explicit follow-up decisions.
- Preserve the MVP-critical future need for room/shared persistence without implementing that persistence in G001.

### Non-goals

The MVP is not:

- An official rules or rulings product.
- A scorecard, handicap, betting, or settlement app.
- A public social feed, search, follow, or discovery network.
- A rangefinder-grade or tournament-compliant measuring device.
- A nationwide/all-course database at launch.
- A provider-specific map SDK integration in the foundation slice.
- A course-map upload/calibration workflow unless the initial satellite/GPS MVP fails its usefulness review.

### Privacy and location boundaries

This app is intended for private invite-link rooms. Treat room URLs as share links: anyone with the link may be able to join or view room-scoped data depending on the eventual persistence implementation.

Location data can be sensitive. The app should request browser location permission only when needed, explain why it is requested, and handle denied/unavailable location without crashing. G001 should not introduce public location sharing, public profiles, or live friend tracking by default.

### Approximate distance boundaries

Distances and positions shown by this app are approximate and depend on browser GPS accuracy, device sensors, map imagery, target data, and network conditions. They are for casual orientation and shared round context only. They are not official measurements, not rangefinder-grade output, and not intended for rules, safety, betting, or tournament decisions.

### Provider neutrality note

Map, geolocation display, and persistence integrations should remain swappable. If a future phase chooses MapLibre, Mapbox, Google Maps, Kakao Maps, Supabase, Firebase, or another provider, that choice should be isolated behind clear adapter/repository boundaries and documented setup requirements.

## README acceptance checklist

Use this checklist when integrating the final `README.md`:

- [ ] Explains the friend-room golf GPS shot-pin concept in mobile-first terms.
- [ ] States G001 is foundation/test/docs only, not the full MVP.
- [ ] Includes privacy/location permission expectations.
- [ ] Includes approximate-distance language and avoids official/rangefinder-grade claims.
- [ ] Lists non-goals: rules/rulings, scoring, betting/settlement, public social feed, all-course database, provider-specific coupling.
- [ ] Mentions shared persistence is MVP-critical later, but not implemented in G001.
- [ ] Avoids selecting or coupling to a specific map/provider/backend in G001.
- [ ] Gives setup/test commands once the scaffold defines them.

## Source constraints reviewed

- `.omx/plans/prd-golf-field-gps-shot-pins.md`: Option A provider-isolated MVP, approximate-by-design, friend-room privacy, non-goals, and Phase 0 README/test tooling.
- `.omx/plans/test-spec-golf-field-gps-shot-pins.md`: distance copy must remain approximate; non-goal smoke should verify no scorecard, betting, public feed routes or labels.
- Leader handoff: workers must not mutate `.omx/ultragoal`; shared persistence is MVP-critical later but not implemented in G001.
