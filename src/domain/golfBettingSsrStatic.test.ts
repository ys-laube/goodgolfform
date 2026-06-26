import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import designSource from '../../DESIGN.md?raw';
import indexSource from '../../index.html?raw';
import readmeSource from '../../README.md?raw';
import appSource from '../App.tsx?raw';
import stylesSource from '../styles.css?raw';
import { App } from '../App';

const requiredVisibleConcepts = [
  '라운드 세팅',
  '플레이어',
  '핸디',
  '내기 게임',
  '홀 입력',
  '정산표',
  '순정산',
  '계산 내역',
  '미션 카드',
  '공유',
] as const;

const retiredCaddieVisiblePattern = new RegExp(
  [
    '캐' + '디',
    '처' + '방',
    '클럽 ' + '거리',
    '거리 ' + '프리셋',
    '샷 ' + '비주얼',
    '탄도 ' + '이유',
    '라이 ' + '조언',
    '한국형 2D ' + '셋업',
    '목표 ' + '탄도',
    '미스 ' + '경고',
    '클럽 ' + '선택이유',
  ].join('|'),
);
const forbiddenTransactionPattern = new RegExp(['송' + '금', '결' + '제', '지' + '갑', '에스' + '크로', '입' + '금', '출' + '금', 'Payment' + 'Request', 'wallet', 'escrow', 'deposit', 'withdraw'].join('|'), 'i');
const appleAffiliationPattern = /Apple(?:\s+Inc\.|\s+logo|\s+official|\s+certified)|애플\s*(?:공식|인증|제휴|로고)/i;

function withPoisonedBrowserGlobals<T>(assertions: () => T): T {
  const globalNames = ['window', 'localStorage', 'sessionStorage', 'navigator', 'fetch', 'Web' + 'Socket', 'Event' + 'Source', 'XML' + 'HttpRequest'] as const;
  const descriptors = Object.fromEntries(globalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])) as Record<
    (typeof globalNames)[number],
    PropertyDescriptor | undefined
  >;

  for (const property of globalNames) {
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
    for (const property of globalNames) {
      const descriptor = descriptors[property];
      if (descriptor) {
        Object.defineProperty(globalThis, property, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, property);
      }
    }
  }
}

describe('Korean betting-ledger SSR/static integration contract', () => {
  it('SSR-renders the replacement betting-ledger UI without browser, storage, or network globals', () => {
    const renderedApp = withPoisonedBrowserGlobals(() => renderToString(createElement(App)));

    expect(renderedApp).toMatch(/[가-힣]/);
    for (const concept of requiredVisibleConcepts) {
      expect(renderedApp, `SSR output should include ${concept}`).toContain(concept);
    }

    expect(renderedApp).toMatch(/2\s*[–-]\s*4|2~4|2명|4명/);
    expect(renderedApp).toMatch(/스트로크|스킨|베가스|이벤트|미션/);
    expect(renderedApp).toMatch(/포인트|금액|받을 금액|줄 금액/);
    expect(renderedApp).toMatch(/뒷문오픈/);
    expect(renderedApp).toMatch(/더블파/);
    expect(renderedApp).not.toMatch(retiredCaddieVisiblePattern);
    expect(renderedApp).not.toMatch(forbiddenTransactionPattern);
    expect(renderedApp).not.toMatch(appleAffiliationPattern);
  });

  it('keeps README and DESIGN aligned to the local-only betting-ledger replacement scope', () => {
    const docs = `${readmeSource}\n${designSource}`;

    expect(docs).toMatch(/local-only|로컬|현재 기기/);
    expect(docs).toMatch(/golf-bet-ledger:\*:v1|golf-bet-ledger/);
    expect(docs).toMatch(/korean-caddie:preset-distances:v1/);
    expect(docs).toMatch(/old caddie|caddie recommendation/i);
    expect(docs).toMatch(/라운드 세팅/);
    expect(docs).toMatch(/내기 게임/);
    expect(docs).toMatch(/순정산/);
    expect(docs).toMatch(/공유 카드/);
    expect(docs).toMatch(/Apple-inspired|Apple-inspired visual polish|Apple-inspired styling/i);
    expect(docs).toMatch(/no Apple logo|Apple logos|애플.*로고/i);
    expect(docs).toMatch(/No backend|No payment execution|No URL or QR app-state sharing/i);
  });

  it('keeps browser metadata on the betting-ledger product instead of the retired caddie app', () => {
    expect(indexSource).toMatch(/펀골프 정산 장부/);
    expect(indexSource).toMatch(/골프.*내기|정산 장부/);
    expect(indexSource).not.toMatch(retiredCaddieVisiblePattern);
  });

  it('keeps the app source and stylesheet oriented around mobile betting-ledger surfaces', () => {
    const appAndStyles = `${appSource}\n${stylesSource}`;

    expect(appAndStyles).toMatch(/라운드 세팅|round setup|RoundSetup/i);
    expect(appAndStyles).toMatch(/홀 입력|hole input|HoleInput/i);
    expect(appAndStyles).toMatch(/정산|settlement|ledger/i);
    expect(appAndStyles).toMatch(/공유|share/i);
    expect(appAndStyles).toMatch(/@media|min-width|safe-area-inset|touch-action|min-height/);
    expect(appAndStyles).not.toMatch(retiredCaddieVisiblePattern);
    expect(appAndStyles).not.toMatch(forbiddenTransactionPattern);
  });
});
