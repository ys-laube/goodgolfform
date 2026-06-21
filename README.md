# FunGolf Swing Lab

FunGolf is a mobile-first TypeScript web app prototype for a serious golf swing lab. It lets a player choose or save a local profile, enter manual shot context, and view a deterministic analysis card plus parameterized pseudo-3D motion values.

## Current scope

This prototype includes:

- Vite + React + TypeScript app shell optimized for mobile-first layout.
- Built-in and locally saved swing profiles stored on the current device only.
- Manual scenario inputs for distance, wind, lie, and desired shot window.
- A deterministic recommendation engine for club distance feel, swing size, tempo, path bias, trajectory strategy, confidence, and explanatory adjustments.
- Motion-parameter mapping for a pseudo-3D swing viewer without WebGL, map, backend, or provider SDK dependencies.
- Vitest, TypeScript, ESLint, and production build scripts.

## Explicit non-goals

- No backend, hosted persistence, database, API server, or remote sync.
- No authentication, accounts, invite rooms, multiplayer, or shared state.
- No GPS, browser geolocation, maps, map tiles, weather feeds, forecasts, or location permissions.
- No scorecards, betting, public social feed, followers, or discovery.
- No official rules, rulings, rangefinder-grade precision promises, or command-style coaching.

## Local storage boundary

Saved profiles use browser `localStorage` when it is available. That storage is device-local only; the app has no remote account or shared persistence layer.

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
