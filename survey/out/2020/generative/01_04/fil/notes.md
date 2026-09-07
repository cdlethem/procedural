---
sketch: 2020/generative/01_04/fil
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1485
animated: false
techniques: [noise-field, polar, dots-stippling, distortion]
primitives: [shape, line, ellipse]
palette:
  colors: ["#ED4715", "#FFA3EC", "#B0A8FF", "#0D110F", "#FFB951"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: bigBlobCount, default: 100, tried: [40], change: large, effect: "fewer, more distinct background blobs; less tonal overlap"}
  - {name: bigBlobScale, default: 120, tried: [240], change: large, effect: "blobs 2x, merge into a few canvas-spanning faceted regions"}
  - {name: faceCount, default: 25, tried: [8], change: moderate, effect: "only ~8 face motifs; background unchanged"}
  - {name: spokeRange, default: "random(12,40)*random(1)", tried: ["random(12,40)"], change: moderate, effect: "every face gets dense full spokes; stronger starbursts"}
  - {name: vertexKeepProb, default: 0.1, tried: [0.3], change: moderate, effect: "blobs clearly smoother/rounder; faceting reduced"}
  - {name: palette, default: "ED4715,FFA3EC,B0A8FF,0D110F,FFB951", tried: ["04EDC2,FFED93,F9F9F9,000000,062FAA"], change: large, effect: "same structure, recoloured to cool teal/cream/blue/black"}
reusable_candidates:
  - {name: facetedCircle, signature: "facetedCircle(x, y, size, roughness) -> shape", note: "low-resolution polygon: res = r*PI*roughness candidate vertices, each kept with probability ~0.1; produces the angular blob look"}
  - {name: radialSpokes, signature: "radialSpokes(x, y, r, count, color) -> void", note: "cc evenly spaced (angle-jittered) lines from center to r with a 3px dot at each tip"}
  - {name: paletteLerp, signature: "getColor(v) -> color", note: "index into a 5-color list with wraparound, lerp between neighbours, pow(., 0.4) bias"}
---

## What it draws
A 960×960 flat composition of large, angular, faceted blobs in muted brick-red, dusty
purple, and near-black, laid over a single flat background colour; the big blobs are
semi-transparent and overlap into broad tonal regions. On top sit about 25 smaller
"face" motifs: a dark angular polygon with thin radial spokes (each ending in a small
dot) and a smaller solid inner blob in a bright palette colour (orange-red, pink,
lavender, or amber).

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (static, confirmed: frames 10/60
identical). `randomSeed(seed); noiseSeed(seed)` (L48-49) make it deterministic.

1. **Background**: `background(getColor())` (L51) — one colour from `getColor(v)`
   (L172-178), which wraps `v` over the 5-colour `colors[]` (L163) and lerps between
   neighbours.
2. **Big blobs** (L54-61): 100 iterations; position `random(width/height)`; size
   `s = random(5,10)*120*map(y,0,height,0.4,1)` (L57) → radius 240–600 px, smaller
   toward the top; fill is a palette colour darkened toward black
   (`lerpColor(col, color(0), …)`) with alpha `random(256)` (L59).
3. **Dead loop** (L72): `for (int i = 0; i < 0; i++)` — a second ADD-blend blob layer
   that is never executed (count 0).
4. **Faces "caras"** (L90-120): 25 iterations; size `s = random(5,10)*44*map(y,…)`
   then `s *= random(0.5,1)` (L93-94); colour lerps a random palette colour toward
   `getColor(noise(x*dc, y*dc))` (L95-96) — the one noise-field use — then darkened
   toward `#0D110F` (L97). Draws `cir(x,y,s,0.5)` (L98), then spokes: `r = s*random(0.3,0.5)`,
   `cc = int(random(12,40)*random(1))` (L102, often 0–half of the max), each spoke an
   angle-jittered `line` from center to `r` plus a 3×3 `ellipse` dot at the tip
   (L105-112); finally an inner `cir(x,y, s*random(0.3,0.7), 0.5)` (L114) in the spoke
   colour — the bright inner blob.
5. **`cir(x,y,s,rr)`** (L141-154): the key shape generator. `res = int(r*PI*rr)`
   candidate angles, a random phase offset, and a vertex is emitted only with
   probability 0.1 (L148) → 15–50 vertices on the circle → the faceted, irregular
   polygon look. `rr` (0.25 for big blobs, 0.5 for faces) controls angularity.

Randomness enters via `random()` everywhere after the seed; no per-frame change.
`smooth(8)` (L19) softens edges.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count100_40 | `for (int i = 0; i < 100; i++)` -> `for (int i = 0; i < 40; i++)` | large | background blob layer sparser: fewer, more distinct faceted blobs with less tonal overlap; faces unchanged | variants/count100_40/frame_00001.png |
| size120_240 | `random(5, 10)*120*map` -> `random(5, 10)*240*map` | large | blobs doubled: a few huge canvas-spanning faceted regions dominate; faces look comparatively tiny | variants/size120_240/frame_00001.png |
| faces25_8 | `for (int i = 0; i < 25; i++)` -> `for (int i = 0; i < 8; i++)` | moderate | only ~8 face motifs remain; background identical in character | variants/faces25_8/frame_00001.png |
| cc_full | `int cc = int(random(12, 40)*random(1));` -> `int cc = int(random(12, 40));` | moderate | every face now has a dense full ring of spokes (no sparse/empty faces); stronger starburst effect | variants/cc_full/frame_00001.png |
| cirprob_0.3 | `if (random(1) < 0.1) {` -> `if (random(1) < 0.3) {` | moderate | all blobs visibly smoother and rounder (more vertices kept); faceted look greatly reduced | variants/cirprob_0.3/frame_00001.png |
| palette_cool | `int colors[] = {#ED4715, #FFA3EC, #B0A8FF, #0D110F, #FFB951};` -> `{#04EDC2, #FFED93, #F9F9F9, #000000, #062FAA};` | large | identical structure, fully recoloured: mint/teal, cream, lavender-blue, black | variants/palette_cool/frame_00001.png |

## Modularisation notes
- **Generic (library candidates)**: `cir()`/facetedCircle (random-subsampled polygon
  from a circle — the core visual device, fully parameterisable by radius and
  roughness), the radial-spokes motif, and `getColor(v)` palette-walk.
- **One-off art decisions**: the 5-colour palette, the specific size multipliers
  (120 / 44) and the y-dependent `map(y,0,height,0.4,1)` scaling, the face count (25),
  the darkening toward `#0D110F`, and the dead ADD-blend loop (L66-86) which is
  unused and could be deleted.
- **Clean parameter object**: `{seed, bgIndex, bigBlobCount, bigBlobScale, faceCount,
  faceScale, spokeRange:[min,max], spokeJitter, vertexKeepProb, darkening,
  palette[]}`. The sketch is a two-layer scatter: a background field of large
  faceted translucent blobs plus a foreground scatter of spoked face motifs.
