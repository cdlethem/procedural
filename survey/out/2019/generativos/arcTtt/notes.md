---
sketch: 2019/generativos/arcTtt
year: 2019
renderer: P2D
size: [1920, 1920]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1743
animated: false
techniques: [grid, polar]
primitives: [ellipse, shape]
palette:
  colors: ["#F76FC1", "#FF7028", "#AFE36B", "#29a8CC", "#100082"]
  selection: random-from-list
composition: centered
parameters: []
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "annular sector (r1..r2, a1..a2) tessellated into quads whose fill alpha interpolates alp1->alp2 across the radius = radial-gradient ring/disk"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "uniform random pick from a palette array"}
---

## What it draws
A centred square mosaic on a flat cyan background, built from a grid of cells (about 8x8). Each
occupied cell holds a solid quarter-circle (90-degree sector) in one of five flat palette colours
(hot pink, orange, light green, cyan, deep indigo), randomly rotated to one of four orientations, so
adjacent sectors sometimes read as half- or full-circles. Over the sectors sit soft radial-gradient
halos of the same palette colours at partial alpha, giving a hazy, blurred, overlapping look. Most
cells carry a small solid dot at their centre, and a few larger solid circles (one big orange, one
light green) break the grid.

## How the code works
- `settings()` (L14-19): 1920x1920 P2D window (nwidth/swidth = 2x scale of the 960 design size),
  `smooth(8)`, `pixelDensity(2)`.
- `setup()` calls `generate()` once (L21-29); `draw()` is empty (L31-38) - the sketch is static.
- `generate()` (L48): seeds `randomSeed`/`noiseSeed` (L50-51); background = one random palette
  colour (L53; cyan #29A8CC here); `cc = int(random(6, random(9,12)))` (L57) sets the implicit
  grid count (6-11); `ss = width/cc` (L58) is the cell size.
- Main loop runs `cc*cc*2` times (L65); each iteration picks a random grid cell
  `xx,yy = ss*(k+0.5)`, k in 1..cc-2 (L66-67), so cells are repeated with random multiplicity and
  the mosaic never fills the border (hence the centred composition).
- With probability 0.4 (L74) the cell gets a solid quarter-sector: direction `dir` 0-3 (L75) sets
  `dx,dy = +/-ss/2` (L82-97), and `arc(xx+dx, yy+dy, ss*2, ss*2, ang, ang+HALF_PI)` (L98) draws a
  quarter-disk of diameter 2*ss centred on the neighbouring cell corner, exactly covering this cell.
  Two `arc2()` calls then overlay radial-gradient annuli (L100-101): a disk r=0..ss at alpha
  110-130 fading to 0 (L99, L100) and a ring r=ss..2ss (L101) - the soft hazy glow over the sector.
- With probability 0.5 (L106): with p=0.05 a bigger centred quarter-arc of diameter 2*ss plus a
  faint (alpha 30-50) gradient ring (L110-114); with p=0.15 a solid circle of diameter ss offset by
  +/- half a cell plus a faint ring (L116-119) - these are the large orange/green circles; with
  p=0.8 a small dot of diameter `ss*0.2` at the cell centre (L123-129).
- Colour: `rcol()` (L183-185) picks uniformly from the 5-colour palette at L176 (several commented
  alternative palettes at L172-182).
- `arc2()` (L146-163): tessellates an annular sector into `~PI*max(s1,s2)*0.1` quads (L149); each
  quad sets `fill(col, alp1)` for its inner two vertices and `fill(col, alp2)` for its outer two
  (L155-159), so alpha interpolates across the radius - that is the radial gradient.
- Imports at L1-2 (triangulate, toxi SimplexNoise) are present but unused in this sketch.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic / reusable: `arc2()` is a clean "radial-gradient annular sector" primitive (centre,
  inner/outer diameter, angle span, colour, inner/outer alpha) - directly library-worthy.
  The corner-quarter-sector placement (pick one of 4 directions, arc of 2*ss at the neighbouring
  corner) is a reusable "quarter circle in grid cell" motif. `rcol()` is a trivial palette picker.
- One-off art decisions: the specific 5-colour palette, all the probabilities (0.4 arc, 0.05 big
  quarter, 0.15 big circle, 0.8 dot), the alpha ranges (110-130 main, 30-50 faint), the cc range
  6-11, dot diameter 0.2*ss, and the random-background-colour choice.
- Suggested parameter object: `{seed, cc (grid count), arcProb, gradAlpha:[lo,hi], bigArcProb,
  circleProb, dotProb, dotDiameterFactor, palette[], background: 'palette-random' | color}`.
