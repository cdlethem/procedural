---
sketch: 2018/Generativos/toys
year: 2018
renderer: P2D
size: [6500, 6500]
libraries: []
deterministic: true
ms_first_frame: 4290
animated: false
techniques: [distortion]
primitives: [ellipse, shape]
palette:
  colors: ["#F8C43D", "#023390", "#6AA6E2", "#F35076", "#F6F6F6"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: srect, signature: "srect(x, y, w, h, shadow, col, alpha1, alpha2) -> void", note: "rect drawn as 4 edge trapezoids with per-edge alpha fade; soft drop-shadow halo around a bar"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alpha1, alpha2) -> void", note: "annular ring built from trapezoid segments between two radii with per-vertex alpha fade"}
---

## What it draws
A full-bleed Bauhaus-style collage on a 6500×6500 canvas. The background is a
diagonally split wash of warm coral, orange and yellow (four random-filled
triangles). Over it lie thin, two-tone bars rotated to multiples of 45°, each
surrounded by a faint soft halo, and scattered solid dots in deep blue, light
blue, pink and off-white, each with a faint wider ring around it. Dominant
colours: orange/coral background, deep blue and pink accents, pale yellow/white.

## How the code works
`setup()` sizes a 6500×6500 P2D canvas, calls `generate()` once, saves and
exits — the sketch is static (toys.pde:4-12). `generate()` (toys.pde:26-67):

- **Background (L27-34):** one full-canvas shape built from four triangles
  (top-left, top-right, bottom-right, bottom-left), each filled with an
  independent `rcol()` draw call, so the canvas splits along the two diagonals
  into up to four colour regions.
- **Loop (L37-66), 50 iterations**, each adds two elements:
  - **Bar (L38-58):** random position; width `w = random(width*2)*random(1)`
    (0–13000, skewed small), height `h = w*random(0.015, 0.1)` so bars are thin
    strips; rotated by `HALF_PI*0.5*int(random(8))` (L45), i.e. a multiple of
    45°. The bar body is one quad filled with two independent `rcol()` values
    split diagonally (L48-55), giving the two-tone look. `srect(..., 20, 0)`
    (L57) then draws four trapezoids hugging each edge of the bar, fading from
    alpha 20 to 0, producing the soft halo around every bar.
  - **Dot (L60-65):** random position; size `s = random(width/2)*random(1)*random(1)`
    (0–3250, strongly skewed small); a solid `rcol()` ellipse (L64) plus
    `arc2(..., s, s*1.8, 0, TAU, rcol(), 30, 0)` (L65) — a full annulus from
    radius 0.5·s to 0.9·s fading alpha 30→0, the faint ring around each dot.
- **Helpers:** `srect` (L69-106) decomposes the shadow into four per-edge
  trapezoids with a vertex-wise alpha ramp; `arc2` (L108-126) tessellates the
  ring into `cc` trapezoid segments, segment count proportional to arc length.
- **Colour:** 5-colour list (L132); `rcol()` (L133-135) picks one at random for
  every fill. `getColor` (L136-144, lerp-between) is defined but unused.
- **Dead code:** `int cc = int(random(10, random(20, 1200)));` (L36) is
  computed but never used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
`srect` and `arc2` are self-contained, generic "soft-edged shape" helpers
(alpha ramp per vertex, no canvas-specific state) — direct library candidates.
`rcol`/`getColor` form a small palette module (random pick vs lerped pick).
The background 4-triangle split is a one-off art decision. A clean parameter
object: `{count (50), barAspect [0.015, 0.1], barShadowAlpha (20), dotSizeMax
(width/2), dotRingScale (1.8), dotRingAlpha (30), rotationStep (HALF_PI/4),
palette [5 hex]}`.
