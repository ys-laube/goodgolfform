# Test Spec — Simple Golf Scorecard

## Source of truth
- PRD: `.omx/plans/prd-simple-golf-scorecard.md`.
- Deep interview transcript: `.omx/interviews/simple-golf-scorecard-20260626T165648Z.md`.
- Product docs: `README.md`, `DESIGN.md`.
- Runtime surfaces: `src/App.tsx`, `src/ScorecardGrid.tsx`, `src/useScorecardController.ts`, `src/useScorecardSession.ts`.
- Domain/storage/export surfaces: `src/domain/scorecard.ts`, `src/domain/scorecardStorage.ts`, `src/scorecardExport.ts`.

## Existing coverage baseline
- `src/domain/scorecard.test.ts` covers round defaults, 1–4 player support, relative labels, review stats, and view-model behavior.
- `src/domain/scorecardStorage.test.ts` covers local storage keying, persistence, malformed payload fallback, unavailable storage, and stale-key quarantine.
- `src/useScorecardSession.test.ts` covers session load/save/reset/update flows and editable scorecard state.
- `src/scorecardExport.test.ts` covers deterministic SVG export, escaping, memo inclusion, and filename behavior.
- `src/domain/scorecardStatic.test.ts` covers SSR/static product guardrails, metadata, storage key boundaries, and removal of retired concepts.

## Domain tests
- Assert default round creation starts with 1 blank player, 18 holes, blank labels, and valid par defaults.
- Assert player count normalizes to 1–4 and preserves stable player ordering where possible.
- Assert hole count normalizes to 1–18 and par normalizes to 3–5.
- Assert editable labels and player names can be empty strings.
- Assert applying 온/펏 values creates a completed score with total strokes `on + putt` while preserving on/putt annotations.
- Assert hole-in-one and direct-stroke fallback normalize safely.
- Assert score labels are `—`, `0`, `-N`, or `+N` only.
- Assert score-type counts classify under-par, par, bogey, double-or-worse, and incomplete holes deterministically.
- Assert review stats compute total relative score, front/back relative score, average on, average putts, 3-putt count, and memo highlights.
- Assert `ScorecardRoundView` exposes exactly the read data needed by App/Grid/Export without leaking retired ledger/share concepts.

## Storage/session tests
- Assert active storage key is exactly `fungolf-scorecard:active-round:v1`.
- Assert serialization/deserialization round-trips labels, players, hole count, par, on/putt scores, direct scores, hole-in-one state, and memos.
- Assert invalid JSON, unsupported versions, malformed player lists, malformed holes, and out-of-range values fail closed or normalize without crashing.
- Assert unavailable or throwing storage falls back to memory-only state.
- Assert reset creates a blank scorecard rather than sample names.
- Assert old betting/caddie storage families are not migrated into names, scores, memos, stats, or export payloads.
- Assert session status messages and save/clear paths remain local-only.

## Controller/UI behavior tests
- Assert player name, round label, course label, and numeric drafts can be fully cleared with Backspace-like empty strings before commit/blur.
- Assert front/back tabs or sections select the intended hole and keep score entry focused on the selected hole.
- Assert par edits update the selected hole and recompute relative labels.
- Assert 온 and 펏 button flows update the selected player/hole score.
- Assert hole-in-one, direct stroke fallback, and clear-score actions update the scorecard consistently.
- Assert memo edits persist and appear in the selected-hole panel.
- Assert scorecard cells show only the main relative score and small `온 N · 펏 N` annotation.
- Assert the hero title remains exactly `오늘 폼 정말 좋으시네요 ^0^`.
- Assert setup, scorecard, selected-hole input, round review, and image export sections render in Korean.
- Assert no sample player names appear at runtime.

## Export tests
- Assert SVG export is deterministic for the same view model.
- Assert exported SVG includes all configured holes, active player rows, relative scores, on/putt annotations, and non-empty memos.
- Assert XML text is escaped and Korean labels remain readable.
- Assert blank names remain blank or neutral without injecting sample names.
- Assert filenames are safe and Korean-friendly.
- Assert export uses local SVG generation only: no canvas, image service, network request, share-link, QR, or external provider SDK.

## Static guardrail tests/scans
- Reject betting/settlement language and retired side-game concepts from runtime source and public docs.
- Reject backend, database, cloud sync, realtime rooms, public rooms, login/auth/account, social graph, ranking/matching, QR, share-link, payment execution, wallet, escrow, GPS, map, weather, caddie advice, club-distance advice, shot coaching, advanced analytics, 3D, canvas, and external provider SDK surfaces.
- Assert dependency manifests do not add runtime packages for sharing, QR, backend/cloud, payments, GPS/maps/weather, 3D/canvas, or external services.
- Assert README/DESIGN/index metadata document a local-only simple scorecard, SVG export, and current-round stats.

## Focused rerun guidance
After changing scorecard behavior, run:
```bash
npx vitest run src/domain/scorecard.test.ts src/domain/scorecardStorage.test.ts src/useScorecardSession.test.ts src/scorecardExport.test.ts src/domain/scorecardStatic.test.ts
```

## Required verification
```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

## Completion checklist
- Acceptance criteria in the PRD map to at least one domain, storage/session, controller/UI, export, or static guardrail assertion.
- Removed product surfaces remain absent from runtime and public docs.
- Verification passes without adding dependencies or weakening local-only scorecard boundaries.
