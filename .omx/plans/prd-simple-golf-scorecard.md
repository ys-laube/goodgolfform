# PRD — Simple Golf Scorecard

## Source of truth
- User-approved pivot: remove betting/settlement and rebuild as a simple golf score recorder.
- Deep interview transcript: `.omx/interviews/simple-golf-scorecard-20260626T165648Z.md`.
- Context snapshot: `.omx/context/simple-golf-scorecard-20260626T164017Z.md`.
- Product docs: `README.md`, `DESIGN.md`.
- Runtime surfaces: `src/App.tsx`, `src/ScorecardGrid.tsx`, `src/useScorecardController.ts`, `src/useScorecardSession.ts`.
- Domain/storage/export surfaces: `src/domain/scorecard.ts`, `src/domain/scorecardStorage.ts`, `src/scorecardExport.ts`.

## Product goal
Deliver a Korean, mobile-first, local-only golf scorecard for field use. The default experience is a 1-person personal score recorder, expandable to 4 players on the same device. A golfer should be able to open the app, enter each hole with fast 온/펏 buttons, add short hole memos, review simple current-round stats, and save the full scorecard plus memos as a local SVG image.

## Target users
- Korean golfers who want a fast personal scorecard while walking the course.
- Small groups that want to record 1–4 players on one phone without account setup.
- iPhone and Samsung phone users who need large touch targets, readable Korean UI, and local export.

## Core product contract
The app is a **private local score recorder**:
- Default to 1 blank player; support 1–4 players.
- Every editable label can be fully cleared; never inject runtime sample names.
- Store only the active local round under `fungolf-scorecard:active-round:v1`.
- Do not restore obsolete betting/caddie payloads into the scorecard model.
- Expose a shared `ScorecardRoundView` read model for UI/export/tests.
- Export is a deterministic in-browser SVG download; no server, canvas, QR, share-link, or provider SDK.

## In scope
### Round setup
- 1–4 player selector, default 1.
- Blank editable player names.
- Optional round label, course label, and hole count from 1–18.
- Front/back scorecard structure for up to 18 holes.
- Per-hole par constrained to par 3–5.

### Score entry
- Selected-hole workflow with fast 온 and 펏 buttons.
- Scorecard cells show only relative score vs par as `0`, `-N`, `+N`, or `—`.
- Each completed score cell includes only the small annotation `온 N · 펏 N`.
- Hole-in-one shortcut, direct stroke fallback, and clear-score action for exceptions.
- Per-hole free-text memo.
- Mobile-first one-hand use with large, high-contrast controls.

### Current-round review
- Total relative score and front/back relative score.
- Birdie/par/bogey-or-worse style score-type counts.
- Average 온 and average 펏.
- 3-putt count.
- Memo highlights from non-empty hole memos.

### Export
- Bottom export section only; no floating card.
- Save full scorecard plus non-empty memos as a local SVG image/file.
- SVG should remain readable in iPhone/Samsung Files/Gallery/Downloads flows.
- Export file names should be Korean-friendly and safely sanitized.

### UI and copy
- Hero/page title remains exactly `오늘 폼 정말 좋으시네요 ^0^`.
- Korean-first copy: `스코어카드`, `홀 메모`, `온`, `펏`, `라운드 리뷰`, `이미지 저장`, `로컬 저장`.
- Apple-inspired in the broad UI sense only: refined, restrained, generous spacing, soft depth, high contrast.

## Out of scope / non-goals
- No betting, settlement, side games, rule builders, money movement, payment, wallet, escrow, deposit, withdrawal, or net-transfer guidance.
- No backend, database, cloud sync, realtime room, public room, account, login, auth, ranking, matching, social graph, QR, share-link, or URL-hash sharing.
- No GPS, map, weather, location permission, caddie advice, club-distance advice, shot coaching, 3D, canvas, or advanced analytics.
- No migration of old betting/caddie data into player names, scores, memos, stats, or export payloads.
- No new runtime dependencies.
- No Apple logos, trademark lockups, copied product imagery, or affiliation claims.

## Acceptance criteria
1. App starts with one blank player and supports selecting 1–4 players.
2. Player/round/course labels can be fully cleared with Backspace and remain blank unless entered by the user.
3. The scorecard renders holes 1–18 with par row and active player rows.
4. Selected-hole controls let users enter 온/펏 values, hole-in-one, direct strokes, clear score, and memo text.
5. Score cells display only relative score plus `온 N · 펏 N`; no other score metadata appears inside cells.
6. Par is displayed as `0`, under par as negative, over par as positive, and incomplete as `—`.
7. Per-hole memos persist locally and appear in the export.
8. Round review shows total/front/back relative summary, score-type counts, on/putt averages, 3-putt count, and memo highlights only.
9. Active storage key is `fungolf-scorecard:active-round:v1`; obsolete storage keys are not restored into the scorecard model.
10. SVG export is deterministic, local-only, includes the full scorecard and non-empty memos, and uses a safe Korean-friendly filename.
11. Runtime public docs and UI do not expose betting/settlement, QR/share-link, backend/auth/cloud, GPS/weather/map, caddie advice, or advanced analytics surfaces.
12. Verification passes: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Test strategy
- Domain tests for default round creation, player/hole count normalization, par normalization, relative labels, score-type counts, on/putt averages, memo highlights, and `ScorecardRoundView` derivation.
- Storage/session tests for v1 keying, blank-name persistence, malformed storage fallback, localStorage-unavailable safety, reset/clear behavior, and obsolete key quarantine.
- Controller/UI tests for editable draft clearing, selected-hole updates, 온/펏 score application, memo edits, hole-in-one/direct-stroke fallback, and front/back grid behavior.
- Export tests for deterministic SVG, XML escaping, full scorecard inclusion, memo inclusion, blank-name behavior, and filename safety.
- Static guardrails for removed product surfaces, dependency boundaries, Korean hero/title/copy, and local-only scorecard docs.

## ADR
Decision: replace the previous experimental ledger surfaces with a dependency-free, local-only React/TypeScript scorecard using localStorage for the active round and SVG for phone-friendly export.

### Drivers
- Field usability: fast hole entry matters more than workflow-heavy collaboration.
- Simplicity: one-device local recording avoids accounts, cloud, provider SDKs, and network risk.
- Korean-first clarity: users see a clean scorecard, relative score, on/putt details, memos, and current-round summary.
- Maintainability: a focused domain model and static guardrails prevent stale betting/caddie surfaces from returning silently.

### Alternatives rejected
- Backend/cloud/history: rejected for first version because the user explicitly excluded auth/cloud and advanced analytics.
- URL/QR sharing: rejected because the user selected local SVG image export only.
- Betting/settlement modes: rejected by the latest pivot to a pure score recorder.
- GPS/weather/caddie advice: rejected as non-goals for this product.

### Consequences
- Sharing is file/image based only.
- Round data is device-local unless the user manually exports the SVG.
- Future history, cloud sync, share links, or advanced analytics require a new interview/plan because current guardrails intentionally exclude them.
