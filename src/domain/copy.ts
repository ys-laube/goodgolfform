export const productPrinciples = [
  'One-handed, outdoor-readable round companion.',
  'Profile-aware distance feel and swing context stay approximate by design.',
  'Invite-link rooms for friends, not public discovery.',
  'Shot pins stay playful and lightweight.',
] as const;

export const nonGoals = [
  'No rulings, scoring judgments, or rules-advice workflow.',
  'No scorecards, betting, or settlement flows.',
  'No public social feed, search, followers, or discovery.',
  'No precision-promise panel or measuring-device workflow.',
  'No map-provider-specific SDK coupling in the foundation.',
] as const;

export const privacyNotes = [
  'Location permission should be requested only when a round feature needs it.',
  'MVP sharing is scoped to invite-link rooms.',
  'Shared persistence is MVP-critical later, but this foundation does not implement backend storage.',
] as const;

export const approximateDistanceDisclaimer =
  'Distance feel uses approximate practice estimates shaped by player profile, course context, and conditions.';
