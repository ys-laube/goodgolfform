import type { CSSProperties } from 'react';

import {
  ballPositionSlotLabels,
  clubGroupLabels,
  handednessLabels,
  sideHillRelationLabels,
  stanceSlopeLabels,
  type CaddieShotVisualState,
} from './useCaddieSession';

type ShotVisualStyle = CSSProperties & { readonly '--ball-position': string };

type CaddieShotVisualProps = {
  readonly visual: CaddieShotVisualState;
};

export function CaddieShotVisual({ visual }: CaddieShotVisualProps) {
  return (
    <section className="shot-visual" aria-labelledby="shot-visual-title">
      <div className="shot-visual-copy">
        <p className="eyebrow">한국형 2D 셋업 비주얼</p>
        <h3 id="shot-visual-title">발, 공, 라이를 두 시점으로 나눠 확인합니다</h3>
        <p>탄도·바람 그림 대신 클럽군, 우타/좌타, 공 위치와 경사 관계만 셋업 정보로 보여줍니다.</p>
      </div>

      <div className="shot-visual-views" aria-label="셋업 비주얼">
        <figure className="shot-visual-view shot-visual-top">
          <figcaption>위에서 본 스탠스 / 공 위치</figcaption>
          <div
            className="shot-visual-stage"
            data-handedness={visual.handedness}
            data-club-group={visual.clubGroup}
            style={{ '--ball-position': `${visual.ballPositionPercent}%` } as ShotVisualStyle}
            aria-hidden="true"
          >
            <span className="shot-visual-target-line">타깃 방향</span>
            <span className="shot-visual-foot shot-visual-foot-lead" />
            <span className="shot-visual-foot shot-visual-foot-trail" />
            <span className="shot-visual-ball" />
          </div>
          <p>
            {handednessLabels[visual.handedness]} · {clubGroupLabels[visual.clubGroup]} · {ballPositionSlotLabels[visual.ballPositionSlot]}
          </p>
        </figure>

        <figure className="shot-visual-view shot-visual-rear">
          <figcaption>뒤에서 본 라이 / 경사</figcaption>
          <div className="shot-visual-stage" data-front-back={visual.frontBackSlope} data-side-hill={visual.sideHillRelation} aria-hidden="true">
            <span className="shot-visual-horizon" />
            <span className="shot-visual-slope" />
            <span className="shot-visual-ball" />
          </div>
          <p>
            앞뒤 경사 {stanceSlopeLabels[visual.frontBackSlope]} · 공 위치 {sideHillRelationLabels[visual.sideHillRelation]}
          </p>
        </figure>
      </div>

      <details className="shot-visual-evidence">
        <summary>근거 보기</summary>
        <ul>
          <li>드라이버는 리드발 안쪽, 짧은 클럽일수록 중앙 쪽으로 공 위치를 이동합니다.</li>
          <li>미들 아이언은 대체로 스탠스 중앙 기준으로 보고, 롱 아이언과 우드는 약간 리드발 쪽을 봅니다.</li>
          <li>오르막·내리막은 앞뒤 경사로, 공이 발보다 높거나 낮은 상태는 발끝 라이로 분리해서 봅니다.</li>
        </ul>
      </details>
    </section>
  );
}
