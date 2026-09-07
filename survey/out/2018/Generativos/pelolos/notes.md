---
sketch: 2018/Generativos/pelolos
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1695
animated: false
techniques: [noise-field, flow-field, lines-hatching]
primitives: [shape]
palette:
  colors: ["#AFAAA5", "#889033", "#7CA521", "#1296A1", "#83CCD7", "#EEA902", "#F18D02", "#783200", "#181A19"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(160, 6400)", tried: ["random(160, 900)"], change: moderate, effect: "fewer lines: fur thins, individual wavy strands visible, more orange background shows through"}
  - {name: vel, default: 3, tried: [8], change: moderate, effect: "bigger steps: lines spread apart, mass thins, more background visible, S-spine less pronounced"}
  - {name: amp, default: 4, tried: [8], change: subtle, effect: "slightly looser, more diffused wiggle; overall structure unchanged"}
  - {name: strokeWeight, default: "random(0.5, 1.2)", tried: ["random(2.0, 3.0)"], change: moderate, effect: "lines read slightly darker and denser (stroke alpha is only 8, so effect is limited)"}
  - {name: colors, default: "warm 9-colour palette", tried: ["cool 5-colour palette"], change: large, effect: "completely recoloured: blue/violet/white field with crimson strand mass; background rcol() also changes (now near-white)"}
reusable_candidates:
  - {name: noiseFlowBands, signature: "noiseFlowBands(count, detail, step, angAmp) -> PVector[][]", note: "walk N horizontal polylines through a 2-D noise angle field, amplitude growing toward the tail"}
  - {name: paletteLerpStrip, signature: "paletteLerpStrip(colors, offset, drift) -> int[]", note: "smoothly lerp along a palette with a per-strip offset and drift, used to fill thin quad strips"}
---

## What it draws
A full-bleed vivid orange canvas covered with a dense mass of fine, silky wavy lines in teal,
cyan, olive green and dark brown. The lines start as tight horizontal bands on the left edge and
bend, braid and fan out along an S-shaped spine through the centre of the frame, like fur or
streamlines combed by a flow field.

## How the code works
- `setup()` (L3-8): 960x960 P2D, `smooth(8)`, calls `generate()` once; `draw()` (L10-11) is
  empty, so the piece is static (baseline frames 10/60 were identical to frame 1).
- Line count `cc = int(random(160, 320*20))` (L27) with spacing `ss = height/cc` (L28). Each of
  the `cc` lines starts at the left edge `lx=0, ly=(i+0.5)*ss` (L37-38).
- Per-line noise detail `det = random(0.006)` (L33) drifts slowly via `det *= random(0.98, 1.02)`
  (L39). Step length `vel = 0.2 + noise(lx*det*0.2, ly*det*0.2)*1.2`, scaled by `vel *= 3` (L40-42).
- The walk (L43-49) takes `width*0.4` steps: angular amplitude
  `amp = pow(map(j, 0, width*0.5, 0, 1), 2.8)*4` (L44) grows from 0 to ~4 rad, and the heading
  `ang = map(noise(lx*det, ly*det), 0, 1, PI*(2-amp), PI*(2+amp))` (L45) is a 2-D noise field
  centred on pointing right, so lines follow the field and wiggle harder as they go. The point
  advances by `(cos(ang), sin(ang))*vel` (L47-48).
- Rendering (L54-72): each polyline is drawn as a `QUADS` strip; every segment is a 2 px tall
  quad (`p1, p2, p2+2, p1+2`) with a near-invisible dark stroke `stroke(0, 8)` (L57). Fill colour
  comes from `getColor(ic + dc*j)` (L61): `ic` varies slowly with line index via
  `(cos(i*0.0008)*0.5+0.5)*colors.length` (L55) and `dc` is a small random drift (L56), so
  `getColor(float)` (L103-108) lerps between adjacent palette entries, giving smooth colour
  transitions along each band.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_900 | `int cc = int(random(160, 320*20));` -> `int cc = int(random(160, 900));` | moderate | fur mass thins to sparser, individually visible wavy strands; same orange background and S-shaped braid | variants/cc_900/frame_00001.png |
| vel_8 | `vel *= 3;` -> `vel *= 8;` | moderate | lines spread far apart into loose near-horizontal bands; much more background shows through, composition flatter | variants/vel_8/frame_00001.png |
| amp_8 | `... pow(..., 2.8)*4;` -> `... pow(..., 2.8)*8;` | subtle | subtle: strands wiggle a little more and the mass is slightly more diffuse; structure and colours unchanged | variants/amp_8/frame_00001.png |
| stroke_3 | `strokeWeight(random(0.5, 1.2));` -> `strokeWeight(random(2.0, 3.0));` | moderate | strands read slightly darker/denser along their edges; overall look close to baseline (stroke alpha 8 keeps it faint) | variants/stroke_3/frame_00001.png |
| palette_cool | `int colors[] = {#AFAAA5, ...};` -> `int colors[] = {#101820, #2E52DF, #F78DF1, #FEFEFE, #EC3063};` | large | entirely different look: blue/violet/white gradient field on the left, crimson strand mass braiding through a white background | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic: the noise-field walk (L43-49) is a reusable `noiseFlowBands` primitive (count, detail,
  step, angular amplitude); `getColor(float)` is a generic palette-lerp.
- One-off art decisions: the 2 px quad-strip rendering with per-vertex colour drift, the `det`
  random-walk per line, the specific 9-colour warm palette, background = random palette colour.
- Clean parameter object: `{seed, lineCount, noiseDetail, step, angAmpPow, angAmpMax, stripPx,
  palette, paletteDrift, background}`.
