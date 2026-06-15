# G005 field-readiness and fallback assessment

This assessment supports `G005-integration-e2e-field-readiness` without mutating `.omx/ultragoal` state. It reviews whether the current MVP surface is ready for field validation with private invite rooms, approximate GPS/course context, and lightweight shot pins.

## Readiness verdict

**Conditionally field-ready for a controlled friend-room trial.** The current implementation is appropriate for casual validation when testers understand that all distances and positions are approximate, invite tokens act as share links, and the room backend is still an in-app provider-neutral boundary rather than deployed hosted persistence.

## Checks covered

- **Approximate/privacy copy:** product copy says distances are approximate GPS estimates, not official measuring-device, safety-critical, or rangefinder-grade output. Location is requested only at point of use and sharing remains scoped to invite-link rooms.
- **Two-device sharing readiness:** the room API/repository contract allows two independent clients against the same backend to create/join a room and observe appended pins in stable order. This supports the product behavior needed for two-browser-context validation.
- **Outdoor use risks:** UI copy and acceptance docs preserve one-handed, outdoor-readable, low-typing principles, but real brightness/glove/wet-screen validation still requires on-course testing.
- **Fallback without upload first:** current GPS, tapped target, and manual coordinate sources provide fallback shot-pin creation before introducing uploaded course maps.
- **Non-goal absence:** scorecards, betting/settlement, public feed/discovery, official rulings, live tracking, and rangefinder-grade precision remain outside the MVP.

## Uploaded course-map fallback trigger assessment

Do **not** add uploaded course maps as the default MVP path. Treat upload/calibration as a later fallback only if field trials show that the provider-neutral satellite/GPS/manual-target approach is not useful enough.

Fallback triggers that justify revisiting uploaded course maps:

1. Repeated field tests cannot align sample/manual targets with visible course context closely enough for casual shot-pin orientation.
2. Browser GPS accuracy remains too poor or unavailable across common outdoor devices even with manual/tapped fallback.
3. Target setup for a course cannot be completed from visible map/course context without an operator-supplied image or diagram.
4. A private facility lacks usable public imagery or provider coverage for the holes under test.

If a trigger fires, the next design must define image source rights, calibration UX, privacy/storage rules, offline behavior, and a provider-neutral adapter boundary before implementation.

## Documentation gaps / follow-ups

- Record a real two-device browser smoke result once the app is served from a reachable dev/staging URL.
- Record on-course readability findings under bright sun and poor network conditions.
- Decide hosted persistence only through a later provider-selection goal; do not infer readiness from the in-memory backend alone.
