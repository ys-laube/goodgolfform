import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

const forbiddenProviderPackages = [
  '@googlemaps/js-api-loader',
  '@mapbox/mapbox-gl-geocoder',
  '@react-google-maps/api',
  'google-map-react',
  'leaflet',
  'mapbox-gl',
  'maplibre-gl',
  'react-leaflet',
] as const;

type PackageManifest = {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

const manifest = packageJson as PackageManifest;
const declaredPackages = {
  ...manifest.dependencies,
  ...manifest.devDependencies,
};

describe('G002 provider-neutral map shell contract', () => {
  it('keeps map providers out of the app manifest until an adapter decision is approved', () => {
    for (const packageName of forbiddenProviderPackages) {
      expect(declaredPackages).not.toHaveProperty(packageName);
    }
  });
});
