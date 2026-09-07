---
sketch: 2019/generativos/orderco
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1626
animated: false
techniques: [grid, noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#F23602", "#300F96", "#C9FFF6", "#F72C81", "#09EFA6"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, desAng, detAng, desAmp, detAmp, desDes, detDes, ampScale) -> PVector", note: "def(): three simplex-noise fields drive angle/amplitude/distance displacement of a point"}
  - {name: warpedGridQuad, signature: "warpedGridQuad(cw, ch, pw, ph, mult, fillFn) -> void", note: "pow-compressed, noise-warped grid of quads with two fill alphas per cell"}
---

## What it draws
Full-bleed abstract composition on a muted teal field. A few huge, gently warped bands and plates — mostly near-black, one wide orange-red band on the right, some pale cyan/white plates — coexist with hundreds of small scattered quadrilaterals in black, white, orange, pink and green. All shapes are quadrilaterals with softly irregular edges; the mix of giant and tiny cells gives a "zoomed-in corner of a warped checkerboard" look.

## How the code works
- `setup()` calls `generate()` once (orderco.pde:22-24); `draw()` is empty, so the image is static.
- Background is one random palette color (line 48); the canvas is shifted and magnified with `translate(-0.2w, -0.2h); scale(1.4)` (lines 50-51).
- A fine grid `cw × ch` (cw = int(random(12,20)*20*0.5) ≈ 120-200, ch ≈ 90-224, lines 60-61) is placed with power-compressed coordinates `pow(i*ww, pwrw) * width * mult` where `mult = random(120)*random(0.5,1)` (line 98). The pow exponents (pw1..pw2, ph1..ph2, lines 65-73, 88-93) plus the huge `mult` push almost all cells far off-canvas; only the near-origin corner is visible, and it spans an enormous size range — hence giant bands next to tiny specks.
- Every corner is displaced by `def()` (lines 209-214): three simplex-noise fields supply an angle, an amplitude and a distance, so each quad is smoothly warped (this is the irregular edge of every shape).
- Per-cell colour: `rcol()` picks a random palette color (lines 125, 236-238); with probability 0.8 the checkerboard rule overrides it — `(i+j)%2==0` black, else white (lines 126-129). Palette is the 5-colour list on line 235.
- Each cell quad is drawn in two halves: first two edges at full opacity, last two edges at alpha 120 (lines 131-144 via `line2`), so every quad reads as a slightly folded/overlapped pair of trapezoids.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `def()` noise-displacement (a clean `noiseDisplace` utility), the pow-warped grid generator (cell counts, pow exponent ramps, mult, displacement params, fill callback), the two-alpha quad drawing.
- One-off art decisions: the 0.8 checkerboard/black-white override, the specific 5-colour palette, the `translate`/`scale` framing, `mult` magnitude (controls the size-range zoom).
- Clean parameter object: `{cw, ch, pw: [pw1, pw2], ph: [ph1, ph2], mult, disp: {desAng, detAng, desAmp, detAmp, desDes, detDes, ampScale}, checkerProb, alpha2, palette, seed}`.
