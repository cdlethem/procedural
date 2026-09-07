---
sketch: 2017/Generativos/circlescirclescircles
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2986
animated: false
techniques: [recursion, polar, distortion]
primitives: [shape]
palette:
  colors: ["#F8CA9C", "#F8B6D9", "#EF276B", "#A14FBE", "#1D43B8"]
  selection: lerp-between
composition: scattered
parameters: []
reusable_candidates:
  - {name: circleRec, signature: "circleRec(x, y, size, levels, children, childScale) -> void", note: "recursive radial ring: disc plus N child discs on a circle of radius size*0.3"}
  - {name: triFanCircle, signature: "triFanCircle(x, y, size, wedges, palette) -> void", note: "disc built from N triangles fanned from a random interior point, per-wedge conic colour gradient"}
---

## What it draws

Two large soft-edged clusters of nested circles on a pale pink/peach ground, one in the
upper-left and one in the lower-left, both partly cut off by the canvas edge. Each cluster is a
big disc (pink-magenta or periwinkle-blue) containing a ring of six smaller discs, each of which
contains a ring of six still smaller ones, down to five levels. The smallest discs look like tiny
flowers or bubbles. Dominant colours are pink, magenta, purple and blue with cream/peach accents;
every disc has a soft radial shading and a faintly faceted, off-centre highlight.

## How the code works

`generate()` (L24-35) re-seeds, paints the background with a random `getColor()` value, then picks
one origin offset from the centre by a random angle within `s*0.2` (L30-32) and calls
`circleRec(x, y, s, 5)` with `s = width*random(1, 10)` (L29) — so one or two huge discs, each
typically crossing the canvas edge.

`circleRec` (L37-50) draws one disc with the custom `circle()` and, if `lvl > 0`, recurses into
`cc = 6` children placed every `TWO_PI/6` around the parent at radius `r = s*0.3` (L44-48);
children get size `ss = r*0.9` (L39), i.e. each level scales by ~0.27, so level 5 discs are
~1/1000 of the top disc. The start angle of each ring is random (L46), so rings are rotated
relative to their parent.

The custom `circle()` (L52-79) does not call Processing's `circle`: it builds the disc from
`res = 120` tiny triangles, each with two vertices on the rim and the third at a single random
interior point (L57-59). Because all triangles share that one off-centre apex, the disc looks
softly shaded with a faceted highlight. Each wedge's rim colour is a conic gradient:
`getColor(ic + map(distance-from-wedge-mid, ...))` (L63-67) sweeps a random amount `dc` of the
palette around the rim, giving each disc a two-tone swirl. `getColor` (L88-93) lerps between two
adjacent entries of the 5-colour palette (L83), so all colours come from
#F8CA9C/#F8B6D9/#EF276B/#A14FBE/#1D43B8. The `fill(0, 20)` at L42 is set but never used for a
draw (the child `circle()` sets its own fill per wedge), so it has no visible effect. The sketch
is static: `draw()` is empty (L10-12); generation happens once in `setup`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

- `circleRec` is generic as-is: a `radialRecursion(x, y, size, levels, {children, childScale, radiusFrac, randomRingRotation})` function.
- `triFanCircle` is a reusable "soft disc" primitive: `fanDisc(x, y, size, {wedges, apexOffset, colorSweep})` — the shared-apex triangle fan + conic palette sweep is the distinctive look.
- `getColor`/`colors[]` is a standard lerp-between-palette helper.
- One-off art decisions: the single-origin `generate()` call (one or two giant clusters), the
  0.3/0.9 scale pair (governs how tightly the rings nest), and the palette itself.
- A clean parameter object: `{originOffset, topSize, levels, children, childScale, wedges, palette, sweep}`.
