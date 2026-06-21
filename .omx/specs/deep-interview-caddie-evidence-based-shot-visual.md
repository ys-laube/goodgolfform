# Deep Interview Spec: Evidence-based Caddie Shot Visual

## Metadata
- Profile: standard
- Rounds: 5
- Final ambiguity: 16%
- Threshold: 20%
- Context type: brownfield
- Context snapshot: `.omx/context/caddie-evidence-based-shot-visual-20260621T110539Z.md`

## Intent
Replace the current prescription-result picture because it feels arbitrary and not golf-grounded. The new visual should look like a credible golf setup guide for serious Korean golfers, not decorative UI.

## Desired outcome
Create an evidence-based, Korean, mobile-first visual module for the caddie result that explains setup visually:
1. Top-down stance/ball-position view.
2. Rear-view lie/slope view.
3. Optional side/target-direction mini-view if it helps clarify front-back slope.
4. Data model shaped so a future 3D rotatable setup view can reuse the same semantic visual state, but no 3D runtime in this pass.

## In scope
- Remove current blue trajectory arc from the visual.
- Remove current wind marker from the visual.
- Replace current single abstract CSS drawing with a multi-view setup graphic.
- Add handedness support: right-handed default, left-handed toggle mirrors lead/trail foot and ball-position direction.
- Top-down view must show:
  - both feet with lead/trail labeling or equivalent Korean labels,
  - target line/direction enough to orient the golfer,
  - selected/current club group,
  - recommended ball position within stance.
- Ball-position model uses five club groups:
  1. Driver
  2. Fairway wood / hybrid
  3. Long iron
  4. Mid iron
  5. Short iron / wedge
- Rear-view must show current lie/slope instead of trajectory/wind:
  - front-back slope: uphill/downhill/level as golfer-relative terrain tilt,
  - ball height relative to feet: ball below feet / level / ball above feet,
  - feet on slope with ball marker in relation to foot plane.
- UI includes a collapsible Korean “근거 보기” section summarizing source rationale.
- README/tests should preserve source-backed rationale and guard against reintroducing rootless trajectory/wind visuals.

## Out of scope / non-goals
- No runtime 3D / three.js / rotatable model in this pass.
- No backswing, downswing, swing path, clubhead trail, or motion animation.
- No trajectory arc or wind marker in the visual.
- No lab-grade biomechanical precision claims.
- No personalization beyond handedness toggle: no height, arm length, foot size, or biomechanics tuning.
- No new backend, GPS, map, weather, auth, social, betting, or external service dependency.

## Decision boundaries
OMX may decide without further confirmation:
- Exact CSS/SVG/HTML implementation method for the 2D multi-view.
- Korean labels and layout details as long as they follow the acceptance criteria.
- Internal data names for future 3D compatibility.
- Whether side/target-direction mini-view is included, if it materially clarifies front-back slope without clutter.
- Exact mapping of existing club keys into the five club groups, using source-backed approximations.

OMX must not decide without further confirmation:
- Adding actual 3D runtime rendering.
- Adding new dependencies solely for graphics.
- Reintroducing trajectory/wind visuals into the drawing.
- Adding warning/disclaimer/legal copy beyond existing product style.

## Constraints
- Korean UI only.
- Mobile-first and usable in the field.
- Existing caddie result flow and four reason panels should remain unless the implementation plan explicitly revises them.
- No new dependency unless separately justified and approved.
- Keep visual as instructional setup guidance, not exact biomechanical measurement.

## External evidence notes
- USGTF: driver ball position aligns near lead-foot instep, then moves progressively back by club; stance width also changes by club. Source: https://www.usgtf.com/the-importance-of-ball-position-and-stance-width/
- Golf Monthly / Jo Taylor, PGA Advanced Professional: mid-iron ball position is center of stance; longer irons shift roughly a ball width forward; alignment sticks are useful for checking setup. Source: https://www.golfmonthly.com/tips/improve-your-irons-shots-in-golf-with-10-expert-tips-from-a-pga-advanced-professional
- Golf Monthly / Sarah Bennett, PGA coach: iron setup favors central ball position, sternum over ball, and lead-side weight; hybrid ball position can vary by desired flight. Source: https://www.golfmonthly.com/tips/iron-vs-hybrid-setup-position
- Golf Digest / Butch Harmon: uphill lies generally add loft, use a slightly forward ball position and shoulders parallel to slope; downhill lies deloft, ball back a little, shoulders parallel to slope. Source: https://www.golfdigest.com/story/butch-harmon-uneven-lies
- Peer-reviewed direction found: “Biomechanical Effects of Ball Position on Address Position Variables in Golf” indicates ball position is a studied address variable, though the accessed PMC page was blocked by browser verification during this session. Search result: https://pmc.ncbi.nlm.nih.gov/articles/PMC6243633/

## Testable acceptance criteria
1. Current `.shot-visual-arc` and `.shot-visual-wind` runtime visual elements are removed or no longer rendered.
2. The new visual renders at least two named Korean panels/views: top-down stance/ball-position and rear-view lie/slope.
3. The top-down view changes ball marker location by selected club group.
4. The top-down view mirrors correctly when handedness toggles.
5. The rear-view changes terrain/feet/ball relationship for uphill, downhill, ball-above-feet, and ball-below-feet states.
6. The visual state object contains setup semantics suitable for future 3D: handedness, club group, ball-position slot/offset, front-back slope, ball-height/sidehill relation, and view labels; it must not contain trajectory or wind drawing fields.
7. UI includes a collapsed-by-default or compact “근거 보기” area with Korean summaries of ball-position and slope-lie rationale.
8. Tests assert no trajectory/wind visual reappears.
9. Tests assert no 3D runtime/dependency is introduced.
10. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` pass.

## Assumptions resolved
- 3D is desirable long-term but not first-pass implementation.
- Right-handed is default, but left-handed toggle is in scope.
- Five club groups are sufficient and preferable to per-club precision.
- Evidence should be visible, but not clutter the default field UI; use collapsible evidence.

## Handoff recommendation
- Next: `$ralplan` if architecture/test-shape review is desired because this changes visual semantics and tests.
- Then: `$ultragoal` for durable implementation; `$team` only if splitting visual implementation/tests/docs improves throughput.
