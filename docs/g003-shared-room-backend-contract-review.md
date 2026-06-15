# G003 Shared Room Backend Contract Review

This review captures the minimal backend boundary for `G003-shared-room-backend` without mutating `.omx/ultragoal` state or selecting a hosted backend provider.

## Minimal RoomRepository API

The shared-room persistence surface should stay app-owned and provider-neutral:

- `createRoom(input)` creates a private invite-link room and returns app-owned room data with an opaque `id` and join token/link material.
- `joinRoom(input)` validates a room id/token pair and returns the joined room plus participant-scoped identity data.
- `createPin(input)` appends a new shot pin for an existing room/participant and returns the persisted pin.
- `listPins(roomId)` returns the room's persisted pins in stable append order.

The repository boundary should accept and return existing domain concepts (`RoundRoom`, `Participant`, `ShotPin`, coordinates, timestamps) rather than provider SDK records, auth sessions, or browser storage handles.

## Required behavior

- **Room create/join:** room ids and invite tokens are opaque; callers should not infer provider, database, or local-storage details from them.
- **Second-client visibility:** two independently constructed clients/repositories that point at the same backend seed/state must observe the same room pins after create/list operations.
- **No shared local/session dependency:** correctness must not require `localStorage`, `sessionStorage`, in-memory browser globals, or React component state shared between clients.
- **Loose freshness:** reads may be request/refresh based; live subscriptions and real-time cursor guarantees are not required for G003.
- **Append-only pins:** creating a shot pin adds a new immutable record; update/delete/edit/replace behavior is out of scope.
- **Validation:** reject blank room names, blank participant names, missing/invalid room tokens, invalid coordinates, blank/oversized emoji or comments, and pins for unknown rooms/participants.

## Non-goals and provider boundaries

- Do not add Supabase, Firebase, GraphQL, REST client, database SDK, or auth-provider packages in G003 unless a later provider-selection goal explicitly approves it.
- Do not couple the domain contract to map providers, geolocation providers, browser storage, cookies, or public discovery/search flows.
- Do not write worker-owned Ultragoal checkpoints or mutate `.omx/ultragoal`; leader checkpointing owns that state.

## Integration checklist

- [ ] Room create and join are covered by tests.
- [ ] Pin create/list is covered by tests, including append order.
- [ ] A second independently constructed client can list a pin created by the first client.
- [ ] Tests demonstrate no reliance on shared local/session storage.
- [ ] Invalid input cases reject before persistence.
- [ ] `package.json` remains free of backend provider SDK dependencies.


## G007 hardening update

Final review required the shared-room boundary to stop trusting client-supplied participant names and sequential ids. The RoomRepository now issues opaque room/invite/participant/member tokens, derives participant names server-side, and requires membership credentials for pin create/list/snapshot calls. The React app can target a hosted Room API with `VITE_ROOM_API_BASE_URL`; the in-memory handler remains a local demo/test adapter only.
