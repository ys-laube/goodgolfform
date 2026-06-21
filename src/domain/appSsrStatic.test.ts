import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import appSource from '../App.tsx?raw';
import { builtInProfilePresets, serializeProfilePresets, type StorageLike } from './profilePresets';
import { App } from '../App';

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
    expect(renderedApp).toContain('Save profile locally');
    expect(renderedApp).toContain('Target distance (m)');
    expect(renderedApp).toContain('Wind direction');
    expect(renderedApp).toContain('Wind strength');
    expect(renderedApp).toContain('Desired window');
    expect(renderedApp).toContain('Live analysis preview');
    expect(renderedApp).not.toMatch(/GPS shot pins|room-flow|map-shell|invite-link room/i);
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
});
