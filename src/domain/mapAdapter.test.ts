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
});
