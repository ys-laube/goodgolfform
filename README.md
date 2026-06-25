# FunGolf Field Betting Ledger

FunGolf is now a Korean, mobile-first golf side-game ledger for friends on the course. It replaces the previous caddie recommendation app with a local-only round setup, hole input, deterministic betting-game calculation, settlement board, and share-ready result summary.

## Product scope

This prototype focuses on private score and settlement bookkeeping:

- 2–4 player round setup with player names, optional handicaps, point-only or money-display mode, and per-game units.
- Fixed first-version game set: stroke/per-point, skins with carryover, 4-player Vegas/team mode, event bonus/penalty rows, and a pre-authored Korean mission card deck.
- Fast hole input for raw strokes, event markers, mission outcomes, and running settlement updates.
- Deterministic calculation breakdowns showing raw scores, per-game ledgers, aggregate balances, and final payer → receiver settlement suggestions.
- Share-ready Korean result card/text for group chat or screenshot sharing.
- Browser `localStorage` persistence on the current device only.

## Replacement and stale data policy

This app is a full product-surface replacement. Old caddie recommendation flows, club-distance presets, shot-coaching visuals, map/weather/provider experiments, and prior storage keys are obsolete.

- New storage uses a `golf-bet-ledger:*:v1` namespace.
- Old keys such as `korean-caddie:preset-distances:v1` are ignored or safely purged when explicitly handled.
- Caddie distance presets are never migrated into player names, game settings, hole results, or settlement data.

## Non-goals and safety boundaries

FunGolf is a private ledger/calculator, not a gambling, payment, or social platform.

- No backend, account, login, auth, database, cloud sync, realtime room, public room, ranking, matching, or social graph.
- No payment execution, wallet, escrow, deposit, withdrawal, payment API, or in-app settlement transfer.
- No URL or QR app-state sharing in v1; share output is display/copy metadata only.
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

## Required static scans

```bash
# Retired caddie/recommendation surface scan in runtime/docs
rg "캐디|처방|클럽 거리|샷 비주얼|탄도 이유|라이 조언|거리 프리셋|한국형 2D 셋업" src README.md DESIGN.md

# Forbidden backend/payment/network/provider scan
rg "fetch\(|WebSocket|EventSource|XMLHttpRequest|PaymentRequest|stripe|toss|portone|iamport|firebase|supabase|socket\.io|auth0|clerk|geolocation|mapbox|weather" src package.json package-lock.json
```
