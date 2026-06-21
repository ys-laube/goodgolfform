import { describe, expect, it } from 'vitest';
import { approximateDistanceDisclaimer, nonGoals, privacyNotes, productPrinciples } from './copy';
import { createRoomRepository, createSharedRoomBackend, type CreateShotPinInput } from './roomRepository';

describe('G004 mobile shot-pin UX acceptance contract', () => {
  it('supports shot pins from current, tapped, and manual location sources through the shared room boundary', async () => {
    const repository = createRoomRepository(createSharedRoomBackend());
    const membership = await repository.createRoom({
      name: 'Mobile field round',
      hostDisplayName: 'Ari',
      now: '2026-06-15T09:00:00.000Z',
    });

    const pinDrafts = [
      { source: 'current GPS', emoji: '🏌️', comment: 'Good drive from current spot', lat: 37.4219, lng: -122.084 },
      { source: 'tapped map', emoji: '⛳', comment: 'Tap near the green', lat: 37.4224, lng: -122.0834 },
      { source: 'manual fallback', emoji: '🌲', comment: 'Manual note by tree line', lat: 37.4214, lng: -122.0846 },
    ] as const;

    const createdPins = await Promise.all(
      pinDrafts.map((draft, index) => {
        const input: CreateShotPinInput = {
          roomId: membership.room.id,
          participantId: membership.participant.id,
          memberToken: membership.memberToken,
          emoji: draft.emoji,
          comment: draft.comment,
          lat: draft.lat,
          lng: draft.lng,
          now: `2026-06-15T09:0${index + 1}:00.000Z`,
        };
        return repository.createPin(input);
      }),
    );

    await expect(repository.listPins(membership)).resolves.toEqual(createdPins);
    expect(createdPins.map((pin) => `${pin.emoji} ${pin.comment}`)).toEqual(
      pinDrafts.map((draft) => `${draft.emoji} ${draft.comment}`),
    );
    expect(pinDrafts.map((draft) => draft.source)).toEqual(['current GPS', 'tapped map', 'manual fallback']);
  });

  it('keeps mobile UX copy approximate, private, playful, and out of non-goal product areas', () => {
    expect(productPrinciples.join(' ')).toMatch(/One-handed, outdoor-readable/i);
    expect(productPrinciples.join(' ')).toMatch(/Shot pins stay playful/i);
    expect(privacyNotes.join(' ')).toMatch(/invite-link rooms/i);
    expect(approximateDistanceDisclaimer).toMatch(/approximate practice estimates/i);
    expect(approximateDistanceDisclaimer).not.toMatch(/official|rangefinder|disclaimer/i);
    expect(nonGoals.join(' ')).toMatch(/No public social feed/i);
    expect(nonGoals.join(' ')).toMatch(/No scorecards, betting/i);
    expect(nonGoals.join(' ')).toMatch(/No rulings/i);
  });
});
