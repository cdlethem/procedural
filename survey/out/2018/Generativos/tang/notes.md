---
sketch: 2018/Generativos/tang
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1589
animated: false
techniques: [grid, polar, shader, lines-hatching]
primitives: [line, ellipse, shape]
palette:
  colors: ["#27007F", "#00A6FF", "#FF216E", "#FFB7E3", "#FFFFFF", "#F6F2EC"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: ss, default: "random(width/40, width/3)", tried: ["random(width/100, width/30)"], change: moderate, effect: "smaller lattice cells -> cc grows, all cluster/line counts scale up, canvas fills with a dense web of small shapes and lines"}
  - {name: ccc1, default: "int(cc*random(5))", tried: ["int(cc*random(20))"], change: moderate, effect: "4x more filled clusters; each cluster also strokes lines, so the whole canvas becomes a web of shapes and hairlines"}
  - {name: ccc2, default: "int(cc*random(40))", tried: ["int(cc*random(120))"], change: none, effect: "no visible change; the baseline already drew almost no group-2 lines and the extra ones are 1px low-alpha strokes"}
  - {name: dotAlpha, default: 20, tried: [120], change: none, effect: "no visible change overall; only the sparse 2px dot grid darkens slightly (dots are <0.2% of pixels)"}
  - {name: colors, default: "5 colors {#27007F #00A6FF #FF216E #FFB7E3 #FFFFFF}", tried: "4 colors {#0A49FF #FFCAE3 #FDCF00 #FFFFFF}", change: subtle, effect: "colours shift to blue/gold/pink; 4 vs 5 palette entries change the rcol() collision-retry loops, so the RNG stream diverges and the line web is denser"}
reusable_candidates:
  - {name: rhombusCluster, signature: "rhombusCluster(x1, y1, x2, y2, depth, palette) -> void", note: "iterative rhombus subdivision along the 60-degree lattice (Line.getLine + drawRhombus)"}
  - {name: angleArc, signature: "angleArc(x, y, r1, r2, a1, a2, col, alpha) -> void", note: "tiled arc band used as an angle marker at line endpoints (arc2)"}
  - {name: noiseAlphaShader, signature: "shader: alpha *= 0.01 + pow(rand(pixel*0.001), 0.4)", note: "per-pixel hash modulates fragment alpha, giving all shapes a grainy dappled edge"}
---

## What it draws
A warm off-white (cream) field with a barely visible fine dot grid, on which a small
number of scattered clusters of translucent geometric marks sit: rhombi and
four-pointed star shapes in pale violet, blue and pink, each crossed by thin
red/pink or blue lines, with small concentric arc "angle marks" at their
corners. The shapes carry a fine speckled grain (shader-modulated alpha) and
overlap with low opacity, so the composition reads as a light, airy technical
diagram floating in space.

## How the code works
`setup()` (tang.pde:4-10) sets 960x960 P2D, loads the `noiseShadowFrag.glsl`
shader, and calls `generate()` once; `draw()` is empty, so the sketch is
static. `generate()` (lines 23-117):

1. `randomSeed(seed)` (line 25), then a cream `background(#F6F2EC)` (line 26).
2. A hexagonal dot lattice: cell size `ss = random(width/40, width/3)` (line 28),
   row height `hh = sqrt(ss*ss*0.75)` (line 29), count `cc = int(height/hh)`
   (line 30). After `translate` to centre and a random global rotation (lines 32-33),
   a double loop (lines 36-45) draws 2x2 px `fill(0, 20)` ellipses — the faint
   dot grid — with the shader active, which grays/grains them.
3. Group 1 (lines 48-86): `ccc = int(cc*random(5))` clusters. Each cluster
   starts from a random lattice node (lines 50-51), picks one of three lattice
   directions `ang = radians(int(random(3))*120+30)` (line 55) and a length
   `ddd` up to `cc/3` cells (line 56), builds a `Line`, then iterates
   `sub = int(random(8))` times calling `l.getLine()` (line 251), which
   replaces a line by the segment between the two equilateral-triangle apexes
   perpendicular to it — a rhombus subdivision that produces the 4-point
   stars. For each line: `drawRhombus()` (line 158) draws eight translucent
   quadrilaterals (four near-black `fill(0, alp≈4)` grays under the shader,
   four filled with a palette colour and a partner colour lerped 60% towards
   it, lines 216-248); `drawAngles()` (line 140) draws `arc2` angle markers at
   both endpoints with 60-degree span (`da = PI/6`, line 145); `drawLine()`
   (line 128) strokes the segment plus a perpendicular bar through its
   midpoint (the "+" ticks seen crossing the stars).
4. Group 2 (lines 88-116): the same construction with
   `ccc = int(cc*random(40))` but only the thin stroked `drawLine()` calls
   (lines 110-114) — these are the long red/blue hairlines and + marks that
   cross the composition. With seed 42 this count is small, which the
   ccc2_120 experiment confirms (tripling it still scores "none").
5. Colour: `rcol()` (line 294) picks uniformly from
   `{#27007F, #00A6FF, #FF216E, #FFB7E3, #FFFFFF}` (line 293); consecutive
   fills avoid repeating the previous colour via a retry loop (lines 74-75,
   168-169). Note these retry loops make the RNG stream depend on the palette
   size: the palette_warm experiment (4 colours) produces a different
   composition, not just recoloured shapes. Alpha is random (10-180), keeping
   everything translucent.
6. The fragment shader (noiseShadowFrag.glsl:20) multiplies alpha by
   `0.01 + pow(rand(pixel*0.001), 0.4)` — a per-pixel hash — which is what
   gives every shape its dappled, grainy, soft-edged look.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_width100 | `float ss = random(width/40, random(width/3));` -> `float ss = random(width/100, random(width/30));` | moderate (0.0805, 33.2% px) | dense web: much finer dot grid and many more small rhombus clusters and hairlines covering the whole canvas | variants/ss_width100/frame_00001.png |
| ccc1_20 | `int ccc = int(cc*random(5));` -> `int ccc = int(cc*random(20));` | moderate (0.0642, 25.1% px) | 4x more clusters; canvas fills with a web of shapes and lines, same pastel palette | variants/ccc1_20/frame_00001.png |
| ccc2_120 | `ccc = int(cc*random(40));` -> `ccc = int(cc*random(120));` | none (0.0013, 0.4% px) | no visible change; image nearly identical to baseline (a few extra faint hairlines) | variants/ccc2_120/frame_00001.png |
| dotAlpha_120 | `fill(0, 20);` -> `fill(0, 120);` | none (0.0008, 0.2% px) | no visible change overall; only the sparse dot grid is slightly darker (dots are a tiny fraction of pixels) | variants/dotAlpha_120/frame_00001.png |
| palette_warm | `int colors[] = {#27007F, ... 5 colors};` -> `int colors[] = {#0A49FF, #FFCAE3, #FDCF00, #FFFFFF};` | subtle (0.0262, 7.2% px) | colours become blue/gold/pink; line web appears denser because 4 vs 5 palette entries changes the rcol() collision-retry RNG stream | variants/palette_warm/frame_00001.png |

## Modularisation notes
- Generic: the `Line` class is a self-contained rhombus-lattice primitive
  (`getLine` subdivision, `drawLine` with midpoint bar, `drawAngles` via `arc2`);
  the `arc2` arc-band helper is standalone; the GLSL alpha-grain shader is
  reusable as a "grainy alpha" post-pass for any P2D sketch.
- Art decisions: the three-way lattice angle set (30/150/270 degrees), the
  two-cluster scheme (filled shapes + line-only), the 5-colour pastel palette,
  and the `random`-driven counts/lengths/alphas.
- Pitfall for reuse: the colour-collision retry loops couple the RNG stream to
  the palette size, so palette edits silently change the composition; a clean
  version would draw the geometry first and assign colours afterwards.
- Parameter object: `{ cellSize (ss), filledClusterCount (ccc1), lineCount (ccc2),
  maxLenCells (cc/3), subdivisionDepth (sub), dotAlpha (20), palette[],
  arcSpan (PI/6) }`.
