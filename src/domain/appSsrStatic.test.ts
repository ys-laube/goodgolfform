import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import packageJson from '../../package.json';
import stylesSource from '../styles.css?inline';
import appSource from '../App.tsx?raw';
import browserEnvironmentSource from '../browserEnvironment.ts?raw';
import caddieSessionSource from '../useCaddieSession.ts?raw';
import { App } from '../App';
import { sideSlopeLabels, stanceSlopeLabels } from '../useCaddieSession';
import {
  createCaddieDistancePreset,
  serializeCaddiePresets,
  type StorageLike,
} from './caddiePresets';

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
  return Array.from(
    source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(["']([^"']+)["']\)/g),
    (match) => match[1] ?? match[2],
  );
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
  it('renders the Korean caddie shell to a static string without browser storage globals', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toContain('id="app-title"');
    expect(renderedApp).toContain('id="shot-panel"');
    expect(renderedApp).toContain('id="preset-panel"');
    expect(renderedApp).toContain('캐디 한줄 처방');
    expect(renderedApp).toContain('남은 거리와 라이만 빠르게 넣고');
    expect(renderedApp).toContain('지금 처방');
    expect(renderedApp).toContain('추천 요약');
    expect(renderedApp).toContain('정적 샷 대시보드');
    expect(renderedApp).toContain('스크린 골프식 샷 요약');
    expect(renderedApp).toContain('정적 샷 지표');
    expect(renderedApp).toContain('샷 상황 입력');
    expect(renderedApp).toContain('남은 거리 (m)');
    expect(renderedApp).toContain('앞뒤 경사');
    expect(renderedApp).toContain('공 위치 높이');
    expect(renderedApp).toContain('바람 방향');
    expect(renderedApp).toContain('핀 위치');
    expect(renderedApp).toContain('그린 위험');
    expect(renderedApp).toContain('로컬 프리셋 저장');
    expect(renderedApp).toContain('왜 이렇게 치나요?');
    expect(renderedApp).toContain('정적 샷 대시보드');
    expect(renderedApp).toContain('한 장으로 보는 타깃 라인');
    expect(renderedApp).toContain('추천 요약');
    expect(renderedApp).toContain('공 위치');
    expect(renderedApp).not.toMatch(/Serious Golf Swing Lab|Profile panel|Scenario panel|Save profile locally|Live analysis report/);
    expect(renderedApp).not.toMatch(/GPS shot pins|room-flow|map-shell|invite-link room/i);
    expect(renderedApp).not.toMatch(/without GPS|No login|GPS shot pins|weather feeds?|invite-link room|backend setup|backend dependency/i);

    expect(renderedApp).not.toMatch(/경사\/스탠스|좌우 경사|발끝 오르막|발끝 내리막|좌측 경사|우측 경사|조준과 라이 미니카드|2D 보조|근거 카드|근거카드/);
    expect(renderedApp).not.toMatch(/Build the shot|Read the swing card|Enter shot|Type the shot|choose a saved profile|get a deterministic|adjusted play|you should|let's|do this|next|now/i);
  });

  it('SSR-renders the representative 100m result-first prescription fields', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toContain('추천: 9번 아이언 90%');
    expect(renderedApp).toContain('목표보다 살짝 오른쪽 조준');
    expect(renderedApp).toContain('낮게 컨트롤');
    expect(renderedApp).toContain('공이 발보다 낮아 당김·토핑 주의');
    expect(renderedApp).toContain('플레이 거리');
    expect(renderedApp).toContain('103');
    expect(renderedApp).toMatch(/라이[\s\S]*페어웨이/);
    expect(renderedApp).toMatch(/앞뒤 경사[\s\S]*평지/);
    expect(renderedApp).toMatch(/공 위치[\s\S]*공이 발보다 낮음/);
    expect(renderedApp).not.toMatch(/\b(disclaimer|legal notice|official|rangefinder|must|should|need to|try to|guarantee|exact|adjusted play)\b|면책|법적 고지|공식|거리측정기|보장|정확/i);
  });

  it('renders every required Korean caddie result card category from prescription output', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toMatch(/지금 처방[\s\S]*추천 요약[\s\S]*클럽[\s\S]*스윙[\s\S]*플레이 거리/i);
    expect(renderedApp).toMatch(/짧은 이유[\s\S]*9번 아이언 90%[\s\S]*목표보다 살짝 오른쪽 조준[\s\S]*낮게 컨트롤/i);
    expect(renderedApp).toMatch(/정적 샷 대시보드[\s\S]*타깃 라인[\s\S]*공 위치[\s\S]*바람[\s\S]*탄도/i);
    expect(renderedApp).not.toMatch(/\b(coach|must|should|need to|try to|guarantee|exact)\b|adjusted play|코치|보장|정확/i);
  });


  it('locks the refined slope and ball-height option vocabulary at the source of truth', () => {
    expect(stanceSlopeLabels).toEqual({
      level: '평지',
      uphill: '오르막',
      downhill: '내리막',
    });
    expect(sideSlopeLabels).toEqual({
      none: '발과 비슷함',
      'left-slope': '공이 발보다 낮음',
      'right-slope': '공이 발보다 높음',
    });
  });

  it('renders exactly four refined reason card category headings without duplicate heading bodies', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));
    const categories = ['클럽 선택이유', '조준 방향 이유', '목표 탄도 이유', '미스 경고 코멘트'];

    for (const category of categories) {
      expect(renderedApp.match(new RegExp(category, 'g'))?.length).toBe(1);
    }
    expect(renderedApp).toMatch(/클럽 선택이유[\s\S]*9번 아이언 90%/);
    expect(renderedApp).not.toMatch(/근거 카드|근거카드/);
  });

  it('restores saved caddie distance presets through the App storage boundary when browser storage exists', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const savedPreset = createCaddieDistancePreset({
      id: 'preset-saved-local-yardage',
      name: '저장된 거리표',
      anchorDistances: { driver: 225, sevenIron: 142, pitchingWedge: 108 },
    });
    const storage: StorageLike = {
      getItem: () => serializeCaddiePresets([savedPreset]),
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage },
    });

    try {
      const renderedApp = renderToString(createElement(App));

      expect(renderedApp).toContain('이 기기에서 거리 프리셋 1개를 불러왔습니다.');
      expect(renderedApp).toContain('저장된 프리셋 불러오기');
      expect(renderedApp).toContain('저장된 거리표');
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
    const appSessionSource = `${appSource}\n${caddieSessionSource}`;

    expect(appSessionSource).toMatch(/useCaddieSession/);
    expect(appSessionSource).toMatch(/buildPrescription/);
    expect(appSessionSource).toMatch(/caddiePresets/);
    expect(appSource).toMatch(/shot-dashboard/);
    expect(appSource).toMatch(/dashboard-metrics/);
    expect(appSource).not.toMatch(/visual-card-grid|visualCards/);
    expect(appSource).not.toMatch(/TrackMan|FlightScope|Foresight|GCQuad|logo|brand|asset|img src|<img/i);
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

  it('imports the premium Korean webfont with system Korean fallbacks', () => {
    expect(stylesSource).toContain('@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css");');
    expect(stylesSource).toMatch(/font-family:[\s\S]*"Pretendard"[\s\S]*"Apple SD Gothic Neo"[\s\S]*"Malgun Gothic"[\s\S]*"Noto Sans KR"[\s\S]*ui-sans-serif[\s\S]*system-ui[\s\S]*sans-serif/);
  });

  it('keeps the static HTML entrypoint ready for mobile Korean caddie smoke checks', () => {
    expect(indexHtml).toContain('<!doctype html>');
    expect(indexHtml).toContain('<html lang="ko">');
    expect(indexHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#0b3d2e" />');
    expect(indexHtml).toContain('한국어 캐디 한줄 처방');
    expect(indexHtml).toContain('<div id="root"></div>');
    expect(indexHtml).toContain('<script type="module" src="/src/main.tsx"></script>');
  });

  it('keeps browser environment access optional and SSR-safe', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toContain('기본 거리표가 준비되었습니다.');
    expect(browserEnvironmentSource).toMatch(/browserWindow\(\)\?\.localStorage/);
    expect(browserEnvironmentSource).toMatch(/browserWindow\(\)\?\.matchMedia/);
    expect(`${appSource}\n${caddieSessionSource}`).not.toMatch(/Object\.getOwnPropertyDescriptor\(globalThis, 'window'\)/);
  });
});
