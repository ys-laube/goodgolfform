import { describe, expect, it } from 'vitest';
import { approximateDistanceDisclaimer, nonGoals, privacyNotes, productPrinciples } from './copy';
import { g005ReadinessChecks, uploadedCourseMapFallbackTriggers } from './fieldReadiness';
import { buildShotPinInput } from './shotPinFlow';
import { createRoomApiClient, createRoomApiHandler } from './roomApi';
import { createRoomRepository, createSharedRoomBackend } from './roomRepository';

describe('G005 field-readiness contract', () => {
  it('keeps field copy approximate, private, outdoor-oriented, and clear of non-goals', () => {
    const joinedCopy = [
      approximateDistanceDisclaimer,
      ...privacyNotes,
      ...productPrinciples,
      ...nonGoals,
      ...g005ReadinessChecks.map((check) => check.evidence),
    ].join(' ');

    expect(joinedCopy).toMatch(/approximate GPS/i);
    expect(joinedCopy).toMatch(/invite-link room/i);
    expect(joinedCopy).toMatch(/one-handed outdoor-readable/i);
    expect(joinedCopy).toMatch(/not official|official rulings/i);
    expect(joinedCopy).toMatch(/safety-critical/i);
    expect(joinedCopy).toMatch(/No scorecards, betting/i);
    expect(joinedCopy).toMatch(/No public social feed/i);
    expect(joinedCopy).toMatch(/rangefinder-grade/i);
    expect(joinedCopy).not.toMatch(/live tracking is ready/i);
  });

  it('supports two independent browser-style clients sharing room pins through the API boundary', async () => {
    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    const firstBrowser = createRoomApiClient({ baseUrl: 'https://fungolf.field', fetch: handler });
    const secondBrowser = createRoomApiClient({ baseUrl: 'https://fungolf.field', fetch: handler });

    const host = await firstBrowser.createRoom({
      name: 'Field readiness round',
      hostDisplayName: 'Host',
      now: '2026-06-15T10:00:00.000Z',
    });
    const guest = await secondBrowser.joinRoom({
      inviteToken: host.room.inviteToken ?? '',
      displayName: 'Guest',
      now: '2026-06-15T10:01:00.000Z',
    });

    const hostPin = await firstBrowser.createPin({
      roomId: host.room.id,
      participantId: host.participant.id,
      participantName: host.participant.displayName,
      emoji: '🏌️',
      comment: 'Approx host pin',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T10:02:00.000Z',
    });
    const guestPin = await secondBrowser.createPin({
      roomId: guest.room.id,
      participantId: guest.participant.id,
      participantName: guest.participant.displayName,
      emoji: '⛳',
      comment: 'Approx guest pin',
      lat: 37.4222,
      lng: -122.0844,
      now: '2026-06-15T10:03:00.000Z',
    });

    await expect(firstBrowser.listPins(host.room.id)).resolves.toEqual([hostPin, guestPin]);
    await expect(secondBrowser.listPins(host.room.id)).resolves.toEqual([hostPin, guestPin]);
  });

  it('keeps manual/tapped fallback available before uploaded course-map work is justified', () => {
    const membership = {
      room: { id: 'room-field', name: 'Field round', createdAt: '2026-06-15T10:00:00.000Z', inviteToken: 'invite-field' },
      participant: { id: 'participant-field', displayName: 'Field tester', joinedAt: '2026-06-15T10:00:00.000Z' },
    };

    expect(
      buildShotPinInput({
        membership,
        source: 'manual',
        category: 'note',
        comment: 'Manual fallback when GPS is denied',
        manualLocation: { lat: 37.4215, lng: -122.0847 },
      }),
    ).toMatchObject({
      roomId: 'room-field',
      participantId: 'participant-field',
      lat: 37.4215,
      lng: -122.0847,
      comment: 'Manual fallback when GPS is denied',
    });

    expect(uploadedCourseMapFallbackTriggers).toHaveLength(3);
    expect(uploadedCourseMapFallbackTriggers.map((trigger) => trigger.trigger).join(' ')).toMatch(
      /despite manual\/tapped fallback|lacks usable public imagery/i,
    );
    expect(
      g005ReadinessChecks.find((check) => check.id === 'uploaded-course-map-fallback'),
    ).toMatchObject({ status: 'conditional' });
  });
});
