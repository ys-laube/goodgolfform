import type { Coordinate, LocationSample, ShotPinCategory } from './models';
import type { CreateShotPinInput, RoomMembership } from './roomRepository';

export type ShotPinLocationSource = 'current' | 'tapped' | 'manual';

export type ShotPinCategoryOption = {
  readonly id: ShotPinCategory;
  readonly label: string;
  readonly emoji: string;
  readonly commentHint: string;
};

export const shotPinCategories: readonly ShotPinCategoryOption[] = [
  { id: 'shot', label: 'Shot', emoji: '🏌️', commentHint: 'Good swing or memorable contact' },
  { id: 'lie', label: 'Lie', emoji: '🌲', commentHint: 'Tree, rough, sand, or awkward stance' },
  { id: 'target', label: 'Target', emoji: '⛳', commentHint: 'Aim point, green, or safe miss' },
  { id: 'note', label: 'Note', emoji: '💬', commentHint: 'Friendly round note' },
] as const;

export type BuildShotPinInput = {
  readonly membership: RoomMembership;
  readonly category: ShotPinCategory;
  readonly comment: string;
  readonly source: ShotPinLocationSource;
  readonly currentLocation?: LocationSample;
  readonly tappedLocation?: Coordinate;
  readonly manualLocation?: Coordinate;
  readonly now?: string;
};

export function buildShotPinInput(input: BuildShotPinInput): CreateShotPinInput {
  const category = findShotPinCategory(input.category);
  const coordinate = resolveShotPinCoordinate(input);

  return {
    roomId: input.membership.room.id,
    participantId: input.membership.participant.id,
    participantName: input.membership.participant.displayName,
    category: category.id,
    emoji: category.emoji,
    comment: normalizeShotPinComment(input.comment, category),
    lat: coordinate.lat,
    lng: coordinate.lng,
    now: input.now,
  };
}

export function findShotPinCategory(category: ShotPinCategory): ShotPinCategoryOption {
  return shotPinCategories.find((option) => option.id === category) ?? shotPinCategories[0];
}

export function normalizeShotPinComment(comment: string, category: ShotPinCategoryOption): string {
  const trimmed = comment.trim();
  return trimmed || category.commentHint;
}

function resolveShotPinCoordinate(input: BuildShotPinInput): Coordinate {
  if (input.source === 'current' && input.currentLocation) {
    return { lat: input.currentLocation.lat, lng: input.currentLocation.lng };
  }

  if (input.source === 'tapped' && input.tappedLocation) {
    return input.tappedLocation;
  }

  if (input.source === 'manual' && input.manualLocation) {
    return input.manualLocation;
  }

  throw new Error(`${input.source} shot pin location is unavailable.`);
}
