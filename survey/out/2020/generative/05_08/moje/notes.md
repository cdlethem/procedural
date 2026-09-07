---
sketch: 2020/generative/05_08/moje
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1570
animated: false
techniques: [agents, recursion, distortion]
primitives: [ellipse, rect, shape]
palette:
  colors: ["#18002E", "#001BCC", "#E6D4FC", "#F5F2F8", "#E73504"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: shardCount, default: 60, tried: [20], change: large, effect: "fewer but larger-appearing shards; dark navy and red slabs dominate, right half empties out"}
  - {name: speckCount, default: 4000, tried: [100], change: large, effect: "background grain almost gone; thin shards and twig branches read much more clearly"}
  - {name: shardSizeScale, default: "random(10)", tried: ["random(3)"], change: large, effect: "shards ~3x smaller; dense busy field of mid-size slabs, branches relatively more prominent"}
  - {name: shardSizeMult, default: "random(3)", tried: ["random(8)"], change: large, effect: "shards up to ~2.7x bigger; huge slabs cover most of the canvas, ground barely visible"}
  - {name: shardRotation, default: "random(-0.5, 0.5)", tried: ["random(-1.5, 1.5)"], change: large, effect: "same shard positions/sizes/colours, tilts widened; composition still reads like the baseline but shard edges shift substantially"}
  - {name: palette, default: "#18002E,#001BCC,#E6D4FC,#F5F2F8,#E73504", tried: ["#0B3D0B,#F5D90A,#E8F5E9,#FFFFFF,#1B9C85"], change: large, effect: "same structure recoloured to dark green, yellow, mint, white, teal"}
reusable_candidates:
  - {name: ramab, signature: "ramab(x, y, w, h, angle, depth, ampAng)", note: "recursive tapered-quad branch: draws a trapezoid from (x,y) to (nx,ny), tapers width w*0.6 -> w*0.1, splits into cc sub-branches at random angles, black dot at each node"}
  - {name: getColor, signature: "getColor(v) -> color", note: "continuous palette: lerp between adjacent colors of the list, index from float v, eased with pow(frac, 0.6)"}
---

## What it draws
A full-bleed collage of bold diagonal shards in red-orange and cobalt blue over a pale
lavender/off-white ground, with a few large pale circles, hundreds of tiny specks, and fine
black branching filaments (twig-like recursive branches with black dots at the joints)
scattered across the composition. The shards are rotated rectangles of widely varying length,
mostly tilted within ±~30° of vertical, giving a reed-like, scattered rhythm.

## How the code works
Static: `draw()` calls `generate()` every frame but the seed is fixed, so all frames are
identical (baseline frames 10/60 dropped as duplicates).

- `setup()` (L20-28) and `draw()` (L30-34) both call `generate()`.
- `generate()` (L45-116) re-seeds (`randomSeed(seed)`, `noiseSeed(seed)`, L47-48) then:
  1. `background(rcol())` (L50) — one random palette colour as the ground (here the near-white
     `#F5F2F8`).
  2. Speck loop (L58-74): 4000 small ellipses, size `random(10,20)*random(1)*0.15` (i.e. 0-3 px),
     random palette fill, snapped to a 5-px grid; some are stretched 8-30x in one axis (L66-67)
     but still drawn as tiny circles. This is the fine grain of the image.
  3. Triangle layer (L76-90): 10 random triangles with random alpha fills — barely visible under
     the shards.
  4. Shard loop (L92-115): 60 items. Each picks a position snapped to a 10-px grid, a size
     `s = random(10,40)*random(1)*random(10)*lerp(0.8,1,ry)` then `s *= random(3)` (L100-101),
     rotates by `random(-0.5,0.5)*random(0.8,1)` (L105, ~±29°), and draws a tall rotated rect
     `rect(0,-s*r(0.2,0.4), s*0.5, s*4)` (L106) in a random palette colour, plus a small ellipse
     at the base (L108). The large red/blue slabs are these rects.
  5. Per-shard branches: `rama(0,0,s*0.02, s*0.3, HALF_PI, 5)` (L111) and
     `ramab(0,0, s*r(0.2,0.6), s*r(1,3), PI*1.5, 10, ...)` (L112) — recursive twig structures
     drawn in the shard's local (rotated) frame.
- `rama`/`ramab` (L125-252): recursive branch. Each level computes a child point
  `n = a + (cos a, sin a)*h`, draws a tapered quad (width `w*0.6` at the base, `w*0.1` at the
  tip, L133-145) filled with `getColor(ite)` — a continuous lerp through the palette indexed by
  the recursion depth — then a black dot at both joints (L147-150), then spawns 1-4 child
  branches at random angles (L152-163), shrinking w and h by 0.55-0.8x each level. This produces
  the fine black/coloured filament network.
- Colour: `rcol()` (L261-263) picks a random entry from the 5-colour array (L260);
  `getColor(float)` (L269-275) lerps between adjacent entries for the branch quads.
- `import ... triangulate` and `toxi SimplexNoise` (L1-2) are unused in the active code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| shards_20 | `for (int i = 0; i < 60; i++) {` -> `for (int i = 0; i < 20; i++) {` | large | the 20 remaining shards render big: dark-navy, red and cobalt slabs dominate the left/centre, right half nearly empty with just branches and specks | variants/shards_20/frame_00001.png |
| specks_100 | `for (int i = 0; i < 4000; i++) {` -> `for (int i = 0; i < 100; i++) {` | large | background grain almost gone; thin shards and twig branches read much more clearly, composition looks sparser | variants/specks_100/frame_00001.png |
| shardsize_3 | `...random(10)*lerp(0.8, 1, ry);` (L100) -> `...random(3)*lerp(0.8, 1, ry);` | large | shards ~1/3 size: dense busy field of mid-size slabs in every corner, branches relatively more prominent | variants/shardsize_3/frame_00001.png |
| shardmult_8 | `s *= random(3);//*random(1);` (L101) -> `s *= random(8);//*random(1);` | large | huge slabs cover most of the canvas; ground barely visible, heavy collage | variants/shardmult_8/frame_00001.png |
| rotation_1.5 | `rotate(random(-0.5, 0.5)*random(0.8, 1));` (L105) -> `rotate(random(-1.5, 1.5)*random(0.8, 1));` | large | recognisably the same composition (same shard positions, sizes, colours); tilts are wider, the large score comes from big-shard edge shifts rather than a new layout | variants/rotation_1.5/frame_00001.png |
| palette_alt | `int colors[] = {#18002E, #001BCC, ...};` (L260) -> `{#0B3D0B, #F5D90A, #E8F5E9, #FFFFFF, #1B9C85};` | large | same structure recoloured: dark green, yellow, mint, white, teal | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: `ramab`/`rama` (recursive tapered-branch renderer with width taper, split count,
  angle spread, black joint dots) and `getColor` (continuous palette lerp) are self-contained
  and parameterised; both are strong library candidates.
- One-off art decisions: the specific 5-colour palette, the 60-shard/4000-speck composition
  layering, grid snapping (5px/10px), and the rotation range.
- Clean parameter object: `{seed, palette, ground: 'random'|'fixed', shards: {count, size,
  sizeJitter, rotation, grid}, specks: {count, size, grid}, branches: {depth, spread,
  splitRange, taperBase, taperTip, jointDot}}`.
