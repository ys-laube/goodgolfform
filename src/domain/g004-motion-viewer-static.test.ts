import * as fs from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import appSource from '../App.tsx?raw';
import shotVisualSource from '../CaddieShotVisual.tsx?raw';
import caddieSessionSource from '../useCaddieSession.ts?raw';

const stylesSource = fs.readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

function fileExists(path: string): boolean {
  try {
    fs.readFileSync(path, 'utf8');
    return true;
  } catch {
    return false;
  }
}
const staleRuntimeFiles = [
  'src/components/SwingMotionViewer.tsx',
  'src/domain/motionParameters.ts',
  'src/domain/profilePresets.ts',
  'src/domain/recommendationEngine.ts',
  'src/domain/swingLabModels.ts',
  'src/useSwingLabSession.ts',
] as const;

describe('G004 stale Swing Lab removal guard', () => {
  it('removes stale Swing Lab, motion viewer, and old profile stack files', () => {
    for (const file of staleRuntimeFiles) {
      expect(fileExists(join(process.cwd(), file)), `${file} should be removed`).toBe(false);
    }
  });

  it('keeps the app wired only to the Korean caddie session and Korean semantic 2D setup visual', () => {
    expect(appSource).toMatch(/useCaddieSession/);
    expect(appSource).toMatch(/prescription\.reasonCards/);
    expect(appSource).toMatch(/prescription\.shotVisual/);
    expect(`${appSource}\n${shotVisualSource}`).toMatch(/shot-visual/);
    expect(caddieSessionSource).toMatch(/buildCaddiePrescription/);
    expect(caddieSessionSource).toMatch(/caddiePresets/);
    expect(caddieSessionSource).toMatch(/CaddieShotVisualState/);
    expect(caddieSessionSource).toMatch(/shotVisual:\s*\{/);
    expect(caddieSessionSource).not.toMatch(new RegExp(['CaddieShot' + 'Dashboard', 'shot' + 'Dashboard', 'recommendation:'].join('|')));
    expect(`${appSource}\n${shotVisualSource}\n${caddieSessionSource}`).not.toMatch(/SwingMotionViewer|motionParameters|useSwingLabSession|recommendShot|profilePresets|swingLabModels/);
  });

  it('keeps semantic visual state free of recommendation, wind drawing, trajectory drawing, and swing summary fields', () => {
    const visualTypeBody = caddieSessionSource.match(/type CaddieShotVisualState = \{([\s\S]*?)\};/)?.[1] ?? '';
    const visualStateBody = caddieSessionSource.match(/shotVisual:\s*\{([\s\S]*?)\n {4}\},/)?.[1] ?? '';

    expect(visualTypeBody).toMatch(/handedness/);
    expect(visualTypeBody).toMatch(/clubGroup/);
    expect(visualTypeBody).toMatch(/ballPositionSlot/);
    expect(visualTypeBody).toMatch(/ballPositionPercentRightHanded/);
    expect(visualTypeBody).toMatch(/ballPositionPercent/);
    expect(visualTypeBody).toMatch(/frontBackSlope/);
    expect(visualTypeBody).toMatch(/sideHillRelation/);
    expect(`${visualTypeBody}\n${visualStateBody}`).not.toMatch(
      /recommendation|playDistanceMeters|swingPercent|selectedClubLabel|windDirection|windStrength|trajectory|추천|플레이 거리|스윙/,
    );
  });

  it('removes motion-viewer styling while preserving responsive mobile layout', () => {
    expect(stylesSource).not.toMatch(/motion-viewer|motion-stage|motion-meter|swing-arc|swing-plane|swing-armature|perspective|preserve-3d|translateZ|rotateX|rotateY/i);
    expect(stylesSource).toContain('.shot-visual');
    expect(stylesSource).not.toContain('.shot-visual-' + 'metrics');
    expect(stylesSource).not.toMatch(/shot-dashboard|dashboard-metrics|visual-card-grid|visual-card|visual-marker/);
    expect(stylesSource).toMatch(/data-front-back="uphill"[\s\S]*--stance-tilt/);
    expect(stylesSource).toMatch(/data-side-hill="below-feet"[\s\S]*--side-hill-offset/);
    expect(stylesSource).not.toMatch(/data-wind|data-trajectory|shot-visual-arc|shot-visual-wind/);
    expect(stylesSource).toContain('@media (min-width: 42rem)');
    expect(stylesSource).toContain('@media (min-width: 56rem)');
  });
});
