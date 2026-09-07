---
sketch: 2019/generativos/arcCir
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1563
animated: false
techniques: [grid, polar]
primitives: [ellipse, shape]
palette:
  colors: ["#F76FC1", "#FF7028", "#AFE36B", "#29a8cc", "#100082"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "int(random(6,12))", tried: [5, 12], change: large, effect: "grid columns; 5 = sparse large wedges + wide border, 12 = dense small wedges/dots"}
  - {name: arcProb, default: 0.4, tried: [0.9], change: moderate, effect: "corner wedge probability; higher fills almost every cell with a quarter-circle"}
  - {name: dotProb, default: 0.5, tried: [0.9], change: moderate, effect: "dot/circle gate probability; higher adds many more small dots and offset circles"}
  - {name: glowAlpha, default: 120, tried: [220], change: subtle, effect: "arc2 halo alpha; 220 slightly strengthens the soft halos, overall look nearly the same"}
  - {name: colors, default: "{#F76FC1,#FF7028,#AFE36B,#29a8cc,#100082}", tried: ["{#333A95,#FFDC15,#FC9CE6,#31F5C2,#1E9BF3}"], change: large, effect: "swaps whole look: yellow/pink/mint/blue, ground becomes bright green (bg is rcol())"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "radial alpha-fade wedge: quad strip between two radii, alpha lerped alp1->alp2"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "uniform random pick from a palette array"}
---

## What it draws
Flat Bauhaus-style composition on a teal ground (one of the palette colors): loose grid of
quarter-circle wedges, half circles, and circles in magenta, orange, lime, cyan and navy, each
wedge accompanied by a soft alpha-fade halo that blurs where colours overlap. Small opaque dots
sit on cell centres. Shapes snap to an invisible square grid, leaving an irregular border of plain
background around the edges. Static: frames 10 and 60 are identical to frame 1.

## How the code works
- `settings()` (line 16): 960x960 P2D, `smooth(8)`, `pixelDensity(2)`.
- `setup()` calls `generate()` once (line 23); `draw()` is empty (the per-frame regenerate block,
  lines 32-37, is commented out), so the sketch is static.
- `generate()`: `randomSeed/noiseSeed` (50-51), `background(rcol())` picks a palette colour for the
  ground (53), `noStroke()`, `cc = int(random(6,12))` grid columns (57), `ss = width/cc` cell size (58).
- Loop `cc*cc*2` iterations (65): a random grid cell is chosen, `xx,yy` at its centre (66-67).
  - prob 0.4 (74): a random cell corner is picked (`dir` 0-3, 75-97); a filled quarter-circle wedge
    of size `ss*2` is drawn at that corner with `arc()` (98), plus an `arc2` glow wedge `ss*2 -> ss*4`
    with alpha fading 120->0 (101). This glow is the soft halo seen around every wedge. (Line 99
    draws a degenerate `ss*0` wedge — invisible.)
  - prob 0.5 (108): with prob 0.05 a centred quarter-circle wedge `ss*2` + glow (112-117); with
    prob 0.1 a full `ss`-sized circle offset to a neighbouring cell + full-circle glow (118-122);
    always a small solid dot `ss*0.2` at the cell centre (123).
- Colour: `rcol()` (175-177) picks uniformly from the 5-colour array (168). The lerp-based
  `getColor` (181-187) and the triangulate/SimplexNoise imports are never used.
- `arc2` (138-155) approximates a radial-gradient wedge with `PI*max(s1,s2)*0.1` quads, each quad's
  alpha lerped between `alp1` and `alp2` — this is what produces the blurred colour blending.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_5 | `int cc = int(random(6, 12));` -> `int cc = 5;` | moderate | sparser: 5-column grid, fewer and larger wedges, wide plain border | variants/cc_5/frame_00001.png |
| cc_12 | `int cc = int(random(6, 12));` -> `int cc = 12;` | large | denser: 12-column grid, many small wedges and dots, border nearly gone | variants/cc_12/frame_00001.png |
| arcprob_0.9 | `if (random(1) < 0.4) {` -> `if (random(1) < 0.9) {` | moderate | quarter-circle wedges appear in almost every cell; busier, less background visible | variants/arcprob_0.9/frame_00001.png |
| dotprob_0.9 | `if (random(1) < 0.5) {` -> `if (random(1) < 0.9) {` | moderate | many more small dots plus extra offset circles with halos | variants/dotprob_0.9/frame_00001.png |
| alpha_220 | `...ss*2, ss*4, ang, ang+HALF_PI, rcol(), 120, 0);` -> `...220, 0);` | subtle | halos slightly stronger/more visible; overall look nearly the same | variants/alpha_220/frame_00001.png |
| palette_blue | `int colors[] = {#F76FC1, #FF7028, #AFE36B, #29a8cc, #100082};` -> `int colors[] = {#333A95, #FFDC15, #FC9CE6, #31F5C2, #1E9BF3};` | large | completely different scheme: yellow/pink/mint/blue shapes on a bright green ground | variants/palette_blue/frame_00001.png |

## Modularisation notes
Generic: `arc2` (radial alpha-fade wedge) is a self-contained, parameterised drawing primitive — a
clean library candidate as-is. `rcol` (random palette pick) is trivially generic. The grid-cell
sampling (random cell + corner/centre offsets, lines 65-97) is generic "stamped-on-grid" logic.
One-off art decisions: the three probability gates (0.4 / 0.5 with 0.05/0.1 sub-gates), the
specific wedge sizes (`ss*2`, `ss*4` glows, `ss*0.2` dots), the 5-colour palette, and drawing
`cc*cc*2` stamps (2x cell count → ~half the cells filled). A clean parameter object:
`{gridCols, stampsPerCell, arcProb, dotProb, wedgeSize, glowExtent, glowAlpha, dotSize, palette}`.
