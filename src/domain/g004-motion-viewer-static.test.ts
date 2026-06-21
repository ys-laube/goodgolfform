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

  it('keeps the app wired only to the Korean caddie session and static shot dashboard', () => {
    expect(appSource).toMatch(/useCaddieSession/);
    expect(appSource).toMatch(/prescription\.reasonCards/);
    expect(appSource).toMatch(/shot-dashboard/);
    expect(appSource).not.toMatch(/prescription\.shotDashboard|dashboard-metrics/);
    expect(caddieSessionSource).toMatch(/buildPrescription/);
    expect(caddieSessionSource).toMatch(/caddiePresets/);
    expect(`${appSource}\n${caddieSessionSource}`).not.toMatch(/SwingMotionViewer|motionParameters|useSwingLabSession|recommendShot|profilePresets|swingLabModels/);
  });

  it('removes motion-viewer styling while preserving responsive mobile layout', () => {
    expect(stylesSource).not.toMatch(/motion-viewer|motion-stage|motion-meter|swing-arc|swing-plane|swing-armature|perspective|preserve-3d|translateZ|rotateX|rotateY/i);
    expect(stylesSource).toContain('.shot-dashboard');
    expect(stylesSource).not.toContain('.dashboard-metrics');
    expect(stylesSource).not.toMatch(/visual-card-grid|visual-card|visual-marker/);
    expect(stylesSource).toContain('@media (min-width: 42rem)');
    expect(stylesSource).toContain('@media (min-width: 56rem)');
  });
});
