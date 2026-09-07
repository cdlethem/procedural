---
sketch: 2020/generative/01_04/popi
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1469
animated: true
techniques: [particles, dots-stippling]
primitives: [ellipse, rect]
palette:
  colors: ["#000000", "#0E1C00", "#6D9100", "#D61406", "#E2A218"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: pointCount, default: 30, tried: [300], change: moderate, effect: "far denser field of small dots, some clustered"}
  - {name: seedDotSize, default: 20, tried: [80], change: moderate, effect: "same count, each dot ~4x larger"}
  - {name: initZ, default: 2, tried: [60], change: none, effect: "no visible change at frame 1; rects are 1px thin alpha outlines"}
  - {name: strokeAlpha, default: 120, tried: [4], change: none, effect: "no visible change; outlines stay faint 1px lines"}
  - {name: background, default: 190, tried: [0], change: large, effect: "black field; dots and faint squares read against dark"}
reusable_candidates:
  - {name: getColor, signature: "getColor(v) -> color", note: "map a float to a lerp between adjacent palette entries (c1..c2, pow(v%1,1.8))"}
---

## What it draws
On a flat light-grey field, about 30 small solid black dots are scattered at random positions. As the frames advance, thin hollow squares (rectangles) grow around each dot and their strokes pick up faint colour from a five-colour palette (black, dark green, olive, red, amber). At frame 1 the picture reads as a sparse field of tiny black dots; by frame 60 a few dots show a faint greenish/amber square halo.

## How the code works
`setup()` -> `generate()` (popi.pde:21-29, 62-106): seeds RNG/noise from `seed`, paints `background(190)` (light grey, line 69), then places 30 dots in a loop (lines 73-81) at `random(width)/random(height)`, drawing a filled black `ellipse(x, y, 20, 20)` (line 78) and storing a `PVector(x, y, 2)` in `points`. These ellipses are drawn once and persist (no `background()` in `draw()`).

`draw()` runs every frame (lines 33-50): for each point it advances `p.z += 0.008; p.z *= 1.003` (lines 45-46) so each square grows geometrically, then with `rectMode(CENTER)` and `noFill()` strokes a square `rect(p.x, p.y, p.z, p.z)` (line 48). The stroke colour is `getColor(frameCount*0.2)` (line 47) — a value that walks through the 5-entry `colors[]` palette (line 117), lerping between adjacent entries (`getColor(float)`, lines 125-131). The second `stroke()` argument `random(120)` is the **alpha** (0-255), not the weight, so every outline is a thin 1px semi-transparent line re-rolled to a random opacity each frame; the layers accumulate over frames. Depth test is disabled (line 64). `SimplexNoise`/`triangulate` are imported but unused by the active code.

## Experiments
| variant | substitution | change score | observation | image |
| count_300 | `for (int i = 0; i < 30; i++)` -> `for (int i = 0; i < 300; i++)` | moderate | ~300 small dots, much denser scattered field with some clusters | variants/count_300/frame_00001.png |
| dotSize_80 | `ellipse(x, y, 20, 20);` -> `ellipse(x, y, 80, 80);` | moderate | same ~30 dots but each ~4x larger | variants/dotSize_80/frame_00001.png |
| initZ_60 | `points.add(new PVector(x, y, 2));` -> `points.add(new PVector(x, y, 60));` | none | no visible change; still plain dots (larger start size not visible at frame 1) | variants/initZ_60/frame_00001.png |
| strokeWeight_4 | `stroke(getColor(frameCount*0.2), random(120));` -> `... random(4));` | none | no visible change; only faint 1px thin square outlines around dots | variants/strokeWeight_4/frame_00001.png |
| bg_0 | `background(190);` -> `background(0);` | large | black field; same dots plus faint dark square outlines | variants/bg_0/frame_00001.png |

## Modularisation notes
The generic, reusable pieces: `getColor(float)` (palette lerp by scalar) and the "scatter N points and grow a shape at each" scaffold. One-off art decisions: the specific 5-colour palette, the geometric z-growth constants (0.008 / 1.003), the per-frame `random(120)` stroke **alpha** (weight stays 1px), and the 20px black seed dots. A clean parameter object would hold: pointCount, seedDotSize, initZ, zAdd, zMul, strokeAlphaMax, palette, and background.
