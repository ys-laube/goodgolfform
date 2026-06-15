import type { Coordinate, CourseTarget, LocationSample } from './models';

export type LocationProblem = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'unknown';

export type CurrentLocationState =
  | { readonly status: 'idle'; readonly message: string }
  | { readonly status: 'requesting'; readonly message: string }
  | { readonly status: 'ready'; readonly sample: LocationSample; readonly message: string }
  | { readonly status: 'low_accuracy'; readonly sample: LocationSample; readonly maxAcceptableAccuracyMeters: number; readonly message: string }
  | { readonly status: 'denied'; readonly reason: LocationProblem; readonly message: string }
  | { readonly status: 'unavailable'; readonly reason: LocationProblem; readonly message: string };

export type GeolocationErrorCode = 1 | 2 | 3;

export type GeolocationFailure = {
  readonly code?: GeolocationErrorCode;
  readonly message?: string;
};

export type GeolocationPort = {
  readonly getCurrentPosition: () => Promise<LocationSample>;
};

export type LocationOptions = {
  readonly maxAcceptableAccuracyMeters: number;
};

export type TargetDistance = {
  readonly target: CourseTarget;
  readonly meters: number;
  readonly label: string;
};

export const defaultLocationOptions: LocationOptions = {
  maxAcceptableAccuracyMeters: 50,
};

const metersPerKilometer = 1000;
const earthRadiusKilometers = 6371.0088;

export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKilometers * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * metersPerKilometer;
}

export function formatApproxDistance(meters: number): string {
  if (meters < 1000) {
    return `≈ ${Math.round(meters)} m`;
  }

  return `≈ ${(meters / 1000).toFixed(1)} km`;
}

export function targetDistances(origin: Coordinate, targets: readonly CourseTarget[]): readonly TargetDistance[] {
  return targets
    .map((target) => {
      const meters = distanceMeters(origin, target);
      return {
        target,
        meters,
        label: formatApproxDistance(meters),
      } satisfies TargetDistance;
    })
    .sort((left, right) => left.meters - right.meters);
}

export function classifyLocationSample(
  sample: LocationSample,
  options: LocationOptions = defaultLocationOptions,
): CurrentLocationState {
  if (sample.accuracyMeters > options.maxAcceptableAccuracyMeters) {
    return {
      status: 'low_accuracy',
      sample,
      maxAcceptableAccuracyMeters: options.maxAcceptableAccuracyMeters,
      message: `GPS accuracy is about ${Math.round(sample.accuracyMeters)} m, so distances are extra approximate.`,
    };
  }

  return {
    status: 'ready',
    sample,
    message: `Location ready with about ${Math.round(sample.accuracyMeters)} m accuracy.`,
  };
}

export function classifyLocationFailure(error: GeolocationFailure): CurrentLocationState {
  if (error.code === 1) {
    return {
      status: 'denied',
      reason: 'denied',
      message: 'Location permission was denied. You can still use manually entered course targets.',
    };
  }

  if (error.code === 3) {
    return {
      status: 'unavailable',
      reason: 'timeout',
      message: 'Location timed out. Try again outside with a clearer sky view.',
    };
  }

  return {
    status: 'unavailable',
    reason: error.code === 2 ? 'unavailable' : 'unknown',
    message: 'Current location is unavailable. Manual target distances stay visible when a location is provided.',
  };
}

export async function resolveCurrentLocation(
  geolocation: GeolocationPort,
  options: LocationOptions = defaultLocationOptions,
): Promise<CurrentLocationState> {
  try {
    const sample = await geolocation.getCurrentPosition();
    return classifyLocationSample(sample, options);
  } catch (error) {
    return classifyLocationFailure(error as GeolocationFailure);
  }
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
