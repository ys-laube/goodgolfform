import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

const runtimeSourceModules = import.meta.glob('../**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const runtimeSourceEntries = Object.entries(runtimeSourceModules).filter(
  ([modulePath]) => !modulePath.endsWith('.test.ts') && !modulePath.endsWith('vitest-node.d.ts') && !modulePath.endsWith('vite-env.d.ts'),
);

const forbiddenRuntimeFilePatterns = [
  /(?:^|\/)(?:MapShell|useCurrentLocation|roomApi|roomRepository|shotPinFlow|courseTargets|geo|mapAdapter|fieldReadiness|auth|weather)\.(?:ts|tsx)$/i,
] as const;

const forbiddenImportSpecifiers = [
  /(?:^|\/)(?:MapShell|useCurrentLocation|roomApi|roomRepository|shotPinFlow|courseTargets|geo|mapAdapter|fieldReadiness|auth|weather)$/i,
  /(?:mapbox|maplibre|leaflet|google[-.]?maps|firebase|supabase|amplify|socket\.io|auth0|clerk|openweather|weatherapi)/i,
] as const;

const forbiddenRuntimeTokens = [
  /navigator\.geolocation/i,
  /getCurrentPosition/i,
  /watchPosition/i,
  /\bGeolocationPosition\b/i,
  /\bfetch\s*\(/i,
  /XMLHttpRequest/i,
  /EventSource/i,
  /WebSocket/i,
  /VITE_(?:MAP|ROOM|WEATHER|API|AUTH|BACKEND)_/i,
  /(?:mapbox|maplibre|leaflet|google\.maps|firebase|supabase|amplify|graphql|openweather|weatherapi)/i,
] as const;

function importSpecifiersFromSource(source: string): string[] {
  return Array.from(
    source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(["']([^"']+)["']\)/g),
    (match) => match[1] ?? match[2],
  );
}

describe('no GPS/map/weather/backend/auth static boundary', () => {
  it('keeps runtime source files out of retired external-service surfaces', () => {
    const runtimeModulePaths = runtimeSourceEntries.map(([modulePath]) => modulePath);

    for (const filePattern of forbiddenRuntimeFilePatterns) {
      expect(runtimeModulePaths, `runtime source must not include ${filePattern}`).not.toEqual(
        expect.arrayContaining([expect.stringMatching(filePattern)]),
      );
    }
  });

  it('keeps runtime imports and package dependencies free of external providers', () => {
    const runtimeImports = runtimeSourceEntries.flatMap(([modulePath, source]) =>
      importSpecifiersFromSource(source).map((specifier) => ({ modulePath, specifier })),
    );
    const packageDependencyNames = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies ?? {})];

    for (const { modulePath, specifier } of runtimeImports) {
      for (const pattern of forbiddenImportSpecifiers) {
        expect(specifier, `${modulePath} must not import GPS/map/weather/backend/auth provider ${pattern}`).not.toMatch(pattern);
      }
    }

    for (const dependencyName of packageDependencyNames) {
      for (const pattern of forbiddenImportSpecifiers) {
        expect(dependencyName, `dependency ${dependencyName} must not add GPS/map/weather/backend/auth provider ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('keeps runtime source free of browser location, network, backend, weather, and auth hooks', () => {
    const combinedRuntimeSource = runtimeSourceEntries.map(([modulePath, source]) => `// ${modulePath}\n${source}`).join('\n');

    for (const pattern of forbiddenRuntimeTokens) {
      expect(combinedRuntimeSource, `runtime source must not reference ${pattern}`).not.toMatch(pattern);
    }
  });
});
