# Test Spec — Caddie Usability Cleanup

## Acceptance mapping

### Numeric typing
- Static/SSR source assertions should verify caddie numeric fields request mobile numeric keyboard (`inputMode="numeric"` or equivalent) and do not depend on visible number steppers.
- Component/SSR tests should verify all club carry fields and remaining distance labels still render.
- Domain tests should continue proving invalid/empty/fallback values normalize safely through existing preset/scenario safety paths.

### Layout order and removed hero copy
- SSR-render `App` and assert first major workflow order is distance preset section before shot scenario before prescription/result.
- Assert old visible hero strings are absent:
  - `캐디 한줄 처방`
  - `남은 거리와 라이만 빠르게 넣고 한 줄 조언을 먼저 봅니다`
  - `위치·날씨 자동 연동이나`

### Result simplification
- Assert no visible `추천:` headline.
- Assert no compact summary line such as `추천 요약`, `클럽 ... 스윙 ... 플레이 거리`, or equivalent duplicate summary above the cards.
- Assert no visible `짧은 이유` label.
- Assert no repeated lower adjustment strip structure/classes/copy.
- Assert exactly four reason card titles remain and are the only textual result explanation surface besides the reactive visual labels.

### Trajectory reason copy
- Assert fixed filler phrase `긴 설명보다 낮은 실행 처방이 빠릅니다` is absent from source and SSR output.
- Add unit tests for `useCaddieSession`/recommendation rendering or extracted helper to prove at least headwind/front-pin and tailwind/long-risk cases produce different trajectory detail text.

### Reactive 2D visual
- Static/SSR tests should assert the visual exists as a named 2D shot/stance visual, not `정적 샷 대시보드`.
- Assert it contains accessible text/labels for feet/stance and ball.
- Assert rendered state/class/data attributes or text change for all five drivers:
  - ball height
  - front-back slope
  - aim line
  - trajectory arc
  - wind arrow
- Source scan should ensure no 3D/canvas/external service dependency was introduced unless intentionally chosen; default plan is SVG/HTML/CSS only.

### Guardrails
- Existing no external services/no backend/no auth/no GPS/map/weather/no 3D tests must pass or be updated to the new copy without weakening constraints.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` are required before completion.

## Risk-based verification notes
- Direct mobile typing is the highest UX risk; if no browser e2e is available, combine source assertions with local manual smoke after `npm run dev`.
- Reactive visual could become decorative; tests must bind visual state to prescription/scenario-derived data, not only check that an SVG exists.
- Layout reorder can break anchors; remove or update stale anchor links.

## Iteration 1 revision note
Add explicit tests for absence of the compact result summary line so duplicate-copy creep cannot return.

## Iteration 2 revision note
Add absence assertions for summary-like recommendation text anywhere in the rendered result subtree, including the visual: no visual metric block may show `추천`, `플레이 거리`, or `스윙 %` outside the four reason cards. Add explicit copy/doc test updates replacing old `정적 샷 대시보드` terminology with reactive 2D shot/stance visual terminology.

## Iteration 3 revision note
Critic-required test hardening:
1. Add source/static tests that `shotDashboard.recommendation` is removed or renamed and no visual-state type/object exposes summary-bearing fields such as `recommendation`, `playDistanceMeters`, `swingPercent`, `추천`, `플레이 거리`, or `스윙 %`.
2. Add source/static or component tests proving caddie numeric input handlers do not use direct `Number(event.target.value)` coercion and allow temporary empty-string drafts before blur/save/calculation normalization.
3. Add unit tests for an extracted visual-state helper or prop-driven visual component that cover all five drivers across multiple scenarios: ball height, front-back slope, aim line, trajectory arc, and wind arrow.
