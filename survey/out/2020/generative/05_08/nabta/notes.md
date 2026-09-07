---
sketch: 2020/generative/05_08/nabta
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1604
animated: false
techniques: [noise-field, voronoi-delaunay, packing]
primitives: [shape]
palette:
  colors: ["#057EBF", "#DBB304", "#E1E7ED", "#04140C"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: detSize, default: "random(0.008)", tried: [0.002], change: moderate, effect: "spacing noise varies more slowly -> larger, more uniform facets and broader colour fields"}
  - {name: det, default: "random(0.01)", tried: [0.03], change: large, effect: "finer colour noise -> smaller, busier mottled colour regions, large blue fields break up"}
  - {name: pointCount, default: 10000, tried: [3000], change: large, effect: "sparser point set -> larger, blockier facets; more black background shows at the edges"}
  - {name: radiusScale, default: 40, tried: [80], change: moderate, effect: "doubled minimum distance -> far fewer, much larger facets, coarser mosaic"}
  - {name: noiseAmp, default: 2, tried: [0.5], change: moderate, effect: "smaller min distance -> denser, smaller, more uniform facets; less black background"}
  - {name: palette, default: "#057EBF #DBB304 #E1E7ED #04140C", tried: ["#EDF67D #F896D8 #CA7DF9 #724CF9 #564592"], change: large, effect: "fully recoloured (lavender/pink/yellow-green); facet geometry identical to baseline"}
reusable_candidates:
  - {name: noisePackedPoints, signature: "noisePackedPoints(count, canvasW, canvasH, detSize, radiusScale, gridSnap) -> PVector[]", note: "rejection-sampled point set: grid-snapped random candidates kept only if farther than a noise-modulated radius from all kept points (Poisson-disk-like with spatially varying density)"}
  - {name: paletteNoiseColor, signature: "paletteNoiseColor(noiseVal, palette[]) -> color", note: "maps a continuous noise value to a palette: index = v % n, color = lerp(palette[i], palette[(i+1)%n], pow(v%1, 0.4))"}
---

## What it draws
A full-bleed low-poly mosaic of soft-edged triangles on a black ground (black shows through at the
corners/edges where the points' convex hull falls short of the canvas). The facets are large and
blocky; mid-blue dominates, interrupted by a broad diagonal band of off-white/grey, scattered
yellow facets, and dark green-black patches. Colour shifts smoothly *within* each triangle, so the
whole image reads as a blurred, watercoloured terrain map rather than a hard faceted one.

## How the code works
`setup()` calls `generate()` (nabta.pde:20-28); `draw()` is a no-op, so the image is static.
- **Point placement** (lines 51-68): 10000 candidate iterations. Each candidate (x, y) is uniform
  random, then snapped to a grid of size `2^int(random(1,5))` (lines 56-58), creating a
  multi-scale clustering. `s = noise(x*detSize, y*detSize)*2` (line 55) with
  `detSize = random(0.008)` (line 49). A candidate is kept only if it is at least `40*s` away
  from every kept point (lines 60-66) — a Poisson-disk-style packing whose minimum distance is
  modulated by simplex/Perlin noise, so density and facet size vary smoothly across the canvas.
- **Triangulation** (line 72): `Triangulate.triangulate(points)` (triangulate jar) produces the
  Delaunay triangles drawn in the image.
- **Colour** (lines 73-83): one `beginShape(TRIANGLES)` pass; for each triangle the fill of all
  three vertices is set to `getColor(noise(vertex.x*det, vertex.y*det)*6)` with
  `det = random(0.01)` (line 70). `getColor(v)` (lines 102-108) takes the continuous value,
  indexes the 4-colour palette (line 93: `#057EBF, #DBB304, #E1E7ED, #04140C`) with `v % 4`, and
  lerps to the next palette entry with `pow(v%1, 0.4)`. Per-vertex colours are interpolated by
  the P3D renderer, which is what gives each triangle its smooth internal gradient.
- **Randomness**: everything derives from the `seed` field (line 4, harness-set to 42) via
  `randomSeed`/`noiseSeed` (lines 45-46). Random also drives the grid snap size, the two noise
  scales, and (in the unseeded default run) the initial seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| detSize_0.002 | `float detSize = random(0.008);` -> `random(0.002);` | moderate (mean 0.065, 0.238 of px) | facets larger and more uniform; colour regions broader (wider white band, bigger blue fields) | variants/detSize_0.002/frame_00001.png |
| det_0.03 | `float det = random(0.01);` -> `random(0.03);` | large (mean 0.2026, 0.669 of px) | busier mottling: colour regions smaller, all four colours mixed more evenly, blue fields fragmented | variants/det_0.03/frame_00001.png |
| pointCount_3000 | `for (int i = 0; i < 10000; i++) {` -> `i < 3000` | large (mean 0.1873, 0.644 of px) | sparser points: larger, blockier facets, more black ground visible (wider black band at bottom) | variants/pointCount_3000/frame_00001.png |
| radius_80 | `dist(...) < 40*s` -> `dist(...) < 80*s` | moderate (mean 0.1128, 0.431 of px) | far fewer, much larger facets; coarse mosaic with a handful of big triangles | variants/radius_80/frame_00001.png |
| noiseAmp_0.5 | `noise(...)*2` -> `noise(...)*0.5` | moderate (mean 0.0762, 0.292 of px) | denser, smaller, more regular facets; less black background, same colour layout | variants/noiseAmp_0.5/frame_00001.png |
| palette_pastel | 4-colour list -> 5-colour pastel list from commented line 91 | large (mean 0.17, 0.889 of px) | recoloured: lavender/violet dominates with pink blobs and yellow-green accents; facet geometry unchanged from baseline | variants/palette_pastel/frame_00001.png |

## Modularisation notes
- **Generic / library-worthy**: `noisePackedPoints` (noise-modulated Poisson-disk packing with
  optional grid snap) and `paletteNoiseColor` (continuous-to-palette lerp) are both independent of
  the sketch's art choices and reusable. The triangulate call itself is already a library.
- **One-off art decisions**: the 4-colour palette, the `*2` on the noise amplitude (line 55), the
  `40` radius multiplier (line 62), the `*6` and `pow(...,0.4)` shaping in `getColor`, the grid
  snap to powers of two, and the black background.
- **Clean parameter object**: `{seed, canvasSize, pointBudget (10000), detSize (~0.008),
  noiseAmp (2), radiusScale (40), gridSnap (true), colorDet (~0.01), palette[], lerpExp (0.4),
  background}`.
