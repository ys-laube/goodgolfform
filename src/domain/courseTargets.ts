import type { CourseTarget } from './models';

export const sampleRoomId = 'sample-round-room';

export const sampleCourseTargets: readonly CourseTarget[] = [
  {
    id: 'sample-tee-1',
    roomId: sampleRoomId,
    type: 'tee',
    label: 'Pebble sample tee box',
    lat: 36.56844,
    lng: -121.95094,
  },
  {
    id: 'sample-green-1',
    roomId: sampleRoomId,
    type: 'green',
    label: 'Pebble sample green',
    lat: 36.56916,
    lng: -121.94993,
  },
  {
    id: 'sample-hazard-1',
    roomId: sampleRoomId,
    type: 'hazard',
    label: 'Sample fairway bunker',
    lat: 36.56882,
    lng: -121.95034,
  },
  {
    id: 'sample-custom-layup',
    roomId: sampleRoomId,
    type: 'custom',
    label: 'Manual layup marker',
    lat: 36.56898,
    lng: -121.95058,
  },
] as const;

export function createManualCourseTarget(input: {
  readonly roomId: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly id?: string;
}): CourseTarget {
  return {
    id: input.id ?? `manual-${slugify(input.label)}`,
    roomId: input.roomId,
    type: 'custom',
    label: input.label,
    lat: input.lat,
    lng: input.lng,
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'target';
}
