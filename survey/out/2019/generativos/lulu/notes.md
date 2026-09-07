---
sketch: 2019/generativos/lulu
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2379
animated: false
techniques: [subdivision, grid, 3d-pointcloud]
primitives: [point, line]
palette:
  colors: ["#DFAB56", "#E5463E", "#366A51", "#2884BC"]
  selection: random-from-list
composition: radial
parameters:
  - {name: clusters, default: 8, tried: [4], change: moderate, effect: "halving clusters thins the starburst: sparser, thinner arms with more black gaps, same colours"}
  - {name: subdivide_iters, default: 8000, tried: [2000], change: moderate, effect: "fewer subdivision steps leaves bigger boxes: coarser streaks, more visible wireframe grid, less fine dust"}
  - {name: point_alpha, default: "random(160,200)", tried: ["random(240,255)"], change: none, effect: "no visible change; ADD blending already saturates dense regions to white"}
  - {name: point_weight, default: "random(0.2,0.6)", tried: ["random(0.8,1.5)"], change: large, effect: "much brighter and denser: bigger white core, arms fill more of the canvas"}
  - {name: cluster_scale, default: 1.3, tried: [0.7], change: moderate, effect: "burst shrinks toward the centre: shorter arms, more black margin at edges"}
  - {name: box_jitter_rot, default: 0.05, tried: [0.3], change: subtle, effect: "subtle: lattice streaks slightly more scattered/softer, overall look unchanged"}
reusable_candidates:
  - {name: octreeSubdivide, signature: "octreeSubdivide(size, iterations) -> Box[]", note: "recursive 8-way box subdivision, stopping below a min edge"}
  - {name: pointLattice, signature: "pointLattice(size, count) -> points", note: "axial point grid filling a cube (gridCube)"}
  - {name: additivePointCloud, signature: "additivePointCloud(boxes, color, alphaRange) -> void", note: "per-box jittered point lattice + faint 99% wireframe under ADD blend"}
---

## What it draws
A black field filled with a radial starburst of glowing point clouds: eight
clusters of densely subdivided boxes, each rendered as a jittered 3-D lattice
of points, radiate from the centre toward the corners. Overlapping points
add to white in the dense core. Dominant colours are red and blue, with
amber/gold and a darker green in the outer arms. Very thin straight wireframe
lines (box edges) cross the image at low opacity, giving the bursts a
tunnel-like, crystalline structure.

## How the code works
`settings()` opens a 960x960 P3D window (lulu.pde:16-21). `setup()` calls
`generate()` once; `draw()` is empty, so the piece is static (lulu.pde:23-34).
`generate()` (lulu.pde:104-178) seeds `random`/`noise` from the harness seed,
sets `background(2)` (near black) and `blendMode(ADD)` (lulu.pde:113-114),
jitters the camera with random `translate`/`rotate` of up to `dc=100`
(lulu.pde:116-121), and sets a random perspective FOV (lulu.pde:132-135).
Then, for each of 8 clusters (lulu.pde:137), it starts from one box of side
`random(800,900)*1.3` at the origin and runs 8000 subdivision steps
(lulu.pde:143-148): each step picks a random box, replaces it with its 8
half-sized octants (Box.sub, lulu.pde:83-101) below a 4-px minimum, building a
stochastic octree of many small boxes plus a few large ones. Every surviving
box is drawn (lulu.pde:154-176) with a small random orientation jitter
(`rot=0.05`) as: (a) a `gridCube` point lattice with `cc` points per axis,
`cc` up to ~2% of the box side, so big boxes get dense lattices and tiny ones
a single point (lulu.pde:168, 180-192); (b) a faint wireframe `box` at 99%
size stroked at alpha 4 (lulu.pde:171-173). Colour: one palette entry
(`rcol()`) is drawn for all boxes in a cluster, stroke alpha 160-200
(lulu.pde:153, 165); the palette is the 4-colour amber/red/green/blue array
(lulu.pde:201). ADD blending makes dense overlap bloom to white; the point
weight per box is `random(0.2, 0.6)` (lulu.pde:164).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| clusters_4 | `for (int k = 0; k < 8; k++) {` -> `for (int k = 0; k < 4; k++) {` | moderate | sparser starburst: thinner arms, more black gaps between bursts, same four colours | variants/clusters_4/frame_00001.png |
| iterations_2000 | `for (int i = 0; i < 8000; i++) {` -> `for (int i = 0; i < 2000; i++) {` | moderate | coarser: fewer, larger boxes survive so streaks are chunkier and the faint wireframe grid is more visible | variants/iterations_2000/frame_00001.png |
| point_alpha_240 | `stroke(col, random(160, 200));` -> `stroke(col, random(240, 255));` | none | no visible change (ADD blend saturates dense areas to white at both alpha ranges) | variants/point_alpha_240/frame_00001.png |
| point_weight_1.0 | `strokeWeight(random(0.2, 0.6));` -> `strokeWeight(random(0.8, 1.5));` | large | much brighter and denser: large blown-out white core, arms fill more of the frame | variants/point_weight_1.0/frame_00001.png |
| cluster_scale_0.7 | `float size = random(800, 900)*1.3;` -> `float size = random(800, 900)*0.7;` | moderate | burst smaller and pulled to centre: shorter arms, more black margin around edges | variants/cluster_scale_0.7/frame_00001.png |
| jitter_rot_0.3 | `float rot = 0.05;` -> `float rot = 0.3;` | subtle | subtle: individual lattice streaks slightly more scattered, overall starburst unchanged | variants/jitter_rot_0.3/frame_00001.png |

## Modularisation notes
- Generic: `octreeSubdivide` (recursive 8-way subdivision with min-edge stop
  and iteration budget) is a reusable 3-D space-filler; `pointLattice`
  (axial point grid in a cube) is a trivial reusable primitive; the
  per-box jitter + faint wireframe + additive rendering is a reusable
  "point-cloud cluster" style.
- One-off art decisions: the 4-colour palette, ADD blend on near-black, the
  starburst composition (all clusters share the world origin, so they read as
  one radial burst), random camera jitter and FOV per run, 8 clusters x 8000
  subdivision budget, and the 99% wireframe at alpha 4.
- A clean parameter object: `{clusters, clusterSize, iterations, minEdge,
  pointsPerAxisCap (fraction of side), jitterRot, pointAlpha, pointWeight,
  wireframeAlpha, palette, blend, cameraJitter, fovRange}`.
