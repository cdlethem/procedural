---
sketch: 2018/Generativos/patio
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1551
animated: false
techniques: [3d-mesh, symmetry]
primitives: [rect, ellipse]
palette:
  colors: ["#272928", "#2DC3BA", "#BCEBD2", "#F9F77A", "#F8BDD3"]
  selection: random-from-list
composition: radial
parameters:
  - {name: cc, default: 80, tried: [30], change: moderate, effect: "fewer stacked slab levels - striped walls end shorter, gaps at the top of the stacks become visible"}
  - {name: hh, default: 960, tried: [480], change: large, effect: "solid corner/edge blocks and posts half the height - more of the central cross and slab walls visible, tan corner bands capped early"}
  - {name: colors, default: "#272928,#2DC3BA,#BCEBD2,#F9F77A,#F8BDD3", tried: ["#FACD00,#FB4F00,#F277C5,#7D57C6,#00B187,#3DC1CD"], change: large, effect: "every surface recoloured - orange/red/magenta/teal/yellow replaces the muted teal/tan/mauve scheme"}
  - {name: ss, default: "width*random(0.2, 0.8)", tried: ["width*0.5"], change: large, effect: "flat cross, dots and corner blocks scale up - central cyan cross fills most of the frame"}
  - {name: fov, default: "PI/random(1.02, 1.3)", tried: ["PI/2.5"], change: large, effect: "narrower, flatter perspective - centre appears smaller, wall stripes more compressed"}
  - {name: dd, default: "ss*0.06", tried: ["ss*0.15"], change: large, effect: "2.5x wider spacing between stacked slabs - stripes read as separated slabs with dark gaps instead of dense texture"}
reusable_candidates:
  - {name: boxAt, signature: "boxAt(x, y, z, w, h, d) -> void", note: "translate + built-in box() helper used for every solid"}
  - {name: slabWall, signature: "slabWall(origin, size, count, spacing, thickness, z0) -> void", note: "loop stacking N thin boxes along z at given footprint"}
  - {name: lerpPaletteColor, signature: "getColor(v) -> color", note: "random v mapped to lerp between adjacent palette entries"}
---

## What it draws
A straight-on view down the vertical axis of a four-fold-symmetric 3D "courtyard": a cross of five flat squares (tan, teal, mauve, yellow-green) at the centre with a small cyan square in the middle and four small teal discs around it. Four walls built from dozens of thin stacked slabs — striped in alternating teal, tan, mauve, yellow and cream — close in from all four sides, and four wide tan slabs radiate out toward the corners. Black background.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (static; frames 10/60 identical).
- Camera: `perspective()` with a random `fov = PI/random(1.02,1.3)` (patio.pde:27-29); scene centred by `translate(width/2,height/2,0)` with small random X/Y tilts (±0.12·HALF_PI) and a full random Z rotation (lines 31-35), which is why the cross appears axis-aligned-ish but slightly rotated.
- Floor: five `rect()`s of size `ss` at (0,0) and (±ss, ±ss) plus a smaller `ss*0.6` rect at the centre and four `ellipse()`s of diameter `0.2ss` at the arms (lines 48-62) — the cross of squares, the cyan centre square and the four dots.
- Walls: solid corner `box()`es at (±ss·1.5, ±ss·1.5), edge `box()`es at (±ss·2.5, 0) and (0, ±ss·2.5), and small posts at (±ss·0.54, ±ss·0.54) (lines 67-90) — the wide tan corner bands and the outer blocks.
- Striped walls: a loop `i < cc` (cc = 80, line 93) stacks eight thin slabs (thickness `h2 = ss*0.006`, spacing `dd = ss*0.06`, line 92) per level at the four edge and four corner footprints, each at height `hhh = dd*i - h2` (lines 94-107). Stacking 80 levels of 8 slabs is what produces the dense horizontal stripe pattern on every wall face.
- Colour: `getColor()` (lines 142-151) takes a random `v` and lerps between adjacent entries of the 5-colour palette `#272928, #2DC3BA, #BCEBD2, #F9F77A, #F8BDD3` (line 134); every box/rect gets a fresh random call, so neighbouring slabs differ.
- Light: `ambientLight(60,60,60)` plus two `pointLight()`s along +z (lines 43-46), so upper faces of slabs are brighter than lower — the subtle shading steps in the stripes.
- `Rect` class (lines 110-118) is dead code, never instantiated.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30 | `int cc = 80;` -> `int cc = 30;` | moderate | striped walls visibly shorter (fewer slab levels); same layout, palette and centre cross | variants/cc_30/frame_00001.png |
| hh_half | `float hh = width;` -> `float hh = width*0.5;` | large | tan corner/edge blocks half height, capped early; more of the central cross and slab walls exposed | variants/hh_half/frame_00001.png |
| palette_vivid | 5-colour muted palette -> commented 6-colour vivid palette | large | whole scene recoloured orange/red/magenta/teal/yellow; geometry unchanged | variants/palette_vivid/frame_00001.png |
| ss_fixed05 | `float ss = width*random(0.2, 0.8);` -> `float ss = width*0.5;` | large | flat cross, dots and corner blocks much larger; cyan cross dominates the centre | variants/ss_fixed05/frame_00001.png |
| fov_narrow | `float fov = PI/random(1.02, 1.3);` -> `float fov = PI/2.5;` | large | flatter, more telephoto view; centre cross smaller, wall stripes compressed | variants/fov_narrow/frame_00001.png |
| dd_wide | `float dd = ss*0.06;` -> `float dd = ss*0.15;` | large | slabs clearly separated with dark gaps; striped walls become banded slabs | variants/dd_wide/frame_00001.png |

## Modularisation notes
Generic blocks: `boxAt` translate-helper; the `slabWall` stacking loop (footprint, count, spacing, thickness, base height); `getColor` palette-lerp; the perspective-camera + small random tilt setup. One-off art decisions: the exact courtyard layout (corner vs edge blocks, post positions), the 5-colour palette, fov/tilt ranges. A clean parameter object: `{ palette, slabCount (cc), slabSpacing (dd), slabThickness (h2), blockScale (ss), height (hh), fov, tilt, zSpin }`.
