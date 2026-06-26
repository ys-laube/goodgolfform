# DESIGN.md — FunGolf Simple Scorecard

## Design intent

FunGolf should feel like a premium Korean mobile utility for a golfer walking the course: calm, fast, legible, and restrained. The visual language may be Apple-inspired in the broad sense of quiet hierarchy, soft depth, generous spacing, and precise typography, but it must not use Apple logos, product imagery, trademark lockups, or affiliation language.

## Core screens

1. **라운드 세팅** — 1-person default, selectable 1–4 players, blank-editable names, round/course labels, and hole count.
2. **스코어카드** — front/back grid with hole row, par row, and one player row per active player.
3. **홀 입력** — selected-hole 온/펏 buttons, 홀인원, direct stroke fallback, clear score, and hole memo.
4. **라운드 리뷰** — total relative score, front/back relative score, score-type counts, on/putt averages, 3-putt count, and memo highlights.
5. **이미지 저장** — local SVG export with full scorecard and non-empty memos.

## Interaction principles

- **Under 2-minute setup:** default to one blank player and allow every editable field to be fully cleared.
- **Under 10-second hole entry:** selected-hole controls should be thumb-friendly, large, and visible below the grid.
- **Single-screen confidence:** score cells show the relative number first, with 온/펏 detail as a small annotation.
- **Local-only simplicity:** saved data stays on the current device; export is a local file action.
- **No extra game modes:** do not introduce side games, settlement panels, external APIs, or coaching flows.

## Visual system

- Korean-first font stack: `Pretendard`, `Apple SD Gothic Neo`, `Malgun Gothic`, `Noto Sans KR`, system sans-serif.
- Mobile-first width, safe-area padding, rounded cards, quiet separators, and high-contrast text.
- Premium palette: soft neutral base, deep slate surfaces, restrained green/blue accents.
- Minimum touch target: roughly 44px height for primary controls.
- Scorecard grid uses horizontal scroll on small phones while keeping row labels sticky.
- Exported SVG should look screenshot-worthy and readable when opened from iPhone or Samsung Gallery/File apps.

## Copy boundaries

Use score-recording language:

- Prefer: `스코어카드`, `홀 메모`, `온`, `펏`, `라운드 리뷰`, `이미지 저장`, `로컬 저장`.
- Avoid: money movement language, public sharing, backend room, live sync, external field-data integrations, recommendation flows, distance advice, or coaching claims.
