# PRD — Caddie Evidence-Based Shot Visual

## Source of truth
- Approved interview spec: `.omx/specs/deep-interview-caddie-evidence-based-shot-visual.md`.
- Current implementation surfaces: `src/useCaddieSession.ts`, `src/App.tsx`, `src/styles.css`.
- Regression evidence: `src/domain/caddieShotVisualState.test.ts`, `src/domain/appSsrStatic.test.ts`, `src/domain/g004-motion-viewer-static.test.ts`.
- Active durable context: `.omx/ultragoal/goals.json`.

## Product goal
Replace the old decorative shot picture with a Korean, mobile-first, evidence-based 2D setup visual that explains stance, ball position, and lie/slope relationships without duplicating the four prescription reason cards.

## Chosen contract
The result visual is a **visual-only semantic projection** of the caddie prescription.

### Semantic visual state
`CaddieShotVisualState` must expose setup semantics only:
- `handedness`
- `clubGroup`
- `ballPositionSlot`
- `ballPositionPercentRightHanded`
- `ballPositionPercent`
- `frontBackSlope`
- `sideHillRelation`

It must not expose wind/trajectory drawing fields or recommendation summaries such as `selectedClubLabel`, `playDistanceMeters`, `swingPercent`, `recommendation`, `data-wind`, `data-trajectory`, or equivalent compact recommendation copy.

### Club-group mapping
- driver → driver, 82% right-handed lead-side position.
- 3w/5w → fairway wood, 72%.
- 4i/5i → long iron, 62%.
- 6i/7i/8i → mid iron, 50%.
- 9i/pw/gw/sw → wedge, 42%.
- Left-handed rendering mirrors `ballPositionPercent` as `100 - ballPositionPercentRightHanded`.

### Rendered UI
- Top-down view: `위에서 본 스탠스 / 공 위치`, feet, lead/trail labels, target direction, club group, and ball marker.
- Rear view: `뒤에서 본 라이 / 경사`, front-back slope and sidehill relation separated.
- Handedness toggle: 우타/좌타, default 우타.
- Evidence accordion: real collapsed-by-default `<details><summary>근거 보기</summary>` with concise Korean rationale.

## Non-goals
- No 3D runtime, three.js, canvas, swing animation, GPS, maps, weather API, backend, auth, social, betting, or external provider SDK.
- No second recommendation summary outside the four reason cards.
- No lab-grade precision claim; visual geometry is instructional.

## Acceptance criteria
1. Runtime visual no longer renders `.shot-visual-arc`, `.shot-visual-wind`, `data-trajectory`, `data-wind`, or `data-wind-strength` drawing hooks.
2. `CaddieShotVisualState` contains the seven semantic setup fields listed above and no wind/trajectory drawing fields.
3. Club mapping and left-handed mirroring are tested.
4. Right-handed driver/wood positions render closer to the lead side; wedges move toward the trail side.
5. Rear-view copy and data hooks consume `frontBackSlope` and `sideHillRelation`, not raw scenario-only interpretation.
6. UI renders two Korean named views and a real collapsed `근거 보기` accordion.
7. README or project note records the evidence mapping and no-3D non-goal.
8. Exactly four reason cards remain: 클럽 선택이유, 조준 방향 이유, 목표 탄도 이유, 미스 경고 코멘트.
9. No new runtime dependency is added.
10. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, stale hook scan, and 3D dependency scan pass.

## ADR
Decision: keep a dependency-free 2D semantic setup visual now and defer a dedicated 3D/rotatable renderer until the 2D model is user-validated.

Alternatives considered:
- Keep old trajectory/wind visual: rejected as user explicitly disliked it.
- Inline/SVG/CSS 2D semantic visual: chosen.
- 3D runtime: rejected for this pass by explicit scope and complexity.

Consequences:
- The visual remains approximate but fast and testable.
- Future 3D can reuse the semantic state contract.
- Tests must guard against stale trajectory/wind visual hooks returning.
