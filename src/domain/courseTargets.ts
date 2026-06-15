import type { CourseTarget } from './models';

export const sampleRoomId = 'sample-round-room';

export const sampleCourseTargets: readonly CourseTarget[] = [
  {
    id: 'sample-tee-1',
    roomId: sampleRoomId,
    type: 'tee',
    label: 'Hole 1 tee box',
    lat: 37.42194,
    lng: -122.08403,
  },
  {
    id: 'sample-green-1',
    roomId: sampleRoomId,
    type: 'green',
    label: 'Hole 1 front green',
    lat: 37.42312,
    lng: -122.08523,
  },
  {
    id: 'sample-hazard-1',
    roomId: sampleRoomId,
    type: 'hazard',
    label: 'Left fairway bunker',
    lat: 37.42256,
    lng: -122.08482,
  },
  {
    id: 'sample-custom-layup',
    roomId: sampleRoomId,
    type: 'custom',
    label: 'Manual layup marker',
    lat: 37.42282,
    lng: -122.08443,
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
