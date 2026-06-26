# Test Spec — Simple Golf Scorecard

## Source of truth
- PRD: `.omx/plans/prd-simple-golf-scorecard.md`.
- Product docs: `README.md`, `DESIGN.md`.
- Runtime surfaces: `src/App.tsx`, `src/ScorecardGrid.tsx`, `src/useScorecardController.ts`, `src/useBettingRoundSession.ts`.
- Domain/storage/share/export surfaces: `src/domain/bettingLedger.ts`, `src/domain/bettingStorage.ts`, `src/domain/bettingShareSnapshot.ts`, `src/scorecardExport.ts`.

## Existing coverage baseline
- `src/domain/bettingLedger.test.ts` already covers default 2–4 player setup, out-of-range player rejection, pairwise settlement, 배판 triggers, 4명 동타 carry, 파3 니어/니뻐, score metadata normalization, handicap deltas, deterministic net transfers, and calculation order.
- `src/domain/bettingStorage.test.ts` already covers v3 keying, round serialization/deserialization, blank player names, hole metadata, v2 migration, v1/v2 cleanup, caddie-key isolation/purge, corrupt payloads, unavailable storage, and clone-by-value behavior.
- `src/domain/bettingShareSnapshot.test.ts` already covers compact hash creation/round-trip, label restore, valid storage restore, invalid/unsupported/oversized rejection, and the hard `>2200` guard.
- `src/useBettingRoundSession.test.ts` already covers initial load, corrupt/unavailable storage, setup/player mutations, blank-name clearing, player-count resize/pruning, hole score/setup/near mutations, and 홀인원/raw-score capping.
- `src/scorecardExport.test.ts` already covers deterministic SVG export, XML escaping, blank-name behavior, and safe filename generation.
- `src/App.inputDrafts.test.ts`, `src/domain/golfBettingGuardrailsStatic.test.ts`, and `src/domain/golfBettingSsrStatic.test.ts` already cover draft helpers/source wiring, reset/share/export wiring, and local-only/static copy guardrails.
- Known coverage gap: `src/App.tsx` and `src/ScorecardGrid.tsx` are mostly protected by SSR/source assertions, not full DOM interaction tests.

## Domain tests
- Assert default round creation supports 2–4 players, creates blank player names, defaults to 18 holes and 5,000원 타당 금액, and rejects unsupported player counts.
- Assert hole count normalizes to 1–18, par normalizes to 3–5, and score strokes are clamped to the maximum safe value.
- Assert score entry modes are preserved for manual, 온/펏, and 홀인원 inputs.
- Assert 파3 니어 can be assigned only to active players on par-3 holes and is cleared when a hole changes away from par 3.
- Assert completed-hole detection ignores incomplete holes and includes holes only when every active player has a score.
- Assert pairwise 오장 타수차 settlement uses 타당 금액, player score deltas, and completed holes deterministically.
- Assert 배판 rows are emitted for 뒷문오픈, 홀인원, and 4명 동타 이월 behavior.
- Assert under-par bonus rows distinguish 버디, 이글, and 홀인원 values.
- Assert 파3 니어/니뻐 rows are zero-sum and do not leak money when no valid near player exists.
- Assert final-total handicap adjustment applies only as the final total delta and does not mutate raw stroke totals.
- Assert net transfers balance to zero, sort deterministically, and never create self-pay transfers.
- Assert rounding-residual correction keeps balances zero-sum after integer money rounding.
- Assert final settlement rows appear after 오장 calculation rows and preserve deterministic row ordering.
- Assert `normalizeBettingRound` preserves `roundId` and player order while trimming/clamping malformed IDs, handicaps, hole counts, and unit amounts according to the storage/domain contract.
- Assert ledger breakdown rows include inspectable Korean labels/details for each calculation source.

## Storage/session tests
- Assert active storage key is exactly `golf-bet-ledger:active-round:v3`.
- Assert v3 round serialization/deserialization round-trips players, settings, holes, par, 뒷문오픈, 니어, and score entry metadata.
- Assert supported v1/v2 payloads restore safely and are re-saved through the current v3 key when loaded.
- Assert invalid JSON, unsupported versions, malformed player lists, duplicate player IDs, malformed holes, unknown players, and out-of-range scores are rejected or normalized safely.
- Assert legacy v1/v2/v3 malformed payload shapes either restore through the documented compatibility path or fail closed without partial active-round mutation.
- Assert unavailable or throwing storage falls back to memory-only state without crashing the session.
- Assert reset, save, clear, and active mutation APIs update timestamps/status messages consistently.
- Assert `updateRoundSetup` clamps settings, `updateHoleSetup` clears `nearPlayerId` when par changes away from 3, `applyPlayerCountMutation` preserves stable unique IDs across shrink/expand, and `applyHoleScoreMutation` ignores unknown player IDs.
- Assert known legacy shot-advice keys such as `korean-caddie:preset-distances:v1` can be purged but are never migrated into scorecard player names, scores, settlement rows, or share payloads.

## Controller/UI behavior tests
- Add behavioral UI tests for `App`/`ScorecardGrid` beyond raw-source assertions: hole/tab selection, disabled back-nine button when `holeCount < 10`, par-cell focus selecting the hole, 뒷문오픈 toggle behavior, player score cell labels, and share-card action/status copy.
- Add `useScorecardController` hook tests for blank draft retention, numeric draft commit, 온/펏 and 홀인원 normalization, `resetScorecardDrafts()` clearing every draft, `scoreInputValue`/`parInputValue` preferring drafts over persisted values, and backdoor-open direct score clamping.
- Assert setup controls render for 2–4 players, blank-editable names, per-player handicap, hole count, and 타당 금액.
- Assert the hero title remains exactly `오늘 폼 정말 좋으시네요 ^0^` and `오장 룰 자세히 보기` remains available.
- Assert the scorecard renders front/back hole structure with 구분, 파, 뒷문오픈, and player rows.
- Assert selected-hole controls expose 온/펏 choices, manual stroke fallback, 홀인원, and 파3 니어 selection.
- Assert direct numeric entry supports temporary draft states where applicable, then normalizes on commit/blur/save.
- Assert blank user labels remain blank until edited and no runtime sample player/course/round names appear.
- Assert live settlement, 순정산, 계산 내역, and 공유 카드 sections render with Korean ledger/calculator copy.
- Assert the rules disclosure explains the fixed traditional 오장 ruleset and does not expose custom side-game/rule-builder controls.
- Assert UI copy describes money as informational settlement guidance, not executed payment.

## Share/export tests
- Assert `createBettingRoundShareHash` uses only the `#fg=` fragment and creates a compact local payload with labels plus round data.
- Assert share payloads target `<=1800` characters and hard-stop/reject above `<=2200` characters.
- Assert valid share hashes restore round labels, player names, handicaps, settings, par, 뒷문오픈, 니어, and all score entry modes.
- Assert unsupported, invalid, oversized, and storage-unavailable hashes fail with explicit restore reasons and no partial mutation.
- Assert local result-link copy does not require backend, account, provider SDK, network request, or new dependency.
- Add App-level share-flow tests for initial URL-hash restore success/failure paths, `unsupported`/`empty`/`invalid`/`payload-too-large` status messaging, `replaceCurrentLocationHash` failure handling, and empty-string `localResultLink`/`localQrCells` fallback behavior.
- Assert legacy compact v1/v2 payload parsing remains supported where promised, labels are sanitized/truncated to 80 chars, `withinTarget === false` but still-valid hashes remain usable, and `storage-unavailable` restore failure is explicit.
- Assert SVG export is deterministic, Korean-friendly, local-only, and contains scorecard metadata without canvas/image-service/network use.
- Assert exported blank player names remain blank rather than falling back to sample names.
- Assert export file names are sanitized while preserving Korean-friendly labels.
- If SVG geometry is treated as product contract, assert row count/height behavior, blank round/course title fallback, and no accidental fallback player names or external script injection.

## Static guardrail tests/scans
- Reject backend, database, realtime room, public room, login/auth/account, social graph, ranking/matching, payment execution, wallet, escrow, deposit/withdrawal, GPS, map, weather, location permission, caddie recommendation, club-distance advice, shot coaching, 3D, canvas, and external provider SDK surfaces.
- Reject stale caddie storage migration into the scorecard model.
- Reject side-game mode toggles, custom rule builders, scoring-mode switches, and hole-allocation handicap modes.
- Reject Apple logos, trademark lockups, copied Apple imagery, or affiliation claims.
- Assert dependency manifests do not add runtime packages for sharing, QR generation, backend/cloud, payments, GPS/maps/weather, 3D/canvas, or external services.
- Assert README/DESIGN continue to document local-only storage, URL-hash sharing, SVG export, non-payment boundaries, and fixed traditional 오장 scope.

## Focused rerun guidance
After adding or hardening tests, run a focused subset before the full gate:
```bash
npx vitest run src/App.inputDrafts.test.ts src/domain/bettingLedger.test.ts src/domain/bettingStorage.test.ts src/domain/bettingShareSnapshot.test.ts src/scorecardExport.test.ts src/useBettingRoundSession.test.ts src/domain/golfBettingGuardrailsStatic.test.ts src/domain/golfBettingSsrStatic.test.ts
```

## Risk-based coverage priorities
1. **Ledger correctness:** pairwise money movement, double-plate/carry, bonuses, near rows, handicap deltas, and net transfers must stay deterministic and zero-sum.
2. **Data safety:** malformed storage/hash payloads must not corrupt active rounds.
3. **Local-only boundaries:** sharing/export must not introduce backend/payment/provider surfaces.
4. **Field usability:** score entry, blank names, touch-friendly controls, and direct numeric drafts must be guarded by SSR/static tests where browser e2e is unavailable.
5. **Regression from retired surfaces:** caddie/shot-coaching and side-mode concepts must stay absent.

## Required verification
```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

## Completion checklist
- New or updated tests map every PRD acceptance criterion to at least one domain, UI/static, storage/share/export, or guardrail assertion.
- Existing test suite passes without weakening local-only, no-payment, no-backend, and no-sample-data guards.
- Any browser/manual smoke notes explicitly state what was checked and whether no-code documentation-only changes made a manual smoke unnecessary.
