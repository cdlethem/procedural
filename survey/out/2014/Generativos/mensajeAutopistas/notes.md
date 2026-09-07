---
sketch: 2014/Generativos/mensajeAutopistas
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 476
animated: false
techniques: [lines-hatching]
primitives: [line, rect]
palette:
  colors: ["#E4DED0", "#ABCCBD", "#7DBEB8", "#181619", "#E32F21"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 2000, tried: [500, 5000], change: large, effect: "500: sparser, individual tracks and dark background clearly visible; 5000: denser, more chaotic, heavier overlap"}
  - {name: strokeWeight, default: 2, tried: [4], change: moderate, effect: "thicker double-line tracks, bolder/heavier look"}
  - {name: markerW, default: 80, tried: [40], change: subtle, effect: "smaller marker rects at track heads; overall image nearly unchanged"}
  - {name: diagStep, default: "random(50,100)", tried: ["random(10,30)"], change: large, effect: "shorter diagonal steps, more angular/jagged segments, PCB-like look"}
reusable_candidates:
  - {name: diagonalTracks, signature: "diagonalTracks(count, diagRange, vertRange, lw, markerW, markerH, palette) -> void", note: "2000 random diagonal double-line tracks with small marker rects at each start point"}
---

## What it draws
A dense field of diagonal double-line tracks sweeping from upper-right to lower-left across the full 600×800 canvas, in five flat colours: off-white, light teal, deeper teal, near-black, and red. Each track is two parallel 2-px lines offset by 2 px, with a small horizontal rectangle (80×10) at its start point. The background is one of the five palette colours chosen at random. The overall impression is a stylised highway map or a "message" written in road markings — the name `mensajeAutopistas` means "highway message".

## How the code works
`setup()` sets the 600×800 canvas and calls `generar()` once; `draw()` is empty so the image is static (lines 9–15).

`generar()` (line 22):
1. Fills the background with a random palette colour via `rcol()` (line 23, 60–62).
2. Sets `strokeWeight(2)` (line 24).
3. Loops `i = 0..1999` (line 25): for each iteration picks a random start point `(x, y)` and two random palette colours `c1`, `c2` (lines 26–29).
4. While `dx > 0 && dy < height` (line 32): with 50 % probability moves down-left by `random(50,100)` px on both axes (lines 37–40); otherwise moves straight down by `random(10,50)` px (lines 42–43). Each step draws two parallel lines: `stroke(c2); line(x1,y1+3, x2,y2+3)` and `stroke(c1); line(x1,y1+1, x2,y2+1)` (lines 45–48) — the 2-px vertical offset between the two strokes creates the double-line "lane" effect.
5. After the walk, draws two 80×10 rectangles at the original start point: `fill(c2); rect(x, y+2, 80, 10)` and `fill(c1); rect(x, y, 80, 10)` (lines 52–56) — a small marker/label at the head of each track.

Randomness enters via `random(width)`, `random(height)`, `random(paleta.length)`, the 50 % branch, and the step-size ranges. No noise, no blend modes, no transforms — the layered look comes purely from 2000 overlapping tracks in five flat colours.

## Experiments
| variant | substitution | change score | observation | image |
| count_500 | `for (int i = 0; i < 2000; i++)` -> `i < 500` | large | sparser; individual tracks and dark background clearly visible through gaps | variants/count_500/frame_00001.png |
| count_5000 | `for (int i = 0; i < 2000; i++)` -> `i < 5000` | large | denser; more chaotic, tracks overlap heavily, busier texture | variants/count_5000/frame_00001.png |
| sw_4 | `strokeWeight(2);` -> `strokeWeight(4);` | moderate | thicker double-line tracks; bolder, heavier look | variants/sw_4/frame_00001.png |
| marker_40 | `rect(x, y+2, 80, 10);` -> `rect(x, y+2, 40, 5);` | subtle | no visible change at canvas scale; marker rects slightly smaller | variants/marker_40/frame_00001.png |
| diag_20 | `int cant = int(random(50, 100));` -> `int cant = int(random(10, 30));` | large | shorter diagonal steps; more angular/jagged segments, more frequent turns | variants/diag_20/frame_00001.png |

## Modularisation notes
The `generar()` body is the only logic; it is a single self-contained function with no helper calls besides `rcol()`. The `diagonalTracks` pattern (random start → biased random walk → double-stroke line per step → marker rect) is the core reusable unit. A clean parameter object would expose: `count`, `diagMin`, `diagMax`, `vertMin`, `vertMax`, `lw`, `offset` (2 px gap between the two parallel strokes), `markerW`, `markerH`, `palette`, `bgColor`. The 50/50 branch probability is currently hard-coded; it would become a parameter (e.g. `pDiag`).
