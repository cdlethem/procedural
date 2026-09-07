---
sketch: 2020/generative/01_04/tata
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1495
animated: false
techniques: [grid, noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#D5D3D4", "#CF78AF", "#DA3E0F", "#068146", "#424BC5", "#D5B307"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(80,280)*0.2)", tried: ["int(random(80,280)*0.1)"], change: moderate, effect: "halve cell count: thicker bands, bigger stepped edges"}
  - {name: dc, default: "random(0.2)", tried: ["random(1.0)"], change: moderate, effect: "5x color step: vertical color cycling dominates, top-bottom purple-to-gold drift lost"}
  - {name: det, default: "random(0.001)", tried: ["random(0.01)"], change: subtle, effect: "no visible change at this scale (only a few pixels)"}
  - {name: ww, default: "dd*1.2", tried: ["dd*2.0"], change: subtle, effect: "no visible change: quads already overlapped at 1.2x spacing"}
  - {name: colors, default: "6-color mauve/amber palette", tried: "5-color dark red/crimson palette (line 102)", change: large, effect: "entire field recolored to red/magenta, same band structure"}
  - {name: z-amp, default: "noi*1", tried: "noi*10", change: subtle, effect: "subtle: more visible per-cell stepping, same palette drift"}
reusable_candidates:
  - {name: cycleLerpColor, signature: "cycleLerpColor(colors[], v) -> color", note: "wraps v modulo palette length and lerps between adjacent entries"}
  - {name: gradientQuadGrid, signature: "gradientQuadGrid(cells, spacing, colorA(i), colorB(j)) -> void", note: "grid of quads, top edge solid color, bottom edge alpha 0 (vertical fade)"}
  - {name: noiseZDisplace, signature: "noiseZDisplace(x, y, detail, amp) -> float", note: "simplex-noise z-offset under P3D perspective (scale distortion)"}
---

## What it draws
A full-bleed canvas of roughly twenty horizontal bands that read as soft stripes: the top
bands are periwinkle purple-blue, the middle bands are a muted mauve, and the bottom bands are
golden amber. Band edges are mostly straight but jagged in a few places (a row or two of cells
starts a few pixels higher/lower than its neighbours). Faint lighter vertical streaks run
through the field, strongest at the right edge and in the lower half, so the stripes look
slightly washed or scanned.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the piece is static (tata.pde:23-34).
- `generate()` (tata.pde:44-94) seeds RNG/noise with `seed` (harness sets 42), picks a random
  palette colour as background, then computes the grid: `cc = int(random(80, 280)*0.2)` (16-56
  cells per side), `dd` the cell spacing, `ss` an unused larger cell size (tata.pde:50-53).
- Two nested loops over `j` (rows) and `i` (cols) (tata.pde:62-93). Each cell samples three
  independent 2-D simplex noises at three tiny details (`det`, `det2`, `det3`, all
  `random(0.001)`; det2/det3 only used in commented-out lines). `translate(0, 0, noi*1)`
  pushes the quad slightly toward or away from the camera under P3D perspective (tata.pde:70),
  which is what produces the few jagged row edges (cells scale up/down by a few %).
- Each cell draws the same quad twice (tata.pde:73-89): a quad whose top edge is filled with
  `getColor(ic1+dc*i)` and bottom edge with the same colour at alpha 0 (a vertical fade-out
  strip), then again with `getColor(ic2+dc*j)`. In P3D, `fill(c, 0)` makes the bottom edge
  invisible, so overlapping faded quads accumulate into the soft banded stripes.
- Colour: `getColor(float v)` (tata.pde:111-117) wraps `v` modulo the 6-colour palette and
  lerps between the two adjacent entries — a cyclic gradient. `dc = random(0.2)` is small, so
  colour advances slowly: by `i` it makes the faint vertical streaks, by `j` the coarse
  top-to-bottom purple-to-gold drift.
- `ic1`, `ic2` are two random palette offsets (tata.pde:55-56); the background is a random
  palette colour (`rcol()`, tata.pde:105-107), though it is almost fully covered by the quads.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_0.1 | `  int cc = int(random(80, 280)*0.2);` -> `...*0.1);` | moderate | roughly half as many, much thicker bands; same purple-to-gold drift; stepped cell edges larger and more obvious | variants/cc_0.1/frame_00001.png |
| dc_1.0 | `  float dc = random(0.2);` -> `  float dc = random(1.0);` | moderate | color now cycles per column: field reads crimson/red with thin dark vertical ticks; the smooth top-to-bottom purple-to-gold gradient is gone | variants/dc_1.0/frame_00001.png |
| det_0.01 | `  float det = random(0.001);` -> `  float det = random(0.01);` | subtle | no visible change; a few row edges step slightly more | variants/det_0.01/frame_00001.png |
| ww_2.0 | `      float ww = dd*1.2;...` -> `      float ww = dd*2.0;...` | subtle | no visible change (quads already overlap at 1.2x spacing, so doubling width adds no new structure) | variants/ww_2.0/frame_00001.png |
| palette_dark | `int colors[] = {#D5D3D4, ... #D5B307};` -> `{#1A1312, #3C333B, #A84257, #D81D37, #D81D6E};` (line 102) | large | identical banding/stepping, whole field recolored to red/crimson/magenta with dark vertical ticks top-right | variants/palette_dark/frame_00001.png |
| z_10 | `      translate(0, 0, noi*1);//i*10);` -> `noi*10` | subtle | subtle: per-cell size variation is now clearly visible as a blocky stepped mosaic, but color and structure unchanged | variants/z_10/frame_00001.png |

## Modularisation notes
- Generic: `getColor(float)` cyclic palette lerp is a clean standalone function; the
  gradient-fade quad (top solid, bottom alpha 0) drawn per grid cell is a reusable
  "banding" primitive; simplex-noise z-displacement under perspective is a small reusable
  distortion helper.
- One-off art decisions: the specific 6-colour palette and the two independent i-based /
  j-based colour drifts, the `cc` count range, the tiny noise details.
- A clean parameter object: {cellCount, spacing, noiseDetail, zAmplitude, colorStep (dc),
  colorOffsetA (ic1), colorOffsetB (ic2), palette, backgroundColor}.
