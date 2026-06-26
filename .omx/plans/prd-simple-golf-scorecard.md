# PRD — Simple Golf Scorecard

## Source of truth
- Current product docs: `README.md`, `DESIGN.md`.
- Current app surfaces: `src/App.tsx`, `src/ScorecardGrid.tsx`, `src/useScorecardController.ts`, `src/useBettingRoundSession.ts`.
- Current domain/storage surfaces: `src/domain/bettingLedger.ts`, `src/domain/bettingStorage.ts`, `src/domain/bettingShareSnapshot.ts`.
- Current export surface: `src/scorecardExport.ts`.
- Regression evidence: existing Vitest coverage under `src/*.test.ts` and `src/domain/*.test.ts`.

## Product goal
Deliver a Korean, mobile-first, local-only golf scorecard that lets 2–4 friends enter a round quickly, keep a simple front/back scorecard, and view deterministic traditional 오장 settlement guidance without accounts, backend services, payment execution, or coaching/recommendation features.

## Target users
- Korean recreational golfers tracking a foursome during a round.
- Groups that already know their 오장 rules and need a fast ledger/calculator, not a social/payment app.
- Users who may be outdoors on mobile, need large touch targets, and should not be forced into sample data or account setup.

## Core product contract
The app is a **private scorecard and settlement calculator**:
- Data stays local to the browser by default.
- Saved active rounds use the current local storage key: `golf-bet-ledger:active-round:v3`.
- Share/restore uses local URL-hash snapshots only, prefixed by `#fg=`.
- Export uses a deterministic local SVG scorecard artifact.
- Money values are informational settlement suggestions only; no payment is executed.

## In scope
### Round setup
- 2–4 player support.
- Blank, user-editable player names; never invent runtime sample names.
- Per-player final-total handicap values.
- Configurable hole count from 1–18.
- Configurable 타당 금액 with 5,000원 default.
- Optional round/course labels for local display/share/export.

### Scorecard entry
- Front/back scorecard structure for up to 18 holes.
- Per-hole par value constrained to par 3–5.
- 뒷문오픈 toggle per hole.
- Player rows with fast 온/펏 entry buttons.
- Manual direct stroke entry for exceptions.
- 홀인원 entry support.
- 파3 니어 player selection, available only when the hole is par 3.
- Safe score normalization with a hard upper bound to prevent invalid ledger inputs.

### 오장 ledger
- Single traditional 오장 ruleset only.
- Pairwise 타수차 settlement by completed hole.
- 배판 triggers, including 뒷문오픈, 홀인원, and 4명 동타 이월 behavior.
- Under-par bonuses for 버디/이글/홀인원.
- 파3 니어/니뻐 zero-sum rows.
- Final-total handicap adjustment delta.
- Deterministic payer → receiver net transfer suggestions.
- Inspectable Korean calculation rows so users can audit how balances were produced.

### Persistence and sharing
- Load/save/reset/clear the active local round.
- Safely restore supported v1/v2/v3 local payloads into the current v3 model.
- Purge ignored legacy shot-advice preset data without migrating it into the scorecard.
- Create local URL-hash share snapshots targeting `<=1800` characters and hard-stopping at `<=2200` characters.
- Restore labels plus par/backdoor/near/score metadata from a valid hash snapshot.
- Generate local SVG scorecard export with Korean-friendly file names.

### UI and copy
- Hero title remains exactly `오늘 폼 정말 좋으시네요 ^0^`.
- Provide `오장 룰 자세히 보기` disclosure for the fixed rules.
- Keep the main workflow mobile-first: setup, hole entry, live settlement, calculation details, share card.
- Use ledger/calculator language such as `오장 정산`, `순정산`, `계산 내역`, `타당 금액`, `받을 금액`, `줄 금액`, and `공유 카드`.
- Preserve high contrast, large tap targets, and readable outdoor layout.

## Out of scope / non-goals
- No backend, database, cloud sync, realtime room, public room, account, login, auth, ranking, matching, or social graph.
- No payment execution, wallet, escrow, deposit, withdrawal, payment API, in-app settlement transfer, or claim that money moved.
- No GPS, map, weather, location permission, caddie recommendation, club-distance advice, shot coaching, or 3D/canvas graphics runtime.
- No custom betting/rule builder beyond 타당 금액 and final-total handicaps.
- No side-game modes, team side games, scoring-mode toggles, or hole-allocation handicap modes.
- No migration of old caddie distance presets into names, scores, settlements, or share payloads.
- No Apple logos, trademark lockups, copied product imagery, or affiliation claims.

## Acceptance criteria
1. Round setup supports 2–4 players with blank-editable names, handicap fields, hole count, and 타당 금액 controls.
2. The scorecard renders 1–18 holes with par rows, 뒷문오픈 row, player rows, 온/펏 buttons, 홀인원, 파3 니어, and manual stroke fallback.
3. Completed-hole ledger rows calculate pairwise 오장 타수차, 배판, under-par bonuses, 파3 니어/니뻐, final handicap delta, and net transfers deterministically.
4. The app shows Korean calculation detail rows that explain why each balance changed.
5. Active round storage uses `golf-bet-ledger:active-round:v3`; supported v1/v2 data restores safely and re-saves into v3.
6. URL-hash sharing uses only the `#fg=` fragment, restores labels and scorecard metadata locally, targets `<=1800` characters, and rejects payloads above `<=2200` characters.
7. SVG scorecard export is produced entirely in-browser without canvas, image service, or network dependency.
8. Blank player/course/round labels remain blank unless the user enters them; runtime does not show sample player names.
9. Local-only and non-payment boundaries are visible in copy and enforced by static guard tests.
10. Retired caddie, shot-coaching, external-service, backend/auth/GPS/map/weather, payment-execution, side-mode, and 3D surfaces do not reappear.
11. The hero title remains exactly `오늘 폼 정말 좋으시네요 ^0^` and the rules disclosure remains available.
12. Verification passes: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Test strategy
- Domain tests for default round creation, score normalization, 오장 ledger rows, double-plate/carry behavior, bonuses, near rows, handicap adjustment, and net-transfer balancing.
- Storage tests for v3 serialization, v1/v2 restore safety, invalid payload rejection, unavailable storage behavior, and legacy shot-advice purge boundaries.
- Share snapshot tests for compact hash encoding, restore, label handling, target/max length limits, and invalid hash rejection.
- UI/static tests for required Korean screen concepts, no sample names, local-only copy, forbidden service/payment/coaching strings, and required hero/rules copy.
- Export tests for deterministic local SVG output, blank-name handling, and Korean-safe filenames.

## ADR
Decision: keep the product as a dependency-free, local-only React/TypeScript scorecard plus traditional 오장 settlement ledger, using localStorage, URL-hash snapshots, and SVG export for persistence/share/export.

### Drivers
- Field usability: users need quick mobile entry and readable settlement, not accounts or workflow-heavy collaboration.
- Trust: deterministic local calculations and inspectable rows are easier to audit than opaque shared services.
- Safety boundaries: informational money settlement must not become payment execution.
- Small app constraints: existing React/Vite stack can cover the scope without adding runtime dependencies.

### Alternatives considered
- Backend room/cloud sync: rejected because it adds auth, privacy, network, and operational risk outside local-only scope.
- Payment/wallet integration: rejected because the app must remain a calculator, not a money-movement product.
- Generic custom rule builder: rejected because this pass supports one fixed traditional 오장 ruleset.
- Reuse old caddie/shot-advice flows: rejected as stale product surface unrelated to a simple scorecard ledger.

### Consequences
- Sharing remains payload-size constrained by the URL hash.
- Multi-device/live collaboration is intentionally unavailable.
- Future rule variants require a new PRD/spec because current guardrails intentionally prevent silent scope creep.
