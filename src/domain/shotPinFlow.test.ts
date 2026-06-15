import { describe, expect, it } from 'vitest';
import { buildShotPinInput, normalizeShotPinComment, shotPinCategories } from './shotPinFlow';
import type { RoomMembership } from './roomRepository';

const membership: RoomMembership = {
  room: {
    id: 'room-1',
    name: 'Mobile nine',
    createdAt: '2026-06-15T09:00:00.000Z',
    inviteToken: 'invite-1',
  },
  participant: {
    id: 'participant-1',
    displayName: 'Ari',
    joinedAt: '2026-06-15T09:00:00.000Z',
  },
};

describe('mobile shot pin flow', () => {
  it('offers playful emoji/comment categories without score, social, betting, or rules concepts', () => {
    expect(shotPinCategories.map((category) => category.id)).toEqual(['shot', 'lie', 'target', 'note']);
    expect(shotPinCategories.map((category) => category.emoji)).toEqual(['🏌️', '🌲', '⛳', '💬']);
    expect(JSON.stringify(shotPinCategories)).not.toMatch(/score|bet|wager|rules|follower|feed/i);
  });

  it('builds current-location shot pins for the G003 createPin boundary', () => {
    expect(
      buildShotPinInput({
        membership,
        source: 'current',
        category: 'shot',
        comment: 'Flushed seven iron',
        currentLocation: {
          lat: 37.42194,
          lng: -122.08403,
          accuracyMeters: 18,
          timestamp: '2026-06-15T09:02:00.000Z',
        },
        now: '2026-06-15T09:03:00.000Z',
      }),
    ).toEqual({
      roomId: 'room-1',
      participantId: 'participant-1',
      participantName: 'Ari',
      category: 'shot',
      emoji: '🏌️',
      comment: 'Flushed seven iron',
      lat: 37.42194,
      lng: -122.08403,
      now: '2026-06-15T09:03:00.000Z',
    });
  });

  it('supports tapped and manual coordinates with safe category fallback copy', () => {
    expect(
      buildShotPinInput({
        membership,
        source: 'tapped',
        category: 'target',
        comment: ' ',
        tappedLocation: { lat: 37.42312, lng: -122.08523 },
      }),
    ).toMatchObject({ category: 'target', emoji: '⛳', comment: 'Aim point, green, or safe miss' });

    expect(
      buildShotPinInput({
        membership,
        source: 'manual',
        category: 'lie',
        comment: 'Punch out window',
        manualLocation: { lat: 37.42256, lng: -122.08482 },
      }),
    ).toMatchObject({ category: 'lie', emoji: '🌲', comment: 'Punch out window' });
  });

  it('fails fast when a requested quick-pin location source is unavailable', () => {
    expect(() =>
      buildShotPinInput({
        membership,
        source: 'current',
        category: 'note',
        comment: '',
      }),
    ).toThrow(/current shot pin location is unavailable/i);
  });

  it('normalizes blank comments to the selected outdoor-readable hint', () => {
    expect(normalizeShotPinComment('', shotPinCategories[3])).toBe('Friendly round note');
  });
});
