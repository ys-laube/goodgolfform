import { describe, expect, it } from 'vitest';
import { createRoomRepository, createSharedRoomBackend } from './roomRepository';

describe('shared RoomRepository backend', () => {
  it('creates and joins invite-link rooms across independent repository clients', async () => {
    const backend = createSharedRoomBackend();
    const firstClient = createRoomRepository(backend);
    const secondClient = createRoomRepository(backend);

    const created = await firstClient.createRoom({
      name: 'Saturday nine',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:00:00.000Z',
    });
    const joined = await secondClient.joinRoom({
      inviteToken: created.room.inviteToken ?? '',
      displayName: 'Bo',
      now: '2026-06-15T09:01:00.000Z',
    });

    expect(created.room).toMatchObject({ name: 'Saturday nine' });
    expect(created.room.inviteToken).toMatch(/^invite-/);
    expect(joined.room).toEqual(created.room);
    expect(joined.participant.displayName).toBe('Bo');
  });

  it('makes appended shot pins visible to another client without local or session storage', async () => {
    const backend = createSharedRoomBackend();
    const firstClient = createRoomRepository(backend);
    const secondClient = createRoomRepository(backend);
    const { room, participant } = await firstClient.createRoom({
      name: 'Back nine',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:00:00.000Z',
    });

    const firstPin = await firstClient.createPin({
      roomId: room.id,
      participantId: participant.id,
      participantName: participant.displayName,
      emoji: '🏌️',
      comment: 'Safe layup near the left edge',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:02:00.000Z',
    });
    const secondPin = await secondClient.createPin({
      roomId: room.id,
      participantId: 'participant-guest',
      participantName: 'Bo',
      emoji: '🌲',
      comment: 'Tree trouble but playable',
      lat: 37.4221,
      lng: -122.0844,
      now: '2026-06-15T09:03:00.000Z',
    });

    await expect(secondClient.listPins(room.id)).resolves.toEqual([firstPin, secondPin]);
    await expect(firstClient.listPins(room.id)).resolves.toEqual([firstPin, secondPin]);
    expect(globalThis.localStorage).toBeUndefined();
    expect(globalThis.sessionStorage).toBeUndefined();
  });

  it('returns snapshots so callers cannot mutate append-only backend history', async () => {
    const backend = createSharedRoomBackend();
    const repository = createRoomRepository(backend);
    const { room, participant } = await repository.createRoom({
      name: 'Snapshot round',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:00:00.000Z',
    });
    const pin = await repository.createPin({
      roomId: room.id,
      participantId: participant.id,
      participantName: participant.displayName,
      emoji: '✅',
      comment: 'First pin remains first',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:04:00.000Z',
    });

    const listedPins = await repository.listPins(room.id);
    (listedPins as ShotPinForMutation[]).push({ ...pin, id: 'mutated-pin' });

    await expect(repository.listPins(room.id)).resolves.toEqual([pin]);
  });
});

type ShotPinForMutation = Awaited<ReturnType<ReturnType<typeof createRoomRepository>['listPins']>>[number];
