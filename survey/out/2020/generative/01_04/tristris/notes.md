---
sketch: 2020/generative/01_04/tristris
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1554
animated: false
techniques: [noise-field]
primitives: [shape]
palette:
  colors: ["#505050", "#000000", "#ff0000", "#0000ff"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: det, default: "random(0.1)*random(random(1)) (line 54, small value)", tried: [0.05, 0.001], change: large, effect: "noise-detail scale of the vertex walk: 0.05 scatters 1000 triangles into full-bleed spiky shards; 0.001 makes vertices nearly coincide, giving concentric striped nested triangles; baseline sits between (blobs with fringed edges). Substitution kept the same 3 RNG draws, so only det changed."}
  - {name: desCol, default: "random(0.1) (line 63)", tried: [0.005], change: subtle, effect: "geometry identical; colour advances 20x slower per triangle, so each palette colour spans more consecutive triangles: larger, flatter, more uniform blue/red regions inside the same blobs"}
  - {name: count, default: 1000, tried: [300], change: large, effect: "same overall silhouette, but the saw-tooth fringe disappears (edges nearly smooth) and the colour range stops before blue: only dark red/black/grey remain"}
  - {name: colors, default: "{#505050, #000000, #ff0000, #000000, #0000ff} (line 92)", tried: ["{#E8E6DD, #DFBB66, #D68D46, #857F5D, #809799, #5D6D83, #0F1C15} (commented line 89)"], change: large, effect: "geometry identical; muted blue-grey / olive / orange-tan / pale-cream earth tones instead of red/blue/black"}
  - {name: lerpGamma, default: 1.8, tried: [0.5], change: subtle, effect: "geometry identical; blend biased toward the second palette entry: top-left of the blue blob shifts to muted slate-purple, the grey spike top-right becomes black, rest largely the same"}
reusable_candidates:
  - {name: paletteLerp, signature: "paletteLerp(int[] colors, float v, float gamma) -> color", note: "wrap v around the palette and lerp between adjacent entries with pow(v%1, gamma) (getColor, lines 100-106)"}
  - {name: noiseTriStack, signature: "noiseTriStack(int count, float det, float seed) -> Triangle[]", note: "count noise-placed triangles whose vertices move slowly with i, so the stack merges into fringed blobs"}
---

## What it draws
Static 960x960 image: a few large overlapping soft-edged blobs in bright blue, dark navy, bright red and dark red, with sharp dark grey/black triangular spikes poking out of the right side, all on a light grey background. The blob edges are fringed with fine triangular saw-teeth rather than being smooth.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the image is static (baseline frames 10/60 identical to frame 1).
- `generate()` (lines 44-74): seeds RNG from `seed`, then sets `det = random(0.1)*random(random(1))` (line 54), a small noise-detail scale.
- Loop `i = 0..999` (line 56) builds one `Triangle` per i. Its three vertices are 2-D noise samples at `(i*det, i*det)` with axis offsets 200/500 (lines 58-60), mapped to `(-0.5..1.5) * size`, so vertices may land off-canvas.
- Because `det` is tiny, consecutive i give almost identical vertices: the 1000 triangles stack into a handful of large blobs, and their slightly offset edges produce the saw-tooth fringe.
- Colour: `desCol = random(0.1)` (line 63); triangle i gets `fill(getColor(i*desCol))` (line 68). `getColor(v)` (lines 100-106) wraps v around the active palette `{#505050, #000000, #ff0000, #000000, #0000ff}` (line 92) and lerps between adjacent entries with exponent 1.8. The palette's two black entries mean lerp steps pass through dark red and dark navy, which is exactly the dark red / navy regions seen in the image.
- `noStroke()`, P2D renderer, `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.05 | `random(0.1)*random(random(1))` -> `0.05` | large (mean 0.3584, 86.3% of pixels) | the blobs fall apart: triangles scatter across the whole canvas as spiky red/blue/grey/black shards, full-bleed | variants/det_0.05/frame_00001.png |
| det_0.001 | `random(0.1)*random(random(1))` -> `0.001` | large (mean 0.1619, 46.6% of pixels) | vertices nearly coincide: concentric red/blue/black striped nested triangles, plus one large flat dark-red triangle | variants/det_0.001/frame_00001.png |
| desCol_0.005 | `float desCol = random(0.1);` -> `float desCol = 0.005;` | subtle (mean 0.0297, 8.8% of pixels) | no visible geometry change; colour cycles ~20x slower, so the blue and red blobs are flatter, more uniform, with larger single-colour areas | variants/desCol_0.005/frame_00001.png |
| count_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | large (mean 0.2405, 55.2% of pixels) | same silhouette but edges are now nearly smooth (no saw-tooth fringe), and only dark red/black/grey appear — the blue i-range is dropped | variants/count_300/frame_00001.png |
| colors_warm | line 92 palette -> `{#E8E6DD, #DFBB66, #D68D46, #857F5D, #809799, #5D6D83, #0F1C15}` (commented line 89) | large (mean 0.2464, 59.5% of pixels) | no visible geometry change; muted blue-grey/olive/orange-tan/pale-cream earth tones instead of red/blue/black | variants/colors_warm/frame_00001.png |
| lerp_0.5 | `pow(v%1, 1.8)` -> `pow(v%1, 0.5)` | subtle (mean 0.0461, 18.8% of pixels) | no visible geometry change; blend biased toward the second palette entry — top-left of the blue blob shifts to muted slate-purple and the grey spike top-right becomes black, rest largely the same | variants/lerp_0.5/frame_00001.png |

Note: the `det` substitution replaced the random() expression with a constant but consumed the same three RNG draws, so the rest of the RNG stream is unchanged — a clean single-variable change.

## Modularisation notes
- Generic: `getColor`/paletteLerp (works for any palette + gamma) and the stacked-noise-triangle generator (count, det, seed are clean parameters).
- One-off art decisions: the specific 5-entry palette (with the deliberate double-black that creates the dark red / navy intermediates), the `det = random(0.1)*random(random(1))` expression, the 200/500 noise offsets, and the `[-0.5, 1.5]` coordinate range.
- Clean parameter object: `{count, det, desCol, palette, lerpGamma, seed}`.
- Experiments confirm the look is governed almost entirely by `det` (structure) and `palette`/`desCol`/`lerpGamma` (colour); `count` mainly controls edge fringe density and how far the colour range is traversed.
