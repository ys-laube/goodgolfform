import { describe, expect, it } from 'vitest';
import { createRoomApiClient, createRoomApiHandler } from './roomApi';
import { createRoomRepository, createSharedRoomBackend } from './roomRepository';

describe('Room API backend boundary', () => {
  it('shares room and pin state across independent API clients', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const firstClient = createRoomApiClient({ baseUrl: 'https://fungolf.test', fetch: handler });
    const secondClient = createRoomApiClient({ baseUrl: 'https://fungolf.test', fetch: handler });

    const created = await firstClient.createRoom({
      name: 'API foursome',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:10:00.000Z',
    });
    const joined = await secondClient.joinRoom({
      inviteToken: created.room.inviteToken ?? '',
      displayName: 'Bo',
      now: '2026-06-15T09:11:00.000Z',
    });
    const firstPin = await firstClient.createPin({
      roomId: created.room.id,
      participantId: created.participant.id,
      participantName: created.participant.displayName,
      emoji: '🏌️',
      comment: 'API-visible opener',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:12:00.000Z',
    });
    const secondPin = await secondClient.createPin({
      roomId: joined.room.id,
      participantId: joined.participant.id,
      participantName: joined.participant.displayName,
      emoji: '⛳',
      comment: 'Second client can append',
      lat: 37.4221,
      lng: -122.0844,
      now: '2026-06-15T09:13:00.000Z',
    });

    await expect(secondClient.listPins(created.room.id)).resolves.toEqual([firstPin, secondPin]);
    await expect(firstClient.listPins(created.room.id)).resolves.toEqual([firstPin, secondPin]);
  });

  it('does not depend on browser local or session storage for API visibility', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const client = createRoomApiClient({ baseUrl: 'https://fungolf.test', fetch: handler });

    await withPoisonedBrowserStorage(async () => {
      const { room, participant } = await client.createRoom({
        name: 'Storage-free API',
        hostDisplayName: 'Ari',
        now: '2026-06-15T09:14:00.000Z',
      });
      const pin = await client.createPin({
        roomId: room.id,
        participantId: participant.id,
        participantName: participant.displayName,
        emoji: '✅',
        comment: 'No browser storage touched',
        lat: 37.42194,
        lng: -122.08403,
        now: '2026-06-15T09:15:00.000Z',
      });

      await expect(client.listPins(room.id)).resolves.toEqual([pin]);
    });
  });

  it('keeps pin writes append-only over the API and exposes loose freshness snapshots', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const client = createRoomApiClient({ baseUrl: 'https://fungolf.test', fetch: handler });
    const { room, participant } = await client.createRoom({
      name: 'Append only API',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:16:00.000Z',
    });
    const firstPin = await client.createPin({
      roomId: room.id,
      participantId: participant.id,
      participantName: participant.displayName,
      emoji: '1️⃣',
      comment: 'First append',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:17:00.000Z',
    });
    const secondPin = await client.createPin({
      roomId: room.id,
      participantId: participant.id,
      participantName: participant.displayName,
      emoji: '2️⃣',
      comment: 'Second append',
      lat: 37.4221,
      lng: -122.0844,
      now: '2026-06-15T09:18:00.000Z',
    });

    await expect(client.listPinSnapshot(room.id, '2026-06-15T09:18:10.000Z')).resolves.toEqual({
      pins: [firstPin, secondPin],
      observedAt: '2026-06-15T09:18:10.000Z',
      freshness: 'loose',
    });
  });

  it('returns validation and missing-resource errors through the API client', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const client = createRoomApiClient({ baseUrl: 'https://fungolf.test', fetch: handler });

    await expect(client.createRoom({ name: '', hostDisplayName: 'Ari' })).rejects.toThrow('name is required');
    await expect(client.joinRoom({ inviteToken: 'missing-token', displayName: 'Bo' })).rejects.toThrow(
      'Room invite link was not found',
    );

    const missingRouteResponse = await handler('https://fungolf.test/not-a-route');
    await expect(missingRouteResponse.json()).resolves.toMatchObject({ error: 'not_found' });
  });
});

async function withPoisonedBrowserStorage(assertions: () => Promise<void>): Promise<void> {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('localStorage must not be used by Room API');
    },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get: () => {
      throw new Error('sessionStorage must not be used by Room API');
    },
  });

  try {
    await assertions();
  } finally {
    if (localStorageDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    }
    if (sessionStorageDescriptor) {
      Object.defineProperty(globalThis, 'sessionStorage', sessionStorageDescriptor);
    }
  }
}
