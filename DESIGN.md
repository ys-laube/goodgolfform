# DESIGN.md — FunGolf Field Betting Ledger

## Design intent

FunGolf should feel like a premium Korean mobile utility for a foursome standing on a tee box: calm, fast, legible, and trustworthy. The visual language may be Apple-inspired in the broad sense of restrained hierarchy, generous spacing, soft depth, and precise typography, but it must not use Apple logos, product imagery, trademark lockups, or affiliation language.

## Core screens

1. **라운드 세팅** — choose 2–4 players, names, handicaps, scoring mode, and unit values.
2. **내기 게임** — enable the fixed v1 games: stroke/per-point, skins, Vegas/team, events, and mission cards.
3. **홀 입력** — front/back scorecard grid with hole tabs, par row, 뒷문오픈 row, player rows, plus selected-hole relative score buttons, quick events, and mission outcomes.
4. **실시간 정산 요약** — compact running totals with points and optional money-display values.
5. **순정산 / 계산 내역** — final payer → receiver suggestions plus expandable per-game rows.
6. **공유 카드** — bottom-only Korean summary card with two actions: local SVG scorecard export and local QR/result-link URL-hash snapshot.

## Interaction principles

- **2-minute setup:** blank user-entered fields must remain blank and editable; never invent sample player names or sample course labels at runtime.
- **10-second hole entry:** scorecard cells and selected-hole controls should be thumb-friendly, grouped per player, and avoid modal-heavy flows.
- **Trust before flair:** every total needs an inspectable raw-score and game-row explanation.
- **Local-only confidence:** copy should remind users that data stays on this device without creating backend anxiety.
- **Fixed rules first:** no custom rule builder in v1; advanced flexibility can be future scope.

## Visual system

- Korean-first font stack: `Pretendard`, `Apple SD Gothic Neo`, `Malgun Gothic`, `Noto Sans KR`, system sans-serif.
- Mobile-first width, safe-area padding, large headings, rounded cards, quiet separators, and high-contrast text.
- Premium palette: deep neutral/green base, warm money/point accents, restrained neon only for state emphasis.
- Share card should be screenshot-worthy and export a deterministic local SVG scorecard without canvas, image services, or network calls.
- QR/result-link sharing must render locally from a URL-hash snapshot (`#fg=`), target `<=1800` characters, hard-stop at `<=2200` characters, restore labels plus par/backdoor hole metadata, and add no backend/provider dependency.

## Copy boundaries

Use ledger/calculator language:

- Prefer: `내기 정산표`, `순정산`, `계산 내역`, `포인트`, `받을 금액`, `줄 금액`, `공유 카드`.
- Avoid: payment execution, wallet, escrow, deposit/withdrawal, public gambling, matching, backend room, live sync, GPS/map/weather, caddie recommendation, club-distance advice, or shot coaching claims.

## Accessibility and field use

- Minimum touch target: roughly 44px height for primary controls.
- Do not rely on hover-only disclosure.
- Keep settlement and share text readable in bright outdoor conditions.
- Money-display mode is informational only; it must never imply a transaction was executed.
