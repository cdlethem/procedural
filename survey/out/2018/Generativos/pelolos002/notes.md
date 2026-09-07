---
sketch: 2018/Generativos/pelolos002
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1948
animated: false
techniques: [noise-field, flow-field, lines-hatching]
primitives: [shape]
palette:
  colors: ["#D5D3D4", "#CF78AF", "#DA3E0F", "#068146", "#424BC5", "#D5B307"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 2200, tried: [600], change: moderate, effect: "fewer lines: thicker spaced stripes, looser braid, more background showing"}
  - {name: vel, default: 5, tried: [10], change: large, effect: "bigger steps: braid thins to sparse widely-spaced strands"}
  - {name: err, default: 0.01, tried: [0.05], change: moderate, effect: "faster per-row noise-scale drift: different braid wave shape, same density"}
  - {name: dc, default: 0.032, tried: [0.16], change: large, effect: "faster colour drift along line: many bright white/pink strands, shorter stripe bands"}
  - {name: amp, default: 20, tried: [10], change: moderate, effect: "smaller angular deviation: gentler waves, far fewer loops/crossings"}
reusable_candidates:
  - {name: noiseStream, signature: "noiseStream(y, steps, stepSize, noiseScale, ampPow, ampMax) -> PVector[]", note: "integrate a 1-D noise angle field left-to-right from a start point"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v) -> color", note: "wrap-around lerp between adjacent palette entries for smooth banded colour"}
---

## What it draws
Left half: flat horizontal stripes in banded rainbow colours (pink, orange-red, green, blue,
yellow) running edge to edge. Right half: a large braid of thousands of thin multicoloured
strands sweeping in a diagonal ribbon from top-centre to bottom-right, curling and looping
where strands cross; a solid indigo-blue background (a random palette colour) shows through
in the top-right and bottom-right corners and in the gaps between strands.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static.
- `generate()` (pelolos002.pde:21) re-seeds with the harness `seed`, paints the background with
  one random palette colour (`rcol()`, lines 25/100-102), then draws `cc = 2200` lines
  (line 27), one per horizontal row `ly = (i+0.5)*height/cc` (line 41).
- Per line: a random-walked noise scale `det` (starts `random(0.004,0.008)*0.2`, drifted by
  `±err` each row, lines 34-42) and a step size `vel = (0.2+noise(...)*1.2)*5` (lines 43-45).
  The inner loop (lines 46-52) integrates a 2-D noise angle field: `ang =
  map(noise(lx*det, ly*det), 0, 1, PI*(2-amp), PI*(2+amp))` with
  `amp = pow(map(j,0,width*0.4,0,1), 2.8)*20` (line 47), so early steps point nearly
  horizontal (angle ≈ 2π) and angular deviation grows with the 2.8-power of progress,
  sweeping through the full circle in the second half of the loop; that is why the left of
  the canvas reads as flat stripes and the braid/loops appear in the right half.
- Drawing (lines 57-75): each pair of consecutive points becomes a thin QUAD strip 2 px tall,
  filled with colours from `getColor(v)` (lines 106-112) which wraps and lerps between
  adjacent entries of the 6-colour palette (line 96). The colour index drifts along the line
  by `dc` per step (line 59) and the base index per row is `ic` (line 58), a mix of a
  row-phase cosine `cos(i*dic)` and a linear ramp in `i` — that is what makes colour band
  with row position and slowly rotate through the palette.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_600 | `int cc = 2200;//int(random(160, 320*20));` -> `int cc = 600;` | moderate | stripes on the left are fewer and thicker with background showing between bands; right-hand braid is visibly looser and thinner, more blue background visible in and around the ribbon | variants/cc_600/frame_00001.png |
| vel_10 | `vel *= 5;` -> `vel *= 10;` | large | braid on the right is much sparser: few, thin, widely spaced strands (white/pink/yellow/green) instead of a dense weave; large areas of plain blue background; left stripes largely unchanged | variants/vel_10/frame_00001.png |
| err_0.05 | `float err = 0.01;` -> `float err = 0.05;` | moderate | same overall density and coverage but the braid has a different wave shape: crest sits lower and wider, strands curl differently; left stripes essentially unchanged | variants/err_0.05/frame_00001.png |
| dc_0.16 | `float dc = random(0.099, 0.1)*0.32;` -> `float dc = 0.16;` | large | colour cycles ~5x faster along each line: braid fills with many bright white/pink strands, left stripes show shorter, more numerous colour bands; overall much brighter, more washed-out palette mix | variants/dc_0.16/frame_00001.png |
| amp_10 | `float amp = pow(map(j, 0, width*0.4, 0, 1), 2.8)*20;` -> `... *10;` | moderate | gentler waves: strands undulate but loop and cross much less, braid reads as smoother parallel curves; slightly more blue background in the corners | variants/amp_10/frame_00001.png |

## Modularisation notes
- Generic: `noiseStream` (angle-field integration with growing amplitude) and `lerpPalette`
  (wrapping banded colour) are reusable as-is; the QUAD-strip renderer (2 px tall, per-vertex
  lerp fill) is a small generic helper for "thick lines as filled ribbons".
- One-off art decisions: the specific palette, the `ic` row-phase formula, `err` drift, and
  the `amp` power law; background = random palette colour.
- Clean parameter object: `{count, stepVel, noiseScale0, noiseScaleDrift, steps, ampPow,
  ampMax, palette, dc, dic, bg}`.
