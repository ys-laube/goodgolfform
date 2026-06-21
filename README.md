# FunGolf Korean Caddie Card

FunGolf is a mobile-first Korean web app prototype for serious golfers who want a fast field-side shot card. It lets a player enter manual shot context, load or save local club-distance presets, and read a result-first Korean recommendation with four short reasons and one static shot dashboard.

## Current scope

This prototype includes:

- Vite + React + TypeScript app shell optimized for one-hand mobile use.
- Locally saved club-distance presets stored on the current device only.
- Manual shot inputs for remaining distance, lie, front-back slope, ball position height, wind, pin, and green risk.
- A deterministic Korean caddie prescription for club, swing percent, aim, trajectory, and miss warning.
- A static shot dashboard for target line, ball position, wind, trajectory, and recommendation cues without 3D, maps, backend, weather, or provider SDK dependencies.
- Vitest, TypeScript, ESLint, and production build scripts.

## Explicit non-goals

- No backend, hosted persistence, database, 응용 인터페이스 server, or remote sync.
- No authentication, accounts, invite rooms, multiplayer, or shared state.
- No 위치 자동 인식, browser geolocation, maps, map tiles, weather feeds, forecasts, or location permissions.
- No scorecards, betting, public social feed, followers, or discovery.
- No rulings, rules advice, precision promises, 3D motion viewer, or English core UI.

## Local storage boundary

Saved distance presets stay in browser `localStorage` when it is available. That storage is device-local only; the app has no remote account or shared persistence layer.

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
