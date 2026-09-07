---
sketch: 2014/Generativos/Arboles
year: 2014
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 162
animated: false
techniques: [recursion]
primitives: [line, rect]
palette:
  colors: ["#FAFAFA", "#000000", "#4B9EFF"]
  selection: fixed
composition: centered
parameters:
  - {name: fanSpread, default: 80, tried: [40], change: subtle, effect: "halving the *80 fan multiplier barely narrows the top splay; silhouette essentially unchanged under seed 42"}
  - {name: cantRamas, default: "random(2,9)", tried: ["random(4,9)"], change: subtle, effect: "no clear visual change; the drawn depth was already >=4 under seed 42 so the lower-bound clamp was a no-op"}
  - {name: maxRami, default: "random(1,4)", tried: ["random(1,7)"], change: moderate, effect: "clearly bushier: denser canopy, more branches and crossing twigs, wider spread"}
  - {name: h, default: "height/3", tried: ["height/2"], change: subtle, effect: "tree and its blue bounding box ~1.5x taller; same branching structure"}
  - {name: strucAlpha, default: 80, tried: [255], change: none, effect: "tree unchanged; only the thin blue bounding box/X becomes full opacity (negligible pixel fraction)"}
reusable_candidates:
  - {name: branchingTree, signature: "branchingTree(x, y, h, depth, maxBranch, spread) -> void", note: "recursive line tree: each node spawns up to maxBranch children at a fanned angle, weight tapers with depth, segment length shrinks per level"}
  - {name: boundingStruc, signature: "boundingStruc(x, y, w, h) -> void", note: "thin alpha-blue rect with an X cross marking the tree's bounding box"}
---

## What it draws
A single black branching tree on a near-white (light gray) field, rooted at the
horizontal center about two-thirds down the canvas and growing upward. The trunk
is a thick line (up to weight ~5) that recursively forks into thinner branches;
the tip twigs are hair-thin (weight 1) and splay out into a loose fan. Around the
base of the tree sits a faint light-blue rectangle (with a diagonal X inside) that
frames the tree's footprint.

## How the code works
`generar()` (line 10) fills the background with `background(250)` and constructs one
`Arbol` at `(width/2, height*2/3)` with height `height/3` (line 12), then calls `init()`.
`draw()` is empty, so the whole picture is produced once in setup (static).

`Arbol` constructor (line 30) sets a random box width `w = h*random(0.18, 0.95)`
(line 34) and a private `seed = int(random(999999999))` (line 37); `init()` re-seeds
with `randomSeed(seed)` (line 43), so the global `--seed` only feeds the top-level
randoms and everything after is internally deterministic.

`init()` picks the structural parameters: `desang = random(-0.02,0.02)` (line 44,
a small base angle bias), `cantRamas = int(random(2,9))` (line 45, recursion depth),
`maxRami = int(random(1,4))` (line 46, max children per node), and `probRami`
(line 47-50, probability a node actually branches). Segment length
`des = h*map(cantRamas, 2, 8, 0.5, 0.20)` (line 52) and start angle
`ang = TWO_PI-PI/2+desang` (line 53, straight up) are passed into `rama()`.

`rama()` (line 58) is the recursion: it steps from `(px,py)` by `cos/sin(ang)*des`
(lines 60-61), sets `strokeWeight` tapering from 5 (base) to 1 (tip) by
`map(rama, 0, cantRamas-1, 1, 5)` (line 62), draws one `line` (line 63), shrinks
`des *= map(rama, 2, 8, 1, 0.70)` (line 64), and decrements the depth. When depth
reaches 0 it stops. Otherwise, with probability `1-probRami` it spawns
`cant = int(random(maxRami)+1)` children (lines 69-71), each at a fanned angle
`auxang = ang + desang*(i-cant/2+...)*80` (line 73) and recurses (line 74).

`drawStruc()` (line 78) draws the thin light-blue (`#4B9EFF`, alpha 80) bounding
box: a `rect` (line 85) plus a vertical center line and the two diagonals (lines
82-84), no fill.

## Experiments
| variant | substitution | change score | observation | image |
| spread_40 | `0:0.5))*80;` -> `0:0.5))*40;` | subtle | top fan of twigs splay marginally less; silhouette essentially same as baseline | variants/spread_40/frame_00001.png |
| depth_4_9 | `int(random(2, 9));` -> `int(random(4, 9));` | subtle | no clear visual change vs baseline (drawn depth already >=4 under this seed, so the lower-bound clamp is a no-op) | variants/depth_4_9/frame_00001.png |
| rami_1_7 | `int(random(1, 4));` -> `int(random(1, 7));` | moderate | clearly bushier: denser canopy, more branches and crossing twigs, wider spread | variants/rami_1_7/frame_00001.png |
| h_half | `height/3*2, height/3);` -> `height/3*2, height/2);` | subtle | tree and blue bounding box ~1.5x taller; same branching structure | variants/h_half/frame_00001.png |
| struc_255 | `stroke(#4B9EFF, 80);` -> `stroke(#4B9EFF, 255);` | none | no change to the tree; only the thin blue bounding box/X is now full opacity (negligible pixel fraction) | variants/struc_255/frame_00001.png |

## Modularisation notes
- Generic / reusable: `rama()` is a clean recursive branching primitive parameterised
  by depth, max-children, segment shrink factor, base angle, fan spread and the
  weight taper. A library `branchingTree(x, y, h, depth, maxBranch, spread, shrink, weightTop, weightBottom)`
  captures it directly. The per-node `random(maxRami)+1` and the `probRami` gate are
  the two stochastic knobs that make each tree irregular.
- One-off art decisions: the blue `drawStruc()` bounding box with its X cross is a
  debug/frame aid, not part of the generative idea; the specific angle formula
  `desang*(i-cant/2+...)*80` (the `*80` fan multiplier) is the sketch's signature
  "splay" look and is the single value that most shapes the silhouette.
- Clean parameter object: `{depth (cantRamas), maxBranch (maxRami), branchProb (1-probRami),
  baseAngle, desang, segmentShrink (0.70), fanSpread (80), weightTop (1), weightBottom (5),
  height (h), showStruc (bool)}`.
