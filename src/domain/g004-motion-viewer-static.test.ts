import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SwingMotionViewer } from '../components/SwingMotionViewer';
import appSource from '../App.tsx?raw';
import caddieSessionSource from '../useCaddieSession.ts?raw';
import viewerSource from '../components/SwingMotionViewer.tsx?raw';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { motionParametersFromRecommendation } from './motionParameters';
import { builtInProfilePresets } from './profilePresets';
import { recommendShot } from './recommendationEngine';
import type { ShotScenario } from './swingLabModels';
import { App } from '../App';

const stylesSource = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

const neutralScenario: ShotScenario = {
  targetDistanceMeters: 145,
  windDirection: 'none',
  windStrength: 'calm',
  lie: 'fairway',
  desiredWindow: 'standard',
};

function renderViewerFor(scenario: ShotScenario, profileIndex = 0, forceReducedMotion = false): string {
  const recommendation = recommendShot(builtInProfilePresets[profileIndex], scenario);
  const parameters = motionParametersFromRecommendation(recommendation);

  return renderToStaticMarkup(
    createElement(SwingMotionViewer, {
      parameters,
      recommendation,
      forceReducedMotion,
    }),
  );
}

describe('G004 parameterized motion viewer static contract', () => {
  it('renders an accessible dependency-free SVG motion viewer from recommendation motion parameters', () => {
    const renderedViewer = renderViewerFor(neutralScenario);

    expect(renderedViewer).toContain('id="motion-viewer-title"');
    expect(renderedViewer).toContain('파라미터 기반 골퍼 모션');
    expect(renderedViewer).toContain('<svg');
    expect(renderedViewer).toContain('class="swing-arc-svg"');
    expect(renderedViewer).toContain('role="img"');
    expect(renderedViewer).toMatch(/aria-label="골퍼 모션 뷰어:/);
    expect(renderedViewer).toContain('평면 2D 보기');
    expect(renderedViewer).toContain('현재 모션 파라미터');
    expect(renderedViewer).not.toMatch(/canvas|webgl|three|@react-three/i);
  });

  it('changes visible style parameters across swing size, path, tempo, and trajectory scenarios', () => {
    const compact = renderViewerFor({ ...neutralScenario, targetDistanceMeters: 58 });
    const shaped = renderViewerFor({
      ...neutralScenario,
      targetDistanceMeters: 165,
      windDirection: 'left-to-right',
      windStrength: 'steady',
      desiredWindow: 'low',
    }, 1);

    expect(compact).not.toEqual(shaped);
    expect(compact).toMatch(/--swing-arc:[^;]+deg/);
    expect(shaped).toMatch(/--path-offset:-?\d+px/);
    expect(shaped).toMatch(/--plane-tilt:[^;]+deg/);
    expect(shaped).toMatch(/--swing-duration:[^;]+ms/);
    expect(shaped).toMatch(/--launch-angle:[^;]+deg/);
    expect(compact).toMatch(/스윙 아크 ?\d+%/);
    expect(shaped).toMatch(/탄도/);
  });

  it('supports reduced-motion static fallback from the same parameters', () => {
    const renderedViewer = renderViewerFor(
      {
        ...neutralScenario,
        targetDistanceMeters: 165,
        windDirection: 'headwind',
        windStrength: 'strong',
        desiredWindow: 'low',
      },
      0,
      true,
    );

    expect(renderedViewer).toMatch(/정적 (컴팩트|균형|확장) 자세/);
    expect(renderedViewer).toContain('aria-label="골퍼 모션 뷰어:');
    expect(stylesSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesSource).toContain('animation: none');
  });

  it('wires the App prescription output into result-first cards without new rendering dependencies or notice copy', () => {
    const renderedApp = renderToString(createElement(App));

    expect(caddieSessionSource).toMatch(/buildPrescription/);
    expect(appSource).toMatch(/prescription\.reasonCards/);
    expect(appSource).toMatch(/prescription\.visualCards/);
    expect(renderedApp).toContain('지금 처방');
    expect(renderedApp).toContain('추천: PW 88%');
    expect(renderedApp).toContain('조준과 라이 미니카드');
    expect(renderedApp).not.toMatch(/disclaimer|legal notice|official|rangefinder|coach|must|should|guarantee|exact|면책|법적 고지|공식|거리측정기|코치|보장|정확/i);
  });

  it('keeps the flat viewer free of 3D interaction and transform CSS while preserving mobile styles', () => {
    expect(viewerSource).not.toMatch(/onPointerDown|onPointerMove|setPointerCapture|pseudo-3D|rotate the stage/i);
    expect(stylesSource).not.toMatch(/perspective|preserve-3d|translateZ|rotateX|rotateY/);
    expect(stylesSource).toContain('.motion-stage-wrap');
    expect(stylesSource).toContain('.motion-meter-grid');
    expect(stylesSource).toContain('@media (min-width: 42rem)');
  });
});
