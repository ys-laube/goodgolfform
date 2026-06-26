# DESIGN.md — FunGolf Traditional Ojang Ledger

## Design intent

FunGolf should feel like a premium Korean mobile utility for a foursome standing on a tee box: calm, fast, legible, and trustworthy. The visual language may be Apple-inspired in the broad sense of restrained hierarchy, generous spacing, soft depth, and precise typography, but it must not use Apple logos, product imagery, trademark lockups, or affiliation language.

## Core screens

1. **라운드 세팅** — choose 2–4 players, blank-editable names, final-total handicaps, and 타당 금액.
2. **오장 룰 자세히 보기** — keep the hero title exactly `오늘 폼 정말 좋으시네요 ^0^` and disclose the fixed local Ojang formula.
3. **홀 입력** — front/back scorecard grid with 구분 row, 파 row, 뒷문오픈 row, player rows, 온/펏 buttons, 홀인원, and 파3 니어 selection.
4. **실시간 정산 요약** — compact running money balances from the single Ojang ruleset.
5. **순정산 / 계산 내역** — payer → receiver suggestions plus inspectable rows for 타수차, 배판, 버디값, 니어/니뻐, and 핸디 보정.
6. **공유 카드** — bottom-only Korean summary card with two actions: local SVG scorecard export and local QR/result-link URL-hash snapshot.

## Interaction principles

- **2-minute setup:** blank user-entered fields must remain blank and editable; never invent sample player names or sample course labels at runtime.
- **10-second hole entry:** scorecard cells and selected-hole controls should be thumb-friendly, grouped per player, and avoid modal-heavy flows.
- **Trust before flair:** every total needs an inspectable raw-score and Ojang calculation explanation.
- **Local-only confidence:** copy should remind users that data stays on this device without creating backend anxiety.
- **Fixed rules first:** no custom rule builder; only 타당 금액 and final-total handicaps are editable.

## Visual system

- Korean-first font stack: `Pretendard`, `Apple SD Gothic Neo`, `Malgun Gothic`, `Noto Sans KR`, system sans-serif.
- Mobile-first width, safe-area padding, large headings, rounded cards, quiet separators, and high-contrast text.
- Premium palette: deep neutral/green base, warm money accents, restrained neon only for state emphasis.
- Share card should be screenshot-worthy and export a deterministic local SVG scorecard without canvas, image services, or network calls.
- QR/result-link sharing must render locally from a URL-hash snapshot (`#fg=`), target `<=1800` characters, hard-stop at `<=2200` characters, restore labels plus par/backdoor/near hole metadata, and add no backend/provider dependency.

## Copy boundaries

Use ledger/calculator language:

- Prefer: `오장 정산`, `순정산`, `계산 내역`, `타당 금액`, `받을 금액`, `줄 금액`, `공유 카드`.
- Avoid: payment execution, wallet, escrow, deposit/withdrawal, public gambling, matching, backend room, live sync, GPS/map/weather, caddie recommendation, club-distance advice, or shot coaching claims.

## Accessibility and field use

- Minimum touch target: roughly 44px height for primary controls.
- Do not rely on hover-only disclosure.
- Keep settlement and share text readable in bright outdoor conditions.
- Money amounts are informational only; the app must never imply a transaction was executed.
