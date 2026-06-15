import { describe, expect, it } from 'vitest';
import {
  classifyLocationFailure,
  classifyLocationSample,
  distanceMeters,
  formatApproxDistance,
  resolveCurrentLocation,
  targetDistances,
} from './geo';
import { sampleCourseTargets } from './courseTargets';
import type { LocationSample } from './models';

const accurateSample: LocationSample = {
  lat: 37.42194,
  lng: -122.08403,
  accuracyMeters: 12,
  timestamp: '2026-06-15T09:00:00.000Z',
};

describe('geo distance utilities', () => {
  it('returns 0 meters for identical coordinates', () => {
    expect(distanceMeters(accurateSample, accurateSample)).toBeCloseTo(0, 5);
  });

  it('calculates approximate meter distances between nearby coordinates', () => {
    const meters = distanceMeters(accurateSample, { lat: 37.42294, lng: -122.08403 });

    expect(meters).toBeGreaterThan(110);
    expect(meters).toBeLessThan(112);
  });

  it('formats friendly approximate distance labels without rangefinder precision', () => {
    expect(formatApproxDistance(87.4)).toBe('≈ 87 m');
    expect(formatApproxDistance(1288)).toBe('≈ 1.3 km');
  });

  it('sorts target distances from the current location', () => {
    const distances = targetDistances(accurateSample, sampleCourseTargets);

    expect(distances).toHaveLength(sampleCourseTargets.length);
    expect(distances[0]?.meters).toBeLessThanOrEqual(distances[1]?.meters ?? Number.POSITIVE_INFINITY);
    expect(distances.every((distance) => distance.label.startsWith('≈ '))).toBe(true);
  });
});

describe('current location state classification', () => {
  it('returns ready when accuracy is within the friendly-play threshold', () => {
    const state = classifyLocationSample(accurateSample, { maxAcceptableAccuracyMeters: 50 });

    expect(state.status).toBe('ready');
    expect(state.message).toMatch(/about 12 m accuracy/i);
  });

  it('marks a successful reading as low accuracy when it exceeds the threshold', () => {
    const state = classifyLocationSample(
      { ...accurateSample, accuracyMeters: 95 },
      { maxAcceptableAccuracyMeters: 50 },
    );

    expect(state.status).toBe('low_accuracy');
    expect(state.message).toMatch(/extra approximate/i);
  });

  it('returns denied when the provider reports permission denied', () => {
    const state = classifyLocationFailure({ code: 1, message: 'permission denied' });

    expect(state.status).toBe('denied');
    expect(state.message).toMatch(/permission was denied/i);
  });

  it('returns unavailable when the provider reports position unavailable', () => {
    const state = classifyLocationFailure({ code: 2, message: 'position unavailable' });

    expect(state).toMatchObject({ status: 'unavailable', reason: 'unavailable' });
  });

  it('resolves denied, unavailable, low-accuracy, and ready states through the provider port', async () => {
    await expect(
      resolveCurrentLocation({ getCurrentPosition: async () => accurateSample }, { maxAcceptableAccuracyMeters: 50 }),
    ).resolves.toMatchObject({ status: 'ready' });

    await expect(
      resolveCurrentLocation(
        { getCurrentPosition: async () => ({ ...accurateSample, accuracyMeters: 120 }) },
        { maxAcceptableAccuracyMeters: 50 },
      ),
    ).resolves.toMatchObject({ status: 'low_accuracy' });

    await expect(
      resolveCurrentLocation({ getCurrentPosition: async () => Promise.reject({ code: 1 }) }),
    ).resolves.toMatchObject({ status: 'denied' });

    await expect(
      resolveCurrentLocation({ getCurrentPosition: async () => Promise.reject({ code: 2 }) }),
    ).resolves.toMatchObject({ status: 'unavailable', reason: 'unavailable' });
  });
});
