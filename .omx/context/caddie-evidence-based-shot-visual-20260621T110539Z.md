# Context Snapshot: caddie evidence-based shot visual

## Task statement
User invoked deep-interview to substantially revise the prescription result visual because the current reactive picture feels ungrounded. They want the visual based on golf professional papers/materials.

## Desired outcome
Replace current rootless visual with evidence-backed golf setup graphics focused on ball position, stance, and lie. User specifically requested removing blue trajectory arc and wind marker, adding top-down view, rear view, and possibly an integrated rotatable 3D model.

## Stated solution
1. Delete blue trajectory arc and wind marker from the drawing.
2. Top-down view: right-handed golfer stance with feet and recommended ball position for selected club. Mid irons around center; long irons/driver progressively toward lead/left foot.
3. Rear view: visualize lie/slope. For uphill, right-handed golfer rear-view should show lead/left side higher if target is to golfer's left/lead side depending on convention.
4. Show top/rear/side views together; ideal end state might be a rotatable 3D golfer/lie setup.

## Current code evidence
- `src/App.tsx` renders `.shot-visual-stage` with spans for aim line, arc, feet, stance, ball, wind.
- `src/useCaddieSession.ts` exposes `CaddieShotVisualState` with aimBias, ballHeight, stanceTilt, windDirection, windStrength, trajectory.
- `src/styles.css` draws CSS-only visual based on data attributes.
- Existing tests guard current reactive 2D visual and will need updating.

## External research facts gathered
- USGTF states driver ball position is aligned with lead-foot instep; ball moves progressively back by club, with driver-to-9 iron movement around 2.7 inches for Tour professionals; stance width varies by club.
- Golf Monthly PGA coach Jo Taylor: mid-iron ball position is center of stance; longer irons shift about a ball width forward; alignment sticks can check ball/stance lines.
- Golf Monthly PGA coach Sarah Bennett: irons favor around 55% lead-leg weight; sternum over ball; central ball position and shaft lean support downward strike; hybrids can vary central vs forward by desired flight.
- Golf Digest/Butch Harmon: uphill lies add loft; play ball slightly forward and set shoulders parallel to slope; downhill lies deloft, play ball back a little and set shoulders parallel to slope.
- Peer-reviewed source found: `Biomechanical Effects of Ball Position on Address Position Variables in Golf` (PMC search result); access page had reCAPTCHA, but result summary indicates ball position affects address variables and was studied with small medial-lateral shifts.

## Constraints from previous accepted specs
- Korean UI only.
- Mobile-first, one-hand field use.
- No backend/GPS/map/weather/auth/social/betting.
- Earlier no-3D was accepted for prior scope, but user now explicitly asks whether 3D would be ideal; this is a new scope decision.
- Existing product has local presets and four result panels.

## Unknowns/open questions
- Whether first pass should implement 3D rotatable visualization or evidence-based 2D multi-view only.
- Whether to model right-handed golfers only or include handedness toggle.
- How precise ball-position model should be: simple club categories vs per-club numeric offset.
- Whether lie views should show front-back slope, ball height relative to feet, or both with separate panels.
- How much source citation/copy should be visible in UI versus only encoded in docs/tests.

## Decision-boundary unknowns
- Can OMX choose library/implementation approach for 3D if selected?
- Can OMX use approximate instructional heuristics rather than exact biomechanical prescription?
- What should remain out of scope for this visual pass?

## Relevant repo docs/rules/context inspected
- AGENTS instructions in prompt.
- Current app source and tests.
- Previous specs/plans under `.omx/specs` and `.omx/plans`, especially caddie usability cleanup.

## Prompt-safe initial-context summary status
not_needed
