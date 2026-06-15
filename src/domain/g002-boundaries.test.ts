import { describe, expect, it } from 'vitest';
import type { CourseTarget, LocationSample } from './models';

describe('G002 provider-neutral map/geolocation boundaries', () => {
  it('keeps current course target data provider-neutral and manually supplied', () => {
    const target = {
      id: 'green-9-front',
      roomId: 'room-friends-nine',
      type: 'green',
      label: 'Front of green 9',
      lat: 37.4219999,
      lng: -122.0840575,
    } satisfies CourseTarget;

    expect(target).toMatchObject({
      id: 'green-9-front',
      roomId: 'room-friends-nine',
      type: 'green',
      label: 'Front of green 9',
    });
    expect(target.lat).toBeGreaterThanOrEqual(-90);
    expect(target.lat).toBeLessThanOrEqual(90);
    expect(target.lng).toBeGreaterThanOrEqual(-180);
    expect(target.lng).toBeLessThanOrEqual(180);
  });

  it('models low-accuracy browser geolocation samples without provider-specific SDK fields', () => {
    const lowAccuracySample = {
      lat: 37.4219999,
      lng: -122.0840575,
      accuracyMeters: 125,
      timestamp: '2026-06-15T09:40:00.000Z',
    } satisfies LocationSample;

    expect(lowAccuracySample.accuracyMeters).toBeGreaterThan(50);
    expect(Object.keys(lowAccuracySample).sort()).toEqual([
      'accuracyMeters',
      'lat',
      'lng',
      'timestamp',
    ]);
  });
});
