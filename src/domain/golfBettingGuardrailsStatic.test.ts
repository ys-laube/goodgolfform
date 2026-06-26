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

const approvedRootDependencyNames = [
  '@eslint/js',
  '@types/react',
  '@types/react-dom',
  '@vitejs/plugin-react',
  'eslint',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react-refresh',
  'globals',
  'react',
  'react-dom',
  'typescript',
  'typescript-eslint',
  'vite',
  'vitest',
] as const;

const retiredCaddieFilePattern = new RegExp(
  String.raw`(?:^|/)(?:CaddieShotVisual|useCaddieSession|caddiePresets|caddieRecommendationEngine|caddieShotVisualState|copy)\.(?:ts|tsx)$`,
  'i',
);
const retiredCaddieSourcePattern = new RegExp(
  [
    String.raw`\bCaddie\b`,
    'use' + 'CaddieSession',
    'caddie' + 'Presets',
    'caddie' + 'RecommendationEngine',
    '캐' + '디',
    '처' + '방',
    '클럽 ' + '거리',
    '거리 ' + '프리셋',
    '샷 ' + '비주얼',
    '탄도 ' + '이유',
    '라이 ' + '조언',
    '한국형 2D ' + '셋업',
  ].join('|'),
);
const forbiddenProviderOrRuntimePatterns = [
  new RegExp(String.raw`\bfetch\s*\(`, 'i'),
  new RegExp('XML' + 'HttpRequest', 'i'),
  new RegExp('Event' + 'Source', 'i'),
  new RegExp('Web' + 'Socket', 'i'),
  new RegExp('navigator\\.' + 'geo' + 'location|getCurrentPosition|watchPosition|\\bGeo' + 'locationPosition\\b', 'i'),
  new RegExp('Payment' + 'Request', 'i'),
  new RegExp(['str' + 'ipe', 'to' + 'ss' + 'payments?', 'port' + 'one', 'iam' + 'port', 'pay' + 'pal', 'kakao.?pay', 'naver.?pay'].join('|'), 'i'),
  new RegExp(['fire' + 'base', 'supa' + 'base', 'amplify', 'socket' + '\\.' + 'io', 'pusher', 'ably', 'auth' + '0', 'cle' + 'rk'].join('|'), 'i'),
  new RegExp(['map' + 'box', 'map' + 'libre', 'leaflet', 'google' + '\\.' + 'maps', 'naver' + '\\.' + 'maps', 'kakao' + '\\.' + 'maps', 'open' + 'wea' + 'ther', 'wea' + 'ther' + 'api'].join('|'), 'i'),
  new RegExp(String.raw`VITE_(?:API|BACKEND|AUTH|ROOM|MAP|WEATHER|PAYMENT|STRIPE|TOSS|PORTONE)_`, 'i'),
] as const;
const forbiddenProductSurfacePattern = new RegExp(['송' + '금', '결' + '제', '지' + '갑', '에스' + '크로', '입' + '금', '출' + '금', '공개' + '방', '매' + '칭', '랭' + '킹', '실시간 ' + '방', 'wallet', 'escrow', 'public room', 'matching', 'leaderboard'].join('|'), 'i');
const forbiddenSocialOrExternalSharePattern = new RegExp(
  [
    String.raw`navigator\.(?:canShare|share|sendBeacon)\b`,
    String.raw`\b(?:open|postMessage)\s*\(`,
    String.raw`\btarget\s*=\s*["']_blank["']`,
    String.raw`\b(?:mailto|sms|tel):`,
    String.raw`facebook(?:\.com)?`,
    String.raw`instagram(?:\.com)?`,
    String.raw`twitter(?:\.com)?`,
    String.raw`\bx\.com\b`,
    String.raw`threads(?:\.net)?`,
    String.raw`telegram(?:\.me)?|t\.me`,
    String.raw`discord(?:\.gg|\.com)?`,
    String.raw`line(?:://|\.me)`,
    'kakao(?:talk|story)?',
    'naver(?:band)?',
  ].join('|'),
  'i',
);
const customRuleBuilderPattern = /custom rule|rule builder|사용자.*규칙|커스텀.*규칙|규칙.*빌더/i;

function importSpecifiersFromSource(source: string): string[] {
  return Array.from(
    source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(["']([^"']+)["']\)/g),
    (match) => match[1] ?? match[2],
  );
}

function sortedRootPackageLockDependencyNames(): string[] {
  const packageLock = JSON.parse(packageLockSource) as {
    readonly packages?: {
      readonly '': {
        readonly dependencies?: Readonly<Record<string, string>>;
        readonly devDependencies?: Readonly<Record<string, string>>;
      };
    };
  };
  const rootPackage = packageLock.packages?.[''];

  return [...Object.keys(rootPackage?.dependencies ?? {}), ...Object.keys(rootPackage?.devDependencies ?? {})].sort();
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

  it('keeps the root dependency surface fixed to local-only React/Vite tooling', () => {
    const approvedDependencyNames = [...approvedRootDependencyNames].sort();
    const packageDependencyNames = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies ?? {})].sort();

    expect(packageDependencyNames).toEqual(approvedDependencyNames);
    expect(sortedRootPackageLockDependencyNames()).toEqual(approvedDependencyNames);
  });

  it('keeps runtime source local-only and free of network calls, payment execution, public gambling, and custom rule builder surfaces', () => {
    const combinedRuntimeSource = runtimeSourceEntries.map(([modulePath, source]) => `// ${modulePath}\n${source}`).join('\n');

    for (const pattern of forbiddenProviderOrRuntimePatterns) {
      expect(combinedRuntimeSource, `runtime source must not reference ${pattern}`).not.toMatch(pattern);
    }

    expect(combinedRuntimeSource).not.toMatch(forbiddenProductSurfacePattern);
    expect(combinedRuntimeSource).not.toMatch(forbiddenSocialOrExternalSharePattern);
    expect(combinedRuntimeSource).not.toMatch(customRuleBuilderPattern);
    expect(combinedRuntimeSource).toMatch(/localStorage|StorageLike|golf-bet-ledger|local/i);
  });

  it('allows only bounded local URL-hash share snapshots for QR/result-link sharing', () => {
    const combinedRuntimeSource = runtimeSourceEntries.map(([modulePath, source]) => `// ${modulePath}\n${source}`).join('\n');

    expect(combinedRuntimeSource).toMatch(/bettingShareHashPrefix\s*=\s*['"]fg=['"]/);
    expect(combinedRuntimeSource).toMatch(/bettingShareHashTargetLength\s*=\s*1_800/);
    expect(combinedRuntimeSource).toMatch(/bettingShareHashMaxLength\s*=\s*2_200/);
    expect(combinedRuntimeSource).toMatch(/createBettingRoundShareHash|restoreBettingRoundShareHashToStorage/);
    expect(combinedRuntimeSource).not.toMatch(/https?:\/\/|new\s+URL\(|URLSearchParams|QRCode|qr-code|qrcode/i);
  });
});
