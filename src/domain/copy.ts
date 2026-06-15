export const productPrinciples = [
  'One-handed, outdoor-readable round companion.',
  'Approximate GPS distances only; never official rangefinder output.',
  'Invite-link rooms for friends, not public discovery.',
  'Shot pins stay playful and lightweight.',
] as const;

export const nonGoals = [
  'No official rulings or rules advice.',
  'No scorecards, betting, or settlement flows.',
  'No public social feed, search, followers, or discovery.',
  'No rangefinder-grade precision promises.',
  'No map-provider-specific SDK coupling in the foundation.',
] as const;

export const privacyNotes = [
  'Location permission should be requested only when a round feature needs it.',
  'MVP sharing is scoped to invite-link rooms.',
  'Shared persistence is MVP-critical later, but this foundation does not implement backend storage.',
] as const;

export const approximateDistanceDisclaimer =
  'Distances and positions are approximate GPS estimates for friendly play context only, not official measuring-device or safety-critical output.';
