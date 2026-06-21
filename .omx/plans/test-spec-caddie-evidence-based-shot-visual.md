# Test Spec — Caddie Evidence-Based Shot Visual

## Source of truth
- PRD: `.omx/plans/prd-caddie-evidence-based-shot-visual.md`.
- Current implementation surfaces: `src/useCaddieSession.ts`, `src/App.tsx`, `src/styles.css`.
- Current static/SSR regression suites: `src/domain/appSsrStatic.test.ts`, `src/domain/g004-motion-viewer-static.test.ts`, `src/domain/g002-ssr-static-import-scan.test.ts`.
- Goal context: `G001-semantic-visual-state-tests`.

## Acceptance mapping

### Visual-only semantic state
- Source/static tests must assert a named visual state type exists, such as `CaddieShotVisualState`.
- The visual state contract must expose these semantic drivers:
  - `aimBias`
  - `ballHeight`
  - `stanceTilt`
  - `windDirection`
  - `windStrength`
  - `trajectory`
- The visual state type/body and visual object construction must not expose summary-bearing fields:
  - `recommendation`
  - `selectedClubLabel`
  - `playDistanceMeters`
  - `swingPercent`
  - Korean summary copy including `추천`, `플레이 거리`, or `스윙 %`.
- Regression tests should fail if an old `shotDashboard`/`CaddieShotDashboard` summary path returns.

### Scenario-to-visual evidence mapping
Add or preserve tests for explicit mapping rules:
- Side slope controls ball height:
  - `left-slope` → `below-feet`.
  - `right-slope` → `above-feet`.
  - `none` → `level`.
- Side slope/crosswind controls aim bias:
  - `left-slope` or `right-to-left` wind → `right`.
  - `right-slope` or `left-to-right` wind → `left`.
  - neutral side slope/wind → `center`.
- Stance slope controls stance tilt:
  - `level`, `uphill`, and `downhill` must all be representable in visual state/rendering.
- Wind direction and wind strength must flow into distinct rendered hooks.
- Trajectory controls must cover:
  - headwind/front pin/short-danger → `low`.
  - tailwind/long-danger → `soft-landing`.
  - neutral/safe-middle conditions → `neutral`.

Preferred implementation shape:
- Prefer an exported or otherwise testable pure helper that builds visual state from a `CaddieScenario`, then unit-test a scenario matrix directly.
- If helpers remain private, use static/source tests plus SSR render/source assertions to prove every mapping and rendered hook is present.
- The spec should call out source-only regex coverage as weaker evidence; final implementation should add a helper or prop-driven component before relying on source scans for all mapping rules.

### Rendered semantic hooks
- SSR/static tests must assert the rendered visual includes stable hooks for every visual driver, such as:
  - `data-aim={prescription.shotVisual.aimBias}`
  - `data-ball-height={prescription.shotVisual.ballHeight}`
  - `data-stance={prescription.shotVisual.stanceTilt}`
  - `data-trajectory={prescription.shotVisual.trajectory}`
  - `data-wind={prescription.shotVisual.windDirection}`
  - `data-wind-strength={prescription.shotVisual.windStrength}`
- Tests must assert the rendered DOM/component tree, not only source strings, contains feet/stance and ball primitives, for example `shot-visual-feet`, `shot-visual-stance`, and `shot-visual-ball`; include wind, aim-line, and trajectory-arc primitives when they exist.
- At least one render-level or prop-driven component test must prove the stage receives expected `data-*` values from scenario-derived visual state, rather than only proving JSX bindings exist in source.
- CSS/source tests must assert non-default visual variants are styled for at least:
  - `data-ball-height="below-feet"` or `above-feet`.
  - `data-stance="uphill"` or `downhill`.
  - `data-aim="left"` or `right`.
  - `data-trajectory="low"` or `soft-landing`.
  - `data-wind="right-to-left"` or `left-to-right`.
  - `data-wind-strength="strong"`.

### Text hierarchy and no-summary visual subtree
- SSR tests must assert the result explanation remains exactly four reason-card headings:
  - `클럽 선택이유`
  - `조준 방향 이유`
  - `목표 탄도 이유`
  - `미스 경고 코멘트`
- Tests must assert the visual copy uses reactive 2D shot/stance terminology, such as `반응형 2D 샷/스탠스 비주얼`.
- Tests must assert old or summary-like text is absent from the visual/result subtree specifically, not only from the full page:
  - `정적 샷 대시보드`
  - `샷 대시보드`
  - `추천 요약`
  - `플레이 거리`
  - `스윙 %`
  - duplicated `추천:` headline outside reason cards.

### Visual read-only contract
- Tests or static assertions must prove the visual does not introduce its own input controls or mutation handlers.
- The shot visual should be a projection of `prescription.shotVisual`/scenario-derived state only; user changes must continue to enter through the scenario form controls.
- Reject future visual-local controls such as buttons, sliders, text inputs, or select elements inside the visual subtree unless a new PRD explicitly changes this contract.

### Guardrail coverage
- Existing static import/boundary tests must continue to prove caddie flow has no backend, API, auth, GPS, map, weather, external-service, old Swing Lab, motion-viewer, 3D, canvas, or rich visualization dependency.
- Style/source tests must reject motion-viewer/3D markers such as `perspective`, `preserve-3d`, `translateZ`, `rotateX`, `rotateY`, `motion-viewer`, `swing-arc`, or old dashboard metric classes.
- Package/dependency checks should confirm no new runtime dependency is needed for this visual contract.

## Risk-based verification notes
- Highest risk: tests asserting only an element exists while missing scenario-to-driver mappings. Require at least one mapping-oriented assertion per driver and prefer direct helper/component tests over source regex.
- Medium risk: visual state leaks a compact recommendation summary. Keep negative tests on visual state, visual object construction, and rendered result/visual copy.
- Medium risk: CSS hooks exist but do not style variants. Keep CSS source assertions for non-default data attribute variants.
- Low risk: full browser e2e is absent. SSR/static/unit coverage is acceptable because this goal is semantic state and regression coverage, not pixel-perfect rendering, but the spec should still require render-level proof where practical.

## Required test matrix

| Driver | Default/example | Non-default cases that must be testable | Evidence surface |
| --- | --- | --- | --- |
| Ball height | `below-feet` from default left-slope | `above-feet`, `level` | visual state mapping + `data-ball-height` + CSS variant |
| Aim bias | `right` from left-slope/headwind default | `left`, `center` | visual state mapping + `data-aim` + CSS variant |
| Stance tilt | `level` | `uphill`, `downhill` | visual state mapping + `data-stance` + CSS variant |
| Trajectory | `low` from headwind/front/short danger | `soft-landing`, `neutral` | visual state mapping + `data-trajectory` + CSS variant |
| Wind direction | `headwind` | crosswind and no/tailwind paths | state/render hook + CSS variant |
| Wind strength | `light` | `medium`, `strong` | state/render hook + CSS variant |

## Existing coverage snapshot
- `src/domain/appSsrStatic.test.ts` already covers the SSR shell, workflow order, direct-typing numeric guards, default prescription output, exactly four reason-card headings, source wiring for six visual data hooks, and CSS variant source checks.
- `src/domain/g004-motion-viewer-static.test.ts` already guards the visual state shape, rejects summary-bearing visual fields, and rejects old motion-viewer/3D/dashboard styling.
- `src/domain/g002-ssr-static-import-scan.test.ts` already guards against GPS/map/weather/backend/auth/canvas/3D/motion-viewer dependencies.
- `src/domain/copy.test.ts` and `src/domain/g003-copy-ux-integration.test.ts` already lock reactive 2D shot/stance terminology and reject stale dashboard copy.
- Known weak spots to improve: multi-scenario visual mapping, render-level `data-*` values, focused no-summary assertions inside the visual subtree, runtime primitive presence, and read-only visual contract coverage.

## Verification commands
Run these after implementing or updating tests:
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Completion criteria
- All acceptance sections have explicit coverage in tests or a documented, reviewed reason for deferral.
- Verification commands pass.
- Test spec and implementation remain aligned with the PRD without mutating leader-owned `.omx/ultragoal` state.
