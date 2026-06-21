import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { currentMatchMedia } from '../browserEnvironment';
import type { MotionParameters, SwingRecommendation } from '../domain/swingLabModels';

type SwingMotionViewerProps = {
  readonly parameters: MotionParameters;
  readonly recommendation: SwingRecommendation;
  readonly forceReducedMotion?: boolean;
};


function tempoLabel(value: SwingRecommendation['tempo']): string {
  return { smooth: '부드러운', neutral: '중립', assertive: '과감한' }[value];
}

function pathBiasLabel(value: SwingRecommendation['pathBias']): string {
  return { neutral: '중립', 'draw-biased': '드로 성향', 'fade-biased': '페이드 성향' }[value];
}

function trajectoryLabel(value: SwingRecommendation['trajectoryStrategy']): string {
  return { flighted: '낮은 탄도', 'standard-window': '표준 탄도', 'launch-higher': '높은 탄도' }[value];
}

function poseLabel(value: MotionParameters['reducedMotionPose']): string {
  return { compact: '컴팩트', balanced: '균형', extended: '확장' }[value];
}

function usePrefersReducedMotion(forceReducedMotion = false): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    const matchMedia = currentMatchMedia();
    if (forceReducedMotion || typeof matchMedia !== 'function') {
      return forceReducedMotion;
    }

    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const matchMedia = currentMatchMedia();
    if (forceReducedMotion || typeof matchMedia !== 'function') {
      return;
    }

    const mediaQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener('change', syncPreference);

    return () => mediaQuery.removeEventListener('change', syncPreference);
  }, [forceReducedMotion]);

  return forceReducedMotion || prefersReducedMotion;
}

export function SwingMotionViewer({ parameters, recommendation, forceReducedMotion = false }: SwingMotionViewerProps) {
  const prefersReducedMotion = usePrefersReducedMotion(forceReducedMotion);
  const visualState = useMemo(() => {
    const amplitude = parameters.arcDegrees / 2;
    const backswingRotation = -amplitude;
    const finishRotation = amplitude * 0.72;
    const impactOffset = parameters.pathOffset * 0.34;
    const trajectoryEndY = 176 - parameters.followThroughHeight * 0.72;

    return {
      backswingRotation,
      finishRotation,
      impactOffset,
      trajectoryEndY,
      poseLabel: prefersReducedMotion ? `정적 ${poseLabel(parameters.reducedMotionPose)} 자세` : '애니메이션 템포 루프',
    };
  }, [parameters, prefersReducedMotion]);

  const viewerStyle = {
    '--swing-arc': `${parameters.arcDegrees}deg`,
    '--backswing-rotation': `${visualState.backswingRotation}deg`,
    '--finish-rotation': `${visualState.finishRotation}deg`,
    '--plane-tilt': `${parameters.planeTiltDegrees}deg`,
    '--path-offset': `${parameters.pathOffset}px`,
    '--impact-offset': `${visualState.impactOffset}px`,
    '--launch-angle': `${parameters.launchAngleDegrees}deg`,
    '--swing-duration': `${parameters.animationDurationMs}ms`,
  } as CSSProperties;

  return (
    <section className="motion-viewer-panel" aria-labelledby="motion-viewer-title">
      <div className="section-heading motion-viewer-heading">
        <p className="eyebrow">3단계 · 모션 뷰어</p>
        <h2 id="motion-viewer-title">파라미터 기반 골퍼 모션</h2>
        <p>
          SVG 레이어가 이 카드의 스윙 크기, 경로, 템포, 플레인, 탄도 변화를 평면 2D 보기로 보여줍니다.
        </p>
      </div>

      <div
        className="motion-stage-wrap"
        style={viewerStyle}
        role="img"
        tabIndex={0}
        aria-label={`골퍼 모션 뷰어: ${parameters.accessibleSummary}. ${visualState.poseLabel}. 평면 2D 스테이지.`}
      >
        <div className="motion-stage-depth">
          <svg className="swing-arc-svg" viewBox="0 0 360 320" aria-hidden="true">
            <defs>
              <linearGradient id="trajectoryGradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#b8ff68" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#53d1ff" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            <ellipse className="ground-ring" cx="180" cy="250" rx="118" ry="28" />
            <path className="swing-plane" d={`M 84 222 C 122 72, 236 72, 276 222`} pathLength="100" />
            <path className="swing-plane swing-plane-shadow" d={`M ${84 + parameters.pathOffset} 228 C ${124 + parameters.pathOffset} 96, ${236 + parameters.pathOffset} 96, ${276 + parameters.pathOffset} 228`} pathLength="100" />
            <path className="trajectory-line" d={`M 196 164 C 236 ${134 - parameters.launchAngleDegrees}, 282 ${visualState.trajectoryEndY}, 330 ${visualState.trajectoryEndY - 24}`} />

            <g className="golfer-body">
              <line className="leg lead-leg" x1="166" y1="205" x2="144" y2="252" />
              <line className="leg trail-leg" x1="172" y1="205" x2="202" y2="252" />
              <line className="torso" x1="168" y1="202" x2="184" y2="142" />
              <circle className="head" cx="190" cy="122" r="15" />
              <line className="collar-line" x1="166" y1="154" x2="202" y2="150" />
              <g className="swing-armature">
                <line className="lead-arm" x1="172" y1="156" x2="146" y2="188" />
                <line className="trail-arm" x1="198" y1="154" x2="158" y2="190" />
                <line className="club" x1="156" y1="190" x2="118" y2="260" />
                <circle className="club-head" cx="116" cy="263" r="6" />
              </g>
            </g>

            <g className="pose-markers" aria-hidden="true">
              <circle cx="90" cy="220" r="5" />
              <circle cx={180 + parameters.pathOffset * 0.5} cy="246" r="6" />
              <circle cx="276" cy="220" r="5" />
            </g>
          </svg>
        </div>
      </div>

      <div className="motion-meter-grid" aria-label="현재 모션 파라미터">
        <span>
          <strong>{parameters.arcDegrees}°</strong>
          스윙 아크 {recommendation.swingSizePercent}% {recommendation.swingSizeLabel}
        </span>
        <span>
          <strong>{(parameters.animationDurationMs / 1000).toFixed(1)}s</strong>
          {tempoLabel(recommendation.tempo)} 템포 루프
        </span>
        <span>
          <strong>{parameters.pathOffset}px</strong>
          {pathBiasLabel(recommendation.pathBias)} 경로 오프셋
        </span>
        <span>
          <strong>{parameters.launchAngleDegrees}°</strong>
          {trajectoryLabel(recommendation.trajectoryStrategy)}
        </span>
      </div>
    </section>
  );
}
