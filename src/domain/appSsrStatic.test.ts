import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import packageJson from '../../package.json';
import { SwingMotionViewer } from '../components/SwingMotionViewer';
import browserEnvironmentSource from '../browserEnvironment.ts?raw';
import swingMotionViewerSource from '../components/SwingMotionViewer.tsx?raw';
import appSource from '../App.tsx?raw';
import swingLabSessionSource from '../useSwingLabSession.ts?raw';
import { motionParametersFromRecommendation } from './motionParameters';
import { builtInProfilePresets, serializeProfilePresets, type StorageLike } from './profilePresets';
import { recommendShot } from './recommendationEngine';
import { App } from '../App';
import motionParametersSource from './motionParameters.ts?raw';

const packageDependencyNames = Object.keys(packageJson.dependencies);
const runtimeSourceModules = import.meta.glob('../**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const runtimeSourceEntries = Object.entries(runtimeSourceModules).filter(
  ([modulePath]) => !modulePath.endsWith('.test.ts') && !modulePath.endsWith('vitest-node.d.ts') && !modulePath.endsWith('vite-env.d.ts'),
);

const supersededRuntimeFilePatterns = [
  /(?:MapShell|useCurrentLocation|roomApi|roomRepository|shotPinFlow|courseTargets|geo|mapAdapter|fieldReadiness|auth|weather)\.(?:ts|tsx)$/i,
] as const;

const supersededImportSpecifiers = [
  /(?:^|\/)MapShell$/,
  /(?:^|\/)useCurrentLocation$/,
  /(?:^|\/)roomApi$/,
  /(?:^|\/)roomRepository$/,
  /(?:^|\/)shotPinFlow$/,
  /(?:^|\/)courseTargets$/,
  /(?:^|\/)geo$/,
  /(?:^|\/)mapAdapter$/,
  /(?:^|\/)fieldReadiness$/,
  /(?:^|\/)(?:auth|weather|backend)$/,
  /mapbox|maplibre|leaflet|firebase|supabase|amplify|socket\.io|auth0|clerk|openweather|weatherapi/i,
] as const;

const supersededRuntimeTokens = [
  /navigator\.geolocation/i,
  /getCurrentPosition/i,
  /VITE_MAP_/i,
  /VITE_ROOM_API_/i,
  /VITE_(?:WEATHER|AUTH|BACKEND)_/i,
  /google\.maps/i,
  /\bfetch\s*\(/i,
  /XMLHttpRequest|EventSource|WebSocket/i,
] as const;

function importSpecifiersFromSource(source: string): string[] {
  return Array.from(source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(["']([^"']+)["']\)/g), (match) => match[1] ?? match[2]);
}

function withPoisonedBrowserStorage<T>(assertions: () => T): T {
  const descriptors = {
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    fetch: Object.getOwnPropertyDescriptor(globalThis, 'fetch'),
  };

  for (const property of Object.keys(descriptors) as Array<keyof typeof descriptors>) {
    Object.defineProperty(globalThis, property, {
      configurable: true,
      get: () => {
        throw new Error(`SSR/static harness must not access ${property}`);
      },
    });
  }

  try {
    return assertions();
  } finally {
    for (const [property, descriptor] of Object.entries(descriptors)) {
      if (descriptor) {
        Object.defineProperty(globalThis, property, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, property);
      }
    }
  }
}

describe('App SSR/static harness contract', () => {
  it('renders the swing lab shell to a static string without browser storage globals', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toContain('id="app-title"');
    expect(renderedApp).toContain('id="profile-panel"');
    expect(renderedApp).toContain('id="scenario-panel"');
    expect(renderedApp).toContain('진지한 골프 스윙 랩');
    expect(renderedApp).toContain('플레이어 프로필과 상황을 넣으면 분석 카드가 바로 준비됩니다.');
    expect(renderedApp).toContain('프로필 패널');
    expect(renderedApp).toContain('상황 패널');
    expect(renderedApp).toContain('프로필 로컬 저장');
    expect(renderedApp).toContain('목표 거리 (m)');
    expect(renderedApp).toContain('바람 방향');
    expect(renderedApp).toContain('바람 세기');
    expect(renderedApp).toContain('원하는 탄도창');
    expect(renderedApp).toContain('실시간 분석 리포트');
    expect(renderedApp).toContain('분석 리포트 카드');
    expect(renderedApp).toContain('클럽 · 거리감');
    expect(renderedApp).toContain('스윙 크기 · 템포');
    expect(renderedApp).toContain('탄도 전략');
    expect(renderedApp).toContain('개연성 · 게임 지표');
    expect(renderedApp).toContain('이 카드의 이유');
    expect(renderedApp).toContain('파라미터 기반 골퍼 모션');
    expect(renderedApp).toContain('현재 모션 파라미터');
    expect(renderedApp).toMatch(/골퍼 모션 뷰어:/);
    expect(renderedApp).toMatch(/적합도/i);
    expect(renderedApp).toMatch(/보정 목표/i);
    expect(renderedApp).not.toMatch(/Serious Golf Swing Lab|Profile panel|Scenario panel|Save profile locally|Live analysis report/);
    expect(renderedApp).not.toMatch(/GPS shot pins|room-flow|map-shell|invite-link room/i);
    expect(renderedApp).not.toMatch(/without GPS|No login|GPS shot pins|weather feeds?|invite-link room|backend setup|backend dependency/i);
    expect(renderedApp).not.toMatch(/\b(coach|caddie|caddy)\b/i);
    expect(renderedApp).not.toMatch(/Build the shot|Read the swing card|Enter shot|Type the shot|choose a saved profile|get a deterministic|becoming commands|adjusted play|you should|let's|do this|next|now/i);
  });

  it('SSR-renders the default analysis card fields without notice-style copy', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toContain('6번 아이언');
    expect(renderedApp).toContain('컨트롤');
    expect(renderedApp).toContain('개연성');
    expect(renderedApp).toContain('템포');
    expect(renderedApp).toContain('탄도 전략');
    expect(renderedApp).toMatch(/적합도/i);
    expect(renderedApp).toMatch(/보정 목표/i);
    expect(renderedApp).not.toMatch(/\b(disclaimer|legal notice|official|rangefinder|coach|caddie|caddy|must|should|need to|try to|hit|aim|guarantee|exact|adjusted play)\b/i);
  });


  it('renders every required analysis report card category from recommendation output', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toMatch(/클럽 · 거리감[\s\S]*아이언/i);
    expect(renderedApp).toMatch(/스윙 크기 · 템포[\s\S]*(컨트롤|풀 스톡)/i);
    expect(renderedApp).toMatch(/탄도 전략[\s\S]*표준 탄도창/i);
    expect(renderedApp).toMatch(/개연성 · 게임 지표[\s\S]*적합도/i);
    expect(renderedApp).toMatch(/이 카드의 이유[\s\S]*보정 목표/i);
    expect(renderedApp).toMatch(/상황 보정 읽기|이 카드의 이유/i);
    expect(renderedApp).not.toMatch(/\b(coach|caddie|caddy|must|should|need to|try to|hit|aim|guarantee|exact)\b|adjusted play/i);
  });

  it('restores saved profile presets through the App storage boundary when browser storage exists', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const savedProfile = {
      ...builtInProfilePresets[1],
      id: 'saved-smooth-draw-player',
      name: 'Saved Smooth Draw',
    };
    const storage: StorageLike = {
      getItem: () => serializeProfilePresets([savedProfile]),
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage },
    });

    try {
      const renderedApp = renderToString(createElement(App));

      expect(renderedApp).toContain('이 기기에서 저장 프로필 1개를 불러왔습니다.');
      expect(renderedApp).toContain('이 기기에 저장됨');
      expect(renderedApp).toContain('Saved Smooth Draw');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'window', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }
  });

  it('keeps App free of superseded GPS/map/room/weather/auth/backend imports', () => {
    expect(appSource).not.toMatch(/MapShell|useCurrentLocation|roomApi|roomRepository|shotPinFlow|courseTargets|mapAdapter|auth|weather|backend/i);
    const appSessionSource = `${appSource}\n${swingLabSessionSource}`;

    expect(appSessionSource).toMatch(/profilePresets/);
    expect(appSessionSource).toMatch(/recommendShot/);
    expect(appSessionSource).toMatch(/motionParametersFromRecommendation/);
    expect(appSource).toMatch(/SwingMotionViewer/);
  });

  it('keeps all runtime source free of retired GPS, map, room, weather, auth, and backend import surfaces', () => {
    const runtimeModulePaths = runtimeSourceEntries.map(([modulePath]) => modulePath);
    const runtimeImports = runtimeSourceEntries.flatMap(([modulePath, source]) =>
      importSpecifiersFromSource(source).map((specifier) => ({ modulePath, specifier })),
    );
    const combinedRuntimeSource = runtimeSourceEntries.map(([, source]) => source).join('\n');

    expect(runtimeModulePaths).not.toEqual(expect.arrayContaining([expect.stringMatching(supersededRuntimeFilePatterns[0])]));
    for (const { modulePath, specifier } of runtimeImports) {
      for (const pattern of supersededImportSpecifiers) {
        expect(specifier, `${modulePath} must not import retired surface ${pattern}`).not.toMatch(pattern);
      }
    }
    for (const tokenPattern of supersededRuntimeTokens) {
      expect(combinedRuntimeSource, `runtime source must not reference ${tokenPattern}`).not.toMatch(tokenPattern);
    }
    for (const dependencyName of packageDependencyNames) {
      for (const pattern of supersededImportSpecifiers) {
        expect(dependencyName, `runtime dependency ${dependencyName} must stay out of retired provider surfaces`).not.toMatch(pattern);
      }
    }
  });

  it('keeps the static HTML entrypoint ready for mobile swing lab smoke checks', () => {
    expect(indexHtml).toContain('<!doctype html>');
    expect(indexHtml).toContain('<html lang="ko">');
    expect(indexHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#0b3d2e" />');
    expect(indexHtml).toContain('프로필 기반 샷 분석')
    expect(indexHtml).toContain('<div id="root"></div>');
    expect(indexHtml).toContain('<script type="module" src="/src/main.tsx"></script>');
  });

  it('SSR-renders the motion viewer reduced-motion fallback from deterministic parameters', () => {
    const recommendation = recommendShot(builtInProfilePresets[2], {
      targetDistanceMeters: 165,
      windDirection: 'headwind',
      windStrength: 'strong',
      lie: 'rough',
      desiredWindow: 'low',
    });
    const parameters = motionParametersFromRecommendation(recommendation);
    const renderedViewer = withPoisonedBrowserStorage(() =>
      renderToString(createElement(SwingMotionViewer, { parameters, recommendation, forceReducedMotion: true })),
    );

    expect(renderedViewer).toContain('role="img"');
    expect(renderedViewer).toContain(parameters.accessibleSummary);
    expect(renderedViewer).toMatch(/정적 (컴팩트|균형|확장) 자세/);
    expect(renderedViewer).toContain('--swing-arc');
    expect(renderedViewer).toMatch(new RegExp(`${parameters.arcDegrees}<!-- -->°`));
    expect(renderedViewer).toContain(`${parameters.pathOffset}px`);
    expect(renderedViewer).toMatch(new RegExp(`${parameters.launchAngleDegrees}<!-- -->°`));
  });

  it('keeps the motion-viewer static contract dependency-free and SSR-safe', () => {
    const scannedSources = [appSource, swingLabSessionSource, motionParametersSource, swingMotionViewerSource].join('\n');

    expect(packageDependencyNames).toEqual(['@vitejs/plugin-react', 'vite', 'typescript', 'react', 'react-dom']);
    expect(scannedSources).not.toMatch(/three|@react-three|webgl|canvas|getContext|requestAnimationFrame/i);
    expect(scannedSources).not.toMatch(/navigator\.geolocation|VITE_MAP_|VITE_ROOM_API_|mapbox|maplibre|leaflet|firebase|supabase/i);
    expect(motionParametersSource).toMatch(/accessibleSummary/);
    expect(motionParametersSource).toMatch(/reducedMotionPose/);
    expect(browserEnvironmentSource).toMatch(/browserWindow\(\)\?\.localStorage/);
    expect(browserEnvironmentSource).toMatch(/browserWindow\(\)\?\.matchMedia/);
    expect(scannedSources).not.toMatch(/Object\.getOwnPropertyDescriptor\(globalThis, 'window'\)/);
    expect(swingMotionViewerSource).toMatch(/forceReducedMotion/);
    expect(swingLabSessionSource).toMatch(/모션 미터/);
  });
});
