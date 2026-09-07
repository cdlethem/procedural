---
sketch: 2019/generativos/berlin001
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1559
animated: false
techniques: [grid, polar, symmetry, dots-stippling]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#EF3621", "#295166", "#C9E81E", "#0F190C", "#F5FFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: bigEllipses, default: 70, tried: [15], change: large, effect: "fewer big alpha ellipses; mid-tone patches disappear, flat fields and striated bands dominate"}
  - {name: midCells, default: 220, tried: [60], change: moderate, effect: "thinner mid-cell layer; flower petal fans radiate more prominently across the canvas"}
  - {name: flowers, default: 40, tried: [10], change: large, effect: "fewer rosettes; a few huge flat fields, fewer striation bands, more poster-like"}
  - {name: bigSize, default: "random(120,240)*random(0.5,2)", tried: ["random(60,120)*random(0.5,2)"], change: none, effect: "no visible change - layer is fully covered by opaque flowers"}
  - {name: bigAlpha, default: "random(20,180)", tried: ["random(60,255)"], change: none, effect: "no visible change - layer is fully covered by opaque flowers"}
  - {name: petals, default: "random(6, random(12,42))", tried: ["random(6, random(12,18))"], change: large, effect: "coarser rosettes: fewer, wider petal wedges, broad striated fans"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "quad-strip ring between two radii with per-vertex alpha gradient (soft halo disc)"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform random pick from a palette list"}
  - {name: getColor, signature: "getColor(v) -> int", note: "lerp between two adjacent palette entries at pow(t,2) for a smooth background tint"}
---

## What it draws
Full-bleed abstract composition in five saturated colours (red, dark slate blue, yellow-green, near-black olive, off-white). Large flat angular fields dominate: a white angular region on the left, a red wedge below, slate-blue and yellow-green wedges at the top. Around the middle-right and lower-right the fields break into dense fine radiating striations (many thin overlapping ellipses), giving a hatched, fan-like texture. No background grid is visible in this seed — it is covered by the big shapes.

## How the code works
`setup()` calls `generate()` once (berlin001.pde:28); `draw()` is empty, so the piece is static. Everything is random (randomSeed(seed) at :59) and deterministic per seed.

1. **Background** (:62): `background(getColor())` — `getColor` (:202) lerps two adjacent palette colours, so the base is a tint from the same 5-colour list.
2. **Grid layer** (:66-73): 20 px grid over the whole canvas; each cell gets a `noFill` rect with `stroke(255, 20)` (faint outline) and a 2 px dot in a random palette colour. A stipple/grid texture, almost always buried under later layers.
3. **Big soft fields** (:77-89): 70 ellipses at random positions, snapped to the 20 px grid, size `random(120,240)*random(0.5,2)` (60-480 px) with alpha `random(20,180)`; each gets a smaller opaque core at 0.2x size (:88). The experiments below show this layer is completely covered by the opaque flowers for seed 42, so it contributes no visible pixels.
4. **Mid cells** (:92-106): 220 objects snapped to 20 px cells: an `arc2` halo ring (quad strip between radii with alpha gradient, :166) plus an opaque ellipse and a 0.4x core — medium texture patches.
5. **Flowers** (:112-150): 40 objects, each with `cc = int(random(6, random(12,42)))` petals (rotational symmetry, `da = TAU/cc`). First a translucent `arc2` halo drawn at z=-120 with depth test on (:109, :124). Then with a random Z rotation and a slight X/Y tilt (`maxRot` 0.1-0.3, :130-132), 5 concentric rings (k=0..4, scale `s2=k*ss`) of `cc` thin ellipses (`ss*s2` x `ss*0.6*s2`, each pre-rotated `rotateX(0.1); rotateZ(HALF_PI)` :143-145). These opaque 3D ellipses are what the image actually shows: the large flat fields are their big outer petals, the fine radiating striations are their dense thin petals.
6. **Colour**: `rcol()` (:196) picks uniformly from the 5-colour palette; petal colour is re-rolled until it differs from its ring colour (:138-139). P3D + depth test gives the overlap ordering of the flower layers.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| bigEllipses_15 | `for (int i = 0; i < 70; i++) {` -> `for (int i = 0; i < 15; i++) {` | large | fewer mid-tone patches; composition becomes huge flat white/red/yellow-green fields with dense striated bands (top-left, mid-right, lower-right) | variants/bigEllipses_15/frame_00001.png |
| gridCells_60 | `for (int i = 0; i < 220; i++) {` -> `for (int i = 0; i < 60; i++) {` | moderate | mid-cell texture thinned; multiple petal fans now radiate from centres across the canvas, starburst-like, fewer flat patches | variants/gridCells_60/frame_00001.png |
| flowers_10 | `for (int i = 0; i < 40; i++) {` -> `for (int i = 0; i < 10; i++) {` | large | only a few rosettes; canvas splits into huge flat regions with striation texture in a few bands; cleaner, poster-like | variants/flowers_10/frame_00001.png |
| bigSize_60_120 | `float ss = random(120, 240)*random(0.5, 2);` -> `float ss = random(60, 120)*random(0.5, 2);` | none | no visible change (pixel-identical); the big-ellipse layer is fully covered by the opaque flowers on top | variants/bigSize_60_120/frame_00001.png |
| bigAlpha_60_255 | `fill(rcol(), random(20, 180));` -> `fill(rcol(), random(60, 255));` | none | no visible change (pixel-identical); same coverage as above, alpha is moot | variants/bigAlpha_60_255/frame_00001.png |
| petals_18 | `int cc = int(random(6, random(12, 42)));` -> `int cc = int(random(6, random(12, 18)));` | large | coarser rosettes: fewer, wider petal wedges; broad diagonal red/blue/white striated fans instead of fine hatching | variants/petals_18/frame_00001.png |

## Modularisation notes
- `arc2` (soft alpha-gradient ring, :166-183) and `gradient` (:153) are fully generic — direct library candidates.
- The flower (:122-149) is a reusable "radial petal rosette": parameters = position, petal count cc, ring count (5), ring scale step, base size ss, tilt, palette. The `s2 = k*ss` loop with k starting at 0 draws a degenerate first ring (size 0) — harmless but worth fixing in a library version.
- The 20 px grid + stipple (:66-73) and the big-ellipse layer (:77-89) are generic "underlay texture" blocks, but for seed 42 both are completely hidden by the opaque flowers — a library version should make layer order/opacity explicit.
- The visible output is essentially "N random rosettes, opaque, overlapping": counts (40) and petal count (6-42) are the parameters that actually steer the look, as the experiments confirm.
- Art decisions to keep in the sketch: the 5-colour palette, the snap-to-grid alignment, the three-layer density/size balance (70/220/40), alpha ranges, and the z=-120 halo offset.
- A clean parameter object: {palette, gridCell, bigEllipses: {count, sizeRange, alphaRange}, midCells: {count, cellSize}, flowers: {count, petalRange, ringCount, tilt}, snap: true}.
