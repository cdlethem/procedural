---
sketch: 2019/generativos/bord
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1522
animated: false
techniques: [grid]
primitives: [rect, ellipse]
palette:
  colors: ["#0E1619", "#024AEE", "#FE86F0", "#FD4335", "#F4F4F4", "#D4D7E0", "#E6E6E6"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "random(8, random(12, 32)) — 9 at seed 42", tried: [16], change: moderate, effect: "finer, denser 16x16 grid with smaller squares and dots"}
  - {name: squareFrac, default: 0.5, tried: [0.8], change: moderate, effect: "squares grow to fill more of each cell, gaps shrink, dots scale up with them"}
  - {name: midDotFrac, default: 0.5, tried: [0.9], change: subtle, effect: "mid-dots nearly fill the squares, pale tile edges mostly hidden"}
  - {name: centerDotFrac, default: 0.1, tried: [0.3], change: none, effect: "no visible change (center dots 3x larger in code, only 1.5% of pixels differ)"}
  - {name: squareColorProb, default: 0.02, tried: [0.5], change: subtle, effect: "half the squares drawn in palette colors, but overall image stays pale since squares are small"}
  - {name: background, default: 230, tried: [30], change: large, effect: "dark charcoal background inverts the mood; pale tiles and dots pop against dark field"}
reusable_candidates:
  - {name: dotGrid, signature: "dotGrid(cellCount, squareFrac, midDotFrac, centerDotFrac, palette, squareColor, squareColorProb) -> void", note: "cc x cc grid of small centered squares each carrying two concentric random-color dots"}
  - {name: rcol, signature: "rcol(palette) -> int", note: "uniform random pick from a palette array"}
---

## What it draws
On a light warm-gray background, a uniform 9x9 grid of small pale gray-blue squares fills the canvas with generous gaps between cells. On each square sits a mid-sized circle in one of five flat colors (near-black, blue, magenta-pink, red-orange, white) and a tiny dot of a (usually different) palette color at its center. It reads as a tidy matrix of colored dots on pale tiles — a simple, flat, poster-like composition.

## How the code works
`settings()` (bord.pde:14-19) opens a 960x960 P2D window; `setup()` calls `generate()` once. `generate()` (bord.pde:46-72) reseeds with `randomSeed(seed)`/`noiseSeed(seed)`, paints `background(230)` (light gray), then picks the grid count `cc = int(random(8, random(12, 32)))` (bord.pde:53; seed 42 gives cc=9). Cell size is `ss = width/cc` (bord.pde:54). A double loop over the cc x cc grid (bord.pde:58-71) places each element at the cell center: a square of side `ss*0.5 - 4` (bord.pde:62,65) filled `#D4D7E0`, except with 2% probability a random palette color (bord.pde:64); then a mid ellipse `s*0.5` (bord.pde:67) and a center dot `s*0.1` (bord.pde:69), both `rcol()`. `rcol()` (bord.pde:124-126) picks uniformly from the 5-color `colors[]` list (bord.pde:117). All randomness enters through `random()` after the fixed seed, so the layout is deterministic per seed. No noise, no transforms, no blend modes in the drawn path. `draw()` (bord.pde:31-36) regenerates with a fresh random seed every 120 frames, which is why the piece is animated in a window but frames 1/10/60 are identical. `desform()` (bord.pde:80-84, Simplex-noise displacement) and `arc2()` (bord.pde:92-109, arc wedges) are defined but never called — dead code; the toxi/triangulate imports serve only the unused code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_16 | `int cc = int(random(8, random(12, 32)));` -> `int cc = 16;` | moderate (mean 0.058, 9.6% px) | 16x16 grid instead of 9x9: cells, squares and dots all smaller, composition noticeably finer and denser; a few palette-colored squares (2% x 256 cells) are visible | variants/cc_16/frame_00001.png |
| sFrac_0.8 | `float s = ss*0.5;` -> `float s = ss*0.8;` | moderate (mean 0.058, 9.1% px) | squares grow from half to 80% of the cell, gaps shrink to thin lines, dots scale up with them; heavier, more solid tiles | variants/sFrac_0.8/frame_00001.png |
| midDot_0.9 | `ellipse(x, y, s*0.5, s*0.5);` -> `ellipse(x, y, s*0.9, s*0.9);` | subtle (mean 0.049, 11.6% px) | subtle: mid-dots grow to nearly the square's width, so most tiles look like plain colored circles with only a thin pale rim | variants/midDot_0.9/frame_00001.png |
| centerDot_0.3 | `ellipse(x, y, s*0.1, s*0.1);` -> `ellipse(x, y, s*0.3, s*0.3);` | none (mean 0.006, 1.5% px) | no visible change at image scale, although the center dots are 3x larger in code (5px -> 15px); many dots read as rings on close inspection | variants/centerDot_0.3/frame_00001.png |
| sqColProb_0.5 | `if (random(1) < 0.02) fill(rcol());` -> `if (random(1) < 0.5) fill(rcol());` | subtle (mean 0.048, 11.6% px) | subtle: about half the squares are now palette-colored (magenta, white, black, blue, red) instead of pale gray-blue, but the squares are small relative to the canvas so the overall impression stays a pale grid | variants/sqColProb_0.5/frame_00001.png |
| bg_30 | `background(230);` -> `background(30);` | large (mean 0.618, 79.8% px) | dark charcoal background; the pale tiles and colored dots now sit on a near-black field — the mood fully inverts, biggest change of all variants | variants/bg_30/frame_00001.png |

## Modularisation notes
`generate()` is a compact, self-contained block and the main reusable unit: a `dotGrid` function parameterised by cell count, square size fraction, the two dot size fractions, square color, square-color probability, palette, and background. The 120-frame auto-regeneration in `draw()` and the `keyPressed` handler are one-off presentation decisions. `desform()` (noise displacement) and `arc2()` (arc wedge) are generic and could be extracted as-is, but they are unused in this sketch. A clean parameter object: `{cellCount, squareFrac: 0.5, midDotFrac: 0.5, centerDotFrac: 0.1, squareColor: #D4D7E0, squareColorProb: 0.02, palette, background: 230}`.
