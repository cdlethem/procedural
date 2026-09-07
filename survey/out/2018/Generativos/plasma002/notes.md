---
sketch: 2018/Generativos/plasma002
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1831
animated: true
techniques: [particles, packing, polar, symmetry]
primitives: [point]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: rejectDiskPacking, signature: "rejectDiskPacking(attempts, radiusRange) -> PVector[]", note: "rejection-sampled set of non-overlapping discs (x, y, size in z)"}
  - {name: pointOrb, signature: "pointOrb(x, y, r, color, density) -> void", note: "additive point-disc: 500x100 points on a drifting spherical projection with cosine-oscillating alpha, plus a 1000-point crisp ring"}
  - {name: spokedEllipse, signature: "spokedEllipse(x, y, r, spokes, squash, rot) -> void", note: "4000-point elliptical outline with points bunched toward N spoke lines"}
---

## What it draws
On a black background, a scattered pack of roughly ten to twenty non-overlapping glowing
orbs, each a soft disc of densely stippled points in warm reds/oranges/golds or cool
blues/indigos (with occasional near-black discs). Each orb has a bright star-like core,
fine radial filaments, a crisp thin circular outline, and one or two larger elliptical
rings with faint spoke-like bunching. Orbs overlap in outline but their bodies never
touch; the canvas is fully covered (full-bleed). Note: the harness's frame 1 capture is
an overexposed, nearly all-white version of the same composition (additive points
saturated); frames 10 and 60 are identical and show the intended dark, coloured result.

## How the code works
`setup()` (L2-8) creates a 960x960 P2D canvas, calls `generate()` once; `draw()` (L10-11)
is empty, so the image is static after setup (the frame-1 vs frame-10 difference is a
first-frame P2D capture artifact, not animation).

`generate()` (L21-110):
1. Seeds: `randomSeed(seed)`, `noiseSeed(seed)` (L23-24); `background(0)` black (L26).
2. Packing (L28-44): 100 attempts; each candidate at random position with size
   `s = width*random(0.1, 0.3)` (L32); accepted only if distance to every accepted
   point is at least `(s+p.z)*0.5` (L36) — no overlapping discs.
3. `blendMode(ADD)` (L46) over black — additive point accumulation makes dense areas
   glow white at the cores.
4. Per orb (L48-109), four point passes:
   - Soft disc (L54-68): 500x100 = 50k points; angles `a1`,`a2` do random walks with
     tiny steps (±0.05, L59-60); plotted as `(x+cos(a1)cos(a2)*r, y+sin(a1)cos(a2)*r)`
     (the 3rd `point()` arg is z, ignored in P2D) — a disc of points whose radius
     breathes as `a2` drifts. Alpha oscillates `(cos(alp)*0.5+0.5)*110` (L65), giving
     the shimmering soft body.
   - Crisp ring (L70-74): 1000 points at random angles on the circle of radius `p.z`,
     alpha 180 — the thin bright outline.
   - Second wash (L76-86): new random palette colour, 10000 points on the same drifting
     spherical projection, alpha 60 — a paler overlapping disc that shifts hue inside
     the orb.
   - Scatter ring (L88-94): `va2=0`, `va1=random(100)` (fast), 1000 points — uniform
     scatter on a circle of radius `cos(a2)*r`.
   - Spoked ellipse (L97-108): translate to orb centre, random rotation;
     `cc = int(random(3,55))` spokes, `da = TAU/cc`; 4000 points on an ellipse
     (squashed by `amp = random(1)`, L97, L106) with angle `a = a1-(a1%da)*0.05`
     (L105) pulling each point 5% toward its spoke line — the spoked elliptical rings.
5. Colour: `rcol()` (L118-120) picks uniformly from the 5-colour `colors[]` array
   (L116). A commented-out alternate palette exists at L117.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the rejection-sampled packing (L28-44) is a clean, parameterised primitive
  (`attempts`, `radiusRange`, canvas size) — reusable as-is. The four per-orb point
  passes are each self-contained (position, radius, count, colour, alpha) and map well
  to library functions: soft additive disc, crisp ring, spoked ellipse. The drifting
  angle random-walk + cosine-alpha alpha modulation is the reusable "shimmer" parameter.
- Art decisions: the exact palette (L116), the four-pass layering order and their
  counts (50k/1k/10k/4k), the 5% spoke-pull factor (L105), the size range
  `random(0.1, 0.3)` of the canvas width, and choosing ADD blending on black.
- A clean parameter object: `{attempts, radiusMin, radiusMax, discPasses: [{count, alphaBase, alphaOsc}], ringCount, ringAlpha, washCount, washAlpha, spokesMin, spokesMax, squash, palette, blend}`.
