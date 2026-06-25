import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';
import packageLockSource from '../../package-lock.json?raw';

const runtimeSourceModules = import.meta.glob('../**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const runtimeSourceEntries = Object.entries(runtimeSourceModules).filter(
  ([modulePath]) => !modulePath.endsWith('.test.ts') && !modulePath.endsWith('vite-env.d.ts') && !modulePath.endsWith('vitest-node.d.ts'),
);

const retiredCaddieFilePattern = /(?:^|\/)(?:CaddieShotVisual|useCaddieSession|caddiePresets|caddieRecommendationEngine|caddieShotVisualState|copy)\.(?:ts|tsx)$/i;
const retiredCaddieSourcePattern = /\bCaddie\b|useCaddieSession|caddiePresets|caddieRecommendationEngine|캐디|처방|클럽 거리|거리 프리셋|샷 비주얼|탄도 이유|라이 조언|한국형 2D 셋업/;
const forbiddenProviderOrRuntimePatterns = [
  /\bfetch\s*\(/i,
  /XMLHttpRequest/i,
  /EventSource/i,
  /WebSocket/i,
  /navigator\.geolocation|getCurrentPosition|watchPosition|\bGeolocationPosition\b/i,
  /PaymentRequest/i,
  /(?:stripe|tosspayments?|portone|iamport|paypal|kakao.?pay|naver.?pay)/i,
  /(?:firebase|supabase|amplify|socket\.io|pusher|ably|auth0|clerk)/i,
  /(?:mapbox|maplibre|leaflet|google\.maps|naver\.maps|kakao\.maps|openweather|weatherapi)/i,
  /VITE_(?:API|BACKEND|AUTH|ROOM|MAP|WEATHER|PAYMENT|STRIPE|TOSS|PORTONE)_/i,
] as const;
const forbiddenProductSurfacePattern = /송금|결제|지갑|에스크로|입금|출금|공개방|매칭|랭킹|실시간 방|wallet|escrow|public room|matching|leaderboard/i;
const customRuleBuilderPattern = /custom rule|rule builder|사용자.*규칙|커스텀.*규칙|규칙.*빌더/i;

function importSpecifiersFromSource(source: string): string[] {
  return Array.from(
    source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(["']([^"']+)["']\)/g),
    (match) => match[1] ?? match[2],
  );
}

describe('betting-ledger static guardrails', () => {
  it('removes retired caddie runtime files and source identifiers from the app slice', () => {
    const runtimeModulePaths = runtimeSourceEntries.map(([modulePath]) => modulePath);

    expect(runtimeModulePaths).not.toEqual(expect.arrayContaining([expect.stringMatching(retiredCaddieFilePattern)]));

    for (const [modulePath, source] of runtimeSourceEntries) {
      expect(source, `${modulePath} must not retain old caddie product surface`).not.toMatch(retiredCaddieSourcePattern);
    }
  });

  it('keeps runtime imports, dependencies, and lockfile free of backend, network, provider, and payment SDKs', () => {
    const runtimeImports = runtimeSourceEntries.flatMap(([modulePath, source]) =>
      importSpecifiersFromSource(source).map((specifier) => ({ modulePath, specifier })),
    );
    const packageDependencyNames = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies ?? {})];
    const packageSurface = `${packageDependencyNames.join('\n')}\n${packageLockSource}`;

    for (const { modulePath, specifier } of runtimeImports) {
      for (const pattern of forbiddenProviderOrRuntimePatterns) {
        expect(specifier, `${modulePath} must not import provider/runtime ${pattern}`).not.toMatch(pattern);
      }
    }

    for (const pattern of forbiddenProviderOrRuntimePatterns) {
      expect(packageSurface, `package files must not include ${pattern}`).not.toMatch(pattern);
    }
  });

  it('keeps runtime source local-only and free of network calls, payment execution, public gambling, and custom rule builder surfaces', () => {
    const combinedRuntimeSource = runtimeSourceEntries.map(([modulePath, source]) => `// ${modulePath}\n${source}`).join('\n');

    for (const pattern of forbiddenProviderOrRuntimePatterns) {
      expect(combinedRuntimeSource, `runtime source must not reference ${pattern}`).not.toMatch(pattern);
    }

    expect(combinedRuntimeSource).not.toMatch(forbiddenProductSurfacePattern);
    expect(combinedRuntimeSource).not.toMatch(customRuleBuilderPattern);
    expect(combinedRuntimeSource).toMatch(/localStorage|StorageLike|golf-bet-ledger|local/i);
  });
});
