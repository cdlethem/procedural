---
sketch: 2016/Generativos/arcss
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 835
animated: false
techniques: [polar]
primitives: [shape]
palette:
  colors: ["#08D9D6", "#252A34", "#FF2E63", "#EAEAEA"]
  selection: lerp-between
composition: radial
parameters:
  - {name: layers, default: 100, tried: [30], change: large, effect: "fewer overlapping layers -> sparser; big solid wedges & a dark-navy block stand out instead of dense blended rings"}
  - {name: r2max, default: 0.8, tried: [0.4], change: large, effect: "caps outer radius -> rings become a contained disc on a black margin instead of full-bleed"}
  - {name: amp, default: "0.2..0.96", tried: ["0.2..0.4"], change: subtle, effect: "arcs fill less of each slot -> thinner spokes with more gaps; radii/bands & colours essentially unchanged"}
  - {name: cc, default: "3..100", tried: ["3..30"], change: large, effect: "fewer segments per ring -> coarser, bolder spoke bars"}
  - {name: arcyRes, default: "PI*r2+4", tried: ["PI*r2+30"], change: none, effect: "higher polygon vertex count -> no visible change (arcs already sampled densely enough)"}
  - {name: maxAlpha, default: 255, tried: [120], change: moderate, effect: "lower alpha -> more translucent, paler, lower-contrast image"}
reusable_candidates:
  - {name: arcSector, signature: "arcSector(cx, cy, r1, r2, a1, a2) -> void", note: "closed annular sector (donut wedge) between inner radius r1 and outer radius r2 over angle a1..a2"}
  - {name: colorRamp, signature: "colorRamp(stops[]) -> getColor(p):color", note: "piecewise-linear colour ramp sampled at p in [0,1]"}
---

## What it draws
A radial, full-bleed composition centred on the middle of a black 960x960 canvas:
many concentric rings made of short arc segments (annular sectors) that fan out from a
small dark core to large pale rings near the edges. Dominant colours are teal/cyan,
pink-red, dark navy, and pale pink-white, laid down semi-transparently so overlaps
blend into muted mauves. The inner rings are dense and segmented (many thin spokes),
the outer rings are broader and sparser, giving a target / radar / vinyl look.

## How the code works
`setup()` (arcss.pde:3) creates a `ColorRamp` (colorRamp.pde) with four stops at
positions 0.0/0.2/0.6/0.85 — teal `#08D9D6`, navy `#252A34`, pink-red `#FF2E63`,
pale `#EAEAEA` — then calls `generate()`. `draw()` is empty, so the image is built
once per `generate()` call (static).

`generate()` (arcss.pde:26) fills a black background and centres on (width/2, height/2).
A loop runs 100 times (line 30); each iteration draws one "layer" of arc sector(s):
- `r2 = width*random(0.05, 0.8)` (line 31) picks the outer radius (48..768 px), so
  rings span from small to near-full-bleed; `r1 = r2*random(1)` (line 32) picks a
  smaller inner radius, making the wedge a donut.
- `a1 = random(TWO_PI)`, `a2 = a1+random(TWO_PI)` (lines 33-34) set a random angular span.
- `rnd = int(random(3))` (line 35) chooses one of three modes; `cc = int(random(3,100))`
  (line 36) is a segment count; `amp = random(0.2, 0.96)` (line 37) is how much of each
  slot an arc fills.
- Colour: `fill(cr.getColor(random(1)), random(255))` (line 39) samples the ramp at a
  random position (lerped between the four stops) with a random alpha — this is what
  produces the translucent overlaps and the mauve blends.
- Mode 0 (line 40): one big `arcy` wedge spanning a1..a2.
- Mode 1 (line 42): `cc` wedges evenly spaced across the a1..a2 span, each covering
  `amp` of its slot (`a1+da*j .. a1+da*(j+amp)`) — produces the dense spoke rings.
- Mode 2 (line 48): `cc` multiplied by 1..8, evenly spaced over a full TWO_PI, each wedge
  drawn only if `random(1) > prob` — sparse dotted rings.

`arcy()` (arcss.pde:63) builds a closed `beginShape` polygon: points on the inner circle
r1 from a1->a2, then points on the outer circle r2 from a2 back to a1. The vertex count
is `int(PI*r2+4)` (line 66), i.e. resolution grows with radius. All wedges share the same
centre, which is why the whole image reads as concentric rings.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| layers_30 | `for (int i = 0; i < 100; i++) {` -> `... i < 30; i++) {` | large | sparser: fewer overlaps, big solid wedges & a dark-navy block stand out; less 'radar', more pie segments | variants/layers_30/frame_00001.png |
| r2max_0.4 | `float r2 = width*random(0.05, 0.8);` -> `... 0.4);` | large | rings pulled into a contained vinyl/mandala disc on a black margin, no longer full-bleed | variants/r2max_0.4/frame_00001.png |
| amp_0.4 | `float amp = random(0.2, 0.96);` -> `... 0.4);` | subtle | spokes/wedges fill less of their slot -> thinner with more gaps; radii, bands & colours essentially unchanged | variants/amp_0.4/frame_00001.png |
| cc_30 | `int cc = int(random(3, 100));` -> `... (3, 30));` | large | coarser: capping per-ring segments at 30 makes mode-1 spokes bolder/wider with bigger gaps | variants/cc_30/frame_00001.png |
| arcyres_30 | `int cc = int(PI*r2+4);` -> `... PI*r2+30);` | none | no visible change: raising polygon vertex count makes no pixel difference (arcs already dense enough) | variants/arcyres_30/frame_00001.png |
| alpha_120 | `fill(cr.getColor(random(1)), random(255));` -> `... random(120));` | moderate | more translucent: halving max alpha washes out colours, shows black background more, lower contrast | variants/alpha_120/frame_00001.png |

## Modularisation notes
- `ColorRamp` (colorRamp.pde) is fully generic and reusable as-is: add stops, sample at
  `p`; the `show()` method is a debug helper.
- `arcy()` is a clean primitive: an annular sector / donut wedge, parameterised by centre,
  two radii, two angles and an implicit segment resolution. A good library function.
- `generate()` is the one-off art decision: the 100-layer loop, the three-mode branching,
  the radius/angle/amp random distributions, and the random-alpha ramp colouring.
- A clean parameter object: `{layers:100, rMin:0.05, rMax:0.8, ccMin:3, ccMax:100, ampMin:0.2, ampMax:0.96, maxAlpha:255, stops:[{col,pos}...]}`.
