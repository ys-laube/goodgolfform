# Deep Interview Spec — Simple Golf Scorecard

## Metadata
- Profile: standard
- Context type: brownfield
- Source status: synthesized from current product docs and team-approved plan artifacts; no separate raw interview transcript was present in this worker worktree.
- Primary source documents: `README.md`, `DESIGN.md`, `.omx/plans/prd-simple-golf-scorecard.md`, `.omx/plans/test-spec-simple-golf-scorecard.md`.
- Current implementation evidence: `src/App.tsx`, `src/ScorecardGrid.tsx`, `src/useScorecardController.ts`, `src/useBettingRoundSession.ts`, `src/domain/bettingLedger.ts`, `src/domain/bettingStorage.ts`, `src/domain/bettingShareSnapshot.ts`, `src/scorecardExport.ts`.
- Final ambiguity estimate: 12% because the product boundary is already implemented and documented; remaining ambiguity is mostly UI interaction depth and future rule variants.
- Threshold: 20%.

## Intent
Create and preserve a simple Korean golf scorecard app for friends on the course: fast mobile entry, local-only persistence, deterministic traditional 오장 settlement, inspectable calculation details, and lightweight local sharing/export. The product must feel like a private field utility, not a backend service, social game, payment product, or shot-coaching/caddie recommendation app.

## Desired outcome
A golfer can open the app on a phone, set up 2–4 blank-editable players, enter front/back hole scores quickly, view live 오장 balances and net settlement suggestions, inspect the calculation rows, and share/export a local scorecard artifact without creating an account or sending data to a server.

## In scope
1. **Round setup**
   - 2–4 players.
   - Blank editable player names; no runtime sample names.
   - Final-total handicaps per player.
   - Hole count from 1–18.
   - Configurable 타당 금액 with 5,000원 default.
   - Optional round and course labels for local display/share/export.

2. **Scorecard entry**
   - Front/back scorecard for up to 18 holes.
   - Per-hole par constrained to 3–5.
   - 뒷문오픈 per-hole toggle.
   - Player rows with fast 온/펏 entry buttons.
   - Manual/direct stroke fallback for exceptions.
   - 홀인원 entry.
   - 파3 니어 selection only for valid par-3 holes and active players.
   - Safe score clamping and normalization before settlement.

3. **Traditional 오장 ledger**
   - One fixed traditional 오장 ruleset.
   - Pairwise 타수차 settlement across completed holes.
   - 배판 triggers including 뒷문오픈, 홀인원, and 4명 동타 이월.
   - 버디/이글/홀인원 bonus rows.
   - 파3 니어/니뻐 zero-sum handling.
   - Final-total handicap adjustment delta.
   - Deterministic payer → receiver net transfers.
   - Korean breakdown rows for auditability.

4. **Persistence and local sharing**
   - Browser localStorage active round persistence under `golf-bet-ledger:active-round:v3`.
   - Safe restore of supported v1/v2/v3 payloads.
   - Safe purge of known legacy shot-advice storage keys without migrating them into scorecard data.
   - URL-hash snapshots using only `#fg=` fragment payloads.
   - Local result-link/QR-like rendering without external provider dependencies.
   - Deterministic local SVG scorecard export with Korean-safe file names.

5. **Korean mobile UI**
   - Hero title exactly `오늘 폼 정말 좋으시네요 ^0^`.
   - `오장 룰 자세히 보기` disclosure for the fixed rules.
   - Main sections: 라운드 세팅, 홀 입력, 실시간 정산 요약, 순정산/계산 내역, 공유 카드.
   - Large touch targets, high contrast, outdoor-readable layout.
   - Copy uses ledger/calculator language, not payment or social platform language.

## Out of scope / non-goals
- No backend, account, login, auth, database, cloud sync, realtime room, public room, ranking, matching, or social graph.
- No payment execution, wallet, escrow, deposit, withdrawal, payment API, transfer execution, or claim that money moved.
- No GPS, map, weather, location permission, caddie recommendation, club-distance advice, shot coaching, or 3D/canvas graphics runtime.
- No custom rule builder, side modes, team side games, scoring-mode toggles, or hole-allocation handicap modes.
- No migration of caddie preset distances into player names, scorecard rows, settlements, or share payloads.
- No Apple logo, copied Apple product imagery, trademark lockup, or affiliation language.
- No English-first UI; Korean visible copy is the product surface.

## Decision boundaries
OMX may decide without further confirmation:
- Exact React/TypeScript helper structure for draft inputs, scorecard controller behavior, local storage plumbing, and static guard tests.
- Korean microcopy for explanatory ledger rows as long as it remains audit-friendly and non-payment-oriented.
- Layout refinements that preserve the documented mobile-first workflow and required hero/rules copy.
- Additional tests that strengthen local-only, no-payment, no-sample-data, score normalization, and ledger correctness guards.

OMX must not decide without further confirmation:
- Adding backend/cloud/account/auth/realtime/payment/GPS/map/weather/provider SDKs.
- Adding new runtime dependencies for QR, sharing, payment, graphics, or backend features.
- Changing from the fixed traditional 오장 ruleset to a custom rule builder or side-game platform.
- Reintroducing caddie recommendation, club-distance advice, shot-coaching visuals, or 3D runtime surfaces.
- Removing blank-name behavior or replacing it with runtime sample names.
- Weakening the `#fg=` local URL-hash share boundary or SVG-only export boundary.

## Constraints
- Data remains local-first and must behave safely when localStorage is unavailable, corrupt, or throwing.
- Share payloads target `<=1800` characters and hard-stop at `<=2200` characters.
- Score normalization must prevent invalid ledger inputs and preserve deterministic settlement.
- Net money suggestions must balance to zero and remain informational only.
- UI and tests must preserve Korean field-use language and avoid implying legal/payment/gambling operations beyond a private ledger.
- Existing guardrails for retired caddie/backend/payment/service surfaces must remain strong.

## Evidence vs inference
### Brownfield evidence
- `README.md` and `DESIGN.md` define the app as a Korean mobile-first traditional 오장 settlement ledger.
- `src/domain/bettingLedger.ts` contains the deterministic settlement model, calculation order, row labels, bonuses, handicap delta, and net transfers.
- `src/domain/bettingStorage.ts` defines v3 local active-round storage and safe legacy restore/purge boundaries.
- `src/domain/bettingShareSnapshot.ts` defines local `#fg=` hash snapshots and payload length limits.
- `src/scorecardExport.ts` defines local SVG scorecard export.
- Existing tests cover core domain, storage, share, export, SSR/static guardrails, and draft helper wiring.

### Inference
- Outdoor/mobile use implies large touch targets and minimal modal friction, consistent with `DESIGN.md` but not requiring a new browser automation stack for this documentation task.
- Future rule variants may be requested later, but current docs intentionally prevent silent expansion beyond fixed traditional 오장.
- Runtime DOM tests would strengthen confidence in scorecard interactions; current test spec records them as hardening checks rather than a prerequisite for this no-code planning artifact.

## Testable acceptance criteria
1. App supports 2–4 blank-editable players, per-player handicaps, hole count, and 타당 금액.
2. App renders front/back scorecard with par, 뒷문오픈, player rows, 온/펏 entry, manual stroke fallback, 홀인원, and 파3 니어.
3. Incomplete holes do not produce completed-hole settlement rows.
4. Completed holes produce deterministic 오장 타수차, 배판, bonus, 니어/니뻐, handicap delta, and net-transfer rows.
5. Ledger balances are zero-sum and net transfers never require self-payment.
6. Korean calculation details explain each balance-changing row.
7. Active local storage key is `golf-bet-ledger:active-round:v3` and supported v1/v2/v3 payloads restore safely.
8. Corrupt storage/hash payloads fail closed or normalize safely without crashing.
9. URL sharing uses only `#fg=` hash payloads, preserves labels/scorecard metadata, and enforces target/max length limits.
10. SVG scorecard export is deterministic, local-only, and preserves blank-name behavior.
11. Runtime copy does not invent sample player/course/round names.
12. Hero title remains exactly `오늘 폼 정말 좋으시네요 ^0^` and fixed rules disclosure remains available.
13. No backend/auth/social/payment/GPS/map/weather/caddie/shot-coaching/3D/canvas/provider surfaces are introduced.
14. Verification commands pass: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Assumptions resolved
- The product is a local ledger/calculator, not a payment app.
- The current rule scope is traditional 오장 only.
- Blank names are intentional and should not be replaced with samples.
- URL-hash sharing and SVG export are sufficient for this pass.
- Old caddie/shot-advice state is obsolete and must stay isolated from the scorecard.
- Existing React/Vite/TypeScript stack is sufficient; no new dependency is needed.

## Open questions for future work
- Whether to add a browser DOM/e2e test stack for stronger interaction coverage.
- Whether additional traditional rule variants should become first-class, which would require a new PRD because the current scope intentionally rejects a custom rule builder.
- Whether real-world mobile usability testing suggests further score-entry shortcuts beyond the current 온/펏/manual/HIO controls.

## Recommended handoff
- Current implementation/docs are ready for `$ultragoal`/team integration once assigned artifacts are merged.
- If scope changes toward live rooms, payments, GPS, caddie recommendation, or custom rule variants, route back through `$deep-interview` and `$ralplan` before implementation.
