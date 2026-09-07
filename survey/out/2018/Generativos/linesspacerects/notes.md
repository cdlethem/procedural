---
sketch: 2018/Generativos/linesspacerects
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: false
ms_first_frame: 1536
animated: false
techniques: [dots-stippling, 3d-pointcloud, lines-hatching]
primitives: [rect, line]
palette:
  colors: ["#F6C9CC", "#119489", "#7AC3AB", "#F47AD4", "#6AC8EC", "#5BD5D4", "#1E4C5B", "#CF350A", "#F5A71C"]
  selection: lerp-between
composition: radial
parameters:
  - {name: size, default: 30, tried: [60], change: moderate, effect: "unit doubled: segments up to 960px reach the frame edges, beads grow to 6px, larger-scale denser structure"}
  - {name: segmentsPerChain, default: 10, tried: [4], change: moderate, effect: "shorter chains: fewer 90-degree bends, sparser canvas coverage, smaller centre cluster"}
  - {name: beadSpacing, default: 4, tried: [8], change: subtle, effect: "beads half as dense; trails read more as dotted lines than solid bead rows"}
  - {name: beadScale, default: 0.1, tried: [0.3], change: moderate, effect: "beads 3x bigger (9px at size=30): visible squares, ladder/diamond patterns where the twist rotates them"}
  - {name: colorStep, default: 0.003, tried: [0.02], change: subtle, effect: "palette cycles ~7x faster along a trail: iridescent pink-teal-orange runs per chain, same geometry"}
reusable_candidates:
  - {name: beadLine, signature: "beadLine(from, to, beadSize, spacing, twist, palette, index) -> void", note: "draw a 3D segment as a thin line plus a trail of small rotated rects (beads), colour lerped from a palette by arc length"}
  - {name: axisChain, signature: "axisChain(origin, segments, minLen, maxLen) -> PVector[][]", note: "random walk of axis-aligned 3D segments (each along +/-x/+/-y/+/-z) with lengths size*pow(int(1..4),2)"}
  - {name: lerpPalette, signature: "lerpPalette(float v, int[] colors) -> int", note: "abs(v)%1 mapped across a colour list with lerpColor between neighbours"}
---

## What it draws
A black canvas filled with a web of thin multicoloured lines radiating out of the
centre, most running along the horizontal/vertical axes of the view with occasional
90-degree bends. Nearly every line is doubled by a dense trail of tiny square beads
(3px rects) spaced ~4px apart, so lines read as dotted or stitched; some bead trails
twist into short helical spirals. Colours are pastel pink, teal, turquoise, gold and
orange at ~70% alpha, with denser, brighter bead clusters near the centre where many
chains start together.

## How the code works
`setup()` calls `generate()` once (`linesspacerects.pde:6-11`); `draw()` is empty, so
the image is static. `generate()` reseeds (`:26-27`), paints a black background
(`:29`), applies tiny random rotations scaled by `millis()*0.001` (`:31-37`, source of
the non-determinism), and translates to the centre (`:39`).

Three nested loops (`:44-87`): c (4) x i (20) make 80 chains, j (10) is the segment
count. Each segment: length `des = 30*pow(int(random(1,5)),2)` (`:48`) i.e. 30-480px;
one of the six axis directions is picked by zeroing two of (dx,dy,dz) randomly
(`:49-60`); `rotateX/Y/Z(±HALF_PI)` (`:62-64`) aligns the local +x axis to it. Then a
bead loop over `k` in steps of 4 from 15 to `des-15` (`:71`) draws a 3x3 noStroke rect
(`size*0.1`) at (k,0,0) after `rotateY(HALF_PI); rotateZ(j*rot)` with
`rot = random(0.8)` (`:70,76-77`) — the per-segment twist that makes some trails
spiral. Bead colour is `getColor(ic + dc*k)` (`:72`): `getColor(float)` (`:122-128`)
maps `abs(v)%1` across the 9-colour list (`:111`) with `lerpColor` between neighbours;
`ic` advances by `dc = random(0.003)` per segment (`:43,66`) so hue drifts slowly
along each chain. A solid `line(0,0,0, des,0,0)` in a random palette colour
`rcol()` at alpha 140 (`:81-82`) underlays the beads, and `translate(des,0,0)`
(`:83`) makes the next segment continue from this one, forming the L-shaped chains.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| size_60 | `float size = 30;` -> `float size = 60;` | moderate (mean 0.091, 0.312 of px) | larger scale: longer segments run to the frame edges, 6px beads, dense full-frame web | variants/size_60/frame_00001.png |
| chain_4 | `for (int j = 0; j < 10; j++) {` -> `for (int j = 0; j < 4; j++) {` | moderate (mean 0.051, 0.186 of px) | shorter chains (4 segments): fewer bends, sparser coverage, smaller central cluster | variants/chain_4/frame_00001.png |
| step_8 | `k < des-size*0.5; k+=4` -> `k+=8` | subtle (mean 0.027, 0.109 of px) | subtle: beads half as dense, trails read more as dotted lines | variants/step_8/frame_00001.png |
| bead_0.3 | `rect(0, 0, size*0.1, size*0.1);` -> `rect(0, 0, size*0.3, size*0.3);` | moderate (mean 0.080, 0.291 of px) | 9px beads: visible squares, ladder/diamond patterns on twisted trails | variants/bead_0.3/frame_00001.png |
| dc_0.02 | `float dc = random(0.003);` -> `float dc = random(0.02);` | subtle (mean 0.029, 0.126 of px) | subtle: colour cycles much faster along trails (iridescent), geometry unchanged | variants/dc_0.02/frame_00001.png |

Note: the sketch is non-deterministic even at a fixed seed (global rotation scaled by
`millis()`, `:31-37`), so the overall layout shifts between any two runs; part of each
score is that run-to-run noise, and the effects above are read from local bead/line
structure, not from the global arrangement.
- Generic: `beadLine` (segment -> line + twisted bead trail, colour by arc length)
  and `lerpPalette` are directly reusable; `axisChain` (random axis-aligned 3D walk)
  is a small standalone generator of polyline data.
- One-off art decisions: the 9-colour palette, bead size 0.1*size, spacing 4, twist
  range 0-0.8, the 4x20x10 chain/segment counts, length law 30*pow(1-4,2).
- Clean parameter object: {chains: 4, perChain: 20, segments: 10, unit: 30,
  lengthPow: [1,4], beadScale: 0.1, beadSpacing: 4, twistMax: 0.8, alphaBead: 200,
  alphaLine: 140, palette: int[9], colorStep: 0.003}.
