---
sketch: 2018/Generativos/plasma006
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1545
animated: false
techniques: [grid, packing, polar, lines-hatching]
primitives: [point, line, ellipse, shape]
palette:
  colors: ["#000F29", "#FE0706", "#F85E8D", "#3E56A8", "#090D0E", "#06A5FF"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: maxPlanetSize, default: 0.7, tried: [0.3], change: moderate, effect: "smaller max radius accepts more points (less overlap) -> denser field of smaller planets/fans"}
  - {name: packTries, default: 10000, tried: [2000], change: moderate, effect: "fewer attempts -> fewer planets, much sparser field"}
  - {name: fanProb, default: 0.4, tried: [0.9], change: large, effect: "90% of planets get the sector fan -> busiest image, large pinwheels everywhere"}
  - {name: lineFrac, default: "0.3-0.4", tried: ["0.8-0.9"], change: none, effect: "no visible change - thin low-alpha lines blend into white bg"}
  - {name: spiralProb, default: 0.2, tried: [0.8], change: moderate, effect: "most planets carry the 4000-point radial spiral halo -> busier dotted texture"}
  - {name: lineWeightMax, default: 2, tried: [8], change: none, effect: "no visible change - faint low-alpha lines barely register even at 8px"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "draws a sector/fan of small filled quads sweeping from radius r1 to r2 over an angular span; the pie-slice pinwheels"}
  - {name: circlePack, signature: "circlePack(maxTries, cell, sizeMin, sizeMax) -> PVector[]", note: "rejection-sample non-overlapping circles snapped to a grid"}
  - {name: connectPairs, signature: "connectPairs(points, frac, weightMax)", note: "draw thin lines between random point pairs, optionally capped with a quarter-arc"}
---

## What it draws
A near-white field carrying a faint 40px grid, dotted with "planets" of widely varying size. Each
planet is a small filled central dot, and some are surrounded by a pinwheel/fan of coloured pie
sectors (some big, e.g. the large yellow/olive wheel at top-left, some small). Thin coloured lines
link random pairs of planets, and one dense radial burst of multicoloured strokes radiates from a
hub point at the bottom-right. Colours are reds, pinks, blues, yellows and olive/grey on an
off-white background.

## How the code works
`setup()` calls `generate()` once (`draw()` is empty, line 21-22), so the output is static.

- **Palette + hue rotation** (46-56): a fixed 9-entry list `aux` (6 unique colours,
  `#000F29 #FE0706 #F85E8D #3E56A8 #090D0E #06A5FF`, repeated) is hue-rotated by a random
  `hr = random(360)` and stored in `colors`. `rcol()` (225) picks a random entry each call —
  colours are random-from-list over the rotated palette.
- **Background + grid** (61-84): `background(252)` off-white; a 40px grid drawn with
  `stroke(0,4)` lines (74-77) plus `stroke(0,30)` dots at every 40px intersection (80-84).
- **Packing** (88-106): up to 10000 random points snapped to the 40px grid; each gets a size
  `s = width*random(0.04, 0.7)` and is accepted only if it doesn't overlap an existing one
  (`dist < (s+p.z)*0.5`). This yields the scattered non-overlapping "planets" of varying size.
- **Per-planet rendering** (108-177): 60% of planets skip the fan. For the rest, `arc2`
  (198-216) sweeps small filled quads from the centre out to radius `r*mr` over the full circle,
  one wedge per iteration, each a random colour and random alpha — this is the pinwheel/fan.
  With 20% probability an extra 4000-point spiral is dotted around the planet (160-173). A small
  filled `ellipse` of `r*0.1` is the central dot (175-176).
- **Connecting lines** (179-194): `points.size()*random(0.3,0.4)` thin lines
  (`stroke(rcol(), random(140))`, `strokeWeight(random(2))`) between random point pairs; 80% of
  them are capped with a quarter-`arc2` fan. A hub that happens to be picked by many pairs
  produces the dense radial burst.

Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (58-59): palette rotation, point
positions/sizes, which planets get fans/spirals, fan wedge count & alpha, line endpoints.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| maxsize_0.3 | `float s = width*random(0.04, 0.7);` -> `...random(0.04, 0.3);` | moderate | denser field of smaller planets/fans + a big central line-hub | variants/maxsize_0.3/frame_00001.png |
| tries_2000 | `for (int i = 0; i < 10000; i++) {` -> `... i < 2000; ...` | moderate | much sparser - fewer planets, large empty areas, a couple fans + radial bursts | variants/tries_2000/frame_00001.png |
| fanprob_0.1 | `if (random(1) < 0.6) continue;` -> `< 0.1` | large | busiest - nearly every planet has a big sector fan, large grey circle top-right | variants/fanprob_0.1/frame_00001.png |
| linefrac_0.85 | `...points.size()*random(0.3, 0.4)` -> `random(0.8, 0.9)` | none | no visible change - connecting lines are thin (<=2px) and low-alpha, extra lines blend in | variants/linefrac_0.85/frame_00001.png |
| spiralprob_0.8 | `if (random(1) < 0.2) {` -> `< 0.8` | moderate | several planets carry a dense 4000-point radial spiral halo, larger bottom-right burst | variants/spiralprob_0.8/frame_00001.png |
| lineweight_8 | `strokeWeight(random(2));` -> `random(8)` | none | no visible change - faint low-alpha lines barely register even up to 8px | variants/lineweight_8/frame_00001.png |

Caveat: the packing is order-dependent rejection sampling, so changing planet size or count
reshuffles which points are accepted; each row above therefore mixes the parameter's local effect
with a reshuffled layout (not a clean A/B on a single planet).

## Modularisation notes
Generic and reusable:
- `arc2` — the sector-fan primitive is self-contained and parameterised (position, two radii,
  angular span, colour, two alphas). A natural library "fan/annulus-of-quads" primitive.
- The packing loop (88-106) is a standard non-overlapping circle-pack with grid snapping — could
  be a `circlePack()` returning the accepted points.
- The connecting-line loop (179-194) is a generic "link random pairs, optionally cap with an arc".

One-off art decisions:
- The specific 9-colour palette and the global random hue rotation.
- The exact probability gates (60% skip fan, 20% spiral) and the many `random(...)` multipliers
  that tune wedge count and alpha.
- The 40px grid + background grey are presentation, not structure.

A clean parameter object for this sketch: `cellSize` (grid), `maxTries` (packing attempts),
`sizeMin/sizeMax` (planet radii), `fanProb`, `spiralProb`, `lineFrac`, `lineWeightMax`,
`palette` + `hueRot`.
