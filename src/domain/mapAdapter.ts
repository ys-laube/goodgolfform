import type { Coordinate, CourseTarget, LocationSample } from './models';

export type MapMarker = {
  readonly id: string;
  readonly label: string;
  readonly coordinate: Coordinate;
  readonly kind: 'current-location' | CourseTarget['type'];
};

export type MapViewport = {
  readonly center: Coordinate;
  readonly zoomHint: 'course' | 'target' | 'location';
};

export type ProviderNeutralMapModel = {
  readonly viewport: MapViewport;
  readonly markers: readonly MapMarker[];
  readonly attribution: string;
};

export type MapAdapter = {
  readonly renderModel: (model: ProviderNeutralMapModel) => unknown;
};

export function buildMockMapModel(input: {
  readonly targets: readonly CourseTarget[];
  readonly currentLocation?: LocationSample;
}): ProviderNeutralMapModel {
  const currentMarker: readonly MapMarker[] = input.currentLocation
    ? [
        {
          id: 'current-location',
          label: `Current location (${Math.round(input.currentLocation.accuracyMeters)} m accuracy)`,
          coordinate: input.currentLocation,
          kind: 'current-location',
        },
      ]
    : [];

  const targetMarkers = input.targets.map((target) => ({
    id: target.id,
    label: target.label,
    coordinate: target,
    kind: target.type,
  } satisfies MapMarker));

  const center = input.currentLocation ?? input.targets[0] ?? { lat: 0, lng: 0 };

  return {
    viewport: {
      center,
      zoomHint: input.currentLocation ? 'location' : 'course',
    },
    markers: [...currentMarker, ...targetMarkers],
    attribution: 'Provider-neutral map shell; no map SDK loaded.',
  };
}
