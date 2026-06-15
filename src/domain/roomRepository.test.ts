import { describe, expect, it } from 'vitest';
import { createRoomRepository, createSharedRoomBackend } from './roomRepository';

describe('shared RoomRepository backend', () => {
  it('creates opaque invite-link rooms across independent repository clients', async () => {
    const backend = createSharedRoomBackend();
    const firstClient = createRoomRepository(backend);
    const secondClient = createRoomRepository(backend);

    const created = await firstClient.createRoom({
      name: 'Saturday nine',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:00:00.000Z',
    });
    const another = await firstClient.createRoom({ name: 'Sunday nine', hostDisplayName: 'Cam' });
    const joined = await secondClient.joinRoom({
      inviteToken: created.room.inviteToken ?? '',
      displayName: 'Bo',
      now: '2026-06-15T09:01:00.000Z',
    });

    expect(created.room).toMatchObject({ name: 'Saturday nine' });
    expect(created.room.inviteToken).toMatch(/^invite_[a-f0-9]{32}$/);
    expect(created.room.id).toMatch(/^room_[a-f0-9]{32}$/);
    expect(created.room.inviteToken).not.toBe(another.room.inviteToken);
    expect(created.memberToken).toMatch(/^member_[a-f0-9]{32}$/);
    expect(joined.room).toEqual(created.room);
    expect(joined.participant.displayName).toBe('Bo');
  });

  it('makes appended shot pins visible only to room members without local or session storage', async () => {
    const backend = createSharedRoomBackend();
    const firstClient = createRoomRepository(backend);
    const secondClient = createRoomRepository(backend);
    const host = await firstClient.createRoom({
      name: 'Back nine',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:00:00.000Z',
    });
    const guest = await secondClient.joinRoom({ inviteToken: host.room.inviteToken ?? '', displayName: 'Bo' });

    const firstPin = await firstClient.createPin({
      roomId: host.room.id,
      participantId: host.participant.id,
      memberToken: host.memberToken,
      emoji: '🏌️',
      comment: 'Safe layup near the left edge',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:02:00.000Z',
    });
    const secondPin = await secondClient.createPin({
      roomId: guest.room.id,
      participantId: guest.participant.id,
      memberToken: guest.memberToken,
      emoji: '🌲',
      comment: 'Tree trouble but playable',
      lat: 37.4221,
      lng: -122.0844,
      now: '2026-06-15T09:03:00.000Z',
    });

    await withPoisonedBrowserStorage(async () => {
      await expect(secondClient.listPins(guest)).resolves.toEqual([firstPin, secondPin]);
      await expect(firstClient.listPins(host)).resolves.toEqual([firstPin, secondPin]);
    });
  });

  it('rejects spoofed participants and non-member reads', async () => {
    const repository = createRoomRepository(createSharedRoomBackend());
    const host = await repository.createRoom({ name: 'Private round', hostDisplayName: 'Ari' });

    await expect(
      repository.createPin({
        roomId: host.room.id,
        participantId: 'participant_spoofed',
        memberToken: host.memberToken,
        emoji: '🚫',
        comment: 'Spoofed',
        lat: 37.42194,
        lng: -122.08403,
      }),
    ).rejects.toThrow('Room membership credentials are invalid');

    await expect(
      repository.listPins({ roomId: host.room.id, participantId: host.participant.id, memberToken: 'member_spoofed' }),
    ).rejects.toThrow('Room membership credentials are invalid');
  });


  it('rejects invalid direct repository input before persistence', async () => {
    const repository = createRoomRepository(createSharedRoomBackend());

    await expect(repository.createRoom({ name: '', hostDisplayName: 'Ari' })).rejects.toThrow('name is required');
    await expect(repository.createRoom({ name: 'Round', hostDisplayName: ' ' })).rejects.toThrow('displayName is required');

    const membership = await repository.createRoom({ name: 'Validated round', hostDisplayName: 'Ari' });
    const basePin = {
      roomId: membership.room.id,
      participantId: membership.participant.id,
      memberToken: membership.memberToken,
      emoji: '✅',
      comment: 'Valid direct pin',
      lat: 37.42194,
      lng: -122.08403,
    };

    await expect(repository.createPin({ ...basePin, lat: 91 })).rejects.toThrow('lat must be between -90 and 90');
    await expect(repository.createPin({ ...basePin, lng: -181 })).rejects.toThrow('lng must be between -180 and 180');
    await expect(repository.createPin({ ...basePin, emoji: 'x'.repeat(17) })).rejects.toThrow(
      'emoji must be 16 characters or fewer',
    );
    await expect(repository.createPin({ ...basePin, comment: 'x'.repeat(141) })).rejects.toThrow(
      'comment must be 140 characters or fewer',
    );
  });

  it('exposes loose freshness metadata for authorized read snapshots', async () => {
    const repository = createRoomRepository(createSharedRoomBackend());
    const membership = await repository.createRoom({
      name: 'Fresh enough round',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:00:00.000Z',
    });
    const pin = await repository.createPin({
      roomId: membership.room.id,
      participantId: membership.participant.id,
      memberToken: membership.memberToken,
      emoji: '⛳',
      comment: 'Readable on next loose-freshness poll',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:05:00.000Z',
    });

    await expect(repository.listPinSnapshot(membership, '2026-06-15T09:05:10.000Z')).resolves.toEqual({
      pins: [pin],
      observedAt: '2026-06-15T09:05:10.000Z',
      freshness: 'loose',
    });
  });

  it('returns snapshots so callers cannot mutate append-only backend history', async () => {
    const repository = createRoomRepository(createSharedRoomBackend());
    const membership = await repository.createRoom({
      name: 'Snapshot round',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:00:00.000Z',
    });
    const pin = await repository.createPin({
      roomId: membership.room.id,
      participantId: membership.participant.id,
      memberToken: membership.memberToken,
      emoji: '✅',
      comment: 'First pin remains first',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:04:00.000Z',
    });

    const listedPins = await repository.listPins(membership);
    (listedPins as ShotPinForMutation[]).push({ ...pin, id: 'mutated-pin' });

    await expect(repository.listPins(membership)).resolves.toEqual([pin]);
  });
});

type ShotPinForMutation = Awaited<ReturnType<ReturnType<typeof createRoomRepository>['listPins']>>[number];

async function withPoisonedBrowserStorage(assertions: () => Promise<void>): Promise<void> {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('localStorage must not be used by RoomRepository');
    },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get: () => {
      throw new Error('sessionStorage must not be used by RoomRepository');
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
