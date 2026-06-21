export const productPrinciples = [
  'One-handed, outdoor-readable swing lab.',
  'Profile-aware distance feel and swing context stay approximate by design.',
  'Manual scenario inputs drive deterministic analysis cards.',
  'Pseudo-3D motion values stay parameterized and dependency-free.',
] as const;

export const nonGoals = [
  'No backend, hosted persistence, database, API server, or remote sync.',
  'No authentication, accounts, invite rooms, multiplayer, or shared state.',
  'No GPS, browser geolocation, maps, map tiles, weather feeds, forecasts, or location permissions.',
  'No scorecards, betting, public social feed, followers, or discovery.',
  'No rulings, rules advice, precision promises, or prescriptive instruction panels.',
] as const;

export const privacyNotes = [
  'Saved profiles stay in local device storage only when the browser provides it.',
  'Manual shot context stays in React state unless a profile is saved locally.',
  'The prototype does not create remote accounts or transmit player context.',
] as const;

export const approximateDistanceCopy =
  'Distance feel uses approximate practice estimates shaped by player profile and manual shot conditions.';
