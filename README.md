# FunGolf Shot Pins

FunGolf is a mobile-first TypeScript web app foundation for a friendly golf round companion. The product direction is a browser-shareable field assistant where friends can create invite-link round rooms, use approximate GPS context, and drop lightweight emoji shot pins during a round.

## G001 foundation scope

This foundation includes:

- Vite + React + TypeScript app shell optimized for mobile-first layout.
- Product copy for concept, privacy boundaries, and approximate-distance boundaries.
- Domain model types for rooms, participants, course targets, location samples, and shot pins.
- Baseline Vitest, TypeScript, ESLint, and production build scripts.
- A real raster tile map surface for golf-course context, rendered without a map SDK dependency.
- A provider-neutral Room API/repository boundary now exists for invite-link rooms and shot pins. The default local demo adapter is in-memory and single-process; production sharing should set `VITE_ROOM_API_BASE_URL` to a hosted Room API using the same Fetch-style contract.

Shared persistence is MVP-critical. The current code separates the client from the Room API contract and keeps the local in-memory adapter as a demo/test fixture, not a hosted persistence substitute.

## Concept

The app is designed for friends playing together, not public social discovery. The MVP lets a player create or join a round room by invite token, view approximate current-location context, and add playful shot pins visible to room participants.

## Non-goals

- No official rules, rulings, or rules advice.
- No scorecards, betting, settlement, or wagering flows.
- No public social feed, search, followers, or discovery.
- No rangefinder-grade precision promises.
- No provider-specific map SDK coupling in this foundation; raster tiles stay behind a URL-template boundary.
- No client-trusted participant identity: room pin reads/writes require opaque membership credentials issued by the Room API.

## Privacy and location disclaimer

FunGolf should request location permission only when a round feature needs it. MVP sharing is scoped to invite-link rooms. Distances and positions are approximate GPS estimates for friendly play context only; they are not official measuring-device, rangefinder-grade, or safety-critical output.

## Setup

```bash
npm install
npm run dev
# optional: point the app at a hosted/shared Room API
VITE_ROOM_API_BASE_URL=https://your-room-api.example npm run dev
# optional: point map tiles at another raster tile provider/template
VITE_MAP_TILE_URL_TEMPLATE=https://tile.openstreetmap.org/{z}/{x}/{y}.png npm run dev
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
- The visible map uses a raster tile URL-template boundary. Keep any future map SDK, provider keys, quota, billing, and regional coverage decisions behind that adapter boundary.
- Preserve mobile field use: large touch targets, low typing, outdoor-readable contrast, and graceful denied/unavailable location states.

## Room API boundary

The app uses a Fetch-style `RoomApiClient`. If `VITE_ROOM_API_BASE_URL` is set, the UI talks to that remote endpoint. Without it, the app uses a local in-memory demo handler so tests and local previews remain dependency-free. Invite tokens, room ids, participant ids, and member tokens are opaque random identifiers; pin creation and pin reads require the issued membership token.
