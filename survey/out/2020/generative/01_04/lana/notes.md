---
sketch: 2020/generative/01_04/lana
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3416
animated: false
techniques: [noise-field, grid, image-source, particles]
primitives: [rect, image, pgraphics]
palette:
  colors: ["#F98806", "#1E4694", "#EAF0F5", "#846A6F"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ccc, default: 1000000, tried: [250000], change: subtle, effect: "lower count = thinner fur, more flat checker showing through"}
  - {name: detAng, default: random(0.02)*random(0.2,1), tried: [random(0.08)*random(0.2,1)], change: subtle, effect: "higher frequency = smaller, tighter curls; overall look similar"}
  - {name: stroke_alpha, default: random(255)*random(1), tried: [255], change: moderate, effect: "full alpha darkens and muddies the quadrant: opaque strokes overpaint earlier bright ones"}
  - {name: add_blend_chance, default: 0.1, tried: [1], change: subtle, effect: "all-ADD slightly brighter; dark area gets faintly visible curl texture"}
  - {name: brush_aspect, default: ww*random(0.1,0.3), tried: [ww*random(0.5,1)], change: moderate, effect: "short fat strokes = stubbly curly wool, checker reads more plaid-like"}
  - {name: brush_width, default: random(4,12), tried: [random(12,36)], change: moderate, effect: "bigger strokes = softer, blurrier quadrant; larger faint curls in dark area"}
reusable_candidates:
  - {name: patchworkBuffer, signature: "patchworkBuffer(size, div, subDiv, alpha, colors[]) -> PImage", note: "two-level checkerboard (div grid of cells, each with a sub-checker of translucent sub-cells) rendered to an offscreen buffer, used as a spatial colour map"}
  - {name: brushField, signature: "brushField(brushes[], count, noiseScale, alphaFn, blendChance, sizeFn) -> void", note: "stamp N image brushes at random positions, rotated by a 2-D noise angle field, tinted from a sampled colour map, with random alpha and occasional ADD blending"}
---

## What it draws
A dense field of tiny fur-like brush strokes over a near-black ground. In the top-left
quarter the strokes read as a woven patchwork quilt: orange, dark blue, off-white and
mauve-brown checkerboard patches, each patch further split into a lighter half-tone
checker, with the strokes swirling in small noise-driven vortices. The other three
quarters are very dark: only faint, low-contrast strokes are visible against the black.

## How the code works
`setup()` loads 4 brush PNGs (`brush/brush01..04.png`, lana.pde:24-27) and calls
`generate()` once (lana.pde:29); `draw()` is a no-op, so the piece is static.

`generate()` (lana.pde:50-115):
1. `background(20)` (lana.pde:54) — near-black base.
2. A 960×960 `PGraphics` buffer is filled as a 2-level checkerboard (lana.pde:57-81):
   `div = 8` cells, each cell filled with a random palette colour `rcol()` (lana.pde:66),
   then each cell gets an 8×8 sub-checker (`cc = 8`, lana.pde:68-76) of translucent
   (alpha 200-255) sub-cells in the same random colour, skipping every other diagonal
   sub-cell (`(l+k+i+j)%2 == 0`, lana.pde:73). This buffer `img` is the spatial colour
   map, never drawn directly (lana.pde:83 is commented out).
3. A loop stamps `ccc = 1000000` brush images (lana.pde:92-114). Each iteration:
   - random position (lana.pde:94-95);
   - stroke size `ww = random(4,12)` (lana.pde:96), height `hh = ww*random(0.1,0.3)`
     (lana.pde:98) — thin elongated strokes;
   - colour `col = getCol(x,y)` (lana.pde:100) samples the buffer at a 2×-scaled
     coordinate (lana.pde:117-121). Because the mapping is `0..img.width*2`, only the
     top-left quarter of the canvas receives real patchwork colours; everywhere else
     out-of-range reads collapse to a dark corner pixel — this is why the image is
     dark outside the top-left;
   - brightness `brig` (lana.pde:101) feeds both the rotation and the scale;
   - alpha `tint(col, random(255)*random(1))` (lana.pde:102) makes most strokes
     translucent, many nearly invisible;
   - 10% of strokes use `blendMode(ADD)` (lana.pde:104), the rest `NORMAL`;
   - rotation `noise(desAng + x*detAng, desAng + y*detAng)*TAU*10 + brig*8`
     (lana.pde:108) with `detAng = random(0.02)*random(0.2,1)` (lana.pde:86) — a smooth
     noise angle field producing the swirling "fur" vortices;
   - scale `sca = (2+brig+random(2)) * random(0.4,1)` (lana.pde:110-111) — lighter
     colours stamp bigger;
   - the brush is stamped centered at the rotated position (lana.pde:112).

Randomness: one global seed (lana.pde:52-53) drives everything; `desAng` is a random
phase offset of the noise field (lana.pde:87). Palette: fixed 4-colour list
(lana.pde:128), chosen randomly per cell/stroke. The `toxi`/`triangulate` imports are
unused in this sketch.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ccc_250000 | `int ccc = 1000000; //1000000` -> `int ccc = 250000; //1000000` | subtle | quadrant fur is thinner, more of the flat checkerboard patches show through; dark area essentially unchanged | variants/ccc_250000/frame_00001.png |
| detAng_0.08 | `float detAng = random(0.02)*random(0.2, 1);` -> `random(0.08)*random(0.2, 1);` | subtle | curls are smaller and tighter (finer fur) but the quadrant's overall appearance is similar; dark area slightly more textured | variants/detAng_0.08/frame_00001.png |
| stroke_alpha_255 | `tint(col, random(255)*random(1));` -> `tint(col, 255);` | moderate | quadrant is clearly darker and duller: fully opaque strokes overpaint earlier bright ones, off-white/orange is suppressed into muddy brown-blue fur | variants/stroke_alpha_255/frame_00001.png |
| add_blend_chance_1 | `if (random(1) < 0.1) blendMode(ADD);` -> `if (random(1) < 1) blendMode(ADD);` | subtle | slightly brighter/glowier quadrant; faint curl texture in the dark area becomes a touch more visible | variants/add_blend_chance_1/frame_00001.png |
| brush_aspect_0.5_1 | `hh = ww*random(0.1, 0.3);` -> `hh = ww*random(0.5, 1);` | moderate | strokes are short and fat: stubbly curly-wool look, checkerboard reads more plaid-like; faint curls visible in the dark area | variants/brush_aspect_0.5_1/frame_00001.png |
| brush_width_12_36 | `float ww = random(4, 12)*random(1);` -> `float ww = random(12, 36)*random(1);` | moderate | strokes ~2-3x larger: quadrant is softer and blurrier, checker more washed out; larger faint curls visible in the dark area | variants/brush_width_12_36/frame_00001.png |

## Modularisation notes
Two generic blocks: (1) `patchworkBuffer` — an offscreen two-level checkerboard that
doubles as a spatial colour map; (2) `brushField` — stamping a large number of image
brushes at random positions with noise-field rotation, colour sampled from a buffer,
random alpha and occasional additive blending. One-off art decisions: the 4-colour
palette, the 2× over-scale in `getCol` (which accidentally confines the patchwork to a
quadrant — arguably an art bug, but it is the defining feature of the baseline look),
and the brush aspect ratio / size distributions. A clean parameter object would
contain: `div`, `cc` (sub-checker size), `subAlpha`, `colors[]`, `count`, `noiseScale`,
`alphaRange`, `addBlendChance`, `strokeSizeRange`, `strokeAspect`, `brushImages[]`.
