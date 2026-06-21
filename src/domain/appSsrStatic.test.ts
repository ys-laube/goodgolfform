import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import { App } from '../App';

function withPoisonedBrowserStorage<T>(assertions: () => T): T {
  const descriptors = {
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
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
  it('renders the app shell to a static string without browser storage globals', () => {
    const renderedApp = withPoisonedBrowserStorage(() => renderToString(createElement(App)));

    expect(renderedApp).toContain('id="app-title"');
    expect(renderedApp).toContain('id="room-flow"');
    expect(renderedApp).toContain('id="map-shell-title"');
    expect(renderedApp).toContain('aria-label="Golf course map with current location and course target markers"');
    expect(renderedApp).not.toContain('Distance feel uses approximate practice estimates');
  });

  it('keeps the static HTML entrypoint ready for mobile SSR/static smoke checks', () => {
    expect(indexHtml).toContain('<!doctype html>');
    expect(indexHtml).toContain('<html lang="en">');
    expect(indexHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#0b3d2e" />');
    expect(indexHtml).toContain('mobile-first golf field GPS shot-pin prototype');
    expect(indexHtml).toContain('<div id="root"></div>');
    expect(indexHtml).toContain('<script type="module" src="/src/main.tsx"></script>');
  });
});
