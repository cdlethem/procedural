---
sketch: 2018/Generativos/citypop
year: 2018
renderer: P3D
size: [640, 640]
libraries: []
deterministic: true
ms_first_frame: 1831
animated: false
techniques: [packing, noise-field, grid, lines-hatching]
primitives: [ellipse, rect, line]
palette:
  colors: ["#0E2857", "#24A2C9", "#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E", "#205AAF", "#E3CEB5", "#6E9ADB", "#F5BBB9", "#A7E8DE"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc (cloud count), default: "int(random(120))", tried: [30], change: large, effect: "fewer cloud streaks, but also re-rolls every downstream random draw, so the whole circle layout, ground colour and palm/city positions shift — a global reseed rather than a local change"}
  - {name: scattered dot count, default: 1000, tried: [300], change: large, effect: "pale mottled underlayer becomes much sparser; sky reads cleaner and the large circles stand out more. Some of the score comes from the RNG stream shifting afterwards"}
  - {name: sky circle palette, default: "{#FF3D20,#FC9D43,#3998C2,#3E56A8,#090D0E}", tried: ["{#687FA1,#AFE0CD,#FDECB4,#F63A49,#FE8141} (the commented-out list)"], change: large, effect: "same layout, but circles become muted sage/cream/red-orange instead of saturated red/blue/black; noticeably pastel"}
  - {name: formSky circle attempts, default: 1000, tried: [500], change: moderate, effect: "fewer large circles, more open sky; faint clouds and contrails become easier to see (also partly RNG-stream shift)"}
  - {name: city building count, default: 8, tried: [3], change: subtle, effect: "city cluster shrinks to 3 buildings in the lower right; ground band happens to pick the pink pastel this run"}
reusable_candidates:
  - {name: circlePack, signature: "circlePack(count, minSize, maxSize, maxOverlap) -> PVector[]", note: "rejection sampling with distance test, used by formSky, clouds and flowers"}
  - {name: gradientSky, signature: "gradientSky(top, bottom) -> void", note: "one closed P3D shape with two fill colours, top/bottom bands"}
  - {name: taperedTrunk, signature: "taperedTrunk(x, y, endX, endY, width, lerpStep, color) -> void", note: "iterative lerp walk drawing shrinking segments (palms, airplanes)"}
  - {name: noiseRidge, signature: "noiseRidge(y, amp, det) -> void", note: "noise-displaced filled ridge strip (mountains, city base)"}
---

## What it draws
A flat, pop-art cityscape on a 640x640 square. The sky is a vertical gradient from deep navy at the top to bright turquoise near the bottom. It is covered with a dense scattering of solid circles — a few very large ones (up to ~1/6 of the width) and many smaller — in saturated red-orange, orange, light blue, indigo and near-black. A pale mint ground band runs across the bottom. Rising from it are ~10 thin, slightly curved dark trunks (palm-like trees) topped with small black blobs, and in the lower right a cluster of 8 small pale rectangular buildings with thin blue horizontal window stripes. Faint white cloud streaks and near-invisible airplane contrail lines cross the middle of the sky.

## How the code works
Everything is drawn once in `setup()` -> `generate()` (citypop.pde:7,21); `draw()` is empty, so the output is static. `randomSeed`/`noiseSeed` are set from the seed field (citypop.pde:23-24) and `hint(DISABLE_DEPTH_TEST)` makes P3D paint in draw order (citypop.pde:26).

Layer order in `generate()`:
1. **Gradient sky** (citypop.pde:28-35): one closed shape with fill `#0E2857` for the top two vertices and `#24A2C9` for the bottom two — P3D interpolates per-triangle, giving the smooth navy->turquoise ramp.
2. **Airplane contrails** (citypop.pde:40-44, function at 116-129): 10 diagonal lines from a random point toward the horizon; each walks with `x = lerp(x, nx, 0.03)` per step, stamping ellipses that shrink by `*0.99`, with `fill(255, 2)` (alpha 2) — nearly invisible in the render.
3. **Mountains** (citypop.pde:46-49, montains.pde:1-11): two noise-displaced filled ridges at the horizon with `fill(0, 40)` — barely visible dark smudges. Note montains.pde:7 always uses `vertex(width, y+hh)` (a bug: should be `vertex(i, ...)`) so each "ridge" is actually a fan of triangles; visually it just reads as a soft dark band.
4. **Clouds** (citypop.pde:51-54, clouds.pde:1-30): `int cc = int(random(120))` cloud clusters; each scatters up to 10000 white/near-white ellipses along a sinusoid envelope, positions rejected if closer than 2 px to an existing point (a packing loop), alpha `random(40,180)*0.02` (~1-4) — this produces the faint horizontal white streaks in the sky.
5. **Ground** (citypop.pde:56-59): one `rect` from `hor` to bottom, filled from a 5-colour pastel list (seed 42 gives the mint `#A7E8DE` look).
6. **Scattered semi-transparent dots** (citypop.pde:61-68): 1000 ellipses of size `width*random(0.02)*0.1` in `#EFB9B7`/`#67A5C2`/`#0F9A5E` with `random(200)` alpha, placed over the whole canvas — these sit under the sky circles and add a pale mottled layer.
7. **Sky circle packing** (citypop.pde:70, formsSky.pde:1-22): the dominant feature. 1000 attempts to place circles of size `width*random(0.02, 0.1)`; a candidate is kept only if its distance to every kept circle is >= `(s+o.z)*0.5`, i.e. circles may overlap by up to half a radius. Kept circles are filled solid with `rcol()` — random from the 5-colour palette (citypop.pde:135,137-139): red-orange `#FF3D20`, orange `#FC9D43`, light blue `#3998C2`, indigo `#3E56A8`, near-black `#090D0E` (a second, commented-out pastel palette sits at line 136).
8. **City** (citypop.pde:72, city.pde:1-37): 8 buildings of width `160*random(0.2,0.3)`, height `60*random(0.4,...)`, placed in a 160 px window at a random x at the horizon. Walls from a mostly-pale list, then blue window stripes `#0086B9` every 5 px, a 1 px dark gap, and a small dark shadow triangle on the right. A noise ridge (`fill(0)`, city.pde:27-36) caps the base.
9. **Palms** (citypop.pde:74-79, 88-114): 10 trunks. Each is an iterative lerp walk toward a direction `PI*random(1.43,1.57)` (near-vertical, slightly left), stamping a small rotated rect per step that shrinks `*0.98` while its colour lerps black -> `#7A3134`; a black ellipse marks the base. The trunk tops (small black blobs in the image) come from the shrinking end of the walk.
10. `ballFlowers`/`flowers` are commented out (citypop.pde:81-85).

Randomness enters via the global seed (circle layout, palette picks, positions, cloud count). No blend modes are used; layering order plus a few low-alpha fills create all the depth.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| clouds_30 | `int cc = int(random(120));` -> `int cc = 30;` | large (mean 0.2234, 0.675 of pixels) | cloud streaks thinner, but the visible difference is a full relayout: circles, palms, city and ground colour all moved — earlier in the single RNG stream, so this is a reseed effect, not just fewer clouds | variants/clouds_30/frame_00001.png |
| dots_300 | `for (int i = 0; i < 1000; i++) {` (dots loop) -> `... i < 300 ...` | large (mean 0.2037, 0.595 of pixels) | the pale semi-transparent underlayer is much thinner; sky and large circles read cleaner and more saturated, layout still shifted by the RNG stream | variants/dots_300/frame_00001.png |
| palette_2nd | `int colors[] = {#FF3D20, ...};` -> `int colors[] = {#687FA1, #AFE0CD, #FDECB4, #F63A49, #FE8141};` | large (mean 0.1587, 0.404 of pixels) | identical layout; circles now sage green, cream, muted red and grey-blue — clearly a softer pastel scheme, confirming the palette drives the mood | variants/palette_2nd/frame_00001.png |
| skyCircles_500 | `for(int i = 0; i < 1000; i++){` (formSky) -> `... i < 500 ...` | moderate (mean 0.1361, 0.372 of pixels) | noticeably fewer large circles, more open sky; faint cloud bands and contrail lines become visible; layout shifted again by the RNG stream | variants/skyCircles_500/frame_00001.png |
| buildings_3 | `int cc = 8; ` (city.pde) -> `int cc = 3; ` | subtle (mean 0.013, 0.032 of pixels) | only the lower-right building cluster changes: 3 smaller buildings instead of 8; ground band picks the pink pastel this run; everything else identical | variants/buildings_3/frame_00001.png |

## Modularisation notes
- **Generic / library candidates:** the rejection-sampling circle pack (formsSky.pde:3-16) is reused almost verbatim in clouds.pde:8-23 and flowers.pde:20-35 — a single `circlePack(attempts, sizeRange, overlapFactor)` function would cover all three. The two-colour P3D gradient sky (citypop.pde:28-35) is trivially reusable as `gradientSky(top, bottom)`. The lerp-walk trunk (palm/airplane, citypop.pde:97-113, 120-128) is the same "tapered trail" algorithm and could be one function. The noise ridge (montains.pde, city.pde:29-36) is a one-liner `noiseRidge` if the `vertex(width,...)` bug in montains.pde is fixed.
- **One-off art decisions:** the 5-colour sky palette and the pastel ground/building palettes, the specific layer order (dots under circles), the building window stripe spacing, and the palm angle range.
- **Suggested parameter object:** `{horizon, skyTop, skyBottom, groundColor, circlePalette, circleAttempts, circleMinSize, circleMaxSize, overlapFactor, dotCount, dotAlpha, cloudCount, buildingCount, buildingWindow, palmCount, trunkAngle}`.
- **Cleanup needed for reuse:** `random(hor)` as a single-argument random (returns 0..hor) is used as an angle in the mountain call (citypop.pde:48); `int cc` is shadowed in city.pde:4; the unused `getColor`/`rcol` pair duplicates palette access.
