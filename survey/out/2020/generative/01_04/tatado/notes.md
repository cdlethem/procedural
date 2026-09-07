---
sketch: 2020/generative/01_04/tatado
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2187
animated: false
techniques: [grid, noise-field]
primitives: [shape]
palette:
  colors: ["#D5D3D4", "#CF78AF", "#DA3E0F", "#068146", "#424BC5", "#D5B307"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(80, 280)*0.6) (~48-168)", tried: [30], change: large, effect: "far fewer, much larger tiles; grid of big squares clearly visible, coarse blocks of colour"}
  - {name: alp, default: "random(30, 120)*1.9 (~57-228)", tried: [240], change: moderate, effect: "more opaque tiles: higher-contrast, more saturated mosaic; individual tiles and their edges stand out more"}
  - {name: det, default: "random(0.002) (0-0.002)", tried: [0.008], change: moderate, effect: "stronger horizontal banding: noise Z-displacement wobbles the quads into dense horizontal stripes"}
  - {name: dc, default: "random(0.4) (0-0.4)", tried: [1.5], change: large, effect: "palette cycles several times across the grid; big dark/muted patches and harsh colour breaks instead of smooth drift"}
  - {name: k, default: 10, tried: [3], change: moderate, effect: "3 passes instead of 10: paler, softer, more blended wash; fewer overlapping colour patches"}
  - {name: "quad width factor (ww)", default: "dd*1.2", tried: ["dd*2.0"], change: subtle, effect: "subtle: texture becomes finer and denser (more overlap, moire) but overall colour layout nearly unchanged"}
reusable_candidates:
  - {name: colorRamp, signature: "colorRamp(float v, int[] palette) -> color", note: "map a continuous value to lerpColor between two adjacent palette entries (getColor, lines 115-123)"}
  - {name: noiseDepthGrid, signature: "noiseDepthGrid(n, det, overlap, alp) -> void", note: "grid of translucent top-to-bottom-fading quads with per-cell SimplexNoise Z-offset and column/row color drift"}
---

## What it draws
A full-bleed abstract mosaic that fills the whole 960×960 canvas with small, slightly
overlapping square tiles. The tiles use a warm palette — orange-red, mauve-pink,
olive/yellow-green, blue and pale gray — which blend into large soft patches. Each tile
fades from a colored top edge down to transparency, and the color drifts slowly across
the palette, producing broad soft diagonal bands. A fine horizontal scanline/interference
texture runs across the surface (a P3D software-render artifact), with a few faint
vertical streaks in spots.

## How the code works
`setup()` calls `generate()`; `draw()` is empty, so the sketch is static (a key press
regenerates with a fresh seed; `keyPressed`, lines 36-42). `background(0)` (line 48).

`generate()` (lines 44-98) runs 10 independent passes (`for k`, line 51). Each pass is one
full grid layer:
- `cc` (line 52) = `int(random(80,280)*0.6)` → grid resolution (≈48–168 cells per side).
  `dd` (line 54) = `width/(cc+1)` is the cell spacing.
- `ic1`/`ic2` (lines 57-58) are random palette start indices; `dc` (line 59) is a small
  random drift so the color index advances slowly along the axis.
- `det`/`det2`/`det3` (lines 61-63) are noise details; `SimplexNoise.noise` is sampled at
  each cell's position (lines 70-72).
- `translate(0,0,noi*2)` (line 73) pushes each cell a tiny Z depth from the noise → subtle
  parallax in P3D.
- Quads are sized `dd*1.2` (lines 74-75), i.e. 20% larger than the cell so they overlap.

Each cell draws TWO overlapping quads (lines 76-92): one colored by the column index
(`ic1+dc*i`, `ic2+dc*i`), one by the row index (`ic1+dc*j`, `ic2+dc*j`). Each quad is a
vertical gradient: the top two vertices are filled with the color at alpha `alp`
(line 64, `random(30,120)*1.9`), the bottom two at alpha 0 (transparent) → per-cell
top-to-bottom fade.

Color is chosen by `getColor(float)` (lines 115-123): it wraps a continuous value modulo
the palette length and returns `lerpColor` between the two adjacent entries → a smooth
lerp-between palette. The palette itself is the 6-entry array on line 105: gray, mauve,
orange-red, green, blue, yellow (the commented-out arrays on lines 106-108 are alternates).

Randomness enters via `cc` (grid size), `ic1`/`ic2` (palette phase), `dc` (drift), `det`
(noise detail), `alp` (opacity) and the seed (`randomSeed`/`noiseSeed`, lines 46-47).
The horizontal scanline texture is not intentional: it is a P3D software-render artifact
of thousands of overlapping translucent quads drawn with `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30 | `int cc = int(random(80, 280)*0.6);` -> `int cc = 30;` | large | much coarser: big square tiles (~30 per side) clearly visible, coarse blocks of orange/green/pink with a dark scanline patch top-left | variants/cc_30/frame_00001.png |
| alp_240 | `float alp = random(30, 120)*1.9;` -> `float alp = 240;` | moderate | more opaque tiles: higher-contrast, more saturated mosaic; tile edges and grid stand out more, patches less blended | variants/alp_240/frame_00001.png |
| det_0.008 | `float det = random(0.002);` -> `float det = 0.008;` | moderate | strong horizontal banding: the noise Z-displacement wobbles each row of quads into dense horizontal stripes; soft patches broken into bands | variants/det_0.008/frame_00001.png |
| dc_1.5 | `float dc = random(0.4);` -> `float dc = 1.5;` | large | palette cycles several times across the grid: large dark/muted patches (big black blob top-left), harsh colour breaks and mottling instead of smooth drift | variants/dc_1.5/frame_00001.png |
| k_3 | `for (int k = 0; k < 10; k++)` -> `for (int k = 0; k < 3; k++)` | moderate | 3 passes instead of 10: paler, softer, more blended wash; fewer distinct colour patches, overall lighter | variants/k_3/frame_00001.png |
| ww_2.0 | `float ww = dd*1.2;//*noi2*5;//width-xx;` -> `float ww = dd*2.0;//*noi2*5;//width-xx;` | subtle | subtle: texture finer and denser (more overlap, fine moire) but overall colour layout and patches nearly unchanged | variants/ww_2.0/frame_00001.png |

## Modularisation notes
Generic / reusable:
- `getColor(float)` → a `colorRamp(v, palette)` helper: continuous value → `lerpColor`
  between adjacent palette entries. Directly reusable.
- The per-cell quad (two vertical-fade shapes, one column-tinted, one row-tinted) plus the
  `SimplexNoise` Z-offset is a self-contained `noiseDepthGrid` tile primitive: given a
  grid count, noise detail, overlap and alpha it tiles the canvas with fading,
  noise-displaced, drifting-color quads.

One-off art decisions:
- The fixed 6-color warm palette (line 105) and the 10 stacked passes.
- The specific random ranges (cc, det, alp, dc) and the `0.6` scale factor on `cc`.

A clean parameter object for this sketch would hold: `seed`, `passes` (k count),
`gridCount` (cc), `overlap` (quad size factor, 1.2), `alpha` (alp), `noiseDetail` (det),
`colorDrift` (dc), `palette[]`, and `palettePhase` (ic1/ic2).
