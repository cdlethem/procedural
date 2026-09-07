---
sketch: 2019/generativos/mala
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1538
animated: false
techniques: [grid, dots-stippling, curves]
primitives: [point, ellipse, shape]
palette:
  colors: ["#FE562A", "#F1AA01", "#176962", "#77B0E1", "#F3F2EE", "#262A33"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: perspectiveRows, signature: "perspectiveRows(top, bottom, rows, power) -> float[][]", note: "row bands whose y positions ease with pow(i/n, power), dense at the horizon, sparse at the bottom"}
  - {name: domeField, signature: "domeField(rows, colRange, domeChance, domeH, envelope) -> void", note: "grid of slabs with sticky random colours; each slab may top a semicircular arc dome, dome size under a sin() envelope across the width"}
  - {name: accentShapes, signature: "accentShapes(n, palette) -> void", note: "a few large scattered ellipses, each possibly half-overlaid by a matching arc (two-tone disc), plus a random thin triangle hanging below"}
---

## What it draws
A flat, retro-modernist landscape. The top third is a pale peach sky band sprinkled with tiny white dots.
Below the horizon, a dense field of small vertical slabs in blocks of orange, mustard, teal, navy, cream
and blue, with rows of semicircular dome/arch shapes sitting on top of them; the rows are tightly packed at
the horizon and grow taller and sparser toward the bottom edge. The domes are largest in the horizontal
centre and disappear near the left/right edges. A few large flat accents sit in the foreground: several
big triangles (navy, orange, cream, light blue) and two-tone circles (e.g. an orange/white disc, a
yellow/blue disc).

## How the code works
Single tab, `generate()` called once from `setup()`; `draw()` is empty, so the image is static
(mala.pde:21-32). Everything is seeded from `seed` via `randomSeed`/`noiseSeed` (mala.pde:44-45).

- **Sky band** (mala.pde:50-58): a full-width rect from `bb` to `height*0.3` filled with one
  `rcol()` draw (the pale peach). 1000 white dots (`point`, `strokeWeight(random(2))`) are scattered in
  the top half with y biased downward (`lerp(bb, height*0.5, random(1)*random(0.4,1))`,
  mala.pde:60-66) — the starfield speckles.
- **Field band** (mala.pde:70-77): a second full-width rect from `height*0.3` to the bottom, filled
  with another `rcol()` (the grey-teal ground tone).
- **Slab grid** (mala.pde:81-104): `div = 120` rows. Row i spans y1..y2 where
  `y = lerp(height*0.3, height-bb, pow(i/div, 9))` — the pow-9 easing packs rows densely at the horizon
  and stretches them near the bottom (pseudo-perspective). Each row has `sub = random(50, 600)`
  slabs; each slab is a filled quad `beginShape()`/`vertex`. The row colour `col` is sticky: it only
  changes when `random(1) < 0.2` (mala.pde:98), producing the horizontal colour blocks.
- **Domes** (mala.pde:106-114): per slab, with probability 0.2, an arc
  `arc(xx, y1, hh, hh*random(2.4,3), PI, TAU)` — a half-ellipse sitting on the slab top. Dome width
  `hh = (x2-x1)*6*amph*random(1,1.3)` where `amph = sin(map(|x-center|, ...))` (mala.pde:108) is a
  sine envelope that is 1 at the horizontal centre and 0 at both edges, so domes shrink and vanish
  toward the margins. Each dome gets a fresh `rcol()`.
- **Foreground accents** (mala.pde:119-153): 8 shapes. Each is a `fill(rcol())` ellipse with size
  scaled by its y position; with probability 0.5 a same-size `arc(x, y, s, s, ang1-PI, ang1)` is drawn
  over it, splitting the disc into two colours (mala.pde:135-138). Below each disc a thin random
  triangle is built from 4 `vertex` calls around an offset centre (mala.pde:146-152) — the large
  navy/orange/cream/blue triangles.
- **Colour** (mala.pde:167,173-175): `rcol()` picks uniformly at random from the 6-colour
  `colors[]` list (coolors.co palette). `getColor()` (lerp-between variant) exists but is unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic**: the pow-eased row layout (`perspectiveRows`), the sticky-colour slab grid with
  probability-gated domes under a sine envelope (`domeField`), and the two-tone disc + hanging
  triangle accents (`accentShapes`) are all reusable; none depend on the specific palette or canvas size.
- **One-off art decisions**: the 6-colour palette, the pow exponent (9) and dome chance (0.2) tuning,
  the two fixed band boundaries (0.3 of height), and the choice to keep the sky as a single flat colour
  with white dots.
- **Parameter object**: `{rows: 120, colRange: [50, 600], domeChance: 0.2, domeH: 6, domeAspect: [2.4, 3],
  colorSwitch: 0.2, accentCount: 8, dotCount: 1000, horizon: 0.3, palette: [...]}` — with `horizon`
  and `palette` as the two knobs that most change character.
