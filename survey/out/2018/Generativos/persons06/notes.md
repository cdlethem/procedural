---
sketch: 2018/Generativos/persons06
year: 2018
renderer: P2D
size: [720, 720]
libraries: [triangulate]
deterministic: false
ms_first_frame: 1488
animated: true
techniques: [grid, agents, curves]
primitives: [ellipse, rect, line, point]
palette:
  colors: ["#2B00BE", "#F73859", "#9896F1", "#D59BF6", "#EDB1F0"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: "gridCount multiplier", default: 0.5, tried: [1.0], change: subtle, effect: "more grid cells → smaller gridSize → smaller, more numerous figures"}
  - {name: "countPersons multiplier", default: 1.6, tried: [3.2], change: subtle, effect: "doubled person count; denser scene"}
  - {name: "heightBody factor", default: 5.2, tried: [8.0], change: subtle, effect: "slightly taller, more elongated bodies"}
  - {name: "headWidth factor", default: 0.12, tried: [0.3], change: none, effect: "no visible change; head ellipse too small to register at canvas scale"}
  - {name: "grid stroke alpha", default: 12, tried: [60], change: none, effect: "no visible change; grid still barely perceptible against background"}
  - {name: "handsVel range", default: 0.8, tried: [2.0], change: none, effect: "no visible change at frame 1; arm-swing phase ≈ 0 early in animation"}
reusable_candidates:
  - {name: gridPersons, signature: "gridPersons(count, cellSize, personScale) -> Person[]", note: "scatter persons snapped to a fine grid with min-distance rejection"}
  - {name: capsulePerson, signature: "capsulePerson(size, height, hh, palette) -> void", note: "draw a stylised capsule-bodied stick figure with swinging arms and legs"}
---

## What it draws
A lavender field dotted with small, stylised stick-figure people. Each figure is a tall rounded-rectangle (capsule) torso in indigo, coral-red, periwinkle, or pale pink, topped by a tiny ellipse head, with two thin curved arms arcing out from the shoulders and two thin legs dangling below. A faint white grid is visible in the background. The figures vary in height and lean slightly; the whole scene reads like a crowd of tiny people seen from above and a distance, each in a different pastel/indigo palette. The sketch is animated: figures drift slowly to new random positions and their arms swing sinusoidally, so the scene evolves gently over time.

## How the code works

**Setup** (`persons06.pde:18–24`): `size(720,720,P2D)`, `smooth(8)`, `rectMode(CENTER)`, then calls `generate()` once.

**generate()** (`persons06.pde:61–135`):
- Picks a random `backColor` from the 5-colour palette (line 66–67), avoiding `#2B00BE` as background.
- Sets `gridCount = int(random(40,60)*0.5)` → 20–30 cells across; `gridSize = 720/gridCount` (lines 69–70).
- `countPersons = int(gridCount*1.6)` → 32–48 persons (line 77).
- For each person: constructs `Person()` which snaps a random position to the grid (lines 40–41 in `Person.pde`), assigns `size = gridSize*0.8` (with a 10 % chance of a 0.5–2.4× size multiplier, line 29), and picks `pants`, `shirt`, `skin` colours from the palette with rejection so they differ from `backColor` and each other (lines 45–50).
- A minimum-distance check (`dist < 5 px`) rejects overlapping spawns (lines 86–93).
- After the loop, each person's position is drawn as a 2×1 px dot (lines 118–122).

**draw()** (`persons06.pde:26–51`):
- `noiseSeed(seed)` is re-called every frame (line 28) — effectively a no-op since noise is not used in the active code paths.
- `time = millis()*0.001` (line 30) drives all animation.
- Background grid: `stroke(255, 12)` (very faint white) vertical and horizontal lines every `gridSize` pixels (lines 33–37).
- Persons are sorted by Y (painter's algorithm, line 39) then `update()` + `show()` each (lines 41–46).

**Person.update()** (`Person.pde:60–124`):
- `angle = time*handsVel*10` — sinusoidal arm/leg swing phase (line 62).
- Movement: with 3 % probability per frame the target `newPosition` is re-randomised; otherwise the person eases toward it at max 0.3 px/frame (lines 65–74). This gives slow, random drift.
- Body geometry: hip, body, head, shoulder, hand, foot positions are computed relative to `position` using `cos(angle)`/`sin(angle)` for the swing, and a vertical bob `dy = cos(time*10)*hh*5` (line 89).

**Person.show()** (`Person.pde:126–168`):
- Soft shadow: two concentric `fill(0,8)` ellipses at the feet (lines 131–134).
- Legs: `stroke(pants)`, two 1.2 px lines from foot to pelvis (lines 138–140).
- Hip: `fill(pants)`, ellipse with width modulated by `ampWidth = 0.9+cos(angle*2)*0.1` (line 145).
- Torso: `fill(shirt)`, rounded rect (`rect` with 4 corner radii) of size `widthBody×heightBody` (line 148).
- Head: `fill(skin)`, small ellipse (line 153).
- Arms: `stroke(shirt)`, two `curve()` beziers from hand to shoulder with a slight vertical offset (lines 159–160).
- Hands: `fill(skin)`, tiny ellipses (lines 163–164).

**Non-determinism**: `time = millis()` makes the animation state at any given frame depend on wall-clock time, so even with the same seed the exact pose at frame 1 differs between runs.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| gridCount_1.0 | `gridCount = int(random(40, 60)*0.5);` → `*1.0` | subtle | slightly smaller, more numerous figures; grid lines marginally more visible | variants/gridCount_1.0/frame_00001.png |
| countPersons_3.2 | `int countPersons = int(gridCount*1.6);` → `*3.2` | subtle | noticeably denser scene; same figure sizes, more of them | variants/countPersons_3.2/frame_00001.png |
| heightBody_8.0 | `heightBody = size*5.2*hh;` → `*8.0` | subtle | bodies slightly taller and more elongated | variants/heightBody_8.0/frame_00001.png |
| headWidth_0.3 | `headWidth = size*0.12;` → `0.3` | none | no visible change | variants/headWidth_0.3/frame_00001.png |
| gridAlpha_60 | `stroke(255, 12);` → `stroke(255, 60);` | none | no visible change | variants/gridAlpha_60/frame_00001.png |
| handsVel_2.0 | `handsVel = random(-0.8, 0.8);` → `random(-2.0, 2.0);` | none | no visible change at frame 1 | variants/handsVel_2.0/frame_00001.png |

## Modularisation notes
The `Person` class is self-contained and well suited to extraction: it takes a `gridSize`, a palette, and a random seed, and exposes `update(dt)` and `show(ctx)`. The grid-drawing block in `draw()` (lines 33–37) is trivially parameterisable as `drawGrid(count, color, alpha)`. The `rcol()` palette picker and the min-distance rejection loop in `generate()` are small, generic utilities. A clean parameter object would be: `{ personCount, gridSize, sizeScale, heightFactor, headScale, armSwingSpeed, moveSpeed, palette[], bgExclude, minDist }`.
