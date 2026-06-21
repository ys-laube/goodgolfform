# PRD — Caddie Usability Cleanup

## Source of truth
- Deep-interview spec: `.omx/specs/deep-interview-caddie-usability-cleanup.md`
- Context snapshot: `.omx/context/caddie-usability-cleanup-20260621T091450Z.md`

## Product goal
Make the Korean caddie app feel field-usable on mobile: preset first, quick shot input second, concise prescription last, with direct numeric typing and a reactive 2D stance/shot visual that explains why it exists.

## RALPLAN-DR Summary

### Principles
1. **Input-first utility:** the first visible workflow is distance preset setup, then shot scenario, then advice.
2. **No redundant result copy:** four reason panels are the primary explanation surface; remove repeated headline/helper/strip copy.
3. **Reactive visual earns its space:** the visual must change for ball height, front-back slope, aim, trajectory, and wind.
4. **Mobile typing over steppers:** numeric UX must support direct typing and intermediate empty states.
5. **Guard existing boundaries:** no backend/API/auth/map/weather/GPS/3D/social/betting additions.

### Decision drivers
1. Mobile field speed and one-hand readability.
2. Testable preservation of caddie prescription logic and four-panel explanation.
3. Small, reversible React/CSS/domain changes without new dependencies.

### Viable options
#### Option A — Minimal cleanup, delete dashboard
- Pros: fastest, least visual risk.
- Cons: violates user’s chosen reactive 2D visual; loses stance/ball affordance.
- Status: invalidated by user answer requiring reactive picture with feet and ball.

#### Option B — Reactive SVG dashboard + input cleanup + layout reorder (chosen)
- Pros: satisfies all clarified criteria; can be implemented with existing React/CSS; testable by SSR/static assertions.
- Cons: more UI/test surface than deletion; SVG semantics need careful accessible text.

#### Option C — Full canvas/animation dashboard
- Pros: richer screen-golf feel.
- Cons: unnecessary complexity, harder testing, likely too heavy for current scope.
- Status: rejected for first pass.

## Chosen plan
Implement Option B.

### Story 1 — Numeric typing contract
- Introduce reusable numeric text input behavior in `src/App.tsx` or a small local helper/hook.
- Replace direct `Number(event.target.value)` number-control pattern for remaining distance and club carries with direct-typing-friendly values.
- Use `inputMode="numeric"` and pattern/attributes that request numeric keyboard without relying on browser steppers.
- Allow temporary empty string while editing; normalize to safe numeric range on blur or before persistence/calculation.
- Preserve existing clamp/safety behavior in domain code.

### Story 2 — Preset → scenario → prescription layout
- Remove the hero intro card/copy.
- Reorder top-level sections: distance preset first, shot scenario input second, prescription result third.
- Keep local preset save/load behavior and storage message.
- Update anchors/actions if any remain; avoid stale “지금 처방” hero navigation.

### Story 3 — Result simplification and copy repair
- Remove long `추천: ...` headline from visible result surface.
- Remove the compact summary paragraph such as `추천 요약 · 클럽 ... · 스윙 ... · 플레이 거리 ...`; the four panels and reactive visual are the only result explanation surfaces.
- Remove `짧은 이유` helper label.
- Remove `adjustment-strip` visible UI.
- Keep exactly four reason cards with titles; do not add a separate compact result summary above or below them:
  - `클럽 선택이유`
  - `조준 방향 이유`
  - `목표 탄도 이유`
  - `미스 경고 코멘트`
- Replace fixed trajectory detail filler with situation-specific Korean copy keyed off wind/pin/risk/trajectory.

### Story 4 — Reactive 2D shot/stance visual
- Replace static dashboard copy/metrics with a reactive visual component or inline SVG section.
- Must show feet/stance and ball.
- Must visibly encode:
  - ball height relation: lower/similar/higher ball position.
  - front-back slope: platform/stance tilt.
  - aim: left/center/right target line.
  - trajectory: low/basic/soft arc height.
  - wind: arrow direction and strength.
- Keep it 2D and lightweight; no canvas dependency, no 3D.
- Add accessible labels/text that reflect the dynamic state.

### Story 5 — Tests/docs/verification
- Update SSR/static tests for new section order and removed copy.
- Add/adjust tests for numeric input attributes and absence of `type="number"` on caddie numeric fields where relevant.
- Add tests verifying fixed trajectory filler is absent and multiple scenario-specific trajectory reasons exist.
- Add tests/static assertions for reactive visual data/classes/labels covering the five drivers.
- Update README and `src/domain/copy.ts` if they reference static dashboard or old order.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`.

## ADR

### Decision
Use a dependency-free React/SVG/CSS implementation: preset-first layout, text-based numeric inputs with normalization, simplified four-card result, and a reactive 2D stance/shot visual.

### Drivers
- User explicitly rejected the static/decorative dashboard feel.
- Mobile typing must not be blocked by number-input steppers/coercion.
- Existing app is small and already tested by SSR/static Vitest coverage.

### Alternatives considered
- Delete dashboard entirely: rejected by user.
- Canvas/animation/dashboard engine: too much complexity for first pass.
- Keep headline and strip: rejected as duplicated content.

### Consequences
- More UI state may be needed for draft numeric strings.
- SVG/class-based visual states must be covered by tests to avoid becoming decorative again.
- Result surface becomes cleaner but loses the previous single one-line headline.

### Follow-ups
- If visual still feels unclear after user review, consider replacing with panel-level micro-icons instead of expanding complexity.
- If typing UX remains awkward on iOS/Android, validate with a real mobile browser and adjust input attributes.

## Available agent types roster
- `executor`: implementation slices.
- `test-engineer`: acceptance/static test design.
- `designer`: visual/SVG UX refinement.
- `verifier`: final claim/evidence validation.
- `code-reviewer`: final review.
- `architect`: boundary review.
- `critic`: plan/test quality gate.

## Follow-up staffing guidance
- Default: `$ultragoal` to create durable stories matching the five stories above.
- Parallel: `$team $ultragoal` if implementing with lanes:
  - Lane A: numeric inputs + layout reorder (`src/App.tsx`, styles).
  - Lane B: prescription copy/domain data + trajectory reason tests (`src/useCaddieSession.ts`, domain tests).
  - Lane C: reactive 2D SVG/CSS + visual/static tests (`src/App.tsx`, `src/styles.css`, app SSR tests).
  - Leader integrates docs and final verification.
- `$ralph` fallback only if the user wants single-owner sequential persistence instead of durable goal tracking.

## Goal-Mode Follow-up Suggestions
- `$ultragoal` — recommended default durable implementation path.
- `$team $ultragoal` — recommended if parallel delivery is desired.
- `$ralph` — explicit fallback only.
- `$performance-goal` not applicable; no measurable performance optimization target.
- `$autoresearch-goal` not applicable; no research mission.

## Iteration 1 revision note
Architect identified the current compact result summary line (`추천 요약 · 클럽 ... · 스윙 ... · 플레이 거리 ...`) as an unresolved duplicate surface. The plan now explicitly removes it; the final result explanation surfaces are exactly the four panels plus the reactive 2D visual.

## Iteration 2 revision note
Architect identified a remaining loophole: compact recommendation text could survive inside the reactive visual through old `shotDashboard.recommendation`-style metrics. This is now explicitly forbidden. The reactive 2D visual may render only geometric/state labels needed to explain the visual state and accessibility, such as 공 위치, 앞뒤 경사, 조준선, 탄도선, and 바람. It must not render a compact recommendation line, play-distance line, `추천` metric block, `플레이 거리`, or `스윙 %` summary outside the four reason cards. Old `정적 샷 대시보드` copy/test terminology must be replaced with reactive 2D shot/stance visual terminology.

## Iteration 3 revision note
Critic required three execution-readiness hardening changes, now binding:
1. The old `shotDashboard.recommendation` path must be deleted or renamed into a visual-only state shape such as `shotVisualState`. The visual data shape must not expose `recommendation`, `playDistanceMeters`, `swingPercent`, `추천`, `플레이 거리`, or `스윙 %` fields to the visual renderer. Prescription numbers may exist inside the four reason cards/domain calculation, but not as visual summary fields.
2. Numeric input implementation must avoid direct `Number(event.target.value)` coercion in caddie input `onChange` handlers. It must support a temporary empty-string draft while typing and normalize only on blur, save, or calculation boundary.
3. Reactive visual implementation should expose either an extracted visual-state helper or a prop-driven visual component so tests can cover all five visual drivers across multiple scenarios, not only the default SSR render.
