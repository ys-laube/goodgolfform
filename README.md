# FunGolf Korean Caddie Card

FunGolf is a mobile-first Korean web app prototype for serious golfers who want a fast field-side shot card. It lets a player enter manual shot context, load or save local club-distance presets, and read four named Korean result panels: 클럽 선택이유, 조준 방향 이유, 목표 탄도 이유, 미스 경고 코멘트, plus one evidence-based 2D setup visual with top-down stance and rear lie views.

## Current scope

This prototype includes:

- Vite + React + TypeScript app shell optimized for one-hand mobile use.
- Locally saved club-distance presets stored on the current device only.
- Manual shot inputs for remaining distance, lie, front-back slope, ball position height, wind, pin, and green risk.
- A deterministic Korean caddie prescription presented through the four named result panels.
- An evidence-based 2D setup visual for top-down stance/ball position, handedness, and rear-view lie/slope relationships without trajectory arcs, wind markers, 3D, maps, backend, weather, or provider SDK dependencies.
- Vitest, TypeScript, ESLint, and production build scripts.

## Setup visual evidence mapping

- Club setup uses a five-group ball-position model: driver near the lead-foot instep, fairway woods forward of center, long irons slightly forward, mid irons near center, and short irons/wedges slightly back toward the trail side.
- Lie setup separates front-back slope from sidehill relation: 오르막/내리막 changes the rear-view ground line, while 공이 발보다 높음/낮음 changes the ball position relative to the foot plane.
- The visual is intentionally a lightweight 2D setup guide. It does not add a 3D runtime, swing animation, GPS/map/weather data, or a second recommendation engine.

## Explicit non-goals

- No backend, hosted persistence, database, 응용 인터페이스 server, or remote sync.
- No authentication, accounts, invite rooms, multiplayer, or shared state.
- No 위치 자동 인식, browser geolocation, maps, map tiles, weather integrations, forecasts, or location permissions.
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
