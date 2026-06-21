import { useCallback, useState } from 'react';
import {
  type CurrentLocationState,
  type GeolocationPort,
  type LocationOptions,
  defaultLocationOptions,
  resolveCurrentLocation,
} from '../domain/geo';
import type { LocationSample } from '../domain/models';

export function useCurrentLocation(options: LocationOptions = defaultLocationOptions) {
  const [state, setState] = useState<CurrentLocationState>({
    status: 'idle',
    message: 'Location has not been requested yet.',
  });

  const requestLocation = useCallback(async () => {
    setState({ status: 'requesting', message: 'Requesting browser location…' });

    const geolocation = createBrowserGeolocationPort();
    if (!geolocation) {
      setState({
        status: 'unavailable',
        reason: 'unsupported',
        message: 'This browser does not expose geolocation. Manual target data still works.',
      });
      return;
    }

    setState(await resolveCurrentLocation(geolocation, options));
  }, [options]);

  return { state, requestLocation } as const;
}

function createBrowserGeolocationPort(): GeolocationPort | undefined {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return undefined;
  }

  return {
    getCurrentPosition: () =>
      new Promise<LocationSample>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracyMeters: position.coords.accuracy,
              timestamp: new Date(position.timestamp).toISOString(),
              heading: position.coords.heading ?? undefined,
              speed: position.coords.speed ?? undefined,
            });
          },
          (error) => reject({ code: error.code, message: error.message }),
          {
            enableHighAccuracy: true,
            maximumAge: 15_000,
            timeout: 10_000,
          },
        );
      }),
  };
}
