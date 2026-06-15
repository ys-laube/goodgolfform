import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { approximateDistanceDisclaimer, nonGoals, privacyNotes, productPrinciples } from './copy';
import { classifyLocationFailure, classifyLocationSample, formatApproxDistance, targetDistances } from './geo';
import { createRoomApiClient, createRoomApiHandler } from './roomApi';
import { createRoomRepository, createSharedRoomBackend } from './roomRepository';
import { buildShotPinInput } from './shotPinFlow';

async function withIsolatedBrowserContext<T>(assertions: () => Promise<T>): Promise<T> {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('browser-context localStorage must not be used for shared room state');
    },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get: () => {
      throw new Error('browser-context sessionStorage must not be used for shared room state');
    },
  });

  try {
    return await assertions();
  } finally {
    if (localStorageDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }

    if (sessionStorageDescriptor) {
      Object.defineProperty(globalThis, 'sessionStorage', sessionStorageDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'sessionStorage');
    }
  }
}

describe('G005 integration E2E field-readiness contract', () => {
  it('shares invite-room shot pins across two isolated browser contexts', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const hostContext = createRoomApiClient({ baseUrl: 'https://fungolf.field.test', fetch: handler });
    const guestContext = createRoomApiClient({ baseUrl: 'https://fungolf.field.test', fetch: handler });

    await withIsolatedBrowserContext(async () => {
      const hostMembership = await hostContext.createRoom({
        name: 'Field readiness nine',
        hostDisplayName: 'Ari',
        now: '2026-06-15T09:00:00.000Z',
      });
      const guestMembership = await guestContext.joinRoom({
        inviteToken: hostMembership.room.inviteToken ?? '',
        displayName: 'Bo',
        now: '2026-06-15T09:01:00.000Z',
      });

      const hostPinInput = buildShotPinInput({
        membership: hostMembership,
        source: 'current',
        category: 'shot',
        comment: 'Wind-safe opener',
        currentLocation: {
          lat: 37.42194,
          lng: -122.08403,
          accuracyMeters: 18,
          timestamp: '2026-06-15T09:02:00.000Z',
        },
        now: '2026-06-15T09:03:00.000Z',
      });
      const guestPinInput = buildShotPinInput({
        membership: guestMembership,
        source: 'manual',
        category: 'lie',
        comment: 'Manual fallback near tree line',
        manualLocation: { lat: 37.4221, lng: -122.0844 },
        now: '2026-06-15T09:04:00.000Z',
      });

      const hostPin = await hostContext.createPin(hostPinInput);
      const guestPin = await guestContext.createPin(guestPinInput);

      await expect(hostContext.listPins(hostMembership.room.id)).resolves.toEqual([hostPin, guestPin]);
      await expect(guestContext.listPins(guestMembership.room.id)).resolves.toEqual([hostPin, guestPin]);
      await expect(guestContext.listPinSnapshot(guestMembership.room.id, '2026-06-15T09:05:00.000Z')).resolves.toMatchObject({
        pins: [hostPin, guestPin],
        freshness: 'loose',
      });
    });
  });

  it('keeps field copy approximate for location, distance, sharing, and non-goals', () => {
    const renderedApp = renderToString(createElement(App));
    const copySurface = [
      renderedApp,
      approximateDistanceDisclaimer,
      ...productPrinciples,
      ...privacyNotes,
      ...nonGoals,
    ].join(' ');
    const distances = targetDistances(
      { lat: 37.42194, lng: -122.08403 },
      [
        { id: 'green-1', roomId: 'field-room', label: 'Front green', type: 'green', lat: 37.42294, lng: -122.08403 },
        { id: 'hazard-1', roomId: 'field-room', label: 'Left bunker', type: 'hazard', lat: 37.42194, lng: -122.08503 },
      ],
    );

    expect(formatApproxDistance(88.4)).toBe('≈ 88 m');
    expect(distances.map((distance) => distance.label)).toEqual(expect.arrayContaining([expect.stringMatching(/^≈ /)]));
    expect(copySurface).toMatch(/approximate GPS/i);
    expect(copySurface).toMatch(/visible only inside this invite-link room/i);
    expect(copySurface).toMatch(/No official rulings/i);
    expect(copySurface).toMatch(/No scorecards, betting/i);
    expect(copySurface).toMatch(/No public social feed/i);
    expect(copySurface).not.toMatch(/Create scorecard|Place bet|Open leaderboard|Create public profile|Follow player|Request official ruling/i);
  });

  it('assesses geolocation fallback triggers without blocking manual field pins', () => {
    const lowAccuracy = classifyLocationSample(
      {
        lat: 37.42194,
        lng: -122.08403,
        accuracyMeters: 95,
        timestamp: '2026-06-15T09:02:00.000Z',
      },
      { maxAcceptableAccuracyMeters: 50 },
    );
    const denied = classifyLocationFailure({ code: 1 });
    const timedOut = classifyLocationFailure({ code: 3 });
    const membership = {
      room: {
        id: 'field-room',
        name: 'Fallback nine',
        createdAt: '2026-06-15T09:00:00.000Z',
        inviteToken: 'invite-field',
      },
      participant: {
        id: 'participant-ari',
        displayName: 'Ari',
        joinedAt: '2026-06-15T09:00:00.000Z',
      },
    };

    expect(lowAccuracy).toMatchObject({ status: 'low_accuracy', maxAcceptableAccuracyMeters: 50 });
    expect(lowAccuracy.message).toMatch(/extra approximate/i);
    expect(denied).toMatchObject({ status: 'denied', reason: 'denied' });
    expect(denied.message).toMatch(/manually entered course targets/i);
    expect(timedOut).toMatchObject({ status: 'unavailable', reason: 'timeout' });
    expect(
      buildShotPinInput({
        membership,
        source: 'manual',
        category: 'note',
        comment: '',
        manualLocation: { lat: 37.4225, lng: -122.0848 },
      }),
    ).toMatchObject({
      roomId: 'field-room',
      category: 'note',
      emoji: '💬',
      comment: 'Friendly round note',
      lat: 37.4225,
      lng: -122.0848,
    });
  });
});
