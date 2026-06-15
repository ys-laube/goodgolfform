import { describe, expect, it } from 'vitest';
import { createManualCourseTarget, sampleCourseTargets, sampleRoomId } from './courseTargets';

describe('course targets', () => {
  it('provides sample course targets without requiring a provider SDK', () => {
    expect(sampleCourseTargets.length).toBeGreaterThanOrEqual(3);
    expect(sampleCourseTargets.every((target) => target.roomId === sampleRoomId)).toBe(true);
    expect(sampleCourseTargets.map((target) => target.type)).toEqual(
      expect.arrayContaining(['tee', 'green', 'hazard', 'custom']),
    );
  });

  it('creates a manual custom target from user coordinates and label', () => {
    const target = createManualCourseTarget({
      roomId: 'room-1',
      label: 'Carry over creek',
      lat: 37.5,
      lng: -122.1,
    });

    expect(target).toMatchObject({
      id: 'manual-carry-over-creek',
      roomId: 'room-1',
      type: 'custom',
      label: 'Carry over creek',
      lat: 37.5,
      lng: -122.1,
    });
  });
});
