---
sketch: 2018/Generativos/patopato
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2129
animated: false
techniques: [polar, dots-stippling, voronoi-delaunai]
primitives: [ellipse, shape]
palette:
  colors: ["#F8F8F9", "#FE3B00", "#7233A6", "#0601FE", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 100, tried: [30], change: large, effect: "sparser scatter, only first 30 mandalas (same positions/sizes); score inflated by unseeded background turning blue"}
  - {name: sizeScale, default: 1.0, tried: [0.3], change: large, effect: "all mandalas ~3x smaller, more background shows, dotted wires become relatively more visible"}
  - {name: ccMax, default: 100, tried: [12], change: large, effect: "dashed segment rings become 6-10 fat chunky bands instead of many fine dashes"}
  - {name: palette, default: "F8F8F9,FE3B00,7233A6,0601FE,000000", tried: ["F8F8F9,2E7D32,00897B,FFC930,212129"], change: large, effect: "same layout, whole piece recoloured green/teal/amber; background also drawn from the new palette"}
  - {name: meshAlphaMax, default: 30, tried: [120], change: moderate, effect: "white Delaunay veil becomes a prominent faceted overlay over the same layout"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, rInner, rOuter, a1, a2, col, shd1, shd2)", note: "annular sector drawn as quad-strip with per-quad two-tone shading (shd1 inner, shd2 outer)"}
  - {name: wire, signature: "wire(x1, y1, x2, y2)", note: "dotted curve between two points: two mirrored Catmull-Rom dot trails, dot size modulated by cos(i*0.2)"}
---

## What it draws
A dense full-bleed collage on a pale off-white background: dozens of overlapping
translucent circular "mandala" objects in orange-red, purple, blue and black. Each
mandala is a ring of pie-slice arc sectors of varying widths and shades, a thin
outline circle, a solid centre dot, and (for some) a dashed ring of small arc
segments. Thin dotted curves made of tiny colour-gradient dots link consecutive
mandala centres across the canvas. A faint mesh of translucent white triangles
lies over everything. The overall look is a busy, layered, confetti-like scatter
with strong blue/orange complementarity.

## How the code works
`setup()` -> `generate()` (patopato.pde:5-10); `draw()` is empty, so the piece is
static (one shot, re-runnable via keyPressed with a new seed).

1. `generate()` (L23-109) re-seeds with `randomSeed(seed)`/`noiseSeed(seed)` (L28-29)
   and paints the background a random palette colour `back` (L25, L30).
2. Main loop (L37-91): 100 iterations. Each picks a random centre `(x, y)` snapped
   to a 5px grid (L38-44) and a random size `s = random(width)*random(1)` (L46) —
   the second `random(1)` skews sizes small.
   - Arc sectors: a while-loop (L52-65) walks around the circle in random 1/16-PI
     steps (L53, `ia = TAU*int(16)/16`) calling `arc2(x, y, s*0.1, s, ...)` (L62)
     until it has covered a full turn. `arc2` (L111-129) renders the annulus
     between radii `s*0.1` and `s` as a quad strip, each quad filled twice
     (inner half `shd1`, outer half `shd2` alpha) giving a radial two-tone shading;
     colour is `rcol()` (random palette pick), alpha `random(255)`.
   - Outline ring + centre dot (L67-73): thin stroked ellipse of diameter `s`
     (stroke weight `s*random(0.1)`) and a solid ellipse `s*0.1`.
   - Dashed segment ring (L75-81): `cc = int(random(100)*random(1))` segments of
     angle `TAU/cc`; per segment two `arc2` calls, one coloured (alpha 120/200)
     and one white with random alpha.
   - Wire (L83-88): `wire(x, y, ax, ay)` connects this centre to the previous
     one. `wire` (L132-184) draws two mirrored dot trails along a Catmull-Rom
     curve through a raised midpoint; dot size = `map(t,0,1,0.2,0.5)` modulated by
     `pow(cos(i*0.2),1)` (L158-159, L173-174); dot colour = `getColor(t*len)` —
     the palette lerp-ramp (L200-205); 0.1% chance of a big hollow ring.
3. Mesh (L93-108): `Triangulate.triangulate(points)` (Delaunay over the 100 centres)
   drawn as TRIANGLES with per-vertex `fill(255, random(30))` — a faint white
   glassy veil; stroke `stroke(0,4)` barely visible.

Randomness enters at: centre/size (L38-46), sector steps (L53), all alphas
(L61, L80, L101-106), segment count (L75), palette picks (L62, L70, L72, L79),
and the wire's rare big rings (L163, L178). No noise() is actually used.

Caveat: the background colour `back = rcol()` (L25) is sampled BEFORE
`randomSeed(seed)` (L28), i.e. from the unseeded stream, so it differs between
independent runs (baseline: off-white; several variants: blue/purple/teal).
This alone accounts for much of the "large" change scores below; the mandala
layout is seed-locked and identical across variants.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_30 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 30; i++) {` | large (mean 0.2807, 0.898) | sparser: only ~30 mandalas, same sizes; big pale pie-mandala and thick banded ring dominate, blue background (unseeded pick) | variants/count_30/frame_00001.png |
| size_0.3 | `float s = random(width)*random(1);` -> `... *0.3;` | large (mean 0.3224, 0.92) | all mandalas ~3x smaller; dense field of small pie-mandala dots on blue background, dotted wires now clearly visible between them | variants/size_0.3/frame_00001.png |
| cc_12 | `int cc = int(random(100)*random(1));` -> `int cc = int(random(12)*random(1))+1;` | large (mean 0.261, 0.853) | dashed segment rings turn into 6-10 fat chunky bands (black/white/orange/blue) around each mandala; layout otherwise as baseline | variants/cc_12/frame_00001.png |
| palette_green | `int colors[] = {#F8F8F9, #FE3B00, #7233A6, #0601FE, #000000};` -> `{#F8F8F9, #2E7D32, #00897B, #FFC930, #212129};` | large (mean 0.2615, 0.868) | identical layout recoloured green/teal/yellow-amber with dark-green rings; background drawn from the new palette (teal-green) | variants/palette_green/frame_00001.png |
| meshAlpha_120 | `fill(255, random(30));` -> `fill(255, random(120));` (all 3 occurrences, L101-106) | moderate (mean 0.0721, 0.343) | white Delaunay veil becomes a prominent faceted overlay covering a third of the canvas; mandalas unchanged | variants/meshAlpha_120/frame_00001.png |

## Modularisation notes
- **Generic, library candidates**: `arc2` (annular sector with two-tone shading)
  and `wire` (dotted Catmull-Rom connector with size modulation and palette-ramp
  colour) are self-contained and reusable. `getColor`/`rcol` are a simple
  palette-ramp + random-pick pair. The Delaunay veil (triangulate + low-alpha
  white per-vertex fill) is a composable overlay.
- **Art decisions, keep per-sketch**: the 100-object scatter with 5px snap and
  `random(width)*random(1)` size distribution; the 1/16-PI quantised sector walk;
  the specific 5-colour palette and the "dashed segment ring" decoration.
- **Clean parameter object**: {count, sizeDist (or sizeMax), sectorQuanta (16),
  ringSegments (cc max), palette, meshAlphaMax, wireDotScale, seed}.
- **Bug worth fixing in any library port**: `rcol()` for the background runs
  before `randomSeed(seed)`, so the background is not reproducible from the seed.
