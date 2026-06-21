import { describe, expect, it } from 'vitest';
import { caddieClubOrder, createCaddieDistancePreset, replaceCaddieClubDistance, type CaddieClubKey } from './caddiePresets';
import {
  buildCaddiePrescription,
  createCaddieShotVisualState,
  type CaddieScenario,
} from '../useCaddieSession';

const baseScenario: CaddieScenario = {
  targetDistanceMeters: 100,
  lie: 'fairway',
  stanceSlope: 'level',
  sideSlope: 'none',
  windDirection: 'none',
  windStrength: 'light',
  pinPosition: 'middle',
  greenRisk: 'safe-middle',
  handedness: 'right',
};

const expectedClubVisuals = {
  driver: { clubGroup: 'driver', ballPositionPercentRightHanded: 82 },
  '3w': { clubGroup: 'fairway-wood', ballPositionPercentRightHanded: 72 },
  '5w': { clubGroup: 'fairway-wood', ballPositionPercentRightHanded: 72 },
  '4i': { clubGroup: 'long-iron', ballPositionPercentRightHanded: 62 },
  '5i': { clubGroup: 'long-iron', ballPositionPercentRightHanded: 62 },
  '6i': { clubGroup: 'mid-iron', ballPositionPercentRightHanded: 50 },
  '7i': { clubGroup: 'mid-iron', ballPositionPercentRightHanded: 50 },
  '8i': { clubGroup: 'mid-iron', ballPositionPercentRightHanded: 50 },
  '9i': { clubGroup: 'wedge', ballPositionPercentRightHanded: 42 },
  pw: { clubGroup: 'wedge', ballPositionPercentRightHanded: 42 },
  gw: { clubGroup: 'wedge', ballPositionPercentRightHanded: 42 },
  sw: { clubGroup: 'wedge', ballPositionPercentRightHanded: 42 },
} satisfies Record<CaddieClubKey, { clubGroup: string; ballPositionPercentRightHanded: number }>;

describe('semantic caddie shot visual state', () => {
  it('maps all 12 clubs into the canonical five setup groups and right-handed ball positions', () => {
    expect(caddieClubOrder).toHaveLength(12);

    for (const club of caddieClubOrder) {
      const visual = createCaddieShotVisualState(club, baseScenario);
      expect(visual.clubGroup).toBe(expectedClubVisuals[club].clubGroup);
      expect(visual.ballPositionPercentRightHanded).toBe(expectedClubVisuals[club].ballPositionPercentRightHanded);
      expect(visual.ballPositionPercent).toBe(expectedClubVisuals[club].ballPositionPercentRightHanded);
    }

    expect(new Set(Object.values(expectedClubVisuals).map((visual) => visual.clubGroup))).toEqual(
      new Set(['driver', 'fairway-wood', 'long-iron', 'mid-iron', 'wedge']),
    );
  });

  it('mirrors ball position for left-handed setup while preserving the right-handed canonical value', () => {
    const rightHandedWedge = createCaddieShotVisualState('pw', { ...baseScenario, handedness: 'right' });
    const leftHandedWedge = createCaddieShotVisualState('pw', { ...baseScenario, handedness: 'left' });
    const rightHandedDriver = createCaddieShotVisualState('driver', { ...baseScenario, handedness: 'right' });
    const leftHandedDriver = createCaddieShotVisualState('driver', { ...baseScenario, handedness: 'left' });

    expect(rightHandedWedge.ballPositionPercentRightHanded).toBe(42);
    expect(leftHandedWedge.ballPositionPercentRightHanded).toBe(42);
    expect(rightHandedWedge.ballPositionPercent).toBe(42);
    expect(leftHandedWedge.ballPositionPercent).toBe(58);
    expect(rightHandedDriver.ballPositionPercent).toBe(82);
    expect(leftHandedDriver.ballPositionPercent).toBe(18);
  });

  it('keeps long clubs closer to the rendered lead side than the trail side', () => {
    const rightHandedDriver = createCaddieShotVisualState('driver', { ...baseScenario, handedness: 'right' });
    const rightHandedWedge = createCaddieShotVisualState('sw', { ...baseScenario, handedness: 'right' });
    const leftHandedDriver = createCaddieShotVisualState('driver', { ...baseScenario, handedness: 'left' });

    expect(rightHandedDriver.ballPositionPercent).toBeGreaterThan(50);
    expect(rightHandedWedge.ballPositionPercent).toBeLessThan(50);
    expect(leftHandedDriver.ballPositionPercent).toBeLessThan(50);
  });

  it('keeps front-back slope independent from side-hill relation', () => {
    expect(
      createCaddieShotVisualState('7i', {
        ...baseScenario,
        stanceSlope: 'uphill',
        sideSlope: 'right-slope',
      }),
    ).toMatchObject({ frontBackSlope: 'uphill', sideHillRelation: 'above-feet' });

    expect(
      createCaddieShotVisualState('7i', {
        ...baseScenario,
        stanceSlope: 'downhill',
        sideSlope: 'left-slope',
      }),
    ).toMatchObject({ frontBackSlope: 'downhill', sideHillRelation: 'below-feet' });
  });

  it('keeps wind and trajectory as prescription copy instead of shotVisual drawing fields', () => {
    const preset = createCaddieDistancePreset({
      id: 'shot-visual-copy-boundary',
      name: 'copy boundary',
      anchorDistances: { driver: 220, sevenIron: 140, pitchingWedge: 100 },
    });
    const prescription = buildCaddiePrescription(
      replaceCaddieClubDistance(preset, '9i', 112),
      {
        ...baseScenario,
        targetDistanceMeters: 100,
        windDirection: 'headwind',
        windStrength: 'strong',
        pinPosition: 'front',
        greenRisk: 'short-danger',
      },
    );

    expect(prescription.trajectoryText).toBe('낮게 컨트롤');
    expect(prescription.reasonCards.find((card) => card.id === 'target-trajectory-reason')?.detail).toContain('맞바람');
    expect(prescription.shotVisual).not.toHaveProperty('windDirection');
    expect(prescription.shotVisual).not.toHaveProperty('windStrength');
    expect(prescription.shotVisual).not.toHaveProperty('trajectory');
  });
});
