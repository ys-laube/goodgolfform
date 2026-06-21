import { describe, expect, it } from 'vitest';

const sourceModules = import.meta.glob('./*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const g002SwingFlowModules = [
  './swingLabModels.ts',
  './profilePresets.ts',
  './recommendationEngine.ts',
  './motionParameters.ts',
] as const;

const forbiddenRuntimeImportPatterns = [
  /from ['"](?:\.\.\/)?hooks\/useCurrentLocation['"]/,
  /from ['"]\.\/geo['"]/,
  /from ['"]\.\/mapAdapter['"]/,
  /from ['"]\.\/roomApi['"]/,
  /from ['"]\.\/roomRepository['"]/,
  /from ['"]\.\/fieldReadiness['"]/,
  /from ['"](?:react|react-dom(?:\/server)?)['"]/,
] as const;

const forbiddenProviderOrBackendTokens = [
  'navigator.geolocation',
  'getCurrentPosition',
  'VITE_MAP_',
  'VITE_ROOM_API_',
  'weather',
  'forecast',
  'mapbox',
  'maplibre',
  'leaflet',
  'google.maps',
  'firebase',
  'supabase',
  'amplify',
  'graphql',
] as const;

describe('G002 profile/scenario SSR/static import boundaries', () => {
  it('keeps the profile preset and manual scenario engine independent from GPS, map, weather, and backend modules', () => {
    for (const modulePath of g002SwingFlowModules) {
      const source = sourceModules[modulePath];

      expect(source, `${modulePath} should be included in the source scan`).toBeDefined();
      for (const pattern of forbiddenRuntimeImportPatterns) {
        expect(source, `${modulePath} must not import ${pattern}`).not.toMatch(pattern);
      }
      for (const token of forbiddenProviderOrBackendTokens) {
        expect(source.toLowerCase(), `${modulePath} must not reference ${token}`).not.toContain(token.toLowerCase());
      }
    }
  });

  it('keeps the profile/scenario source slice free of full analysis-card and rich motion-viewer surfaces', () => {
    const combinedSource = g002SwingFlowModules.map((modulePath) => sourceModules[modulePath]).join('\n');

    expect(combinedSource).not.toMatch(/analysis\s*card|analysis-card|three\.?js|@react-three|webgl|canvas/i);
  });
});
