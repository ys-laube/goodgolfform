import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SwingMotionViewer } from '../components/SwingMotionViewer';
import appSource from '../App.tsx?raw';
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
    expect(renderedViewer).toContain('Parameterized golfer motion');
    expect(renderedViewer).toContain('<svg');
    expect(renderedViewer).toContain('class="swing-arc-svg"');
    expect(renderedViewer).toContain('role="img"');
    expect(renderedViewer).toMatch(/Golfer motion viewer: .* tempo, .* path, .* launch/i);
    expect(renderedViewer).toContain('Drag the stage to rotate the pseudo-3D view');
    expect(renderedViewer).toContain('Current motion parameters');
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
    expect(compact).toMatch(/Swing arc from \d+% three-quarter/i);
    expect(shaped).toMatch(/trajectory/i);
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

    expect(renderedViewer).toMatch(/Static (compact|balanced|extended) pose/);
    expect(renderedViewer).toContain('aria-label="Golfer motion viewer:');
    expect(stylesSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesSource).toContain('animation: none');
  });

  it('wires the App recommendation output into the viewer without new rendering dependencies or notice copy', () => {
    const renderedApp = renderToString(createElement(App));

    expect(appSource).toMatch(/motionParametersFromRecommendation/);
    expect(appSource).toMatch(/<SwingMotionViewer parameters=\{motionParameters\} recommendation=\{recommendation\}/);
    expect(renderedApp).toContain('Parameterized golfer motion');
    expect(renderedApp).toContain('Current motion parameters');
    expect(renderedApp).toMatch(/Golfer motion viewer:/);
    expect(renderedApp).not.toMatch(/disclaimer|legal notice|official|rangefinder|coach|caddie|caddy|must|should|guarantee|exact/i);
  });

  it('keeps pointer rotation handlers and mobile viewer styles source-visible for manual QA', () => {
    expect(viewerSource).toMatch(/onPointerDown=\{handlePointerDown\}/);
    expect(viewerSource).toMatch(/onPointerMove=\{handlePointerMove\}/);
    expect(viewerSource).toMatch(/setPointerCapture/);
    expect(stylesSource).toContain('.motion-stage-wrap');
    expect(stylesSource).toContain('touch-action: none');
    expect(stylesSource).toContain('.motion-meter-grid');
    expect(stylesSource).toContain('@media (min-width: 42rem)');
  });
});
