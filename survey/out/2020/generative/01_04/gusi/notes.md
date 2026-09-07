---
sketch: 2020/generative/01_04/gusi
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1880
animated: false
techniques: [grid, lines-hatching, blend-modes, dots-stippling]
primitives: [rect]
palette:
  colors: ["#FF4507", "#4111AF", "#FF56B6"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 20000, tried: [6000], change: moderate, effect: "fewer burst strokes = sparser, more separated spines"}
  - {name: sep, default: 6, tried: [4], change: moderate, effect: "fewer divisions = larger cells, more/bigger filled squares"}
  - {name: colors, default: "FF4507,4111AF,FF56B6", tried: ["00C2A8,FFD60A,223072"], change: large, effect: "recolors background, cell fills and bursts (teal/yellow/navy)"}
  - {name: amp, default: 2.4, tried: [5.0], change: moderate, effect: "longer stroke envelope = spines reach past cell edges"}
  - {name: da, default: 0.2, tried: [0.5], change: subtle, effect: "wider spiral drift; barely visible"}
reusable_candidates:
  - {name: spikyBurst, signature: "spikyBurst(x, y, cellSize, count, palette) -> void", note: "dense fan of thin rects along an accumulating rotation, colours lerped through a palette"}
  - {name: jitterGrid, signature: "jitterGrid(sep, cellFillChance) -> rect[]", note: "snaps random cells to a grid and fills a subset"}
---

## What it draws
A full-bleed magenta/pink canvas. Over it sits an irregular, partly-filled grid of square cells (an L-shaped cluster). Each filled cell has a flat background square in orange-red, pink, or blue-purple, and inside it a dense radial burst of hundreds of thin spiky lines fanning out from the centre, in orange and blue-purple, like a sea-urchin or firework.

## How the code works
`settings()` (g14-19) makes a 960x960 P3D window. `setup()` calls `generate()` (g23).

`generate()` (g44-107) sets `DISABLE_DEPTH_TEST`, seeds random/noise from `seed`, then paints `background(rcol())` (g53) — the full-bleed pink. It lays a grid with `sep = 6` (g55) so cell size `ss = width/(sep-1) = 192`.

The main loop (g59-106) runs 30 times: picks a random position, snaps it to the grid (`x -= x%ss`, g62-63), fills a flat cell square in one palette colour with a 1px near-black stroke (g71-74), then builds a radial burst inside it:
- `cc = 20000` (g86) iterations; per iteration a matrix is pushed, translated along a spiral `translate(cos(da*j)*dd, sin(da*j)*dd)` plus a constant drift (g91-93), rotated by `da2*j` (g94).
- Each iteration draws one thin `rect` (g102) of tiny width `random(1,2)*random(0.2,0.5)` and length up to `ss*random(0.2,0.4)*amp`, where `amp` tapers from 2.4 to 0 (g89) so early strokes are longest — the spiky star look.
- Colour: `col = getColor(cos(j*0.0001)*velCol)` (g97) lerps through the 3-colour palette along a cosine; 20% chance to lerp toward black (g98) or white (g99); alpha `random(255)*random(1)` (g101). 5% of strokes use `blendMode(ADD)` (g95), the rest `NORMAL`.

`rcol()` (g120-122) picks a random palette colour (cell fills / background). `getColor(float)` (g126-131) lerps between adjacent palette entries. Palette (g119): `#FF4507` (orange-red), `#4111AF` (blue-purple), `#FF56B6` (pink). The triangulate/toxi imports are unused in the visible path.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_6000 | `int cc = 20000;` -> `int cc = 6000;` | moderate | sparser bursts, individual spines more separated, less solid fan; same layout/colours | variants/cc_6000/frame_00001.png |
| sep_4 | `int sep = 6;` -> `int sep = 4;` | moderate | larger cells (320px), more and bigger filled squares, bigger bursts | variants/sep_4/frame_00001.png |
| palette_alt | `int colors[] = {#FF4507, #4111AF, #FF56b6};` -> `{#00C2A8, #FFD60A, #223072};` | large | whole image recoloured: navy background, teal/yellow cells, yellow-teal bursts | variants/palette_alt/frame_00001.png |
| amp_5 | `float amp = map(j, 0, cc, 2.4, 0);` -> `... 5.0, 0);` | moderate | much longer spines extending past cell edges, overlapping neighbours | variants/amp_5/frame_00001.png |
| da_0.5 | `float da = random(0.2);` -> `float da = random(0.5);` | subtle | no visible change to layout/colour; spiral drift slightly wider | variants/da_0.5/frame_00001.png |

## Modularisation notes
The radial-burst generator (g84-105) is the reusable core: a dense fan of thin rotated rects along a spiral with a tapering length envelope and palette-lerped colour — a clean `spikyBurst(x, y, cellSize, count, palette)` primitive. The grid placement (g55-74) is a one-off art decision (which cells get filled); it is generic enough to factor as `jitterGrid`. The 3-colour palette (g119) and the 5%/20% blend/lerp probabilities are art-specific constants. A parameter object would hold: palette, `sep` (grid divisions), burst `count` (`cc`), taper `amp` range, rotation rates `da`/`da2`, drift `dd`, ADD-blend probability, and cell-fill behaviour.
