export type FieldReadinessStatus = 'ready' | 'conditional' | 'blocked';

export type ReadinessCheck = {
  readonly id: string;
  readonly status: FieldReadinessStatus;
  readonly evidence: string;
};

export type CourseMapFallbackTrigger = {
  readonly id: string;
  readonly trigger: string;
  readonly requiredBeforeBuild: readonly string[];
};

export const g005ReadinessChecks: readonly ReadinessCheck[] = [
  {
    id: 'approximate-privacy-copy',
    status: 'ready',
    evidence: 'Copy frames GPS distances as approximate, private invite-link room context rather than official output.',
  },
  {
    id: 'two-device-sharing-contract',
    status: 'ready',
    evidence: 'Room API clients that share a backend can create/join a room and observe appended pins in order.',
  },
  {
    id: 'outdoor-use-risk',
    status: 'conditional',
    evidence: 'One-handed outdoor-readable UX is documented, but brightness/network/device validation needs field testing.',
  },
  {
    id: 'non-goal-absence',
    status: 'ready',
    evidence: 'Scorecards, betting, public discovery, official rulings, live tracking, and precision claims stay out of scope.',
  },
  {
    id: 'uploaded-course-map-fallback',
    status: 'conditional',
    evidence: 'Uploaded course maps are a later fallback only after GPS/satellite/manual-target usefulness fails in field trials.',
  },
] as const;

export const uploadedCourseMapFallbackTriggers: readonly CourseMapFallbackTrigger[] = [
  {
    id: 'poor-target-alignment',
    trigger: 'Manual or sampled targets cannot be aligned with visible course context closely enough for casual orientation.',
    requiredBeforeBuild: ['field trial notes', 'calibration UX sketch', 'image source rights decision'],
  },
  {
    id: 'gps-unusable',
    trigger: 'Browser GPS is denied, unavailable, or too inaccurate across common outdoor devices despite manual/tapped fallback.',
    requiredBeforeBuild: ['device accuracy logs', 'manual fallback failure examples', 'privacy/storage decision'],
  },
  {
    id: 'missing-provider-coverage',
    trigger: 'The course or facility under test lacks usable public imagery or provider map coverage.',
    requiredBeforeBuild: ['affected course evidence', 'offline behavior decision', 'provider-neutral adapter boundary'],
  },
] as const;
