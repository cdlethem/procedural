---
sketch: 2015/Generativos/mandalitas
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 2591
animated: false
techniques: [polar, symmetry]
primitives: [shape]
palette:
  colors: ["#000000", "#FF3C00", "#FFFF00"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "random(1,20)", tried: [5], change: large, effect: "fewer concentric rings per motif (max 5 vs 20); form1 consumes one random per ring, so the downstream stream shifts and colours reshuffle, making the collage read more orange"}
  - {name: s, default: "random(1,7)", tried: [3], change: moderate, effect: "sharper, spikier stars; the low-facet bumpy shapes disappear, clean spikes and triangles dominate"}
  - {name: c, default: "random(3,22)", tried: [12], change: moderate, effect: "every motif has 12+ points; more flower/mandala-like, the 3-point triangular stars vanish"}
  - {name: d, default: "random(80,340)*random(1)", tried: ["random(80,340)"], change: large, effect: "motifs much larger on average; big stars dominate the canvas, fine small detail mostly lost"}
  - {name: orange_prob, default: 0.2, tried: [0.6], change: large, effect: "majority of fills become orange/amber; orange dominates the palette, greys are the minority"}
  - {name: count, default: 500, tried: [150], change: large, effect: "clearly sparser scatter; white background visible between motifs"}
reusable_candidates:
  - {name: starburst, signature: "starburst(x, y, radius, points, facets) -> shape", note: "c-fold symmetric faceted star: per point, 2*facets+1 sub-vertices at radius (r/s)*(|j|+1), angle da*(i + j/s)"}
---

## What it draws
A dense full-bleed scatter of overlapping mandala-like star shapes on an 800x800 canvas.
Each motif is a radially symmetric, faceted starburst (3 to ~21 points) built from thin
near-black outlines, often nested in several concentric rings, and filled with a flat
grey. Roughly a fifth of the shapes are filled orange-to-amber, which makes the whole
image read as a busy grey collage punctuated by bright orange flower/star motifs.

## How the code works
`setup()` (mandalitas.pde:1) calls `generate()` once; `draw()` is empty, so the sketch
is static (frames 1/10/60 identical). `generate()` (lines 14-37) loops 500 times and
places one motif at a random position:

- `d = random(80, 340)*random(1)` (line 18) — motif diameter in [0, 340], skewed small.
- `c = int(random(3, 22))` (line 19) — number of star points (3-21).
- `s = int(random(1, 7))` (line 20) — facet count per point; each point is sub-divided
  into 2*s+1 vertices, so higher s gives a sharper, spikier star.
- `cc = int(random(1, 20))` (line 21) — number of concentric rings per motif; ring j has
  radius `dd = d/(j+1)` (line 23), so rings shrink geometrically toward the centre.

For each ring, the motif is first stroked 5 times with decreasing `strokeWeight(k)` for
k = 5..1 at `stroke(0, 6)` (lines 24-29) — a thick, soft-edged black outline. Then it is
filled once: normally `fill(random(255))` (a random grey, line 31), or with 20%
probability `fill(255, random(60, 200), 0)` — an orange-to-yellow (lines 32-33).

`form1()` (lines 44-57) draws one faceted star: `da = TWO_PI/c`, and for each of the c
points and j in -s..s it emits a vertex at angle `da*(i + j/s)` and radius
`(r/s)*(|j|+1)` (lines 49-54), closing the shape. The `dr = random(0.2)` on line 47 is
computed but never used (dead code). Randomness enters via position, size, point count,
facet count, ring count, and fill colour; there is no noise field, no transform besides
translation, and no blend mode.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_5 | `int cc = int(random(1, 20));` -> `int cc = int(random(1, 5));` | large | motifs have at most 5 concentric rings (deep target-like nesting gone); because form1 draws one random per ring, the stream also shifts and the whole collage looks more orange than the baseline | variants/cc_5/frame_00001.png |
| s_3 | `int s = int(random(1, 7));` -> `int s = int(random(3, 7));` | moderate | sharper, spikier star outlines; more clean triangular spikes and less bumpy low-facet shapes; same grey/orange balance | variants/s_3/frame_00001.png |
| c_12 | `int c = int(random(3, 22));` -> `int c = int(random(12, 22));` | moderate | all motifs 12-22 points; flower/mandala-like everywhere, no small 3-point stars; slightly more black in the fills | variants/c_12/frame_00001.png |
| d_full | `float d = random(80, 340)*random(1);` -> `float d = random(80, 340);` | large | motifs much bigger on average (no random downscale); a few very large stars cover big areas, fine small detail mostly lost | variants/d_full/frame_00001.png |
| orange_0.6 | `if (random(1) < 0.2)` -> `if (random(1) < 0.6)` | large | roughly 60% of fills orange/amber; orange dominates the palette, greys reduced to a minority | variants/orange_0.6/frame_00001.png |
| count_150 | `for (int i = 0; i < 500; i++) {` -> `for (int i = 0; i < 150; i++) {` | large | clearly sparser scatter; white background visible between motifs, same motif vocabulary | variants/count_150/frame_00001.png |

## Modularisation notes
- `form1` is the only genuinely reusable piece: a parameterised faceted starburst
  (centre, radius, points c, facets s). Everything else is one-off art decisions:
  the 500-motif scatter, the geometric ring shrink `d/(j+1)`, the 5-pass stroke, and
  the grey/orange fill lottery.
- A clean parameter object: `{count, sizeMin, sizeMax, points:[min,max], facets:[min,max],
  rings:[min,max], outlineWeight, outlineAlpha, fillGreys: true, orangeProb,
  orangeHue:[60,200]}`. The 5-pass decreasing-weight stroke could be factored into a
  `softOutline(shape, maxWeight)` helper.
