---
sketch: 2020/generative/01_04/noide
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi, peasy]
deterministic: true
ms_first_frame: 5355
animated: false
techniques: [voronoi-delaunay, noise-field, curves, distortion]
primitives: [line, shape]
palette:
  colors: ["#EA2E73", "#F7AA06", "#1577D8"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: triangulateEdges, signature: "triangulateEdges(points: PVector[]) -> Triangle[]", note: "Delaunay);` No wait—`float amp = lar*random(0.3, 0.8)*0.4*random(1, 3);` → `*1.2*`. This line is unique.

Wait, I need exactly 5 different parameters: cc, turns, detDes, amp, point count. Good.

Render directory naming: <param>_<value>.
- cc_1.2 (multiplier 1.2)
- turns_1_4 → maybe turns_1.3? Let's go with `turns_1_4`… more simply: turns_14? Hmm. `int(random(1, 4))` → name it `turns_1to4`? Let's keep it simple: `turns_1_4`.
- detDes_0.003: sub `detDes = random(0.0006, 0.001);` → `detDes = random(0.002, 0.004);` Name is detDes_0.003.
- amp_1.2: sub `float amp = lar*random(0.3, 0.8)*0.4*random(1, 3);` → `float amp = lar*random(0.3, 0.8)*1.2*random(1, 3);` Name is amp_1.2.
- points_50: sub `for (int i = 0; i < 100; i++) {` → `for (int i = 0; i < 50; i++) {` Name is points_50.

Check uniqueness of each OLD line:
- `int cc = int(random(140, 200)*0.6);` — line 107, unique.
- `float turns = int(random(4, 14));` — line 105, unique.
- `  detDes = random(0.0006, 0.001);` — line 64, unique (leading spaces don't matter, but let's match it exactly with the spaces included: "  detDes = random(0.0006, 0.001);").
- `float amp = lar*random(0.3, 0.8)*0.4*random(1, 3);` — line 103, unique.
- `for (int i = 0; i < 100; i++) {` — line 68, unique.

Run all 5 sequentially in a single bash call joined with `;`. About 33 seconds each → about 3 minutes. Timeout: set it to 300.
</think>

<tool_call>
<function=write>
<parameter=content>
---
sketch: 2020/generative/01_04/noide
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi, peasy]
deterministic: true
ms_first_frame: 5355
animated: false
techniques: [voronoi-delaunay, noise-field, curves, distortion]
primitives: [line, shape]
palette:
  colors: ["#EA2E73", "#F7AA06", "#1577D8"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: triangulateEdges, signature: "triangulateEdges(points: PVector[]) -> Triangle[]", note: "Delaunay triangulation of scattered points, only edges are used"}
  - {name: wavyLine, signature: "wavyLine(p1, p2, bundle, turns, amp) -> void", note: "bundle of parallel sinusoidal polylines along an edge"}
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, detail, offset, scale) -> PVector", note: "2-D simplex displacement (def())"}
---

## What it draws
Black full-bleed canvas. A large bright S-shaped ribbon of neon pink, amber and blue curves runs
diagonally through the centre, made of many overlapping thin wavy lines. Around it, fainter
swirling arcs and a dim web-like mesh of spiky triangle edges (pink/blue on black) fills the
background, brightest where several line bundles overlap.

## How the code works
`generate()` (noide.pde:52) re-runs every frame but is seeded (`randomSeed(seed)`, :54), so the
output is static. It scatters 100 random points pushed outward from the centre (`lerp(x, w*0.5,
-0.8)`, :68-74), Delaunay-triangulates them (Triangulate.triangulate, :76), then for every
triangle edge calls `linee()` (:91-95) with `blendMode(ADD)` (:59) so overlaps brighten.

`linee()` (:100) is the core: for one edge it draws `cc` (~84-120) parallel polylines (:113),
each oscillating perpendicular to the edge with `sin(v*turns*PI + k*da)` (:120), `turns` = 4-13
wiggles (:105) and random amplitude `amp` (:103). Every vertex is displaced by 3-D simplex noise
`def()` (:138-142) with detail `detDes` (0.0006-0.001) and up to 300 px offset, which is what
turns straight bundles into the flowing ribbons and the spiky background mesh. Colour is a random
pick from the 3-colour list per stroke (`rcol()`, :155-157) at low alpha
(`random(170,200)*0.018`, :90), so the neon look comes from additive blending of hundreds of
faint pink/amber/blue strokes. PeasyCam is imported but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic blocks: the triangulate-then-edge-iterate structure, `linee()` (wavy bundle of
  polylines with sinusoidal offset + noise displacement), and `def()` (simplex displacement).
  These map to the `reusable_candidates` above.
- One-off art decisions: the 100-point outward `lerp` scatter, the 3-colour ADD palette with
  ~3-alpha strokes, the fixed 300 px displacement scale, the per-frame regeneration loop.
- Clean parameter object: { pointCount, pointSpread, edgeBundle (cc), turns, ampScale,
  noiseDetail, noiseOffset, displaceScale, alpha, palette }.
