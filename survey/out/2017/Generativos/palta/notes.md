---
sketch: 2017/Generativos/palta
year: 2017
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 140
animated: false
techniques: [grid, curves, symmetry]
primitives: [rect, ellipse]
palette:
  colors: ["#3D8AFF", "#FFD335", "#FFBAE6", "#FEE8FF"]
  selection: lerp-between
composition: centered
parameters:
  - {name: s, default: 0.6, tried: [0.9], change: subtle, effect: "larger figure; outlines closer to canvas edges, same shape"}
  - {name: bodyRatio, default: "random(0.6, 0.8)", tried: ["random(0.85, 0.95)"], change: subtle, effect: "wider body; main ellipse rounder, top/bottom rects wider"}
  - {name: ms, default: "random(0.22, 0.4)", tried: ["random(0.35, 0.55)"], change: subtle, effect: "taller neck (top part), higher split line, smaller lower bulge"}
  - {name: stroke, default: "stroke(0, 200)", tried: ["stroke(255, 200)"], change: none, effect: "outlines fade to nearly the background colour; only the brown seed stands out"}
  - {name: seedFill, default: "fill(120, 80, 10)", tried: ["fill(160, 60, 60)"], change: none, effect: "no visible change (seed hue shifts slightly within 'none' range)"}
  - {name: cs, default: "random(0.3, 0.38)", tried: ["random(0.45, 0.55)"], change: none, effect: "larger seed; small area, so small pixel fraction"}
reusable_candidates:
  - {name: palta, signature: "palta(x, y, s)", note: "pear/avocado figure: outer rect+ellipse, split neck and bulge rect+ellipse pairs, filled seed ellipse"}
  - {name: getColor, signature: "getColor(v, colors[]) -> int", note: "random float -> lerpColor between adjacent palette entries"}
---

## What it draws
A single centered, abstract avocado/pear ("palta") on a pale pink background. The body is a tall
rounded outline: a large rectangle with an ellipse inscribed in it; a smaller rectangle+ellipse
sits at the top (the neck) and a wide rectangle+ellipse forms the big rounded bottom. A solid
brown oval (the seed) sits in the lower-center of the figure. All strokes are thin and dark;
nothing else is on the canvas.

## How the code works
- `setup()` (L3-8): 600x600, `smooth(8)`, `pixelDensity(2)` (unavailable on this display, see
  baseline stderr), then `generate()`. `draw()` is empty (L10-12), so the piece is static; any key
  press regenerates (L14-17).
- `generate()` (L24-28): background = `getColor(random(back.length), back)`, where `back` (L61)
  is 4 pastels; `getColor` (L69-75) picks a random float and `lerpColor`s between two adjacent
  entries, so the background is a blend of two pastels (seed 42 lands on pale pink).
- `palta(x, y, s)` (L30-59), called with `s = width*0.6` (L27), draws with `rectMode(CENTER)`,
  `noFill()`, `stroke(0, 200)`:
  - outer rect + inscribed ellipse, `w = s*random(0.6, 0.8)`, `h = s` (L31-38) — the main silhouette;
  - `ms = random(0.22, 0.4)` (L40) splits the height: small top rect+ellipse at height `h*ms`
    (L42-47) — the neck; then a full-width rect+ellipse at height `h*(1-ms)` (L48-53) — the bulge,
    which is the large circle of the figure;
  - seed: filled ellipse `fill(120, 80, 10)` (brown), diameter `cs = w*random(0.3, 0.38)`, placed
    in the lower half (L56-58).
- Randomness enters only through the `random()` calls above, seeded once at L1; vertical symmetry
  is structural (all shapes share center x). The 13-color `colors[]` array (L64-65) and `rcol()`
  (L66-68) are defined but never used in this sketch — leftover from another palette.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| s_0.9 | `  palta(width*0.5, height*0.5, width*0.6);` -> `  palta(width*0.5, height*0.5, width*0.9);` | subtle | larger figure: outlines reach closer to the canvas edges, proportions unchanged | variants/s_0.9/frame_00001.png |
| w_0.9 | `  float w = s*random(0.6, 0.8);` -> `  float w = s*random(0.85, 0.95);` | subtle | wider body: main ellipse rounder, top and bottom rects wider | variants/w_0.9/frame_00001.png |
| ms_0.45 | `  float ms = random(0.22, 0.4);` -> `  float ms = random(0.35, 0.55);` | subtle | taller neck, higher split line, smaller lower bulge | variants/ms_0.45/frame_00001.png |
| stroke_255 | `  stroke(0, 200);` -> `  stroke(255, 200);` | none | outlines fade to nearly the pale-pink background; figure barely visible, only the brown seed stands out | variants/stroke_255/frame_00001.png |
| seedFill_1606060 | `  fill(120, 80, 10);` -> `  fill(160, 60, 60);` | none | no visible change (seed hue shifts only slightly, within 'none' range) | variants/seedFill_1606060/frame_00001.png |
| cs_0.5 | `  float cs = w*random(0.3, 0.38);` -> `  float cs = w*random(0.45, 0.55);` | none | larger brown seed; occupies a small area, so small pixel fraction | variants/cs_0.5/frame_00001.png |

## Modularisation notes
- `palta(x, y, s)` is fully self-contained (all dimensions derived from `s`) — a clean candidate
  for a "pear/avocado figure" primitive with a parameter object: `{s, bodyRatio (w/h), topRatio
  (ms), seedRatio (cs/w), stroke, seedColor}`.
- `getColor(v, colors[])` is a generic palette-blend helper; the `back[]`/`colors[]` arrays are
  art decisions to externalise.
- The unused `colors[]`/`rcol()` should be dropped when porting.
