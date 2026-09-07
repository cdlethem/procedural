---
sketch: 2020/generative/05_08/brotes
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1467
animated: false
techniques: [recursion, agents, distortion]
primitives: [ellipse, shape, line]
palette:
  colors: ["#021408", "#375585", "#9FBF96", "#1D551B", "#E6C5CD"]
  selection: lerp-between
composition: centered
parameters:
  - {name: root_count, default: 1, tried: [3], change: subtle, effect: "three overlapping stems from the bottom edge; denser canopy, same overall composition"}
  - {name: root_width, default: "width*random(0.02,0.04)", tried: ["width*random(0.05,0.09)"], change: subtle, effect: "stems and lower segments visibly thicker (blue/green base limbs), canopy density similar"}
  - {name: iterations, default: 9, tried: [13], change: subtle, effect: "more recursion depth: twigs reach further to the sides, slightly busier canopy, same look"}
  - {name: fanout, default: "random(2, random(2,4.6)*random(1))", tried: ["random(2, random(2,8)*random(1))"], change: subtle, effect: "more child branches per segment; denser twig tangle, similar silhouette"}
  - {name: disc_size, default: "width*0.6", tried: ["width*0.85"], change: moderate, effect: "central taupe disc grows to fill most of the canvas; branches now sit against a much larger backdrop"}
  - {name: shadow_alpha, default: 50, tried: [160], change: none, effect: "no visible change: the faint grey ghost quads are barely visible at either alpha"}
reusable_candidates:
  - {name: recursiveBranch, signature: "recursiveBranch(x, y, w, h, angle, iterations) -> void", note: "self-similar branching segment: draw shadow quad + textured quad + node dots, then spawn 1-3 child segments at lerped positions with randomised angles and shrinking width"}
  - {name: paletteLerp, signature: "paletteLerp(colors, v) -> int", note: "index a colour list with a float and lerp between the two neighbouring entries"}
---

## What it draws
Off-white background with one large flat taupe disc centred on the canvas. Growing from the
bottom edge are several tall recursive "sprout" structures: thick near-black stems at the base
thinning into a dense canopy of thin angled twigs in dark green, blue, sage, and pale pink.
Faint grey ghost-branches echo behind the main stems, and short black dots mark the joints
between segments. The whole figure is asymmetric, leaning left, with the canopy spreading
across the top third.

## How the code works
- `setup()` calls `generate()` once; `draw()` calls it again per frame but the image is
  deterministic and identical (frames 10/60 dropped as identical to frame 1).
- `generate()` (brotes.pde:45): sets `randomSeed`/`noiseSeed` from the harness-injected seed,
  paints `background(252,250,245)` (the off-white), then draws the central disc — an
  `ellipse` at 50% position, 60% of canvas size, with `fill(getColor())`. The code intends a
  random lerp between two palette colours (brotes.pde:159-165), but in the render the disc is
  a flat taupe, not a palette colour — likely a headless-P2D fill/texture-state quirk; note it
  and do not chase it.
- One root call: `rama(x≈0.5*width, y=1.9*height, w≈2-4% width, h=0.9*height, a≈270°±, 9)` —
  the root starts off-canvas below, so stems enter from the bottom (brotes.pde:56-59).
- `rama()` (brotes.pde:62) is the recursive workhorse. Each segment: computes the endpoint
  `nx,ny` at angle `a`, length `h`. If iterations remain: draws a semi-transparent black
  "shadow" quad (`fill(0,50)`, 4-arg `vertex` with NORMAL texture mode, lerped toward the
  left/bottom edge — the faint grey ghost copies), then the visible quad
  `fill(getColor(ite))` whose colour depends on remaining depth (so depth maps to the
  palette), then black node dots at both ends (`ellipse`, size ∝ segment width).
- Branching: `cc = int(random(2, random(2, 4.6)*random(1)))` children (brotes.pde:98) — 1 to
  ~3 children per segment — each child placed at a random lerp point along the parent, with a
  randomised angle (random spread 0.8–4.2 rad, weighted by extra `random(1)` calls), width and
  length multiplied by ~0.5-0.7, and depth decremented by a random 1.1. This produces the
  self-similar thinning canopy and the dense twig tangle at the top.
- Colour: 5-entry list (dark green, blue, sage, dark green, pale pink, brotes.pde:150);
  `getColor(v)` lerps between neighbouring entries with a pow curve; `rcol()` (random list
  pick) is defined but only used in commented-out code, so actual fills come from depth-indexed
  `getColor(ite)`.
- Imports of triangulate and toxi are present but unused by the active code paths.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| branches_3 | `for (int j = 0; j < 1; j++) {` -> `j < 3` | subtle (mean 0.027, 0.068 px) | three stems instead of one, all near the bottom-centre; denser canopy, composition otherwise unchanged | variants/branches_3/frame_00001.png |
| stemw_0.07 | `width*random(0.02, 0.04)` -> `width*random(0.05, 0.09)` | subtle (mean 0.021, 0.056 px) | base stems and lower limbs visibly thicker (blue and green), fine twigs unchanged | variants/stemw_0.07/frame_00001.png |
| ite_13 | `PI*1.5+aa, 9-j);` -> `PI*1.5+aa, 13-j);` | subtle (mean 0.031, 0.074 px) | twigs spread further left/right and slightly busier canopy; overall look similar | variants/ite_13/frame_00001.png |
| fanout_8 | `random(2, random(2, 4.6)*random(1))` -> `random(2, random(2, 8)*random(1))` | subtle (mean 0.045, 0.114 px) | denser twig tangle in the canopy, silhouette roughly the same | variants/fanout_8/frame_00001.png |
| disc_0.85 | `width*0.6, height*0.6` -> `width*0.85, height*0.85` | moderate (mean 0.083, 0.278 px) | central disc now covers most of the canvas; branches overlap a much larger taupe field | variants/disc_0.85/frame_00001.png |
| shadow_160 | `fill(0, 50);` -> `fill(0, 160);` | none (mean 0.003, 0.011 px) | no visible change: the grey ghost quads remain equally faint | variants/shadow_160/frame_00001.png |

## Modularisation notes
- Generic: `recursiveBranch` (the `rama` core: shadow quad + colour quad + node dots +
  randomised children) is a clean library primitive; `paletteLerp` is trivially reusable.
  The shadow-quad lerp toward a fixed corner is a one-off art decision (gives the ghosting).
- One-off decisions: starting the root off-canvas at `1.9*height`; the 270° base angle;
  the semi-transparent black shadow layer; the central disc; the specific 5-colour palette.
- Clean parameter object: `{seed, disc: {size, color}, root: {count, x, y, width, length,
  angle, iterations}, branch: {minChildren, maxChildren, angleSpread, shrinkWidth,
  shrinkLength, depthDecay}, palette: {colors, alpha}}`.
