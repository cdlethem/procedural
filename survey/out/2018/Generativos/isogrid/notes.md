---
sketch: 2018/Generativos/isogrid
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1798
animated: false
techniques: [grid, dots-stippling, noise-field, shader, distortion]
primitives: [ellipse, line, shape]
palette:
  colors: ["#0A0A0A", "#FFFFFF"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: cc, default: "random 8-220", tried: [40, 320], change: moderate/large, effect: "40 = coarse sparse grid, long walk segments; 320 = fine graph-paper mesh covering the whole canvas"}
  - {name: ringCount, default: 20, tried: [80], change: moderate, effect: "more overlapping soft-circle halos; background becomes visibly mottled with circular structure"}
  - {name: dotHaloAlpha, default: 2, tried: [100], change: large, effect: "halo ellipses at every grid vertex become dominant, canvas covered in overlapping gray circles"}
  - {name: walkerAlpha, default: 10, tried: [200], change: subtle, effect: "random-walk lines only slightly more visible, still faint under the shader grain"}
  - {name: stippleMaxAlpha, default: 10, tried: [100], change: none, effect: "no visible change - stipple dots are tiny (ss*random(0.05)), area too small to read at any alpha"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "ring drawn as radial quad slices with per-vertex alpha ramp (glow-like circle)"}
  - {name: gridDots, signature: "gridDots(cellSize, dotAlpha, dotRadius)", note: "double ellipse (halo + core) at every grid vertex"}
  - {name: gridWalk, signature: "gridWalk(cellSize, walkers, maxSteps, strokeAlpha)", note: "random walks snapping to grid vertices, straight segments between neighbours within 2 cells"}
  - {name: noiseStipple, signature: "noiseStipple(cellSize, blocks, detail, maxAlpha, dotRadius)", note: "noise-driven alpha on small dots in random grid-aligned patches"}
  - {name: splitQuad, signature: "splitQuad(x, y, w, h, alpha)", note: "4-vertex shape with two different vertex fills -> pale wedge/parallelogram"}
---

## What it draws
A near-black, deep blue-black canvas with a faint square grid of tiny bright dots at the
intersections. A few faint straight line segments connect grid points, several huge very
faint circles sit in the background, and two or three pale gray wedge/parallelogram shapes
stand out as the brightest elements. A soft grain and slight blur over everything give it a
film-like, out-of-focus look. Very low contrast overall; the image is dominated by the
dark background.

## How the code works
`setup()` (isogrid.pde:5-13): `size(960,960,P2D)`, `smooth(8)`, `pixelDensity(2)` (warns
unavailable for this display), loads `post.glsl`, calls `generate()` once; `draw()` is empty,
so the sketch is static (regenerated only on key press).

`generate()` (isogrid.pde:26-137), all monochrome white over `background(10)`:
- `cc = int(max(8, random(220)*random(1)))` (l.34) picks grid resolution; `ss = width/cc`
  is the cell size.
- 20 large soft circles: `arc2()` (l.39-44, defined l.144-162) draws each ring as radial
  quad slices with fill alpha ramping 0 -> random(10), so they read as barely-visible
  halos.
- Grid dots (l.47-56): at every grid vertex a big ellipse `fill(255,2)` sized `ss` (halo)
  plus a small core dot `fill(255,80)` sized `ss*random(0.05)` (l.46).
- Random walks (l.58-74): 10 walkers, each up to 1000 steps of up to 2 cells in x/y,
  snapped to grid vertices, `stroke(255,10)` — the faint connecting segments.
- 10 big faint circles (l.76-87) `stroke(255,6)/fill(255,3)`, 1-0.3*cc cells wide.
- Noise stipple (l.89-109): 100 random grid-aligned patches; per dot
  `fill(255, noise(x*det, y*det)*10)` on the small dot size `s` (l.105) — the soft
  mottled patches in the background.
- Pale wedges (l.112-133): `ccc = int(random(cc*0.9))` four-vertex shapes whose first two
  vertices have `fill(255,0)` and last two `fill(255,100)` (per-vertex fill split), giving
  the bright gray parallelograms.
- `filter(post)` (l.135-136): post.glsl mixes a 3x3 Gaussian-weighted blur 50/50,
  brightness 1.5, saturation boost, radial vignette, 6% hash grain, per-channel gamma
  (r^1.1, g^0.96, b^0.9) — produces the soft, grainy, slightly cool look.

The 6-colour `colors[]` palette and `rcol()/getColor()` (l.164-177) are dead code, never
called. `des/det` globals (l.2) are shadowed by locals (l.89-90). Deterministic: true.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = int(max(8, random(220)*random(1)));` -> `int cc = 40;` | moderate | coarse grid: sparse bright dots, long faint walk segments, 2-3 wedges; cells ~24 px | variants/cc_40/frame_00001.png |
| cc_320 | `int cc = int(max(8, random(220)*random(1)));` -> `int cc = 320;` | large | fine graph-paper mesh: dense lattice of thin lines with a dot at every vertex, walks reduced to short ticks | variants/cc_320/frame_00001.png |
| arcs_80 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 80; i++) {` | moderate | background mottled with overlapping circular halos; wedges and grid still faint on top | variants/arcs_80/frame_00001.png |
| dotAlpha_100 | `fill(255, 2);` -> `fill(255, 100);` | large | every grid vertex halo bright: whole canvas becomes a polka-dot pattern of overlapping gray circles | variants/dotAlpha_100/frame_00001.png |
| walkAlpha_200 | `stroke(255, 10);` -> `stroke(255, 200);` | subtle | walk lines slightly more visible; overall look unchanged | variants/walkAlpha_200/frame_00001.png |
| noiseAlpha_100 | `fill(255, noise(des+x*det, des+y*det)*10);` -> `... *100);` | none | no visible change (dots are ss*random(0.05) wide, too small to show) | variants/noiseAlpha_100/frame_00001.png |

## Modularisation notes
- `arc2`, `gridDots`, `gridWalk`, `noiseStipple`, `splitQuad` are all generic (see
  reusable_candidates) and parameterised by cell size; the post shader is a ready-made
  "film grain + blur + vignette" post pass.
- One-off art decisions: the very low alphas (2/3/6/8/10 on most layers), the 80%
  probability of squaring the wedges (l.120), the per-vertex fill split trick, and the
  exact shader constants (blur 0.5 mix, 6% grain, gamma split).
- A clean parameter object: `{seed, gridCount, dotHaloAlpha, dotCoreAlpha, dotRadiusFrac,
  ringCount, ringMaxAlpha, walkerCount, walkerMaxSteps, walkerAlpha, stippleBlocks,
  stippleMaxAlpha, wedgeCount, wedgeAlpha, shader: {blurMix, grain, vignette, gamma}}`.
