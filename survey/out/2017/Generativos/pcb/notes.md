---
sketch: 2017/Generativos/pcb
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 199
animated: false
techniques: [grid, packing, lines-hatching]
primitives: [line, ellipse, rect, shape]
palette:
  colors: ["#0A0A0A", "#FAFAFA", "#8C8C8C", "#FFDCA0"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: cc, default: "random(20,100)", tried: [35], change: "", effect: ""}
  - {name: traceWeight, default: "ss*0.15", tried: ["ss*0.4"], change: "", effect: ""}
  - {name: resistorFrac, default: "random(0.04)", tried: ["random(0.15)"], change: "", effect: ""}
  - {name: growthIterations, default: 10000, tried: [40000], change: "", effect: ""}
  - {name: background, default: 10, tried: [60], change: "", effect: ""}
reusable_candidates:
  - {name: growGridTraces, signature: "growGridTraces(used[][], cell, seeds, iterations) -> Line[]", note: "random-walk traces grown from seed pads on an occupancy grid, marking cells as they go"}
  - {name: placeFootprints, signature: "placeFootprints(used[][], cell, w, h, frac, orientation) -> footprint[]", note: "random non-overlapping rectangular footprint placement on an occupancy grid"}
  - {name: drawTrace, signature: "drawTrace(points[], cell) -> void", note: "polyline + endpoint pads (ellipses) for a grid trace"}
---

## What it draws
A top-down printed-circuit-board texture on a near-black field: a dense web of thin
off-white traces (straight and diagonal polylines) each capped with a small round pad at
its ends, winding across the whole canvas. Scattered among the traces are pale-tan
rounded-rectangle resistors (a line running through the middle) and a handful of larger
gray rounded-rectangle IC chips. The pattern fills edge to edge with only a hairline margin.

## How the code works
`setup()` sets size(960,960), smooth(8), rectMode(CENTER) and calls `generate()` once;
`draw()` is empty, so the piece is static (single render).

`generate()` (pcb.pde L22-209):
- L23 `background(10)` near-black. L25 `cc = int(random(20,100))` = grid resolution;
  L26 `ss = width/(cc+2.)` = pixels per cell; L27 `translate(ss*1.5, ss*1.5)` insets the
  grid ~1.5 cells (the visible margin). L29 `strokeWeight(ss*0.15)` sets trace weight.
- L32 `used[cc][cc]` boolean occupancy grid; L33 `useds = cc*cc` counts free cells.
- Main branch (L37, taken with prob 0.995):
  - **Resistors** (L38-78): `c = cc*cc*random(0.04)` components. Each is a 1x4 or 4x1
    cell footprint (L44-50 picks axis) placed at a random (x,y) whose footprint is not
    already `used`; the footprint is marked used, two endpoint `Line` seeds are added
    (L74-75), and a `Resistor` is recorded.
  - **ICs** (L80-127): `c = cc*cc*random(0.02)` chips. Each is a 3x3 base extended to
    `random(3,10)` along one axis; footprint marked used, per-row/col pin `Line` seeds
    added (L117-120), body drawn as a gray (fill 140) rounded rect (L126).
  - **Wire growth** (L129-151): 10000 iterations. Each picks a random existing `Line`,
    reads its last cell, and random-walks to an adjacent free cell (dx,dy in {-1,0,1}),
    appending points and marking cells used; a stuck walk retries a few directions then
    stops. This grows the trace network outward from the component pads.
- Rare else branch (L152-196, prob 0.005) fills the whole grid with random walks; not
  taken at seed 42.
- Render (L197-208): `stroke(250); noFill();` then every `Line` drawn as a polyline
  (`beginShape/vertex/endShape`, L222-227) with endpoint pads as ellipses sized 0.5*ss
  (L219,221). Components are drawn after (resistor line+body, IC body).

Randomness enters via `cc` (density), component counts/positions (L38, L52-53, L80,
L94-95), and every wire step (L135-136, L139-140). Colour is fixed: near-black bg,
off-white traces, gray IC bodies, tan resistor bodies. The `colors[]` arrays (L274,
L310) and `rcol()` (L319) are defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic: the occupancy-grid random-walk trace grower (used[][] + growth loop, L129-151)
is a reusable "maze/traces on a grid" generator; the non-overlapping footprint placer
(check `used`, then mark, L55-72) is a reusable "pack rectangles on a grid" routine;
`Line.show` / `Resistor.show` / `IC.show` are generic renderers.

One-off art decisions: the specific component set (resistor = 1x4 tan pill, IC = 3xN
gray block), the fixed palette (tan/gray/off-white on near-black), the 0.995 branch,
and the 10000 growth budget.

A clean parameter object: `{cell (grid resolution), traceWeight (fraction of ss),
growthIterations, resistorFraction, icFraction, marginCells, palette{bg, trace, ic,
resistor}}`.
