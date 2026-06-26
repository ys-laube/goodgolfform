# FunGolf Simple Scorecard

FunGolf is a Korean, mobile-first golf scorecard for field use. It starts as a 1-person personal record and can expand to 4 players on the same device. Enter each hole with quick 온/펏 buttons, keep short hole memos, review simple round stats, and save the full scorecard as a local PNG photo.

## Product scope

- Hero title is exactly `오늘 폼 정말 좋으시네요 ^0^`.
- 1-player default, with selectable 1–4 player support.
- Blank, editable player names; fields can be fully cleared with Backspace.
- Front/back scorecard grid for 1–18 holes with par row and player rows.
- Each score cell shows only the relative score (`0`, `-1`, `+2`, or `—`) plus a small `온 N · 펏 N` annotation.
- Selected-hole controls use large mobile-friendly 온/펏 buttons, plus 홀인원, direct stroke fallback, and clear score.
- Each hole can keep a free-text memo.
- Round review shows total relative score, front/back relative score, score-type counts, on/putt averages, 3-putt count, and memo highlights.
- Export creates a local PNG photo containing all holes, player rows, relative score cells, on/putt annotations, round review, and non-empty memos.
- Active round persistence is local-only with `fungolf-scorecard:active-round:v1`.

## Replacement and stale data policy

This app is a full replacement of previous experiments. Old experiments and unrelated product surfaces are obsolete.

- New active storage uses only `fungolf-scorecard:active-round:v1`.
- Previous local payload families are not restored into the scorecard model.
- Previous preset payloads are not migrated into player names, hole scores, memos, or export payloads.

## Non-goals

FunGolf is a private score recorder, not a social, coaching, payment, or external-service app.

- No backend, account, login, auth, database, cloud sync, realtime room, public room, ranking, matching, or social graph.
- No in-app money movement or transaction workflow.
- No public link, Web Share dependency, or server image rendering.
- No external field-data integrations, recommendation flow, coaching flow, or 3D/canvas runtime.
- No new runtime dependencies.

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
