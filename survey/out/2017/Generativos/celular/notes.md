---
sketch: 2017/Generativos/celular
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1763
animated: false
techniques: [packing, lines-hatching, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#F8CA9C", "#F8B6D9", "#EF276B", "#A14FBE", "#1D43B8"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: attempts, default: 50000, tried: [5000], change: subtle, effect: "sparser field; only capsules accepted within the first 5000 RNG attempts remain (large ones come early)"}
  - {name: maxLen, default: 600, tried: [200], change: large, effect: "capsules capped at ~200 px; the very large soft blobs disappear, field more uniform and denser"}
  - {name: thicknessRatio, default: 0.8, tried: [0.2], change: large, effect: "dot diameter 0.2x length: pills become thin needle dashes"}
  - {name: background, default: "random palette-lerp colour", tried: ["#1D43B8"], change: large, effect: "solid deep blue background; same capsules, pink/cream pop, blue ones merge"}
  - {name: palette, default: "5 colours (peach..blue)", tried: ["4-colour warm set from the commented line"], change: large, effect: "maroon background, cream/peach/crimson capsules, no blue/purple"}
  - {name: colorSpread, default: "up to 2.5 palette steps", tried: [0], change: large, effect: "solid single-colour capsules; two-tone gradient along each dash removed"}
reusable_candidates:
  - {name: packNonOverlappingCapsules, signature: "packNonOverlappingCapsules(attempts, minLen, maxLen, thicknessRatio, inflation) -> Capsule[]", note: "rejection sampling: keep a random capsule only if its bounding quad misses all kept quads"}
  - {name: gradientDotLine, signature: "gradientDotLine(p1, p2, width, c1, c2) -> void", note: "stroke a segment as a chain of overlapping ellipses whose fill lerps c1->c2 along the segment"}
  - {name: lerpPalette, signature: "lerpPalette(palette, t) -> color", note: "cyclic palette sampler: lerp between floor/ceiling entry of t"}
---

## What it draws
A light peach-pink field densely scattered with short pill/capsule-shaped dashes in random lengths and angles, from tiny specks to a few capsules several hundred pixels long. Capsules are peach, pink, crimson, purple, and blue; many show a two-tone gradient running along their length (e.g. cream into blue, pink into purple). No two capsules touch: a visible gap of background separates every dash, giving the whole image a confetti or cellular-tissue look, fairly uniform in density.

## How the code works
- `setup()` (celular.pde:3-8) opens a 960x960 P3D window with `smooth(8)` and calls `generate()` -> `render()` once. `draw()` (10-16) only draws a 2px ellipse off-canvas at (-10,-10), so the image is static (frames 10/60 identical to frame 1).
- `render()` (34-75): fills the background with a palette-lerp colour sampled at a random position over the palette doubled (`getColor(random(colors.length*2))`, line 35) - here a peach-pink between #F8CA9C and #F8B6D9. Then 50000 attempts (line 41): each picks a random centre (42-43), a random length `s` in [5, random(100,600)] (44) - a nested random so most lengths sit low and a tail reaches 600 - and a random angle (45), and builds a `Line` capsule.
- `Line` (77-109): endpoints are +/-s/2 from the centre along the angle (85-90); stroke width `ss = s*0.8` (84), so dot diameter is nearly the length -> pill shape. `getPoly()` (97-108) returns a 4-vertex bounding quad around the capsule (half-width 0.55*ss), used only for collision tests.
- Rejection (49-57): the capsule is kept only if its bounding quad does not intersect any kept quad, via `polyPoly` (poly.pde:2) which uses segment-segment tests `lineLine` (poly.pde:68) plus a point-in-polygon containment check `polyPoint` (poly.pde:85). This no-overlap constraint is what produces the evenly gapped, "cellular" packing.
- Drawing (60-74 -> 93-95): each kept capsule is rendered by the custom `line()` (111-125), which walks the segment in unit steps and stamps overlapping ellipses of constant diameter `ss` (since s1 = s2 = ss); each dot's fill is `getColor` between palette positions c1 and c2 (134-139), with `c2 = c1 + random(colors.length*0.5)*random(1)` (line 88) - up to 2.5 palette steps of drift -> two-tone gradient capsules.
- Randomness enters through `random()` for centres, lengths, angles, and palette positions. The `seed` field (1, 29) is assigned but never passed to `randomSeed()`; the harness still reports deterministic: true (re-run frames identical).
## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_5000 | `for (int i = 0; i < 50000; i++) {` -> `for (int i = 0; i < 5000; i++) {` | subtle (mean 0.0328, 10% of pixels) | subtle: sparser field - the large soft capsules (accepted early in the RNG stream) stay in the same places while the dense small dashes added by later attempts are gone, opening the background around the big blobs | variants/count_5000/frame_00001.png |
| maxLen_200 | `float ss = random(5, random(100, 600));` -> `float ss = random(5, random(100, 200));` | large (mean 0.1651, 49% of pixels) | no capsules longer than ~200 px: the very large soft blobs are gone, field is more uniform in size and reads denser with medium pills | variants/maxLen_200/frame_00001.png |
| thick_0.2 | `ss = s*0.8;` -> `ss = s*0.2;` | large (mean 0.1698, 51% of pixels) | capsules become thin needle-like dashes (width = 0.2 of length); the pill look is gone and the thinner collision quads let more, longer dashes fit | variants/thick_0.2/frame_00001.png |
| bg_blue | `background(getColor(random(colors.length*2)));` -> `background(#1D43B8);` | large (mean 0.3441, 89% of pixels) | same capsules over a solid deep blue background; pink/cream dashes now pop strongly, blue capsules merge into the ground | variants/bg_blue/frame_00001.png |
| alt_palette | `int colors[] = {#F8CA9C, #F8B6D9, #EF276B, #A14FBE, #1D43B8};` -> `int colors[] = {#45171D, #F03861, #FF847C, #FECEA8};` | large (mean 0.4471, 96% of pixels) | the commented-out warm palette: dark maroon background, cream/peach/crimson capsules with warm gradients, no blue or purple anywhere | variants/alt_palette/frame_00001.png |
| flat_color | `c2 = c1+random(colors.length*0.5)*random(1);` -> `c2 = c1;` | large (mean 0.1597, 49% of pixels) | capsules are flat single colours (no two-tone gradient along the length); the field reads as solid confetti pills in exact palette colours | variants/flat_color/frame_00001.png |

One render command failed before these: the first bg_blue attempt used a literal `\n` inside the OLD string and came back `bad_sub` (nothing rendered); it was retried with a clean line. 7 render commands in total.

## Modularisation notes
- Generic candidates: the rejection-sampling packer (attempts + bounding-quad intersection) is a clean library function; `gradientDotLine` (dot-chain gradient stroke, celular.pde:111-125) and `lerpPalette` (134-139) are reusable stroke/palette primitives; the poly.pde collision utilities (polyPoly/polyLine/lineLine/polyPoint) are generic 2D intersection tests (standard Processing wiki snippet).
- One-off art decisions: thickness ratio 0.8 (pill look), the nested length distribution `random(5, random(100,600))`, quad inflation factor 0.55, 50000 attempts, the 5-colour palette and the doubled-palette background pick.
- A clean parameter object: `{attempts, minLen, maxLen, thicknessRatio, inflation, palette, background, maxColorSpread}`.
