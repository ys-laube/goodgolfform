# FunGolf Field Betting Ledger

FunGolf is now a Korean, mobile-first golf side-game ledger for friends on the course. It replaces the previous caddie recommendation app with a local-only round setup, hole input, deterministic betting-game calculation, settlement board, and share-ready result summary.

## Product scope

This prototype focuses on private score and settlement bookkeeping:

- 2–4 player round setup with player names, optional handicaps, point-only or money-display mode, and per-game units.
- Fixed first-version game set: stroke/per-point, skins with carryover, 4-player Vegas/team mode, event bonus/penalty rows, and a pre-authored Korean mission card deck.
- Front/back scorecard input with 1–18 hole grid, par row, 뒷문오픈 row, player rows, relative-to-par score buttons, event markers, mission outcomes, and running settlement updates.
- Deterministic calculation breakdowns showing raw scores, per-game ledgers, aggregate balances, and final payer → receiver settlement suggestions.
- Bottom share card with only local SVG scorecard export and QR/result-link URL-hash snapshots.
- Browser `localStorage` persistence on the current device plus optional URL-hash snapshots carried only in the shared `#fg=` fragment.

## Replacement and stale data policy

This app is a full product-surface replacement. Old caddie recommendation flows, club-distance presets, shot-coaching visuals, map/weather/provider experiments, and prior storage keys are obsolete.

- New active storage uses `golf-bet-ledger:active-round:v2`; v1 betting-round payloads are migrated, while old caddie keys remain ignored.
- Old keys such as `korean-caddie:preset-distances:v1` are ignored or safely purged when explicitly handled.
- Caddie distance presets are never migrated into player names, game settings, hole results, or settlement data.

## Non-goals and safety boundaries

FunGolf is a private ledger/calculator, not a gambling, payment, or social platform.

- No backend, account, login, auth, database, cloud sync, realtime room, public room, ranking, matching, or social graph.
- No payment execution, wallet, escrow, deposit, withdrawal, payment API, or in-app settlement transfer.
- URL/QR sharing is limited to local URL-hash snapshots (`#fg=`) and QR-like result-link rendering in the browser; no backend, account, provider, network API, or new dependency may be added for sharing.
- No GPS, map, weather, location permission, caddie recommendation, club-distance advice, shot coaching, or 3D visual runtime.
- No custom rule builder in v1; use the fixed game set and fixed mission deck.
- Apple-inspired visual polish is used only as general design inspiration. There is no Apple logo, asset, trademark affiliation, or endorsement claim.

## Design reference

See [`DESIGN.md`](./DESIGN.md) for the local design system: Korean-first mobile typography, premium card depth, field-speed interaction targets, and boundaries around Apple-inspired styling.

## Setup

```bash
npm install
npm run dev
```

## Verification scripts

```bash
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

## Static guard coverage

`npm run test` includes SSR/static guards for retired recommendation surfaces, forbidden backend/network/provider SDKs, payment-execution boundaries, local-only storage naming, v2 local URL-hash snapshot sharing, scorecard/export behavior, no runtime sample names, and the required Korean betting-ledger screen concepts. Local result-link payloads target `<=1800` characters and must hard-stop at `<=2200` characters. Keep those guards green before release.
