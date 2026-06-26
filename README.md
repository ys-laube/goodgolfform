# FunGolf Traditional Ojang Ledger

FunGolf is a Korean, mobile-first traditional 오장 settlement ledger for friends on the course. It is a local-only calculator: set 2–4 players, enter each hole by 온/펏 or direct strokes, and see deterministic payer → receiver settlement suggestions.

## Product scope

This prototype focuses on private score and settlement bookkeeping:

- Opening hero copy uses the exact field-friendly title `오늘 폼 정말 좋으시네요 ^0^` and an `오장 룰 자세히 보기` disclosure for the local Ojang rule explanation.
- 2–4 player round setup with player names, final-total handicaps, and a single Ojang `타당 금액` unit amount.
- Fixed first-version rule set: Ojang-only hole-by-hole score-difference settlement with 배판/near-pin bookkeeping where supported by stored data.
- Front/back scorecard input with 1–18 hole grid, par row, 뒷문오픈 row, player rows, relative-to-par score buttons, and running settlement updates.
- Deterministic calculation breakdowns showing raw scores, Ojang ledger rows, aggregate balances, and final payer → receiver settlement suggestions.
- Bottom share card with only local SVG scorecard export and QR/result-link URL-hash snapshots.
- Browser `localStorage` persistence on the current device plus optional URL-hash snapshots carried only in the shared `#fg=` fragment.

## Replacement and stale data policy

This app is a full product-surface replacement. Old caddie recommendation flows, club-distance presets, shot-coaching visuals, map/weather/provider experiments, and prior betting-game surfaces are obsolete.

- New active storage uses `golf-bet-ledger:active-round:v3`; safe v1/v2 restore paths normalize old payloads into the single Ojang model.
- Old keys such as `korean-caddie:preset-distances:v1` are ignored or safely purged when explicitly handled.
- Caddie distance presets are never migrated into player names, hole results, or settlement data.

## Non-goals and safety boundaries

FunGolf is a private ledger/calculator, not a payment or social platform.

- No backend, account, login, auth, database, cloud sync, realtime room, public room, ranking, matching, or social graph.
- No payment execution, wallet, escrow, deposit, withdrawal, payment API, or in-app settlement transfer.
- URL/QR sharing is limited to local URL-hash snapshots (`#fg=`) and QR-like result-link rendering in the browser; no backend, account, provider, network API, or new dependency may be added for sharing.
- No GPS, map, weather, location permission, caddie recommendation, club-distance advice, shot coaching, or 3D visual runtime.
- No custom rule builder in v1; use the fixed Ojang rule set.
- Apple-inspired visual polish is used only as general design inspiration. There is no Apple logo, asset, trademark affiliation, or endorsement claim.

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

`npm run test` includes SSR/static guards for retired recommendation surfaces, forbidden backend/network/provider SDKs, payment-execution boundaries, local-only storage naming, v3 local URL-hash snapshot sharing, scorecard/export behavior, no runtime sample names, and the required Korean Ojang ledger screen concepts. Local result-link payloads target `<=1800` characters and must hard-stop at `<=2200` characters.
