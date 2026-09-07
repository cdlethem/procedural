---
sketch: 2019/generativos/linescurvis
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1723
animated: false
techniques: [particles, dots-stippling, curves, distortion, 3d-mesh]
primitives: [ellipse, shape]
palette:
  colors: ["#FFFFFF", "#B0E7FF", "#143585", "#4C7F60", "#D08714", "#F98FC0"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: maxSize_small, default: "random(20, 70)", tried: ["random(60, 160)"], change: none, effect: "no visible change: small-walk slivers are buried under the big blob layer"}
  - {name: maxSize_big, default: "random(120, 300)", tried: ["random(200, 450)"], change: large, effect: "blobs much bigger and rounder; canvas more covered, less white ground between shapes"}
  - {name: zAmp, default: 16, tried: [40], change: subtle, effect: "composition identical; shading slightly stronger, more pronounced light/dark bands on the blob surfaces"}
  - {name: speckles, default: 1000, tried: [3000], change: large, effect: "score is large but from a random-stream shift (extra random() calls re-roll all walks); speckle density itself only subtly denser"}
  - {name: vline2_alpha, default: "random(200, 300)", tried: [255], change: large, effect: "big ribbons fully opaque: more saturated, denser, darker overlaps, less white ground showing through"}
  - {name: palette, default: "6-colour blue/green/orange/pink", tried: ["4-colour warm red/amber/green/steel-blue"], change: moderate, effect: "same composition, colours now coral red, amber, teal green, steel blue"}
reusable_candidates:
  - {name: ribbonWalk, signature: "ribbonWalk(segments, maxStep, ampMax, alphaMax, palette) -> void", note: "random walk whose segments are drawn as tapering QUAD_STRIP ribbons with a colour gradient along their length"}
  - {name: trigDisplace, signature: "trigDisplace(x, y, freq, zAmp) -> PVector", note: "cos/sin bump field used to lift ribbon vertices in z (gives the 3D wave + lighting shading)"}
  - {name: paletteLerp, signature: "getColor(v, colors[]) -> int", note: "abs(v) mod palette length, lerps between the two neighbouring colours; drifting v along a shape gives a smooth gradient"}
  - {name: speckleLayer, signature: "speckleLayer(count, sizeRange, alpha, palette) -> void", note: "scatter of tiny semi-transparent ellipses as ground texture"}
---

## What it draws
Dense full-bleed field of overlapping, semi-transparent ribbon shapes on a white ground.
Most forms are soft leaf/petal-like blobs, tapering to points at both ends, in pale blue,
navy, olive green, ochre orange and pink, layered so overlaps mix into muddy mid-tones.
Between the blobs are many thin, dark, hair-like curved slivers, plus a fine dust of tiny
speckles scattered across the whole canvas. The overall feel is a tangled tangle of
translucent petals, busiest in the centre.

## How the code works
Single-tab sketch, `linescurvis.pde`, P3D renderer (L16), 960x960, all work happens in
`generate()` from `setup()` (L26); `draw()` is empty so the image is static.
`randomSeed(seed)` (L50) makes it deterministic; seed comes from the harness (`seed` field).

Layer 1 (L59-64): 1000 tiny ellipses, size `random(2,3)*0.6` (~1.2-1.8 px), `noStroke()`,
`fill(rcol(), random(40))` — a low-alpha speckle dust in random palette colours. This is
the fine grain visible between the shapes.
Layer 2 (L69-83): after `translate(width/2, height/2)` (L67), 80 random walks of 40 steps;
each walk starts at `width/height*random(-0.6,0.6)` and steps by `dis = random(maxSize)*random(0.4,1)`
with `maxSize = random(20,70)`. Each step is drawn by `vline()` (L104): it builds a
`QUAD_STRIP` (L110) with `cc = int(dis*2)` segments; each vertex is displaced by `displace()`
(L148), which lifts the strip in z via `abs(cos(x*0.02)*sin(y*0.02)*16)` plus a tiny x/y jitter.
Width is a sine envelope `0.1+sin(v*PI)*0.9` (L118) so each ribbon tapers to points; per-ribbon
amplitude `a = random(1, ampMax)*random(0.2,1)*random(0.2,1)` (L113, ampMax=3 here) makes most
thin. Colour drifts along the strip: `fill(getColor(ic+dc*i), alphaMax*amp)` (L119) with
`ic = random(colors.length)`, `dc = random(0.01)` — the lerp between neighbouring palette
colours (L167-172) gives each ribbon a smooth two-colour gradient. Alpha 20-200 (L79).
These are the thin dark slivers.

Layer 3 (L85-101): 80 walks of 20 steps, much bigger (`maxSize = random(120,300)`), drawn by
`vline2()` (L126) with ampMax=120, alpha 200-300, and a `pow(sin(v*PI), pwr)` envelope
(L140, `pwr = random(0.5,2)`) that rounds or sharpens the taper. The wide, soft, high-alpha
leaf blobs come from here; `lights()` (L54) shades the z-displaced surfaces, which is why
blobs have a glossy, dimensional look. `stroke(255,5)` (L85) is effectively invisible.

Randomness enters via: walk start positions, step angle/length, per-ribbon amplitude,
per-ribbon palette start `ic` and drift `dc`, envelope power, and the speckle layer.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| maxSmall_160 | `float maxSize = random(20, 70);` -> `float maxSize = random(60, 160);` | none | no visible change: the thin small-walk slivers sit under the big blob layer and stay hidden | variants/maxSmall_160/frame_00001.png |
| maxBig_450 | `float maxSize = random(120, 300);` -> `float maxSize = random(200, 450);` | large | blobs much bigger and rounder, covering most of the canvas with less white ground between them | variants/maxBig_450/frame_00001.png |
| zamp_40 | `float zz = abs(cos(x*0.02)*sin(y*0.02)*16);` -> `... *40);` | subtle | same composition; surface shading slightly stronger, brighter highlights and more visible light/dark bands on the blobs | variants/zamp_40/frame_00001.png |
| speckle_3000 | `for (int i = 0; i < 1000; i++) {` -> `... i < 3000; ...` | large | whole composition re-rolled (extra random() calls shift the stream, moving every walk); the speckle dust itself only looks slightly denser — the large score is not a speckle effect | variants/speckle_3000/frame_00001.png |
| alpha255 | `vline2(ax, ay, x, y, 120, random(200, 300));` -> `vline2(ax, ay, x, y, 120, 255);` | large | big ribbons fully opaque: saturated, denser, darker overlaps; little white ground left | variants/alpha255/frame_00001.png |
| palette_warm | `int colors[] = {#ffffff, #B0E7FF, #143585, #4c7f60, #D08714, #F98FC0};` -> `{#DFAB56, #E5463E, #366A51, #2884BC};` | moderate | identical composition; palette now coral red, amber/orange, teal green and steel blue | variants/palette_warm/frame_00001.png |

## Modularisation notes
Generic, library-worthy blocks:
- `vline`/`vline2` are the same function except `sin` vs `pow(sin, pwr)` envelope and default
  amplitudes — collapse into one `ribbonWalk(segments, maxStep, ampMax, alphaMax, taperPower)`
  with the taper power as a parameter; the `pwr` random is an art decision to expose.
- `displace` (trig bump field) is fully generic: `trigDisplace(x, y, freq, zAmp)`; the specific
  frequencies (0.02, 0.2) and zAmp=16 are per-art parameters.
- `getColor(v)` palette-lerp is generic and independent of Processing colour specifics.
- Speckle layer (L59-64) is a one-liner worth keeping as `speckleLayer(count, size, alpha)`.

One-off art decisions: the two-layer walk recipe (small thin ribbons under big soft blobs),
the fixed 80/40 and 80/20 counts, the translate-to-centre + ±0.6 coordinate scheme, the
white background + `lights()` combination, and the specific 6-colour palette.

A clean parameter object would be: `{ seed, size, speckles: {count, size, alpha},
walks: [{steps, maxStep, ampMax, alphaMax, taperPower, count}],
field: {freq, zAmp, jitter}, palette: {colors[], lerpDrift} }`.
