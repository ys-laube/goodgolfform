import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json?raw';
import appSource from '../App.tsx?raw';
import { App } from '../App';
import { approximateDistanceCopy, nonGoals, privacyNotes, productPrinciples } from './copy';

const forbiddenNoticeCopy = /disclaimer|legal notice|official|rangefinder|safety-critical/i;
const forbiddenCommandCopy = /\b(must|should|need to|try to|guarantee|exact|hit this|play this|aim at|take this club|use this club|caddie|caddy|coach|go for|club up|club down)\b|adjusted play/i;
const forbiddenAppImports = /MapShell|useCurrentLocation|roomApi|roomRepository|shotPinFlow|courseTargets|mapAdapter|auth|weather|multiplayer/i;
const forbiddenRuntimeDeps = /supabase|firebase|mapbox|leaflet|auth0|clerk|weather|socket\.io/i;

describe('G003 copy/UX integration boundary', () => {
  it('keeps the SSR-visible swing analysis surface serious, bounded, and non-commanding', () => {
    const renderedApp = renderToString(createElement(App));
    const visibleCopy = [renderedApp, approximateDistanceCopy, ...productPrinciples, ...privacyNotes, ...nonGoals].join(' ');
    const analysisCardCopy = renderedApp.slice(renderedApp.indexOf('Live analysis report'));

    expect(renderedApp).toMatch(/Live analysis report/i);
    expect(renderedApp).toMatch(/Plausibility/i);
    expect(renderedApp).toMatch(/Flight lane/i);
    expect(renderedApp).toMatch(/fit score/i);
    expect(visibleCopy).toMatch(/approximate practice estimates/i);
    expect(visibleCopy).not.toMatch(forbiddenNoticeCopy);
    expect(analysisCardCopy).not.toMatch(forbiddenCommandCopy);
  });

  it('guards G003 against backend, auth, GPS, map, weather, and multiplayer imports or dependencies', () => {
    expect(appSource).toMatch(/recommendShot/);
    expect(appSource).toMatch(/profilePresets/);
    const importSurface = appSource
      .split('\n')
      .filter((line) => line.startsWith('import '))
      .join('\n');

    expect(importSurface).not.toMatch(forbiddenAppImports);
    expect(packageJson).not.toMatch(forbiddenRuntimeDeps);
  });
});
