import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import designSource from '../../DESIGN.md?raw';
import indexSource from '../../index.html?raw';
import readmeSource from '../../README.md?raw';
import appSource from '../App.tsx?raw';
import scorecardGridSource from '../ScorecardGrid.tsx?raw';
import stylesSource from '../styles.css?raw';
import { App } from '../App';

const requiredVisibleConcepts = [
  '라운드 세팅',
  '플레이어',
  '핸디',
  '오장 룰',
  '홀 입력',
  '정산표',
  '순정산',
  '계산 내역',
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
const removedGameSurfacePattern = /스킨스?|베가스|이벤트|미션|skins|vegas|mission|gameUnits|enabledGames|scoringMode|handicapMode/i;
const forbiddenTransactionPattern = new RegExp(['송' + '금', '결' + '제', '지' + '갑', '에스' + '크로', '입' + '금', '출' + '금', 'Payment' + 'Request', 'wallet', 'escrow', 'deposit', 'withdraw'].join('|'), 'i');
const appleAffiliationPattern = /Apple(?:\s+Inc\.|\s+logo|\s+official|\s+certified)|애플\s*(?:공식|인증|제휴|로고)/i;

function withPoisonedBrowserGlobals<T>(assertions: () => T): T {
  const globalNames = ['window', 'location', 'history', 'localStorage', 'sessionStorage', 'navigator', 'fetch', 'Web' + 'Socket', 'Event' + 'Source', 'XML' + 'HttpRequest'] as const;
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

describe('Korean traditional Ojang ledger SSR/static integration contract', () => {
  it('SSR-renders the replacement Ojang UI without browser, storage, or network globals', () => {
    const renderedApp = withPoisonedBrowserGlobals(() => renderToString(createElement(App)));

    expect(renderedApp).toMatch(/[가-힣]/);
    for (const concept of requiredVisibleConcepts) {
      expect(renderedApp, `SSR output should include ${concept}`).toContain(concept);
    }

    expect(renderedApp).toMatch(/2\s*[–-]\s*4|2~4|2명|4명/);
    expect(renderedApp).toMatch(/오장|배판|니어|핸디/);
    expect(renderedApp).toMatch(/타당 금액|받을 금액|줄 금액|보낼 금액|순정산/);
    expect(renderedApp).toMatch(/스코어카드 캡처|QR·결과 링크|로컬 결과 링크/);
    expect(renderedApp).toContain('오늘 폼 정말 좋으시네요 ^0^');
    expect(renderedApp).toContain('오장 룰 자세히 보기');
    expect(renderedApp).not.toMatch(retiredCaddieVisiblePattern);
    expect(renderedApp).not.toMatch(removedGameSurfacePattern);
    expect(renderedApp).not.toMatch(forbiddenTransactionPattern);
    expect(renderedApp).not.toMatch(appleAffiliationPattern);
  });

  it('keeps README and DESIGN aligned to the local-only Ojang replacement scope', () => {
    const docs = `${readmeSource}\n${designSource}`;

    expect(docs).toMatch(/local-only|로컬|현재 기기/);
    expect(docs).toMatch(/golf-bet-ledger:\*:v3|golf-bet-ledger/);
    expect(docs).toMatch(/korean-caddie:preset-distances:v1/);
    expect(docs).toMatch(/old caddie|caddie recommendation/i);
    expect(docs).toMatch(/라운드 세팅/);
    expect(docs).toMatch(/전통 오장|traditional 오장|Ojang/);
    expect(docs).toMatch(/순정산/);
    expect(docs).toMatch(/공유 카드/);
    expect(docs).toMatch(/오늘 폼 정말 좋으시네요 \^0\^/);
    expect(docs).toMatch(/오장 룰 자세히 보기/);
    expect(docs).toMatch(/Apple-inspired/i);
    expect(docs).toMatch(/no Apple logo|Apple logos|애플.*로고/i);
    expect(docs).toMatch(/No backend|No payment execution/i);
    expect(docs).toMatch(/URL-hash snapshots|#fg=|QR\/result-link/i);
    expect(docs).toMatch(/<=1800|<=2200/);
    expect(docs).not.toMatch(/스킨스?|베가스|이벤트|미션 카드|fixed game set|mission deck/i);
  });

  it('keeps browser metadata on the Ojang ledger product instead of retired games', () => {
    expect(indexSource).toMatch(/오늘 폼 정말 좋으시네요 \^0\^/);
    expect(indexSource).toMatch(/전통 오장|로컬 장부/);
    expect(indexSource).not.toMatch(retiredCaddieVisiblePattern);
    expect(indexSource).not.toMatch(removedGameSurfacePattern);
  });

  it('keeps the app source and stylesheet oriented around mobile Ojang ledger surfaces', () => {
    const appAndStyles = `${appSource}\n${stylesSource}`;

    expect(appAndStyles).toMatch(/라운드 세팅|round setup|RoundSetup/i);
    expect(appAndStyles).toMatch(/홀 입력|hole input|HoleInput/i);
    expect(appSource).toMatch(/<h1 id="app-title">오늘 폼 정말 좋으시네요 \^0\^<\/h1>/);
    expect(appSource).toMatch(/오장 룰 자세히 보기/);
    expect(appSource).not.toMatch(/한국형 골프 내기 정산/);
    expect(appSource).not.toMatch(/2~4명 라운드 세팅부터 홀 입력, 이벤트, 미션, 순정산, 공유 카드까지/);
    expect(scorecardGridSource).not.toMatch(/scorecard-hole-grid|scorecard-hole/);
    expect(appSource).toMatch(/score-row-context/);
    expect(appSource).toMatch(/score-input-grid/);
    expect(appSource).not.toMatch(/mission-button-row|mission-card|event-card|score-event-grid/);
    expect(appAndStyles).toMatch(/정산|settlement|ledger/i);
    expect(appAndStyles).toMatch(/공유|share/i);
    expect(appAndStyles).toMatch(/@media|min-width|safe-area-inset|touch-action|min-height/);
    expect(appAndStyles).not.toMatch(retiredCaddieVisiblePattern);
    expect(appAndStyles).not.toMatch(forbiddenTransactionPattern);
  });
});
