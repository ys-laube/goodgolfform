import { describe, expect, it } from 'vitest';

const sourceModules = import.meta.glob('./*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const caddieFlowModules = ['./caddiePresets.ts', './caddieRecommendationEngine.ts'] as const;

const forbiddenRuntimeImportPatterns = [
  /from ['"](?:\.\.\/)?hooks\/useCurrentLocation['"]/, /from ['"]\.\/geo['"]/, /from ['"]\.\/mapAdapter['"]/, /from ['"]\.\/roomApi['"]/, /from ['"]\.\/roomRepository['"]/, /from ['"]\.\/fieldReadiness['"]/, /from ['"](?:react|react-dom(?:\/server)?)['"]/, /SwingMotionViewer|motionParameters|profilePresets|recommendationEngine|swingLabModels|useSwingLabSession/,
] as const;

const forbiddenProviderOrBackendTokens = [
  'navigator.geolocation', 'getCurrentPosition', 'VITE_MAP_', 'VITE_ROOM_API_', 'weather', 'forecast', 'mapbox', 'maplibre', 'leaflet', 'google.maps', 'firebase', 'supabase', 'amplify', 'graphql',
] as const;

describe('G002 Korean caddie SSR/static import boundaries', () => {
  it('keeps caddie presets and recommendation engine independent from GPS, map, weather, backend, and old Swing Lab modules', () => {
    for (const modulePath of caddieFlowModules) {
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

  it('keeps the caddie source slice free of rich motion-viewer and 3D surfaces', () => {
    const combinedSource = caddieFlowModules.map((modulePath) => sourceModules[modulePath]).join('\n');

    expect(combinedSource).not.toMatch(/analysis-card|three\.?js|@react-three|webgl|canvas|motion viewer|SwingMotionViewer/i);
  });
});
