# Deep Interview Spec — Simple Golf Scorecard

## Metadata
- Profile: standard.
- Context type: brownfield replacement.
- Primary source documents: `.omx/interviews/simple-golf-scorecard-20260626T165648Z.md`, `.omx/context/simple-golf-scorecard-20260626T164017Z.md`, `.omx/plans/prd-simple-golf-scorecard.md`, `.omx/plans/test-spec-simple-golf-scorecard.md`, `README.md`, `DESIGN.md`.
- Final ambiguity estimate: <=5% for the approved first version.
- Handoff readiness: ready for `$ultragoal` implementation/finalization.

## Intent
Create and preserve a simple Korean golf scorecard app for field use. The app is for recording a current round quickly, not for betting, settlement, social sharing, cloud history, GPS/weather/map, or caddie advice.

## Desired outcome
A golfer opens the app on a phone, starts with one blank player, optionally expands to up to four players, enters each hole with 온/펏 buttons, sees a clean relative-score card, adds short hole memos, reviews simple current-round stats, and saves the full scorecard plus memos as a local SVG image.

## In scope
1. **Round setup**
   - 1 player by default, selectable up to 4 players.
   - Blank editable player names, round label, and course label.
   - Hole count up to 18.
   - Per-hole par values.

2. **Scorecard entry**
   - Front/back scorecard with hole row, par row, and active player rows.
   - Selected-hole entry with fast 온 and 펏 buttons.
   - Hole-in-one shortcut, direct stroke fallback, and clear-score action.
   - Score cells show only relative score (`—`, `0`, `-N`, `+N`) and a small `온 N · 펏 N` annotation.
   - Per-hole memo text.

3. **Simple current-round analysis**
   - Total relative score.
   - Front/back relative score.
   - Score-type counts.
   - Average on and average putts.
   - 3-putt count.
   - Memo highlights.

4. **Persistence/export**
   - Local active-round persistence only.
   - Storage key: `fungolf-scorecard:active-round:v1`.
   - Old betting/caddie payloads are not restored into the new scorecard model.
   - Full scorecard plus non-empty memos exported as deterministic local SVG.

5. **Korean mobile UI**
   - Hero/page title exactly `오늘 폼 정말 좋으시네요 ^0^`.
   - Korean-first labels and copy.
   - iPhone/Samsung-friendly touch targets and readable layout.
   - Restrained Apple-inspired visual language without Apple assets or affiliation claims.

## Out of scope / non-goals
- No betting, settlement, side games, rule builders, money movement, payment, wallet, escrow, or transfer suggestions.
- No backend, database, cloud sync, realtime room, public room, account, login, auth, ranking, matching, social graph, QR, share-link, or URL-hash sharing.
- No GPS, map, weather, location permission, caddie advice, club-distance advice, shot coaching, 3D, canvas, or advanced analytics.
- No migration of old betting/caddie data into player names, scores, memos, stats, storage, or export.
- No new runtime dependencies.
- No English-first UI.

## Decision boundaries
OMX may decide without further confirmation:
- React/TypeScript helper structure, controller/session boundaries, and test organization.
- Korean microcopy that stays within simple score-recording language.
- SVG layout and filename details that remain local-only and phone-friendly.
- Static guardrail wording that prevents retired surfaces from returning.

OMX must not decide without further confirmation:
- Adding cloud/auth/backend/share-link/QR/payment/GPS/weather/map/caddie/advanced analytics features.
- Adding new runtime dependencies.
- Reintroducing betting/settlement or side-game flows.
- Changing the export boundary away from local SVG image/file.
- Replacing blank user labels with sample data.

## Architecture/domain invariants
1. The scorecard domain is independent from retired betting/caddie domains.
2. UI/export consume a shared `ScorecardRoundView` read model.
3. Active persistence is local-only and uses `fungolf-scorecard:active-round:v1`.
4. Score cells expose only relative score plus on/putt annotation.
5. Current-round review remains simple and does not become historical/advanced analytics.
6. Export is deterministic local SVG and includes non-empty memos.
7. Runtime/public docs do not expose retired betting, settlement, share-link, backend, payment, GPS/weather/map, caddie advice, 3D/canvas, or advanced analytics surfaces.
8. No new runtime dependencies are required.

## Testable acceptance criteria
1. App supports 1–4 players with 1 blank player default.
2. Editable names/labels can be fully cleared.
3. App renders front/back scorecard with par row and player rows.
4. Selected-hole controls support 온/펏, hole-in-one, direct stroke fallback, clear score, and memo editing.
5. Cells show only `—`, `0`, `-N`, or `+N` plus `온 N · 펏 N`.
6. Review shows only total/front/back relative summary, score-type counts, on/putt averages, 3-putt count, and memo highlights.
7. Storage uses only the new scorecard key and quarantines obsolete payloads.
8. SVG export includes full scorecard and non-empty memos without network/canvas/provider dependency.
9. Runtime/public docs stay Korean-first and local-only.
10. Verification commands pass: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Assumptions resolved
- Product is a score recorder, not a ledger/calculator.
- Image/SVG download is sufficient for sharing/saving.
- Local active-round persistence is sufficient for first version.
- Current-round basic stats are enough; historical or comparative analytics are out of scope.
- Existing React/Vite/TypeScript stack is sufficient; no dependency addition is needed.

## Open questions for future work
- Whether to add local round history after field testing.
- Whether to add a browser DOM/e2e test stack for richer interaction testing.
- Whether to support optional cloud/share features in a later, separately approved product direction.
