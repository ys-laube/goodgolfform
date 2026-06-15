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
    expect(model.attribution).toMatch(/no map SDK loaded/i);
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
});
