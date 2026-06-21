import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import packageJson from '../../package.json';
import { SwingMotionViewer } from '../components/SwingMotionViewer';
import swingMotionViewerSource from '../components/SwingMotionViewer.tsx?raw';
import appSource from '../App.tsx?raw';
import { motionParametersFromRecommendation } from './motionParameters';
import { builtInProfilePresets, serializeProfilePresets, type StorageLike } from './profilePresets';
import { recommendShot } from './recommendationEngine';
import { App } from '../App';
import motionParametersSource from './motionParameters.ts?raw';

const packageDependencyNames = Object.keys(packageJson.dependencies);

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
    expect(renderedApp).toContain('Serious Golf Swing Lab');
    expect(renderedApp).toContain('Player profile in. Scenario context out. Analysis card ready.');
    expect(renderedApp).toContain('Profile panel');
    expect(renderedApp).toContain('Scenario panel');
    expect(renderedApp).toContain('Save profile locally');
    expect(renderedApp).toContain('Target distance (m)');
    expect(renderedApp).toContain('Wind direction');
    expect(renderedApp).toContain('Wind strength');
    expect(renderedApp).toContain('Desired window');
    expect(renderedApp).toContain('Live analysis report');
    expect(renderedApp).toContain('Analysis report cards');
    expect(renderedApp).toContain('Club · distance feel');
    expect(renderedApp).toContain('Swing size · tempo');
    expect(renderedApp).toContain('Trajectory strategy');
    expect(renderedApp).toContain('Plausibility · game metrics');
    expect(renderedApp).toContain('Why this card');
    expect(renderedApp).toContain('Parameterized golfer motion');
    expect(renderedApp).toContain('Current motion parameters');
    expect(renderedApp).toMatch(/Golfer motion viewer:/);
    expect(renderedApp).toMatch(/fit score/i);
    expect(renderedApp).toMatch(/adjusted target/i);
    expect(renderedApp).not.toMatch(/GPS shot pins|room-flow|map-shell|invite-link room/i);
    expect(renderedApp).not.toMatch(/\b(coach|caddie|caddy)\b/i);
    expect(renderedApp).not.toMatch(/Build the shot|Read the swing card|Enter shot|Type the shot|choose a saved profile|get a deterministic|becoming commands|adjusted play|you should|let's|do this|next|now/i);
  });

  it('SSR-renders the default analysis card fields without notice-style copy', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toContain('6 IRON');
    expect(renderedApp).toContain('controlled');
    expect(renderedApp).toContain('Plausibility');
    expect(renderedApp).toContain('Tempo');
    expect(renderedApp).toContain('Trajectory strategy');
    expect(renderedApp).toMatch(/fit score/i);
    expect(renderedApp).toMatch(/adjusted target/i);
    expect(renderedApp).not.toMatch(/\b(disclaimer|legal notice|official|rangefinder|coach|caddie|caddy|must|should|need to|try to|hit|aim|guarantee|exact|adjusted play)\b/i);
  });


  it('renders every required analysis report card category from recommendation output', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toMatch(/Club · distance feel[\s\S]*IRON/i);
    expect(renderedApp).toMatch(/Swing size · tempo[\s\S]*(controlled|fuller stock)/i);
    expect(renderedApp).toMatch(/Trajectory strategy[\s\S]*standard window/i);
    expect(renderedApp).toMatch(/Plausibility · game metrics[\s\S]*fit score/i);
    expect(renderedApp).toMatch(/Why this card[\s\S]*adjusted target/i);
    expect(renderedApp).toMatch(/Scenario adjustment reads|Why this card/i);
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

      expect(renderedApp).toContain('1 saved profile restored from this device.');
      expect(renderedApp).toContain('Saved on this device');
      expect(renderedApp).toContain('Saved Smooth Draw');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'window', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }
  });

  it('keeps App free of superseded GPS/map/room imports', () => {
    expect(appSource).not.toMatch(/MapShell|useCurrentLocation|roomApi|roomRepository|shotPinFlow|courseTargets|mapAdapter/);
    expect(appSource).toMatch(/profilePresets/);
    expect(appSource).toMatch(/recommendShot/);
    expect(appSource).toMatch(/motionParametersFromRecommendation/);
    expect(appSource).toMatch(/SwingMotionViewer/);
  });

  it('keeps the static HTML entrypoint ready for mobile swing lab smoke checks', () => {
    expect(indexHtml).toContain('<!doctype html>');
    expect(indexHtml).toContain('<html lang="en">');
    expect(indexHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#0b3d2e" />');
    expect(indexHtml).toContain('mobile-first serious golf swing lab prototype');
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
    expect(renderedViewer).toContain(`Static ${parameters.reducedMotionPose} pose`);
    expect(renderedViewer).toContain('--swing-arc');
    expect(renderedViewer).toMatch(new RegExp(`${parameters.arcDegrees}<!-- -->°`));
    expect(renderedViewer).toContain(`${parameters.pathOffset}px`);
    expect(renderedViewer).toMatch(new RegExp(`${parameters.launchAngleDegrees}<!-- -->°`));
  });

  it('keeps the motion-viewer static contract dependency-free and SSR-safe', () => {
    const scannedSources = [appSource, motionParametersSource, swingMotionViewerSource].join('\n');

    expect(packageDependencyNames).toEqual(['@vitejs/plugin-react', 'vite', 'typescript', 'react', 'react-dom']);
    expect(scannedSources).not.toMatch(/three|@react-three|webgl|canvas|getContext|requestAnimationFrame/i);
    expect(scannedSources).not.toMatch(/navigator\.geolocation|VITE_MAP_|VITE_ROOM_API_|mapbox|maplibre|leaflet|firebase|supabase/i);
    expect(motionParametersSource).toMatch(/accessibleSummary/);
    expect(motionParametersSource).toMatch(/reducedMotionPose/);
    expect(swingMotionViewerSource).toMatch(/Object\.getOwnPropertyDescriptor\(globalThis, 'window'\)/);
    expect(swingMotionViewerSource).toMatch(/forceReducedMotion/);
    expect(appSource).toMatch(/Motion meter/);
  });
});
