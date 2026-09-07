---
sketch: 2019/generativos/arau003
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1651
animated: false
techniques: [noise-field, particles, curves]
primitives: [ellipse, line]
palette:
  colors: ["#333A95", "#F6C806", "#F789CA", "#1E9BF3"]
  selection: noise-driven
composition: scattered
parameters:
  - {name: cc, default: 260, tried: [100], change: moderate, effect: "fewer stalks; sparser scene, background dust more visible"}
  - {name: plantSize (0.16 factor), default: 0.16, tried: [0.32], change: large, effect: "2x stalk size; heavy overlap, dense thicket"}
  - {name: detCol (color noise detail), default: 0.008-0.01*0.3, tried: [0.008-0.01*3], change: subtle, effect: "no visible large change; broad colour patches essentially the same, slightly finer hue variation"}
  - {name: den (branches per unit), default: 0.3, tried: [0.6], change: moderate, effect: "double branches per stalk; bushier, fir-tree-like, more overlap"}
  - {name: speckle count, default: 12000, tried: [48000], change: moderate, effect: "background dust 4x denser; colourful speck field clearly visible behind stalks"}
reusable_candidates:
  - {name: plantStalk, signature: "plantStalk(x, y, size, colorT) -> void", note: "ara(): dotted tapering stem + curved branches + ADD-blend glow dots at branch tips"}
  - {name: paletteLerp, signature: "getColor(palette, t) -> color", note: "lerp between adjacent palette entries, wraps with t % length, pow on the fractional part"}
  - {name: noiseColorField, signature: "noiseColor(palette, x, y, detail, offset) -> float", note: "2-D noise at position -> palette position t for spatially coherent color patches"}
  - {name: speckleField, signature: "speckle(count, alpha) -> void", note: "thousands of faint tiny rotated ellipses as background dust"}
---

## What it draws
On a near-black background, ~260 small plant-like stalks are scattered edge to edge with no
overlap control. Each stalk is a thin vertical dotted stem (dots taper toward the top) with
short curved branches arching along it — upturned near the top, drooping near the bottom — and
a small flat colored ellipse at its base, like a puddle. Tiny glow dots mark branch tips.
Colours come from a 4-colour palette (indigo, yellow, pink, bright blue); they shift in large
smooth regions across the canvas so neighbours share a hue. A faint, sparse dust of tiny
specks covers the whole background.

## How the code works
Static: `setup()` calls `generate()` once; `draw()` is empty (frames 10/60 identical to 1).
`generate()` (lines 44-89):
1. Background: `background(10)` (line 50). Then 12000 faint specks (lines 55-65): random
   position, size `width*random(0.01,0.04)*0.08` (~0.8-3 px), random rotation,
   `fill(lerpColor(getColor(), color(0), random(0.8)))` — a random palette colour heavily
   darkened, so only a sparse dust is visible.
2. 260 plants (lines 71-86). Position: x uniform, y mapped from the loop index (top-to-bottom
   sweep with jitter via `random(-0.1,1.1)` on x). Size `s = width*map(v,0,1,0.81,1)*0.16*
   random(0.6,1)` (~77-154 px, larger toward the top). Per-plant colour position
   `ic = noise(desCol + x*detCol, desCol + y*detCol)*colors.length*2` (line 77) with
   `detCol = random(0.008,0.01)*0.3` — very low noise frequency, hence the broad coherent
   colour patches. `rcol()` picks a random palette colour for the base ellipse (line 83).
3. `ara(x,y,s,ic)` (lines 172-247) draws one stalk:
   - stem: `s` small ellipses walking from (x,y) up to (x,y-s), width `s*0.04*(v+0.1)`
     tapering with `pow(v, pwrTron)`, horizontal drift `mov` a random walk damped by 0.9
     (lines 182-192); colour `getColor(ic + dc*v)` so the stem hue drifts along its length.
   - branches: `s*den` iterations (den=0.3); each picks a height `v`, an amplitude curve
     `curAmp = pow(pow(1-curAmp,0.45),1.6)` shaped by `cos(...)`, an angle `angV =
     pow(v,3)*1.2-0.8` (droop at bottom, upturn at top), and a side (left/right mirror,
     line 212). Each branch is a 4-point `curve()` stroke (line 234) plus an ADD-blended
     glow ellipse at the tip (lines 237-242).

Randomness: `randomSeed(seed)`/`noiseSeed(seed)` at the top; the `seed` field is the only
harness seed field. The triangulate import is present but no triangulate classes are used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_100 | `int cc = 260;//10;// 2000;` -> `int cc = 100;//10;// 2000;` | moderate (0.074, 28% px) | sparser scene: ~40% of the stalks, same size/colour patches; background dust stands out more | variants/cc_100/frame_00001.png |
| plantSize_0.32 | `float s = width*map(v, 0, 1, 0.81, 1)*0.16*random(0.6, 1);` -> `...0.32...` | large (0.199, 66% px) | stalks 2x taller; they overlap into a dense thicket, individual stalks hard to separate | variants/plantSize_0.32/frame_00001.png |
| detCol_3 | `float detCol = random(0.008, 0.01)*0.3;` -> `...*3;` | subtle (0.025, 9% px) | no visible large change; broad colour patches (yellow top-centre, blue left, pink right) essentially the same, patch edges slightly finer | variants/detCol_3/frame_00001.png |
| den_0.6 | `float den = 0.3;//random(1.5, 3);` -> `float den = 0.6;//random(1.5, 3);` | moderate (0.115, 44% px) | double the branches per stalk; much bushier, fir-tree-like silhouette, more local overlap | variants/den_0.6/frame_00001.png |
| specks_48000 | `for (int i = 0; i < 12000; i++) {` -> `for (int i = 0; i < 48000; i++) {` | moderate (0.102, 39% px) | background dust 4x denser: a clearly visible colourful field of tiny specks (yellow/blue/pink) behind the unchanged stalks | variants/specks_48000/frame_00001.png |

## Modularisation notes
- `ara()` is the core reusable unit: a "plant stalk" generator (dotted stem + curved
  branches + tip glows), parameterised by position, size, and palette position `ic`. Its
  internal constants (`pwrTron`, `den`, stroke weight, glow alpha) would be the parameter
  object.
- `getColor(float)` (lerp-between-neighbouring-palette-entries, wrapping) is a generic
  palette function; `rcol()` a trivial random pick.
- The noise→colour-position step (`ic = noise(...)*colors.length*2`, line 77) is a generic
  spatial colour field, independent of the drawing.
- One-off art decisions: the 4-colour palette, the 12000-speck background dust, the
  base-ellipse "puddle", the y-sweep placement rule, and the exact branch-shape constants
  (`pwrAmp`, `curAmp` formula, droop angle).
- A clean parameter object: {plantCount, sizeRange, colorDetail, branchesPerUnit (den),
  stemTaper (pwrTron), branchStrokeWeight, glowAlpha, speckleCount, palette}.
