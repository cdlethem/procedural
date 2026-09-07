---
sketch: 2019/generativos/circNoi
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1518
animated: false
techniques: [noise-field, polar, grid]
primitives: [shape]
palette:
  colors: ["#ED61DA", "#200C2B", "#0029BF", "#FFE760", "#DBD1CB"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: clusterCount, default: 80, tried: [20], change: large, effect: "far fewer, much larger targets; black shows through between clusters"}
  - {name: maxRings, default: 40, tried: [10], change: large, effect: "thicker flatter bands, coarser colour steps per cluster; still dense"}
  - {name: clusterSizeRange, default: "random(200,500)", tried: ["random(50,200)"], change: large, effect: "clusters 4-8x smaller, scattered small targets, lots of black"}
  - {name: ampRad, default: 2, tried: [6], change: subtle, effect: "slightly more irregular ring outlines only (perturbs sample angles, not radii)"}
  - {name: paletteYellow, default: "#FFE760", tried: ["#7FFF00"], change: moderate, effect: "yellow rings become bright green; composition unchanged"}
reusable_candidates:
  - {name: noiseBlob, signature: "noiseBlob(cx, cy, radius, points, noiseScale, offsets, amp) -> shape", note: "closed ring of simplex-noise-deformed polar points; the core primitive of the sketch"}
  - {name: ringFan, signature: "ringFan(xs, ys, colA, colB) -> void", note: "triangle fan from origin filling a blob with two alternating shades"}
---

## What it draws
Full-bleed black canvas densely covered with overlapping concentric "target" clusters. Each cluster is a set of wobbly, noise-deformed rings (2 to ~40) in magenta, royal blue, dark purple, pale yellow and warm grey; the rings are not perfect circles but soft amoeba shapes, and the smallest innermost ring is drawn last so many clusters end in a small bright (usually yellow or pink) core. The clusters overlap heavily with no clear focal point, and the 40px grid snap of their centers leaves faint banding where ring edges line up.

## How the code works
`setup()` (L21) calls `generate()` (L34); `draw()` is empty, so the piece is static.
- L44: 80 clusters. Each gets a random center snapped to a 40px grid (L45–49) and a size `s` in [160, 500] (L51).
- Per cluster: random noise offsets `d1/d2` and noise scales (L53–57), wobble amplitude `ampRad` (L58), palette start index `ic` (L59), rotation `rot` (L61), ring count `int(random(2,40)*random(0.2,1))` (L63) — the second random biases the count toward the low end.
- L65–70: translate to the center; tiny `rotateX/Y/Z` scaled by 0.01 (negligible visible tilt; `DISABLE_DEPTH_TEST` at L41 means draw order, not z, decides overlaps).
- Ring loop (L71–108): per ring, `amp = map(j,0,rings,1,0.1)` shrinks the ring; `sub = max(amp*s*PI*0.3, 3)` points (L83). Each point's angle is itself perturbed by simplex noise (L91) and the radius is `pow(noise*0.9+0.1, 0.4)*s` (L92) — the 0.4 exponent flattens the noise distribution so radii vary a lot (wobble). The blob is filled by a `TRIANGLES` fan from the origin (L99–107) alternating `col` and `col2` (col2 = col darkened 20%, L82).
- Colour: `getColor(ic + j*0.5)` (L81, L134–139) lerps between adjacent entries of the 5-colour palette (L127), advancing half a step per ring, which produces the smooth ring-to-ring colour gradient seen in the image.
- Randomness: `noiseSeed`/`randomSeed` from the harness seed field `seed` (L38–39); all positions, sizes, ring counts and noise parameters derive from it, so renders are deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_20 | `for (int k = 0; k < 80; k++) {` -> `k < 20` | large | ~10 huge targets with clean concentric bands; black gaps between clusters | variants/count_20/frame_00001.png |
| rings_10 | `random(2, 40)*random(0.2, 1)` -> `random(2, 10)*random(0.2, 1)` | large | thick flat bands, few colour steps, big solid discs; still full-bleed | variants/rings_10/frame_00001.png |
| size_50_200 | `random(200, 500)` -> `random(50, 200)` | large | scattered small targets, sparse, large black areas, wobble visible at small scale | variants/size_50_200/frame_00001.png |
| wobble_6 | `random(1)*random(1)*random(1)*2;` -> `*6;` | subtle | ring outlines slightly more irregular; composition and colour essentially unchanged | variants/wobble_6/frame_00001.png |
| palette_green | `#FFE760` -> `#7FFF00` | moderate | yellow rings become bright green; magenta/blue/grey unchanged | variants/palette_green/frame_00001.png |

## Modularisation notes
- Generic: the `noiseBlob` polar loop (L88–96) is a clean reusable function — a closed simplex-noise ring with an exponent-controlled amplitude; `ringFan` (L99–107) and `getColor` (L134–139, a palette-lerp by fractional index) are also reusable as-is.
- One-off art decisions: 40px grid snap, the 0.01 rotate jitter, `z += 0.1` per ring (ineffective with depth test off), the `j*0.5` half-step palette advance, and the specific 5-colour palette.
- Parameter object: `{count, sizeRange, gridSnap, ringsRange, noiseScale1, noiseScale2, wobble (ampRad), radiusExponent, palette, paletteStepPerRing}` — everything else follows from these.
