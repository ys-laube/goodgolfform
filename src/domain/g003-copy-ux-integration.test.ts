import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json?raw';
import appSource from '../App.tsx?raw';
import swingLabSessionSource from '../useSwingLabSession.ts?raw';
import { App } from '../App';
import { approximateDistanceCopy, nonGoals, privacyNotes, productPrinciples } from './copy';

const forbiddenNoticeCopy = /disclaimer|legal notice|official|rangefinder|safety-critical|면책|법적 고지|공식|거리측정기|안전 필수/i;
const forbiddenCommandCopy = /\b(must|should|need to|try to|guarantee|exact|hit this|play this|aim at|take this club|use this club|caddie|caddy|coach|go for|club up|club down)\b|adjusted play|반드시|쳐야|겨냥|추천|보장|정확|캐디|코치/i;
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
    const analysisCardCopy = renderedApp.slice(renderedApp.indexOf('실시간 분석 리포트'));

    expect(renderedApp).toMatch(/[가-힣]/);
    expect(renderedApp).toMatch(/실시간 분석 리포트/i);
    expect(renderedApp).toMatch(/개연성/i);
    expect(renderedApp).toMatch(/비행 라인/i);
    expect(renderedApp).toMatch(/적합도/i);
    expect(visibleCopy).toMatch(/근사 연습 추정값/i);
    expect(renderedApp).toMatch(/균형형 메이커[\s\S]*싱글 핸디캡[\s\S]*스트레이트[\s\S]*중간 탄도[\s\S]*중립 템포/);
    expect(renderedApp).not.toMatch(/single-digit · straight · mid 탄도 · neutral 템포|developing · draw · high 탄도 · smooth 템포|scratch · fade · low 탄도 · assertive 템포/);
    expect(renderedApp).not.toMatch(/Serious Golf Swing Lab|Profile panel|Scenario panel|Save profile locally|Live analysis report/);
    expect(visibleCopy).not.toMatch(forbiddenNoticeCopy);
    expect(renderedApp).not.toMatch(forbiddenVisibleConstraintCopy);
    expect(analysisCardCopy).not.toMatch(forbiddenCommandCopy);
  });

  it('guards G003 against backend, auth, GPS, map, weather, and multiplayer imports or dependencies', () => {
    const appSessionSource = `${appSource}\n${swingLabSessionSource}`;

    expect(appSessionSource).toMatch(/recommendShot/);
    expect(appSessionSource).toMatch(/profilePresets/);
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
