# Test Spec — Caddie Evidence-Based Shot Visual

## Domain tests
- Assert `CaddieShotVisualState` has `handedness`, `clubGroup`, `ballPositionSlot`, `ballPositionPercentRightHanded`, `ballPositionPercent`, `frontBackSlope`, `sideHillRelation`.
- Assert no `windDirection`, `windStrength`, or `trajectory` fields exist in `shotVisual`.
- Assert 12 clubs map to the five visual groups and canonical percentages.
- Assert left-handed values mirror right-handed values.
- Assert long clubs are closer to rendered lead side than trail side, and wedges move back.
- Assert `frontBackSlope` and `sideHillRelation` vary independently.

## Render/static tests
- Assert the app renders `위에서 본 스탠스 / 공 위치` and `뒤에서 본 라이 / 경사`.
- Assert top-down visual includes feet, lead/trail labels, target direction, club group, and ball marker.
- Assert rear-view visual consumes `frontBackSlope` and `sideHillRelation` semantic labels.
- Assert a real `<details>` / `<summary>근거 보기</summary>` accordion exists and contains concise Korean rationale.
- Assert exactly four reason cards remain and removed recommendation-summary surfaces do not return.

## Guardrail tests/scans
- Reject `.shot-visual-arc`, `.shot-visual-wind`, `data-trajectory`, `data-wind`, `data-wind-strength` in runtime visual source/CSS.
- Reject 3D/canvas/runtime graphics dependencies (`three`, `@react-three`, `canvas`) and GPS/map/weather/backend/auth/external-service dependencies.
- README/project note must record evidence-source mapping and no-3D-runtime non-goal.

## Required verification
```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```
