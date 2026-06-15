# G004 mobile UX and acceptance review

This review supports `G004-shot-pins-mobile-ux` without mutating `.omx/ultragoal` state or taking over the implementation lane. It defines the mobile field UX checks that the implementation should satisfy on top of the G003 `RoomRepository`/API boundary.

## Mobile field flow acceptance checklist

- **Room flow clarity:** players can create an invite-link round room, see that the room is private to invited friends, and join from an invite without public discovery, followers, feeds, betting, scoring, or official-rules language.
- **Quick shot-pin creation:** the primary mobile action supports adding a shot pin from current GPS when available, a tapped course/map coordinate, or a manually entered fallback coordinate/target when GPS is denied or unavailable.
- **Shot-pin content:** each pin stores one lightweight emoji plus a short comment, participant identity, approximate coordinate, and creation time through the existing room pin boundary.
- **Outdoor readability:** controls remain one-handed and high-contrast with large touch targets, low typing, and readable status/error copy in bright field conditions.
- **Approximate/privacy copy:** location and distance copy stays approximate-by-design, shows GPS accuracy when known, asks for location only at the point of use, and keeps sharing scoped to invite-link rooms.
- **Freshness and sync:** pins are append-only and visible to another room participant through `listPins`/`listPinSnapshot` without promising live tracking or exact real-time presence.

## Current branch review notes

- Existing G001/G002 copy already covers approximate GPS, non-official use, invite-link privacy, and mobile/outdoor principles.
- Existing G003 repository/API tests cover room create/join, append-only pins, second-client visibility, and provider-neutral persistence boundaries.
- The current app shell does not yet expose the final G004 room join/create UI or three-source pin creation controls; those remain implementation acceptance items for the owner of the UI lane.

## Non-goals to preserve

- No public social graph, search, feed, followers, or discovery.
- No betting, scorecards, settlement, tournament rulings, or official rules advice.
- No rangefinder-grade precision, safety-critical output, or exact live tracking promise.
- No provider-specific map/backend SDK coupling unless a later provider-selection goal explicitly approves it.
