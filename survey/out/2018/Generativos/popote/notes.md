---
sketch: 2018/Generativos/popote
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1777
animated: false
techniques: [noise-field, distortion, packing, dots-stippling]
primitives: [shape, pgraphics]
palette:
  colors: ["#FFF4D4", "#FD8BA4", "#FF5500", "#018CC7", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 30, tried: [10], change: large, effect: "fewer, more separated blobs; blue background much more visible; remaining blobs unchanged"}
  - {name: desAmp, default: 80, tried: [20], change: moderate, effect: "blob edges far rounder, near-circular; blobs compact around their centres"}
  - {name: alpha, default: "random(120,255)", tried: ["random(20,90)"], change: none, effect: "no visible change — fill is overwritten by per-vertex fills inside circle()/aro()"}
  - {name: noiseOctaves, default: 2, tried: [6], change: large, effect: "same composition, edges smoother and rounder, less lumpiness"}
  - {name: sizeDist, default: "width*random(1)*random(1)", tried: ["width*random(1)^3"], change: large, effect: "all blobs much smaller, blue background dominates, fan moire reads as starbursts"}
reusable_candidates:
  - {name: desform, signature: "desform(x, y, angOffset, angScale, desOffset, desScale, amp) -> PVector", note: "per-point 2-D noise displacement used to wobble every circle/ring edge"}
  - {name: fanCircle, signature: "fanCircle(x, y, r, color, alpha, deformFn) -> void", note: "polygon approximated as a triangle fan from a deformed center, which produces the radial sheen inside filled blobs"}
  - {name: ringStrip, signature: "ringStrip(x, y, r1, r2, color, alpha, deformFn) -> void", note: "quad-strip annulus between two deformed rings"}
---

## What it draws
A dense full-bleed composition of overlapping organic blobs on a flat blue (#018CC7) field. Each blob is a set of 3–4 concentric, softly wobbled layers (e.g. a cream disc with an orange core, a black blob with a radial sheen, a pink rounded shape with a thin orange ring) in a 5-colour palette of cream, pink, orange, blue and black. Some blobs read as "eyes" or "coins": an outer ring, a mid layer, and a small offset dot. Edges are lumpy, not circular, and large filled areas show a faint radial fan/moiré texture from the triangle construction.

## How the code works
`setup()` sizes a 960×960 P2D canvas and calls `generate()` once; `draw()` is empty, so the piece is static (keyPress regenerates with a new seed, line 15–21). `seed` is a global re-seeded via `randomSeed`/`noiseSeed` in `generate()` (lines 28–29), which is what the harness patches to 42.

`generate()` (lines 23–57): picks a random palette colour for the background (line 25, blue for seed 42), draws 30 blobs (line 42). Each blob: random centre (43–44), radius `s = width*random(1)*random(1)` (45, biased small), then four stacked primitives at the same centre — an alpha-faded `circle(s)` (46–47), a near-solid `circle(s*0.9)` (48–49), a small `circle(s*0.4)` core (51–52), and a low-alpha `aro` ring spanning s*0.6…s*0.9 (53–54). Note the `fill` on line 46 is dead: `circle()` overwrites it with per-vertex fills (108, 111), confirmed by the alpha experiment scoring `none`.

`circle()` (92–117) is not Processing's built-in: it builds a polygon of `cc = max(8, r*PI)` vertices (94) and draws it as a triangle fan — every triangle connects two adjacent perimeter points to the noise-deformed centre `desform(x,y)` (103, 105–116). With alpha 240 and many overlapping semi-transparent triangles, this produces the visible radial sheen/moiré in large filled blobs.

`aro()` (119–143) draws a closed quad-strip ring of `cc` segments, its points displaced by `desform` (132–142).

`desform()` (86–90) is the shape engine: per point it samples 2-D noise for an angle (`noise(desAng + x*detAng, desAng + y*detAng)*TAU*2`) and an offset magnitude (`noise(...)*80`), then offsets the point by that vector. `detAng`/`detDes` are random 0.002–0.01 noise scales (33, 35), so blobs wobble at medium frequency; `noiseDetail(2)` (37) limits octaves.

Colour: `rcol()` (159–161) picks uniformly from the 5-colour array (157); many commented-out palettes sit above it (150–158). `getColor()` (162–171, lerp between adjacent palette entries) is unused. `arc2()` (59–79) is dead code. `import ...triangulate` (1) is never used in the tab.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_10 | `for (int i = 0; i < 30; i++) {` -> `for (int i = 0; i < 10; i++) {` | large (0.1996, 47% px) | fewer, more separated blobs; much more flat blue ground visible; surviving blobs sit at the same positions with the same wobbly edges and layering | variants/count_10/frame_00001.png |
| desAmp_20 | `...detDes)*80; ` -> `...detDes)*20; ` | moderate (0.1051, 23% px) | edges far rounder, blobs nearly circular and compact around their centres; lumpy organic quality mostly gone | variants/desAmp_20/frame_00001.png |
| alpha_low | `fill(rcol(), random(120, 255));` -> `fill(rcol(), random(20, 90));` | none (0.0, 0% px) | no visible change — pixel-identical; the fill is overwritten by per-vertex fills inside circle()/aro() | variants/alpha_low/frame_00001.png |
| noiseOctaves_6 | `noiseDetail(2);` -> `noiseDetail(6);` | large (0.1625, 36% px) | same composition and colours as baseline; blob edges smoother and rounder, less medium-scale lumpiness; radial fan texture still present | variants/noiseOctaves_6/frame_00001.png |
| sizeDist_cubed | `float s = width*random(1)*random(1);` -> `float s = width*random(1)*random(1)*random(1);` | large (0.328, 79% px) | all blobs much smaller (size law biased further down); blue ground dominates; triangle-fan moire now reads as bright starbursts in the cores; thin wavy ring outlines visible | variants/sizeDist_cubed/frame_00001.png |

## Modularisation notes
- Generic: `desform` (noise-displacement field with angle+offset channels), `fanCircle` (fan-shaded deformed polygon — the sheen is a side effect that reads as a radial gradient, a nice built-in feature), `ringStrip` (deformed annulus), `rcol`/palette picker.
- One-off: the 4-layer "eye" stacking recipe in `generate()` (s, 0.9s, 0.4s core, 0.6–0.9s ring) and the 5-colour palette; the `width*random(1)*random(1)` size law.
- Clean parameter object: `{count, sizeLaw, layers: [{scale, alpha, ring?}], deform: {angScale, desScale, amp, octaves}, palette: string[], seed}`. A `deformFn` parameter (identity vs noise) would let the same layer stack render as plain circles or wobbled blobs.
