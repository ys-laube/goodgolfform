# G005 Integration, E2E, and Field-Readiness Validation

## Scope

This readiness artifact records the MVP validation boundary for the invite-room golf GPS shot-pin foundation. It does not mutate `.omx/ultragoal`; the leader-owned ultragoal ledger remains the aggregate audit source.

## Evidence map

- `src/domain/g005-integration-e2e-field-readiness.test.ts` simulates two isolated browser contexts through independent room API clients sharing one backend handler.
- The two-context test poisons `localStorage` and `sessionStorage` so room/pin visibility must cross the API/repository boundary rather than browser-local state.
- Copy validation renders the app shell and checks approximate GPS/distance language, invite-link room privacy, and MVP non-goal absence.
- Fallback validation checks low-accuracy, denied, and timeout geolocation states while proving manual shot pins still build a safe field-ready payload.

## Field-readiness result

The MVP remains provider-neutral and approximate-by-design:

- Shared pins are visible across invite-room contexts with loose freshness snapshots.
- Distance labels use approximate `≈` copy and avoid rangefinder-grade precision promises.
- Public social, scoring, betting/settlement, and official-rulings areas remain non-goals.
- Location failures degrade to manual/tapped field notes instead of blocking the round flow.
