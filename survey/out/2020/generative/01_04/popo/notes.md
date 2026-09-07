---
sketch: 2020/generative/01_04/popo
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1679
animated: false
techniques: [noise-field, packing, dots-stippling]
primitives: [line, ellipse]
palette:
  colors: ["#D5D3D4", "#CF78AF", "#DA3E0F", "#068146", "#424BC5", "#D5B307"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: attempts, default: 120000, tried: [30000], change: subtle, effect: "fewer attempts -> slightly sparser field; overall structure preserved (packing saturates early)"}
  - {name: sizeScale, default: 150, tried: [60], change: moderate, effect: "lower -> many more, smaller dots, spread more evenly; web fills in, empty centre shrinks"}
  - {name: detSize, default: "random(0.007,0.01)*0.4", tried: ["random(0.03,0.05)*0.4"], change: subtle, effect: "finer noise -> finer-grained, more uniform clumping; large empty centre persists"}
  - {name: trailSteps, default: 60, tried: [120], change: subtle, effect: "double the trail length; trails read as longer soft drips, heads and web unchanged"}
  - {name: lineAlpha, default: 20, tried: [90], change: none, effect: "no visible change (thin 1.6px web lines darken but overall look is unchanged)"}
  - {name: palette, default: "bright 6-color", tried: ["dark 5-color #1A1312..#D81D6E"], change: subtle, effect: "identical composition; dots and trails in dark near-black/gray/crimson/magenta instead of bright 6 colors"}
reusable_candidates:
  - {name: poissonPack, signature: "poissonPack(w, h, attempts, sizeFn, margin) -> PVector[]", note: "rejection-sampled packing with per-point radius from a size function"}
  - {name: nearestChain, signature: "nearestChain(points) -> line[]", note: "greedy nearest-neighbour spanning chain (hand-rolled, not the imported triangulate lib)"}
  - {name: dripTrail, signature: "dripTrail(x, y, color, steps, step, fade) -> void", note: "vertical tapering dot trail with random horizontal jitter"}
---

## What it draws
Off-white field of a few hundred small colored dots (gray, pink, orange, green, blue, yellow) joined by a faint thin gray network of lines, like a sparse constellation. Every dot carries a short downward trail of fading dots, so each reads as a dripping or falling speck. Dot density is patchy: crowded along the top edge and the lower third, thin and empty across the middle — an uneven, organic clumping, not a grid.

## How the code works

1. **Packing loop** (lines 52–72): 120000 attempts; each candidate `(xx,yy)` gets a size `ss = noise(x*detSize, y*detSize)^1.4 * 150 * random(random(random(1),1),1)` (lines 57–59). `detSize` (~0.0028–0.004) makes the noise vary slowly, so large regions share similar sizes. A candidate is rejected if it lies within `(ss+other.z)*0.5` of any accepted point (lines 62–68) — a noisy, size-weighted Poisson-style packing. Larger noise values allow bigger points, which carve out exclusion zones; the resulting density map follows the noise field.
2. **Connection chain** (`connects`, lines 114–156): greedy nearest-neighbour spanning chain — repeatedly links the closest pair between the reached and unreached sets, drawing `line()` with `stroke(0,20)`, weight 1.6 (lines 149–151). This produces the faint gray web. The imported triangulate/toxi libs are not actually used.
3. **Dot + trail** (lines 77–90): per point, a random palette color (`getColor()`, lerp between two adjacent palette entries at a random fraction, lines 173–178); 60 ellipses stepping down `1.2` px per step, jittered horizontally by `random(-1,1)*random(1)`, size and alpha fading as `5*(1-j/60)` and `40*(1-j/60)` — the dripping tail.
4. **Head dot** (lines 92–97): a 5 px ellipse at each point in `rcol()` (pure random palette pick, line 168) with `stroke(0,10)`.

Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (lines 46–47); `keyPressed` regenerates with a new seed (lines 36–42). P2D renderer, `smooth(8)` (lines 18–19).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| attempts_30000 | `for (int i = 0; i < 120000; i++) {` -> `for (int i = 0; i < 30000; i++) {` | subtle | slightly fewer dots and a sparser web; same clumped structure, same empty middle | variants/attempts_30000/frame_00001.png |
| sizeScale_60 | `float ss = nn*150*random(...)` -> `nn*60*random(...)` | moderate | clearly busier: many more, smaller dots spread far more evenly; the web fills the gaps and the empty central band largely closes | variants/sizeScale_60/frame_00001.png |
| detSize_fine | `random(0.007, 0.01)` -> `random(0.03, 0.05)` | subtle | finer-grained, more uniform clumps; large empty central region still present, overall look preserved | variants/detSize_fine/frame_00001.png |
| trail_120 | `j < 60` -> `j < 120` + `j*(1./60)` -> `j*(1./120)` | subtle | trails about twice as long with a gentler fade, reading as longer soft drips; heads and web unchanged | variants/trail_120/frame_00001.png |
| palette_dark | `int colors[] = {#D5D3D4, #CF78AF, #DA3E0F, #068146, #424BC5, #D5B307};` -> `{#1A1312, #3C333B, #A84257, #D81D37, #D81D6E}` | subtle | identical dot positions, trails and web; colours now dark near-black, dark gray, crimson and magenta (verified in pixel data) | variants/palette_dark/frame_00001.png |
| lineAlpha_90 | `stroke(0, 20);` -> `stroke(0, 90);` | none | no visible change; thin web lines darken but the overall composition reads the same | variants/lineAlpha_90/frame_00001.png |

## Modularisation notes
- **Generic**: the packing loop (size function injected), the nearest-neighbour chain, the drip trail, and the lerp-between palette picker are all separable pure functions of (seed, size, count, palette).
- **One-off art decisions**: the specific `^1.4` noise shaping, the `random(random(random(1),1),1)` size jitter, the 1.2 px vertical step and 5 px dot size, the two different alpha treatments (trails 40 vs heads 10), and the fixed 6-color palette (three commented-out alternates show the author swapped palettes per variant).
- **Parameter object**: `{seed, w, h, attempts, margin, noiseDetail, sizeScale, sizeJitter, trailSteps, trailStep, trailFade, dotSize, lineColor, lineAlpha, lineWeight, palette}`.
