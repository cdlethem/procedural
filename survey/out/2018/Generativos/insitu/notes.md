---
sketch: 2018/Generativos/insitu
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2310
animated: false
techniques: [subdivision, symmetry]
primitives: [shape, rect, ellipse]
palette:
  colors: ["#F1EDEA", "#3A3C39", "#3854A8", "#A5C9D5", "#F3B62A", "#F64D3A", "#000000"]
  selection: random-from-list
composition: centered
parameters:
  - {name: sub, default: "int(random(80))", tried: [15], change: large, effect: "fewer passes = fewer, much larger nested rings; central mandala shrinks relative to canvas"}
  - {name: max (mix spread), default: "random(0.5)", tried: [0.1], change: large, effect: "tight spread around 0.5 = strict square/diamond alternation, very regular pinwheel nesting"}
  - {name: amp, default: "random(min)", tried: ["min"], change: large, effect: "full-size corner decorations: giant corner squares and shadows dominate the outer rings"}
  - {name: colors, default: "5-colour warm palette", tried: ["5 grey steps"], change: large, effect: "same geometry in monochrome greys; lerp rule gives grey gradients instead of colour contrast"}
  - {name: arc2 shd1 (ring alpha), default: 60, tried: [0], change: subtle, effect: "no visible change; the thin low-alpha rings were already barely perceptible"}
  - {name: srect alp1 (shadow alpha), default: 10, tried: [80], change: moderate, effect: "drop shadows on the corner squares become clearly visible, adding a lifted/relief feel"}
reusable_candidates:
  - {name: recursiveInset, signature: "recursiveInset(polys, sub, spread) -> ArrayList<Poly>", note: "repeatedly inset the newest polygon by a random lerp fraction along its edges"}
  - {name: cornerDecor, signature: "cornerDecor(center, dist, amp, palette) -> void", note: "four corner squares with trapezoid drop-shadows on a square's diagonal corners"}
  - {name: segmentedRing, signature: "segmentedRing(x, y, r1, r2, a1, a2, col, alphaIn, alphaOut) -> void", note: "full ring built from small quads between two radii with per-side alpha"}
---

## What it draws
A centered, four-fold symmetric mandala of nested squares on a light beige ground. Starting from the full canvas, each successive square is smaller and alternately rotated (diamond orientation) depending on where its corners landed, so the composition reads as concentric squares and diamonds tightening toward the center. Dominant colours are orange-red, blue, and yellow, with pale blue and dark gray-green accents. Each ring carries decorations: a solid square at every corner, a faint dark trapezoid "shadow" above each corner square, a small square in another palette colour, and a thin dark ring (ellipse outline plus segmented arc) around the middle.

## How the code works
- `setup()` (insitu.pde:3-11) sizes a 3250x3250 P2D canvas and calls `generate()` once; `draw()` is empty, so the image is static (line 13-15).
- `generate()` (76-112) paints the beige background `#F1EDEA` (78), seeds the RNG (79), and seeds the recursion with the four canvas corners as one `Poly` (81-91).
- Subdivision loop (94-106): `sub = int(random(80))` iterations. Each iteration takes the newest polygon, lerps every vertex toward its next vertex by `mix = random(0.5-max, 0.5+max)` where `max = random(0.5)` (95, 100), and adds the resulting inner polygon. mix near 0.5 rotates the square toward a diamond; varying mix tilts the alternation.
- Draw loop (108-111): each `Poly` from oldest (full canvas) to newest (center) calls `show()`.
- `Poly.show()` (36-69): fills the polygon with a lerp-blended palette colour `getColor()` (41, 193-199); measures the corner spacing `s1,s2` and sets `max = min(s1,s2)` (note line 50 uses `min` for both, so `max` equals `min` — 49-50). `amp = random(min)` (52) is the corner decoration size.
  - Four `srect()` calls (55-58) draw faint black trapezoid shadows (alpha 10) above/below each corner square.
  - Four `rect()` calls (60-63) draw solid corner squares of size `amp` in the lerp colour (60, `fill(getColor())`).
  - A centre `ellipse` in a random palette colour (65-66) and a segmented `arc2` ring of random palette colour with inner alpha 60 (68).
- `srect()` (114-156) builds four trapezoids around a point, each with an alpha-10 (inner) and alpha-0 (outer) fill, giving the soft drop-shadow look.
- `arc2()` (160-178) approximates a ring between radii `s1/2` and `s2/2` with `cc` small quads, fill alpha `shd1` on the inner side, `shd2` on the outer.
- Randomness: `sub`, `mix`, `amp`, `rcol()` (187-189, random palette pick), `getColor()` (lerp between two adjacent palette colours by a random fraction). Palette (186): `#3A3C39, #3854A8, #A5C9D5, #F3B62A, #F64D3A`.
- No blend modes; overlap of translucent shadows over opaque fills produces the muted overlaps.

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_15 | `int sub = int(random(80));` -> `int sub = 15;` | large | 15 passes only: far fewer, much bigger nested rings; small central mandala, big blue/orange outer bands | variants/sub_15/frame_00001.png |
| max_0.1 | `float max = random(0.5);` -> `float max = 0.1;` | large | mix locked near 0.5: strict square/diamond alternation, very regular pinwheel-like nesting to the centre | variants/max_0.1/frame_00001.png |
| amp_full | `float amp = random(min);` -> `float amp = min;` | large | corner decorations at full edge size: huge corner squares (dark blue at the four corners) and big shadow trapezoids dominate the outer rings | variants/amp_full/frame_00001.png |
| colors_mono | `int colors[] = {#3A3C39, #3854A8, #A5C9D5, #F3B62A, #F64D3A};` -> `int colors[] = {#222222, #444444, #666666, #888888, #AAAAAA};` | large | identical geometry in monochrome grey; the lerp-between-neighbours rule reads as smooth grey gradients | variants/colors_mono/frame_00001.png |
| arc_0 | `arc2(..., rcol(), 60, 0);` -> `arc2(..., rcol(), 0, 0);` | subtle | no visible change; the thin low-alpha ring segments were already nearly invisible | variants/arc_0/frame_00001.png |
| shadow_80 | all four `srect(..., color(0), 10, 0);` -> `..., color(0), 80, 0);` | moderate | corner-square drop shadows clearly visible (dark trapezoids above each corner square), giving the composition a stronger lifted/relief feel | variants/shadow_80/frame_00001.png |

## Modularisation notes
- Generic: `recursiveInset` (the subdivision loop 94-106) is a clean library candidate: given a polygon, a number of passes and a spread, return the list of nested polygons. `segmentedRing`/`arc2` is a generic primitive (two radii, arc range, per-side alpha). `cornerDecor` (the srect+rect pair per corner) is reusable if the shadow alpha, corner size and colour source are parameters.
- One-off art decisions: the fixed 5-colour palette and its lerp-between-neighbours rule; choosing `max = min(s1,s2)` for the corner distance (the line-50 `min`/`max` conflation); the specific decoration stack per ring (shadow trapezoid, corner square, small square, centre ellipse, ring); drawing oldest-to-newest so the centre is painted last.
- A clean parameter object: `{sub (pass count), spread (mix variance), cornerSize (amp as fraction of min edge), palette (list), cornerColorMode, shadowAlpha, ringAlpha, ringThickness, backgroundColor}`.
