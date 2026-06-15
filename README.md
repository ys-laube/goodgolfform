# FunGolf Shot Pins

FunGolf is a mobile-first TypeScript web app foundation for a friendly golf round companion. The product direction is a browser-shareable field assistant where friends can create invite-link round rooms, use approximate GPS context, and drop lightweight emoji shot pins during a round.

## G001 foundation scope

This foundation includes:

- Vite + React + TypeScript app shell optimized for mobile-first layout.
- Product copy for concept, privacy boundaries, and approximate-distance disclaimers.
- Domain model types for rooms, participants, course targets, location samples, and shot pins.
- Baseline Vitest, TypeScript, ESLint, and production build scripts.
- No map provider, map SDK, backend, or shared persistence implementation yet.

Shared persistence is MVP-critical for later goals, but it is intentionally not implemented in G001.

## Concept

The app is designed for friends playing together, not public social discovery. A later MVP should let a player create or join a round room by URL, view approximate current-location context, and add playful shot pins visible to room participants.

## Non-goals

- No official rules, rulings, or rules advice.
- No scorecards, betting, settlement, or wagering flows.
- No public social feed, search, followers, or discovery.
- No rangefinder-grade precision promises.
- No provider-specific map coupling in this foundation.

## Privacy and location disclaimer

FunGolf should request location permission only when a round feature needs it. MVP sharing is scoped to invite-link rooms. Distances and positions are approximate GPS estimates for friendly play context only; they are not official measuring-device, rangefinder-grade, or safety-critical output.

## Setup

```bash
npm install
npm run dev
```

## Verification scripts

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Development notes

- Browser geolocation requires a secure context outside localhost; document provider and HTTPS requirements when geolocation work begins.
- Keep future map integration behind an adapter boundary so provider keys, quota, billing, and regional coverage can be evaluated without locking the app shell to one SDK.
- Preserve mobile field use: large touch targets, low typing, outdoor-readable contrast, and graceful denied/unavailable location states.
