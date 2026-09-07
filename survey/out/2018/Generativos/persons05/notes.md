---
sketch: 2018/Generativos/persons05
year: 2018
renderer: P2D
size: [720, 720]
libraries: [triangulate]
deterministic: false
ms_first_frame: 1469
animated: true
techniques: [agents, grid, curves]
primitives: [line, ellipse, rect]
palette:
  colors: ["#2B00BE", "#F73859", "#9896F1", "#D59BF6", "#EDB1F0"]
  selection: random-from-list
composition: scattered
parameters:
reusable_candidates:
  - {name: personAgent, signature: "personAgent(position, size, palette, t) -> draws one figure", note: "capsule body + head + legs + curved arms driven by a swing angle; a self-contained walking-figure agent"}
  - {name: scatterWithMinDist, signature: "scatterWithMinDist(n, minDist, bounds) -> PVector[]", note: "place n points, reject any closer than minDist to an already-placed one"}
---

## What it draws
A flat, poster-like crowd of tall stylized "person" figures scattered over a soft lavender field, overlaid with a faint white square grid. Each figure is a vertical rounded-rectangle (capsule) body in one solid colour, a small elliptical head above it, two thin straight legs, and two thin curved arms ending in dot hands. The dominant colours are deep indigo/blue, coral red, periwinkle and pale pink/lilac against the light-purple ground. Figures vary a lot in height and body width, and are depth-sorted top-to-bottom so nearer (lower) ones paint over farther ones.

## How the code works
`setup()` calls `size(720,720,P2D)` then `generate()`. `generate()` (persons05.pde:61) seeds RNG, picks a random background colour from the palette (never #2b00be), sets `gridCount = int(random(40,60)*0.5)` (=20–30) and `gridSize = width/gridCount`, then spawns `countPersons = gridCount*1.6` (≈32–48) `Person` objects, rejecting any whose start position is within 5px of one already added. Each `Person.init()` (Person.pde:24) places itself snapped to the grid, sets `size = gridSize*0.8` (with a 10% chance of a 0.5–2.4× size multiplier), randomises `hh` (a height factor 0.2–1), `widthBody`, `heightBody = size*5.2*hh`, head size, and picks pants/shirt/skin colours via `rcol()` that are forced distinct from the background and from each other.

`draw()` (persons05.pde:26) runs every frame: resets `noiseSeed`, computes `time = millis()*0.001`, clears to `backColor`, draws the faint grid (`stroke(255,12)`, vertical + horizontal lines spaced `gridSize`), depth-sorts persons by `position.y`, then calls `p.update(); p.show()` on each. `update()` (Person.pde:60) swings the arms via `angle = time*handsVel*10` and drifts the figure slowly toward a random `newPosition` (speed capped at 0.3). `show()` (Person.pde:126) translates to the position and draws: two faint ground-shadow ellipses, two `line()` legs in the pants colour, a rounded `rect()` torso in the shirt colour, a `curve()`-based arm with a dot hand on each side, and a skin-coloured `ellipse` head.

Randomness enters through `rcol()` (fixed 6-entry palette, #2b00be weighted double) for every colour, and through position/size/height factors. The palette is a fixed list (persons05.pde:231), so the look is always this blue/red/lilac scheme. Because `time` uses `millis()` and movement uses `random()` per frame, the sketch is not deterministic and figures drift/swing over time (frames 1/10/60 differ slightly). The triangulate library is imported but the triangulation calls are commented out.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The `Person` class is the clearly reusable unit: a self-contained "figure agent" whose `show()` is a pure function of `position`, `size`, `hh`, a swing `angle`, and a 3-colour (pants/shirt/skin) assignment — parameterising `size`, `hh`, arm swing speed and palette would make it a library `personAgent(...)`. The `scatterWithMinDist` placement loop (persons05.pde:83–106) is also generic and separable. The faint background grid (persons05.pde:34–37) is a trivial standalone overlay. One-off art decisions: the specific palette list, the `#2b00be` exclusion rule for background, the 10% size-mutation chance, the 5.2 body-height multiplier, and the 3-colour mutual-exclusion constraint. A clean parameter object would carry: `{count, gridSize, sizeScale, heightFactor, armSpeed, palette[], backgroundExcluded, gridAlpha}`.
