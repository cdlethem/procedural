---
sketch: 2018/Generativos/magik2
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1935
animated: false
techniques: [polar, noise-field, particles, distortion, lines-hatching]
primitives: [shape, line]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80", "#242527", "#FCFCFA"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: radialWedges, signature: "radialWedges(cx, cy, count, spanAmp, r, colorOffset) -> void", note: "fan of triangular wedges around an off-center point, palette ramped around the ring (perspective(), lines 161-180)"}
  - {name: noiseWalkerTrail, signature: "noiseWalkerTrail(x1, y1, x2, y2, steps, det, des, amp, vel) -> void", note: "two points steered by 2-D Perlin noise, leaving white/black hairline segments (lines 73-131)"}
  - {name: starburst, signature: "starburst(x, y, size, points) -> void", note: "alternating-radius star polygon, white fill (start(), lines 147-159)"}
  - {name: radialGlow, signature: "radialGlow(x, y, rInner, rOuter, color, alphaIn, alphaOut) -> void", note: "arc built from trapezoid strips with two alpha levels (arc2(), lines 187-205)"}
---

## What it draws
A loud full-bleed composition on a hot-pink field: two dense fans of rainbow wedges
(cyan, yellow, magenta, orange) radiating from points near the center-left and
center-right, overlaid with large distorted ribbon-like shapes in the same rainbow
ramp, a dark purple silhouette mass on the left, and thin white/grey hairline
radials with a few small white starbursts and glow spots. A post shader softens
the whole image slightly.

## How the code works
`setup()` calls `generate()` once (line 12); `draw()` is empty, so the sketch is
static (regenerates only on keypress). All randomness is seeded by
`randomSeed(seed)` (line 43).

1. Background is one random palette color (`rcol()`, line 44) — the hot pink.
2. 10,000 small quads are scattered (lines 47-67): each is a thin parallelogram
   built from `beginShape`/`vertex` (lines 53-60), sized by
   `s = width*random(0.04)*random(1)*random(1)*0.2` (line 50), with two different
   random palette fills for the two half-rectangles. These form the ribbon-like
   streaks, mostly buried under later layers.
3. Two `perspective()` calls (lines 69-70) draw the dominant feature: a fan of
   `cc` wedges (60-360 each, line 162-163, radius `width*1.42`) from a random
   center, each wedge a triangle from center to two nearby angles
   (lines 172-178), filled by a palette index that ramps around the ring
   (`getColor(ic+dc*i)`, lines 173, 175) — the rainbow radial fans.
4. 20 noise-walker trails (lines 73-141): a pair of points `(x1,y1)/(x2,y2)` is
   lerped toward each other (lines 85-88) and then stepped for `lar` steps
   (1000-10000), each step steered by 2-D Perlin noise angles
   (`noise(des+x*det)*TAU*amp`, lines 107-108) with velocity `vel`
   (line 98). Each step draws a full-canvas line in a palette color lerped to
   black (line 104) plus short white (alpha 250) and black (alpha 240) segments
   between successive positions (lines 126-129) — the white hairline web.
   Rarely (p=0.004) a soft white radial glow `arc2` (line 120) and very rarely
   (p=0.0002) a white star polygon `start` with a glow (lines 133-140) — the
   small starbursts.
5. `filter(post)` (line 144) applies `post.glsl`, a final full-frame pass that
   softens/mottles the result.

Palette: 12 colors (line 207); `rcol()` picks one at random, `getColor(v)`
(lerps between adjacent entries (lines 215-220) — the smooth rainbow ramps.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `perspective()` (radial rainbow fan) is the most reusable block: center, wedge
  count, angular span amplitude, radius and palette offset/step are already
  parameters; a library version would return nothing and take a palette.
- The noise-walker (lines 73-131) is generic flow-field trail logic: two walkers
  with 2-D Perlin steering, per-step color fade and hairline segments; reusable
  as a "perlin trail pair" primitive.
- `arc2` (strip-built radial glow) and `start` (star polygon) are small generic
  primitives.
- One-off art decisions: the 10,000 random quads (mostly occluded, likely a
  leftover from an earlier version), the double `perspective` call, the 12-color
  palette, the lerp-toward-each-other start points, and the post shader.
- A clean parameter object: `{bgColor, quadCount, quadScale, fans: [{cx, cy,
  wedges, span, radius, colorOffset}], trails: [{count, steps, detail, amp,
  vel, glowProb, starProb}], postShader}`.
