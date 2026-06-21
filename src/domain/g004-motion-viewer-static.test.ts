import * as fs from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import appSource from '../App.tsx?raw';
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

  it('keeps the app wired only to the Korean caddie session and reactive 2D shot visual', () => {
    expect(appSource).toMatch(/useCaddieSession/);
    expect(appSource).toMatch(/prescription\.reasonCards/);
    expect(appSource).toMatch(/prescription\.shotVisual/);
    expect(appSource).toMatch(/shot-visual/);
    expect(caddieSessionSource).toMatch(/buildPrescription/);
    expect(caddieSessionSource).toMatch(/caddiePresets/);
    expect(caddieSessionSource).toMatch(/CaddieShotVisualState/);
    expect(caddieSessionSource).toMatch(/shotVisualState:\s*\{/);
    expect(caddieSessionSource).not.toMatch(/CaddieShotDashboard|shotDashboard|recommendation:/);
    expect(`${appSource}\n${caddieSessionSource}`).not.toMatch(/SwingMotionViewer|motionParameters|useSwingLabSession|recommendShot|profilePresets|swingLabModels/);
  });

  it('keeps visual state free of recommendation, play-distance, and swing summary fields', () => {
    const visualTypeBody = caddieSessionSource.match(/type CaddieShotVisualState = \{([\s\S]*?)\};/)?.[1] ?? '';
    const visualStateBody = caddieSessionSource.match(/shotVisualState:\s*\{([\s\S]*?)\n {4}\},/)?.[1] ?? '';

    expect(visualTypeBody).toMatch(/targetLine/);
    expect(visualTypeBody).toMatch(/ballPosition/);
    expect(visualTypeBody).toMatch(/wind/);
    expect(visualTypeBody).toMatch(/trajectory/);
    expect(`${visualTypeBody}\n${visualStateBody}`).not.toMatch(/recommendation|playDistanceMeters|swingPercent|selectedClubLabel|추천|플레이 거리|스윙/);
  });

  it('removes motion-viewer styling while preserving responsive mobile layout', () => {
    expect(stylesSource).not.toMatch(/motion-viewer|motion-stage|motion-meter|swing-arc|swing-plane|swing-armature|perspective|preserve-3d|translateZ|rotateX|rotateY/i);
    expect(stylesSource).toContain('.shot-visual');
    expect(stylesSource).toContain('.shot-visual-metrics');
    expect(stylesSource).not.toMatch(/shot-dashboard|dashboard-metrics|visual-card-grid|visual-card|visual-marker/);
    expect(stylesSource).toContain('@media (min-width: 42rem)');
    expect(stylesSource).toContain('@media (min-width: 56rem)');
  });
});
