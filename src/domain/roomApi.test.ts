import { describe, expect, it } from 'vitest';
import { createRoomApiClient, createRoomApiHandler } from './roomApi';
import { createRoomRepository, createSharedRoomBackend, type RoomMembership } from './roomRepository';

describe('Room API backend boundary', () => {
  it('shares room and pin state across independent API clients with member credentials', async () => {
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
      memberToken: created.memberToken,
      emoji: '🏌️',
      comment: 'API-visible opener',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:12:00.000Z',
    });
    const secondPin = await secondClient.createPin({
      roomId: joined.room.id,
      participantId: joined.participant.id,
      memberToken: joined.memberToken,
      emoji: '⛳',
      comment: 'Second client can append',
      lat: 37.4221,
      lng: -122.0844,
      now: '2026-06-15T09:13:00.000Z',
    });

    expect(firstPin.participantName).toBe('Ari');
    expect(secondPin.participantName).toBe('Bo');
    await expect(secondClient.listPins(joined)).resolves.toEqual([firstPin, secondPin]);
    await expect(firstClient.listPins(created)).resolves.toEqual([firstPin, secondPin]);
  });

  it('does not depend on browser local or session storage for API visibility', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const client = createRoomApiClient({ baseUrl: 'https://fungolf.test', fetch: handler });

    await withPoisonedBrowserStorage(async () => {
      const membership = await client.createRoom({
        name: 'Storage-free API',
        hostDisplayName: 'Ari',
        now: '2026-06-15T09:14:00.000Z',
      });
      const pin = await client.createPin({
        roomId: membership.room.id,
        participantId: membership.participant.id,
        memberToken: membership.memberToken,
        emoji: '✅',
        comment: 'No browser storage touched',
        lat: 37.42194,
        lng: -122.08403,
        now: '2026-06-15T09:15:00.000Z',
      });

      await expect(client.listPins(membership)).resolves.toEqual([pin]);
    });
  });

  it('keeps pin writes append-only over the API and exposes loose freshness snapshots', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const client = createRoomApiClient({ baseUrl: 'https://fungolf.test', fetch: handler });
    const membership = await client.createRoom({
      name: 'Append only API',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:16:00.000Z',
    });
    const firstPin = await client.createPin(pinInput(membership, '1️⃣', 'First append', 37.42194, -122.08403));
    const secondPin = await client.createPin(pinInput(membership, '2️⃣', 'Second append', 37.4221, -122.0844));

    await expect(client.listPinSnapshot(membership, '2026-06-15T09:18:10.000Z')).resolves.toEqual({
      pins: [firstPin, secondPin],
      observedAt: '2026-06-15T09:18:10.000Z',
      freshness: 'loose',
    });
  });

  it('rejects missing credentials, spoofed participants, invalid coordinates, and oversized input', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const client = createRoomApiClient({ baseUrl: 'https://fungolf.test', fetch: handler });
    const membership = await client.createRoom({ name: 'Guarded room', hostDisplayName: 'Ari' });

    await expect(client.listPins({ ...membership, memberToken: 'member_spoofed' })).rejects.toThrow(
      'Room membership credentials are invalid',
    );
    await expect(
      client.createPin({ ...pinInput(membership, '✅', 'Spoofed', 37.42, -122.08), participantId: 'participant_spoofed' }),
    ).rejects.toThrow('Room membership credentials are invalid');
    await expect(client.createPin(pinInput(membership, '✅', 'Invalid latitude', 97, -122.08))).rejects.toThrow(
      'lat must be between -90 and 90',
    );
    await expect(client.createPin(pinInput(membership, '✅', 'x'.repeat(141), 37.42, -122.08))).rejects.toThrow(
      'comment must be 140 characters or fewer',
    );
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

function pinInput(membership: RoomMembership, emoji: string, comment: string, lat: number, lng: number) {
  return {
    roomId: membership.room.id,
    participantId: membership.participant.id,
    memberToken: membership.memberToken,
    emoji,
    comment,
    lat,
    lng,
    now: '2026-06-15T09:17:00.000Z',
  };
}

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
