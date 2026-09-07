---
sketch: 2017/Generativos/trianglesLines2
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1612
animated: false
techniques: [subdivision, polar]
primitives: [shape]
palette:
  colors: ["#BCBDAC", "#E0A92A", "#F27435", "#F02475", "#33222F"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(1, random(10000))", tried: [15], change: large, effect: "fewer splits -> sparser, larger facets; the dominant facet-scale knob"}
  - {name: ringCount, default: 6, tried: [3], change: large, effect: "3 seed triangles -> 3-fold angular sectors instead of 6-fold"}
  - {name: shadeMax, default: 70, tried: [160], change: moderate, effect: "higher -> darker black facets, stronger 3D contrast"}
  - {name: palette, default: "5 warm colors", tried: ["5 cool colors"], change: large, effect: "recolored only; geometry unchanged"}
  - {name: ringRadius, default: "ss*0.25", tried: ["ss*0.5"], change: large, effect: "seed ring pushed outward -> denser, more uniform full-bleed coverage"}
reusable_candidates:
  - {name: subdivideTriangles, signature: "subdivideTriangles(List<Tri> tris, int iterations) -> List<Tri>", note: "repeatedly replace a random triangle with 4 half-size children (1 flipped center + 3 at corners); net +3 per split"}
  - {name: facetShade, signature: "facetShade(Tri t, float ap, float amax)", note: "draw 3 black gradient wedges from a random interior point to each edge to fake 3D faceting"}
---

## What it draws
A full-bleed low-poly mosaic of triangles in a warm palette (magenta, orange, golden yellow, grey, near-black plum). Each triangle is faceted with soft dark gradient wedges, giving a 3D / polyhedral look. The tessellation density is uneven: large triangles and a big dark region in the lower right sit next to dense, finely subdivided patches of tiny triangles.

## How the code works
`setup()` → `generate()` (line 6); the per-frame regenerate in `draw()` is commented out (line 10), so the image is static.

- **Seed / canvas:** `background(240)` light grey (line 26); translate to center plus a random ±50 offset and a random rotation (lines 27-29) — this is why the whole lattice is off-axis and not centered.
- **Seed ring (polar):** 6 triangles placed around the center (lines 31-38): angle `da*k - PI/6`, radius `ss*0.25` with `ss = width*random(1.8,2.4)`, size `ss*0.5`, orientation `da*(k+0.5)`. These are the largest triangles (the dark lower-right region).
- **Random recursive subdivision:** `sub = int(random(1, random(10000)))` (line 40); each iteration picks a random triangle, replaces it with 4 children via `Tri.sub()` (lines 43-45, 139-150): one flipped center triangle at half size and 3 corner triangles, so each split is net +3 triangles. After `sub` splits there are up to ~30k triangles, densely packed where splits concentrated.
- **Per-triangle colour:** `fill(rcol())` (lines 55-56) picks a random colour from the 5-colour palette (lines 153, 155-157); `getColor` (158-168) is defined but not used.
- **Faceted 3D shading:** for each triangle a random interior point `(cx,cy)` is chosen (lines 59-63, radius scaled by an angle factor 0.4-0.8); then for each of the 3 edges a black wedge `(cx,cy)-(edge)` is drawn (lines 64-80) with alpha `val*0.5 / val*0.8 / val`, where `val` (0-70) is the angle from the edge normal mapped 0..PI → 0..70. Three differently-alpha'd vertices make the wedge a gradient; together the three wedges fake a polyhedron face.
- Randomness enters via: the harness seed (42), `sub` count, the randomly chosen triangle each split, the per-triangle colour, the per-triangle interior point, and the initial translate/rotate.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_15 | `int sub = int(random(1, random(10000)));` -> `...random(1, random(15)));` | large | mostly empty light-grey background with a few large faceted triangles clustered in the corners; far sparser, much bigger facets | variants/sub_15/frame_00001.png |
| ringCount_3 | `for (int k = 0; k < 6; k++) {` -> `... k < 3 ...` | large | 3-fold angular structure (gold / dark-plum / magenta-orange sectors) instead of 6-fold; larger facets, less dense | variants/ringCount_3/frame_00001.png |
| shadeMax_160 | `0, PI, 0, 70);` -> `0, PI, 0, 160);` | moderate | same layout as baseline but black facets much darker; stronger 3D contrast | variants/shadeMax_160/frame_00001.png |
| palette_cool | `int colors[] = {#BCBDAC, #E0A92A, #F27435, #F02475, #33222F };` -> `int colors[] = {#1D3557, #457B9D, #A8DADC, #E63946, #F1FAEE };` | large | identical geometry recolored to cool blues/teal/red/off-white; reads more crystalline | variants/palette_cool/frame_00001.png |
| ringRadius_0.5 | `float rr = ss*0.25;` -> `float rr = ss*0.5;` | large | dense full-bleed mosaic everywhere; no single big dark region; most uniform coverage (largest pixel change) | variants/ringRadius_0.5/frame_00001.png |

## Modularisation notes
- **Generic / reusable:** `Tri.sub()` is a clean space-filling triangle subdivision (4 half-size children, 1 flipped) — a good library primitive. The `facetShade` wedge trick (3 gradient wedges from an interior point) is a reusable low-poly shading routine independent of the palette or subdivision.
- **One-off art decisions:** the specific 5-colour warm palette, the 6-triangle polar seed ring, the `±50` jitter + random rotation, and the alpha ramp constants (`0..70`, `*0.5/*0.8/*1.0`).
- **Clean parameter object:** `{subdivisions (int), ringCount (int), ringRadius (float), triangleScale (float), palette (int[]), shadeMax (float), shadeJitter (float), jitter (float), rotate (bool)}`. `subdivisions` is the dominant visual knob (facet scale); `ringCount`/`ringRadius` control the base layout; `shadeMax` controls 3D contrast.
