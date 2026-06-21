# PRD — Caddie Evidence-Based Shot Visual

## Source of truth
- Current implementation evidence: `src/useCaddieSession.ts`, `src/App.tsx`, `src/styles.css`.
- Current regression evidence: `src/domain/appSsrStatic.test.ts`, `src/domain/g004-motion-viewer-static.test.ts`.
- Related prior plan: `.omx/plans/prd-caddie-usability-cleanup.md`.
- Goal context: `G001-semantic-visual-state-tests` — semantic visual state and tests.

## Product goal
Make the caddie shot visual explain the same evidence used by the prescription, not decorate it. The visible 2D stance/shot picture must be driven by semantic state derived from the selected scenario and must stay free of duplicated recommendation metrics.

## Problem
The app already computes club choice, swing percent, play distance, reason cards, and a reactive 2D visual. The remaining product risk is semantic drift: the visual can look reactive while silently becoming a hard-coded graphic, a summary card in disguise, or a separate interpretation that contradicts the four reason cards.

## Users and use context
- Primary user: a golfer using the Korean caddie flow on a phone at the range, screen-golf bay, or course-side practice context.
- User need: quickly see why the prescription changed when lie, slope, wind, pin, or risk changes.
- Constraint: the visual must remain lightweight, readable, and testable without map/GPS/weather/backend/3D dependencies.

## RALPLAN-DR Summary

### Principles
1. **Evidence-first visual state:** every rendered visual driver comes from scenario or prescription state, never from decorative constants alone.
2. **Visual-only contract:** visual state may expose geometry and environmental semantics; it must not expose recommendation summaries such as selected club, play distance, or swing percent.
3. **One explanation hierarchy:** the four reason cards explain the prescription textually; the visual explains spatial shot conditions.
4. **SSR/static testability:** semantic driver coverage must be provable without browser-only APIs.
5. **Dependency guardrail:** keep the visual in React/HTML/CSS/SVG-style primitives; no canvas engine, 3D surface, external service, GPS, map, or weather integration.

### Decision drivers
1. Prevent the 2D visual from regressing into a static/decorative graphic.
2. Prevent duplicated recommendation copy outside the four reason cards.
3. Give tests stable semantic hooks for all visual drivers.
4. Preserve mobile performance and simple maintenance.

### Viable options
#### Option A — Keep current visual with broad static assertions only
- Pros: smallest immediate effort.
- Cons: weak proof that all scenario drivers are covered; easy for visual state to drift.
- Status: rejected because the goal specifically targets semantic visual state and tests.

#### Option B — Formalize a visual-only semantic state contract and test every driver (chosen)
- Pros: binds UI to scenario evidence, keeps the visual lightweight, and prevents summary leakage.
- Cons: requires source/static and behavior-oriented tests for multiple scenario combinations.

#### Option C — Build a richer visual model/component abstraction
- Pros: could enable future animation or reusable diagrams.
- Cons: unnecessary abstraction for the current single caddie flow; increases surface area.
- Status: deferred until real reuse appears.

## Chosen plan
Implement Option B.

### Story 1 — Visual-only state contract
- Keep or introduce a named visual state type equivalent to `CaddieShotVisualState`.
- The state must include only semantic visual drivers:
  - `aimBias`
  - `ballHeight`
  - `stanceTilt`
  - `windDirection`
  - `windStrength`
  - `trajectory`
- The visual state must not include or render: `recommendation`, `selectedClubLabel`, `playDistanceMeters`, `swingPercent`, `추천`, `플레이 거리`, `스윙 %`, or an equivalent compact recommendation summary.

### Story 2 — Evidence mapping from scenario to visual state
- Map side slope to ball height:
  - left-slope → below-feet.
  - right-slope → above-feet.
  - none → level.
- Map side slope and crosswind to aim bias:
  - left-slope or right-to-left wind → right aim.
  - right-slope or left-to-right wind → left aim.
  - otherwise → center.
- Map front/back stance slope directly to stance tilt.
- Map wind direction and strength directly to visible wind semantics.
- Map trajectory from shot evidence:
  - headwind, front pin, or short-danger → low.
  - tailwind or long-danger → soft-landing.
  - otherwise → neutral.

### Story 3 — Rendered semantic hooks
- Render stable data attributes or equivalent props/classes for each visual driver.
- Include visible or accessible copy that names the visual as a 2D shot/stance visual and describes the five drivers.
- Preserve explicit feet/stance and ball primitives in the DOM or component tree.
- Keep the visual read-only: changing the visual must follow scenario input changes, not introduce a second input channel.

### Story 4 — Regression tests for semantic coverage
- Add or preserve tests proving every visual driver is present in the visual state type and rendered state hooks.
- Add multi-scenario coverage proving each driver can vary from its default value.
- Add negative tests proving recommendation/play-distance/swing summary fields do not leak into the visual state or visual subtree.
- Add boundary tests proving the caddie flow remains free of motion-viewer, 3D, canvas, map, GPS, weather, backend, auth, and external-service dependencies.

### Story 5 — Product copy and documentation alignment
- Use consistent terminology: `반응형 2D 샷/스탠스 비주얼` or equivalent.
- Do not reintroduce `정적 샷 대시보드`, `샷 대시보드`, `추천 요약`, or metric-card terminology.
- README/docs should describe the visual as scenario-evidence visualization, not as an independent recommendation engine.

## Acceptance criteria
1. The app exposes a visual-only semantic state shape with the six approved drivers.
2. The rendered visual has semantic hooks for all six state fields and includes feet/stance plus ball primitives.
3. At least one test exercises non-default values for ball height, stance tilt, aim bias, trajectory, wind direction, and wind strength.
4. Tests prove summary-bearing fields/copy are absent from visual state and visual rendering.
5. Existing caddie prescription reason cards still render exactly four explanation categories.
6. No new dependencies or browser-only service integrations are introduced.

## Non-goals
- No new official coaching, medical, legal, betting, weather, GPS, map, backend, auth, social, or telemetry feature.
- No canvas/3D/motion-viewer rebuild.
- No second recommendation summary outside the reason cards.
- No full browser automation requirement for this pass; SSR/static/unit coverage is acceptable.

## ADR

### Decision
Treat the shot visual as a visual-only projection of semantic scenario evidence. Tests must verify both positive driver coverage and negative summary leakage.

### Consequences
- Developers must update tests when adding a new visual driver.
- Product copy stays concise and avoids duplicating recommendation metrics.
- The visual can evolve cosmetically as long as semantic hooks and no-summary constraints remain intact.

### Verification required
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Follow-up staffing guidance
- Implementation owner: `executor` for local code/test changes.
- Test review: `test-engineer` or `verifier` if semantic coverage is disputed.
- Design review: `designer` only if the visual becomes hard to understand visually after semantic tests pass.

## Completion note for team integration
This PRD is intentionally scoped to `.omx/plans/prd-caddie-evidence-based-shot-visual.md`. It defines the product contract for downstream test-spec and handoff artifacts without mutating `.omx/ultragoal` leader-owned state.
