import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json?raw';
import appSource from '../App.tsx?raw';
import caddieSessionSource from '../useCaddieSession.ts?raw';
import { App } from '../App';
import { approximateDistanceCopy, nonGoals, privacyNotes, productPrinciples } from './copy';

const forbiddenNoticeCopy = /disclaimer|legal notice|official|rangefinder|safety-critical|면책|법적 고지|공식|거리측정기|안전 필수/i;
const forbiddenCommandCopy = /\b(must|should|need to|try to|guarantee|exact|hit this|play this|aim at|take this club|use this club|coach|go for|club up|club down)\b|adjusted play|반드시|쳐야|보장|정확|코치/i;
const forbiddenVisibleConstraintCopy = /without GPS|No login|GPS shot pins|weather feeds?|invite-link room|backend setup|backend dependency/i;
const forbiddenAppImports = /MapShell|useCurrentLocation|roomApi|roomRepository|shotPinFlow|courseTargets|mapAdapter|auth|weather|multiplayer/i;
const forbiddenRuntimeDeps = /supabase|firebase|mapbox|leaflet|auth0|clerk|weather|socket\.io/i;
const forbiddenRuntimeFiles = /(?:MapShell|useCurrentLocation|roomApi|roomRepository|shotPinFlow|courseTargets|geo|mapAdapter|fieldReadiness)\.(?:ts|tsx)$/;
const sourceFilePaths = Object.keys(import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
}));

describe('G003 copy/UX integration boundary', () => {
  it('keeps the SSR-visible swing analysis surface serious, bounded, and non-commanding', () => {
    const renderedApp = renderToString(createElement(App));
    const visibleCopy = [renderedApp, approximateDistanceCopy, ...productPrinciples, ...privacyNotes, ...nonGoals].join(' ');
    const resultCopy = renderedApp.slice(renderedApp.indexOf('지금 처방'));

    expect(renderedApp).toMatch(/[가-힣]/);
    expect(renderedApp).toMatch(/캐디 한줄 처방/i);
    expect(renderedApp).toMatch(/지금 처방/i);
    expect(renderedApp).toMatch(/왜 이렇게 치나요/i);
    expect(renderedApp).toMatch(/조준과 라이 미니카드/i);
    expect(visibleCopy).toMatch(/근사 연습 추정값/i);
    expect(renderedApp).toMatch(/추천: 9번 아이언 90%[\s\S]*목표보다 살짝 오른쪽 조준[\s\S]*낮게 컨트롤/);
    expect(renderedApp).toMatch(/페어웨이 · 발끝 내리막 · 좌측 경사/);
    expect(renderedApp).not.toMatch(/Serious Golf Swing Lab|Profile panel|Scenario panel|Save profile locally|Live analysis report/);
    expect(visibleCopy).not.toMatch(forbiddenNoticeCopy);
    expect(renderedApp).not.toMatch(forbiddenVisibleConstraintCopy);
    expect(resultCopy).not.toMatch(forbiddenCommandCopy);
  });

  it('guards G003 against backend, auth, GPS, map, weather, and multiplayer imports or dependencies', () => {
    const appSessionSource = `${appSource}\n${caddieSessionSource}`;

    expect(appSessionSource).toMatch(/buildPrescription/);
    expect(appSessionSource).toMatch(/caddiePresets/);
    const importSurface = appSessionSource
      .split('\n')
      .filter((line) => line.startsWith('import '))
      .join('\n');

    expect(importSurface).not.toMatch(forbiddenAppImports);
    expect(packageJson).not.toMatch(forbiddenRuntimeDeps);
  });


  it('removes superseded backend, GPS, map, weather, room, and multiplayer implementation files from runtime source', () => {
    expect(sourceFilePaths).not.toEqual(expect.arrayContaining([expect.stringMatching(forbiddenRuntimeFiles)]));
  });

});
