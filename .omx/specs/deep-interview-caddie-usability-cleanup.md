# Deep Interview Spec — Caddie Usability Cleanup

## Metadata
- Profile: standard
- Context type: brownfield
- Rounds: 3
- Final ambiguity: 4%
- Context snapshot: `.omx/context/caddie-usability-cleanup-20260621T091450Z.md`
- Transcript: `.omx/interviews/caddie-usability-cleanup-20260621T092427Z.md`

## Intent
현재 앱은 방향성은 맞지만, 필드에서 빠르게 쓰기에는 숫자 입력이 번거롭고 결과 영역이 중복되어 읽기 피로가 있다. 특히 정적 대시보드는 “왜 있는지 모르겠다”는 인상을 주므로, 실제 입력 변화에 반응하는 의미 있는 2D 안내 그림으로 바꿔야 한다.

## Desired outcome
모바일에서 먼저 거리 프리셋을 확인/수정하고, 이어서 샷 상황을 입력한 뒤, 마지막에 중복 없는 네 개 처방 패널과 반응형 2D 샷/스탠스 그림을 확인하는 한국어 캐디 앱.

## In scope
1. **숫자 입력 개선**
   - 남은 거리, 클럽별 캐리 거리 등 모든 숫자 입력은 직접 타이핑이 편해야 한다.
   - 브라우저 스테퍼 클릭에 의존하지 않게 한다.
   - 모바일 숫자 키보드가 뜨도록 한다.
   - 빈 값/중간 입력 상태가 사용자의 타이핑을 방해하지 않도록 처리한다.
   - 저장/처방 계산 시에는 기존 안전 범위로 정규화한다.

2. **화면 순서 변경**
   - 기존 첫 hero 패널의 `캐디 한줄 처방`, `남은 거리와 라이만 빠르게 넣고...`, `위치·날씨 자동 연동이나...` 설명을 삭제한다.
   - 앱 흐름은 **거리 프리셋 → 샷 상황 입력 → 처방 결과** 순서가 된다.
   - 거리 프리셋을 먼저 불러오거나 수정한 뒤, 샷 상황 입력에 따른 처방이 마지막에 보이는 구조여야 한다.

3. **결과 영역 중복 제거**
   - `추천: ...` 형태의 긴 추천 헤드라인 삭제.
   - `짧은 이유` 보조 문구 삭제.
   - 네 패널 아래의 `조준 / 탄도 / 미스 경고` adjustment strip 삭제.
   - 네 패널은 유지한다:
     - `클럽 선택이유`
     - `조준 방향 이유`
     - `목표 탄도 이유`
     - `미스 경고 코멘트`

4. **목표 탄도 이유 고정문구 제거**
   - 어떤 상황이든 반복되는 `긴 설명보다는 낮은 실행 처방이 빠릅니다` 문구를 제거한다.
   - 목표 탄도 이유는 현재 입력값에 따라 달라지는 구체적인 이유를 말해야 한다.
   - 예: 맞바람/앞핀/짧으면 위험/뒷바람/길면 위험/중핀/평지 등 상황별 문구.

5. **반응형 2D 샷/스탠스 그림**
   - 정적 장식 대시보드가 아니라 입력/처방에 따라 변하는 2D 그림이어야 한다.
   - 그림 안에는 최소한 **스탠스 발 모양**과 **공**이 표시되어야 한다.
   - 반드시 눈에 띄게 반응해야 하는 항목:
     - 공 위치 높이: 공이 발보다 낮음/높음/비슷함에 따라 공 위치와 발 관계가 바뀜.
     - 앞뒤 경사: 오르막/내리막/평지에 따라 발판/스탠스 기울기 표현이 바뀜.
     - 조준 방향: 왼쪽/오른쪽/중앙 조준에 따라 타깃 라인/화살표가 바뀜.
     - 목표 탄도: 낮게 컨트롤/기본/부드럽게 떨어짐에 따라 탄도 곡선 높이가 바뀜.
     - 바람: 방향과 세기에 따라 화살표 방향/강도 표현이 바뀜.

## Out of scope / Non-goals
- GPS, 지도, 날씨 API, 로그인, 백엔드 추가 없음.
- 3D 모션 뷰어 재도입 없음.
- 영어 UI 없음.
- 점수/베팅/소셜 기능 없음.
- 장문의 분석 리포트로 확장하지 않음.
- 브랜드 로고/상표/골프존·카카오골프의 정확한 화면 복제 없음.

## Decision boundaries
OMX may decide without confirmation:
- Numeric input implementation detail: `type="text" inputMode="numeric"` or equivalent, internal draft string state, blur/save-time clamp.
- Reactive 2D visual implementation: SVG/CSS/HTML, as long as visible behavior meets acceptance criteria.
- Exact Korean microcopy for situation-specific trajectory reason, as long as fixed generic phrase is removed.
- Responsive layout details preserving mobile-first one-hand use.

OMX should not decide without confirmation:
- Removing the four required explanation panels.
- Adding APIs/backend/auth/map/weather/GPS/3D.
- Reintroducing a long one-line recommendation headline.

## Constraints
- Korean-only visible UI.
- Mobile-first and one-hand-friendly.
- No new external service dependency.
- Keep existing local preset behavior.
- Keep existing recommendation domain intent: caddie-like practical prescription, not official coaching/medical/legal advice copy.

## Testable acceptance criteria
1. User can type numbers directly into remaining distance and every club carry distance field, including deleting the field temporarily while editing.
2. Mobile numeric keyboard is requested via input attributes.
3. Browser stepper-centric UX is not visible/required.
4. Initial screen begins with distance preset controls, followed by shot situation input, not the previous hero intro copy.
5. Visible old hero copy is absent: `캐디 한줄 처방`, `남은 거리와 라이만 빠르게 넣고 한 줄 조언을 먼저 봅니다`, `위치·날씨 자동 연동이나`.
6. Result area does not show `추천: ...` headline.
7. Result area does not show `짧은 이유` helper label.
8. Result area does not show the lower repeated `조준 / 탄도 / 미스 경고` strip.
9. The four explanation panels remain with the exact four titles.
10. `목표 탄도 이유` detail no longer contains `긴 설명보다 낮은 실행 처방이 빠릅니다` or equivalent fixed generic filler.
11. Reactive 2D shot/stance visual includes feet/stance and ball.
12. Visual changes for all five drivers: 공 위치 높이, 앞뒤 경사, 조준 방향, 목표 탄도, 바람.
13. Existing no-external-services/no-3D/no-auth/no-backend guards still pass.
14. Tests, typecheck, lint, build pass.

## Assumptions exposed + resolutions
- Assumption: Static dashboard is required because previous spec requested it.
  - Resolution: Superseded. User wants reactive 2D dashboard with visible semantic changes.
- Assumption: The one-line headline is still useful.
  - Resolution: Remove it because it duplicates the panels.
- Assumption: Numeric `type=number` is sufficient for typing.
  - Resolution: User experience says it is not; implementation must support comfortable direct typing and intermediate edit states.

## Brownfield evidence vs inference
- Evidence: Current `App.tsx` renders hero intro, result first, adjustment strip, static dashboard, number inputs.
- Evidence: Current `useCaddieSession.ts` contains fixed trajectory detail phrase and headline string.
- Inference: Numeric typing issue likely comes from number-input UX plus numeric state coercion; implementation should verify in browser/mobile where possible.

## Recommended handoff
Use `$ralplan` next for a small implementation/test plan, then `$team $ultragoal` or direct `$ultragoal` for execution.
