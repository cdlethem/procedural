---
sketch: 2018/Generativos/irtri
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 4109
animated: false
techniques: [grid, lines-hatching, recursion]
primitives: [line, ellipse, shape]
palette:
  colors: ["#F6F2EC", "#F5CE00", "#FE84A9", "#00A5D0", "#0072B1", "#004D4F"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ss, default: "random(40, random(120))", tried: [140], change: large, effect: "coarser grid: fewer, much larger faceted diamonds; dot lattice far more widely spaced"}
  - {name: ccc_rhombi, default: "cc*cc*random(1)", tried: [0.2], change: large, effect: "5x fewer rhombus bodies: sparser, more scattered shapes; background, dot lattice and hatch web exposed"}
  - {name: ccc_hatch, default: "cc*cc*random(10)", tried: [2], change: subtle, effect: "no visible change; dense hatch web looks the same at seed 42"}
  - {name: shadow_alp, default: 12, tried: [100], change: large, effect: "grainy black shadow quads dominate: image much darker, near-black background patches, shapes read as light on dark"}
  - {name: shw, default: "h*0.8", tried: [1.6], change: moderate, effect: "diamond wings/shadow slightly wider and softer; composition unchanged"}
  - {name: colors, default: "6-col teal/yellow/pink set", tried: ["warm orange/red/steel-blue set"], change: moderate, effect: "same composition recolored: orange, red, cream, steel blue; structure unaffected"}
reusable_candidates:
  - {name: hexDotLattice, signature: "hexDotLattice(cellW, cellH, dotR, col)", note: "2px dots at hex-lattice points, odd rows half-offset"}
  - {name: perpBisectorChain, signature: "perpBisectorChain(x1, y1, x2, y2, depth) -> Line[]", note: "segment replaced by its perpendicular bisector, repeated (Sierpinski-style)"}
  - {name: facetedRhombus, signature: "facetedRhombus(Line, palette, shadowAlpha, wingW) -> void", note: "diamond of 4 gradient triangles + 4 grainy shader-shadow quads"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "uniform random pick from a fixed palette"}
---

## What it draws
Full-bleed mosaic of overlapping, translucent faceted diamonds and triangles in teal, blue, yellow, pink and cream, on a pale cream/teal background. A dense web of hair-thin colored lines (hatching) crosses the whole image, and a faint lattice of tiny white dots is visible in uncovered areas. Some diamonds read as bright faceted gems (yellow, pink, cyan) each with a soft, grainy shadow cast to one side; shapes layer with varying opacity so the background peeks through.

## How the code works
- `setup()` (4-13): one-shot still: 3250x3250 P2D, loads `noiseShadowFrag/Vert.glsl` shader, calls `generate()`, saves, exits. `draw()` (15) is empty; `keyPressed` regenerates with a new seed.
- `generate()` (26-111): `randomSeed(seed)`, background = `rcol()` (29).
- Dot lattice (31-46): `ss = random(40, random(120))` is the cell width, `hh = ss*sqrt(0.75)` the hex row spacing, `cc = height/hh` rows (33). After translating to center, every lattice point gets a 2x2 white ellipse with black stroke (42-44); odd rows are shifted half a cell (`dy = (j%2)*0.5`, 38) giving the visible hex dot lattice.
- Rhombus loop (48-83): `ccc = cc*cc*random(1)` (up to ~cc^2) shapes. Each picks a random lattice point, a direction from {30, 150, 270} deg (`int(random(3))*120+30`, 55) and a length `ddd*hh` with `ddd` up to `2*cc/3` (56-58). The segment is then extended `sub = int(random(8))` times by replacing the last segment with its perpendicular bisector (`getLine`, 226-233) — a Sierpinski-style recursive subdivision. For every segment, `drawRhombus()` (134-224): four black quads at alpha 12 (149) drawn through the `noi` shader, whose fragment (noiseShadowFrag.glsl:20) multiplies alpha by a per-pixel hash → grainy soft shadow; then four triangles whose per-vertex fills lerp from `col1` to `col2 = lerp(random, col1, 0.6)` (144-146) at random alphas 0-255 → the faceted diamond body; finally a palette-colored stroke line (80-81).
- Hatching loop (84-110): `ccc = cc*cc*random(10)` (up to ~10*cc^2) similar random bisector chains, but each segment is only stroked with `rcol()` at alpha `random(180)*random(1)` (0-180) (107) → the fine line web over everything.
- Colour: `rcol()` (267-269) picks uniformly from the 6-colour palette `colors` (266); `getColor` (270-278, lerp-between variant) is defined but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_140 | `float ss = random(40, random(120));` -> `float ss = random(140, random(220));` | large | coarser grid: much bigger, chunkier diamonds and triangles; concentric faceted-gem motif stands out; dot lattice far more widely spaced | variants/ss_140/frame_00001.png |
| cccr_0.2 | `int ccc = int(cc*cc*random(1));` -> `int ccc = int(cc*cc*random(0.2));` | large | 5x fewer rhombus bodies: sparser, more scattered shapes; cream background, dot lattice and hatch web clearly more exposed | variants/cccr_0.2/frame_00001.png |
| ccch_2 | `ccc = int(cc*cc*random(10));` -> `ccc = int(cc*cc*random(2));` | subtle | no visible change; hatch web still equally dense at seed 42 | variants/ccch_2/frame_00001.png |
| alp_100 | `float alp = 12;` -> `float alp = 100;` | large | grainy black shadow quads now dominate: overall much darker, near-black background patches, shapes read as light objects on dark | variants/alp_100/frame_00001.png |
| shw_1.6 | `float shw = h*0.8;` -> `float shw = h*1.6;` | moderate | diamond wings/shadow slightly wider and softer; composition and density otherwise unchanged | variants/shw_1.6/frame_00001.png |
| palette_warm | `int colors[] = {#F6F2EC, #F5CE00, #FE84A9, #00A5D0, #0072B1, #004D4F};` -> `{#F6F2EC, #FF7B00, #E63946, #A8DADC, #457B9D, #1D3557};` | moderate | identical composition recolored: orange, red, cream, steel blue; structure and layering unaffected | variants/palette_warm/frame_00001.png |

## Modularisation notes
- Generic: hex dot lattice (31-46); the perpendicular-bisector chain (62-66 + `getLine` 226-233) is a clean recursion function; `facetedRhombus` (134-224) is a reusable primitive parameterised by line, palette, shadow alpha and wing width (`shw`); `rcol` palette sampling is standard.
- One-off art decisions: the specific palette (266), angle set {30,150,270} (55), the `h*0.8` wing extension (142), shadow alpha 12 (149), the `col2` 0.6 lerp (146), and the 10x count ratio between hatching and rhombi loops (48 vs 84).
- Clean parameter object: {seed, cellSizeRange, rhombiCount, hatchCount, angles, maxLen (in rows), chainDepth, shadowAlpha, wingWidth, lineAlphaRange, palette}.
- The grainy-shadow shader is a small drop-in (alpha *= pixel-hash) and worth keeping as a library effect; it renders correctly under the P2D display used here.
- Experiment note: the hatch loop count (line 84) was the least effective knob at seed 42 — reducing it 5x left the line web looking identical, so perceived hatch density comes as much from the rhombus-loop strokes (80-81) as from the hatch loop itself.
