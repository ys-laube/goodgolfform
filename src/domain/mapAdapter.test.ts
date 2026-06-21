import { describe, expect, it } from 'vitest';
import { sampleCourseTargets } from './courseTargets';
import { buildMockMapModel, type MapAdapter } from './mapAdapter';
import type { LocationSample } from './models';

const currentLocation: LocationSample = {
  lat: 37.42194,
  lng: -122.08403,
  accuracyMeters: 14,
  timestamp: '2026-06-15T09:00:00.000Z',
};

describe('provider-neutral map adapter boundary', () => {
  it('builds a mock map model with target and current-location markers', () => {
    const model = buildMockMapModel({ targets: sampleCourseTargets, currentLocation });

    expect(model.markers).toHaveLength(sampleCourseTargets.length + 1);
    expect(model.markers[0]).toMatchObject({ id: 'current-location', kind: 'current-location' });
    expect(model.tiles).toHaveLength(9);
    expect(model.tiles[0].url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/17\/\d+\/\d+\.png$/);
    expect(model.markers[0].screen.visible).toBe(true);
    expect(model.attribution).toMatch(/OpenStreetMap contributors/i);
  });

  it('maps the current-location viewport center to the middle of the static tile grid', () => {
    const model = buildMockMapModel({ targets: [], currentLocation });

    expect(model.viewport.center).toBe(currentLocation);
    expect(model.markers).toHaveLength(1);
    expect(model.markers[0]).toMatchObject({
      id: 'current-location',
      screen: {
        xPercent: expect.closeTo(50, 5),
        yPercent: expect.closeTo(50, 5),
        visible: true,
      },
    });
  });

  it('keeps off-viewport targets bounded by motion-safe marker percentage clamps', () => {
    const model = buildMockMapModel({
      currentLocation: { ...currentLocation, lat: 0, lng: 0 },
      targets: [
        {
          id: 'far-target',
          roomId: 'room-1',
          type: 'custom',
          label: 'Far target',
          lat: 80,
          lng: 170,
        },
      ],
    });

    const farMarker = model.markers.find((marker) => marker.id === 'far-target');

    expect(farMarker?.screen.visible).toBe(false);
    expect(farMarker?.screen.xPercent).toBeGreaterThanOrEqual(-20);
    expect(farMarker?.screen.xPercent).toBeLessThanOrEqual(120);
    expect(farMarker?.screen.yPercent).toBeGreaterThanOrEqual(-20);
    expect(farMarker?.screen.yPercent).toBeLessThanOrEqual(120);
    expect([farMarker?.screen.xPercent, farMarker?.screen.yPercent]).toEqual(expect.arrayContaining([expect.any(Number)]));
  });

  it('renders through an injected adapter without provider-specific coupling', () => {
    const model = buildMockMapModel({ targets: sampleCourseTargets });
    const rendered: unknown[] = [];
    const adapter: MapAdapter = {
      renderModel: (nextModel) => rendered.push(nextModel.markers.map((marker) => marker.label)),
    };

    adapter.renderModel(model);

    expect(rendered).toEqual([sampleCourseTargets.map((target) => target.label)]);
  });

  it('allows a provider-neutral tile URL template override without adding an SDK', () => {
    const model = buildMockMapModel({
      targets: sampleCourseTargets,
      tileTemplate: 'https://tiles.example.test/{z}/{x}/{y}.png',
      zoom: 16,
    });

    expect(model.viewport.tileTemplate).toBe('https://tiles.example.test/{z}/{x}/{y}.png');
    expect(model.tiles).toHaveLength(9);
    expect(model.tiles[4].url).toMatch(/^https:\/\/tiles\.example\.test\/16\/\d+\/\d+\.png$/);
  });

  it('maps static tile grid positions deterministically for SSR-friendly rendering', () => {
    const model = buildMockMapModel({ targets: sampleCourseTargets, zoom: 15 });

    expect(model.tiles.map((tile) => tile.leftPercent)).toEqual([
      expect.closeTo(0, 5),
      expect.closeTo(100 / 3, 5),
      expect.closeTo(200 / 3, 5),
      expect.closeTo(0, 5),
      expect.closeTo(100 / 3, 5),
      expect.closeTo(200 / 3, 5),
      expect.closeTo(0, 5),
      expect.closeTo(100 / 3, 5),
      expect.closeTo(200 / 3, 5),
    ]);
    expect(model.tiles.map((tile) => tile.topPercent)).toEqual([
      expect.closeTo(0, 5),
      expect.closeTo(0, 5),
      expect.closeTo(0, 5),
      expect.closeTo(100 / 3, 5),
      expect.closeTo(100 / 3, 5),
      expect.closeTo(100 / 3, 5),
      expect.closeTo(200 / 3, 5),
      expect.closeTo(200 / 3, 5),
      expect.closeTo(200 / 3, 5),
    ]);
    expect(model.tiles.every((tile) => tile.z === 15 && tile.url.includes('/15/'))).toBe(true);
  });

  it('keeps wrapped longitudes and clamped latitudes finite before marker percentage mapping', () => {
    const model = buildMockMapModel({
      targets: [
        {
          id: 'wrapped-target',
          roomId: 'room-1',
          type: 'custom',
          label: 'Wrapped target',
          lat: 91,
          lng: 181,
        },
      ],
      currentLocation: { ...currentLocation, lat: -91, lng: -181 },
    });

    for (const marker of model.markers) {
      expect(Number.isFinite(marker.screen.xPercent)).toBe(true);
      expect(Number.isFinite(marker.screen.yPercent)).toBe(true);
      expect(marker.screen.xPercent).toBeGreaterThanOrEqual(-20);
      expect(marker.screen.xPercent).toBeLessThanOrEqual(120);
      expect(marker.screen.yPercent).toBeGreaterThanOrEqual(-20);
      expect(marker.screen.yPercent).toBeLessThanOrEqual(120);
    }
  });
});
