import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import type { MotionParameters, SwingRecommendation } from '../domain/swingLabModels';

type SwingMotionViewerProps = {
  readonly parameters: MotionParameters;
  readonly recommendation: SwingRecommendation;
  readonly forceReducedMotion?: boolean;
};

type Rotation = {
  readonly x: number;
  readonly y: number;
};

type DragState = {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly origin: Rotation;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatValue(value: string): string {
  return value.replaceAll('-', ' ');
}

function usePrefersReducedMotion(forceReducedMotion = false): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(forceReducedMotion);

  useEffect(() => {
    if (forceReducedMotion) {
      setPrefersReducedMotion(true);
      return;
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener('change', syncPreference);

    return () => mediaQuery.removeEventListener('change', syncPreference);
  }, [forceReducedMotion]);

  return prefersReducedMotion;
}

export function SwingMotionViewer({ parameters, recommendation, forceReducedMotion = false }: SwingMotionViewerProps) {
  const prefersReducedMotion = usePrefersReducedMotion(forceReducedMotion);
  const [rotation, setRotation] = useState<Rotation>({ x: -10, y: 18 });
  const [dragState, setDragState] = useState<DragState | null>(null);

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
      poseLabel: prefersReducedMotion ? `Static ${parameters.reducedMotionPose} pose` : 'Animated tempo loop',
    };
  }, [parameters, prefersReducedMotion]);

  const viewerStyle = {
    '--viewer-rotate-x': `${rotation.x}deg`,
    '--viewer-rotate-y': `${rotation.y}deg`,
    '--swing-arc': `${parameters.arcDegrees}deg`,
    '--backswing-rotation': `${visualState.backswingRotation}deg`,
    '--finish-rotation': `${visualState.finishRotation}deg`,
    '--plane-tilt': `${parameters.planeTiltDegrees}deg`,
    '--path-offset': `${parameters.pathOffset}px`,
    '--impact-offset': `${visualState.impactOffset}px`,
    '--launch-angle': `${parameters.launchAngleDegrees}deg`,
    '--swing-duration': `${parameters.animationDurationMs}ms`,
  } as CSSProperties;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: rotation });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    setRotation({
      x: clamp(dragState.origin.x - deltaY * 0.22, -28, 18),
      y: clamp(dragState.origin.y + deltaX * 0.28, -48, 48),
    });
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
  }

  return (
    <section className="motion-viewer-panel" aria-labelledby="motion-viewer-title">
      <div className="section-heading motion-viewer-heading">
        <p className="eyebrow">Step 3 · Motion viewer</p>
        <h2 id="motion-viewer-title">Parameterized golfer motion</h2>
        <p>
          SVG layers translate this card into visible swing size, path, tempo, plane, and trajectory changes. Swipe the stage for pseudo-3D rotation.
        </p>
      </div>

      <div
        className="motion-stage-wrap"
        style={viewerStyle}
        role="img"
        tabIndex={0}
        aria-label={`Golfer motion viewer: ${parameters.accessibleSummary}. ${visualState.poseLabel}. Swipe the stage for rotation.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
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
              <line className="shoulder" x1="166" y1="154" x2="202" y2="150" />
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

      <div className="motion-meter-grid" aria-label="Current motion parameters">
        <span>
          <strong>{parameters.arcDegrees}°</strong>
          Swing arc from {recommendation.swingSizePercent}% {recommendation.swingSizeLabel}
        </span>
        <span>
          <strong>{(parameters.animationDurationMs / 1000).toFixed(1)}s</strong>
          {formatValue(recommendation.tempo)} tempo loop
        </span>
        <span>
          <strong>{parameters.pathOffset}px</strong>
          {formatValue(recommendation.pathBias)} path offset
        </span>
        <span>
          <strong>{parameters.launchAngleDegrees}°</strong>
          {formatValue(recommendation.trajectoryStrategy)} trajectory
        </span>
      </div>
    </section>
  );
}
