---
sketch: 2020/generative/01_04/fffrrr
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 5680
animated: false
techniques: [noise-field, polar, symmetry, blend-modes, lines-hatching]
primitives: [line, ellipse]
palette:
  colors: ["#edbc1c", "#941313", "#2B1F19", "#1B44C1"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: des, default: 1.0, tried: [0.5], change: moderate, effect: "0.5 = 10x10 grid (100 flowers); much denser, smaller rosettes, carpet-like texture"}
  - {name: cc, default: "random(3,8)", tried: ["random(6,12)"], change: moderate, effect: "more strands per flower; denser, more layered, harder to distinguish individual rosettes"}
  - {name: sub, default: "0.6*amp", tried: ["0.3*amp"], change: moderate, effect: "halved iterations; sparser, more delicate, individual spiral strands visible, more background showing"}
  - {name: det, default: 0.002, tried: [0.008], change: moderate, effect: "higher noise detail on arc angles; slightly rougher, more high-frequency wobble in individual arcs"}
  - {name: alp, default: 26, tried: [60], change: moderate, effect: "higher alpha; brighter, more saturated, flowers appear more 'filled in' and glowing"}
  - {name: colors, default: "#edbc1c,#941313,#2B1F19,#1B44C1", tried: "#FFB401,#072457,#EF4C02,#ADC7C8,#FE6567", change: moderate, effect: "warm orange/pink/white palette; much lighter overall, pastel feel, gold and salmon dominant"}
reusable_candidates:
  - {name: nearestNeighborTree, signature: "nearestNeighborTree(points: PVector[]) -> edgeList", note: "Prim-like nearest-neighbor spanning tree over a point set"}
  - {name: noisyArc, signature: "noisyArc(cx, cy, radius, startAngle, endAngle, noiseScale, noiseZ) -> shape", note: "arc with simplex-noise distortion on angular sampling"}
  - {name: radialFlower, signature: "radialFlower(cx, cy, scale, strandCount, iterations, noiseDetail) -> void", note: "spiral strand cluster with oscillating radius and noise-perturbed arcs"}
---

## What it draws
On a near-black background, a 5×5 grid of radial "flower" rosettes fills the canvas. Each rosette is composed of many thin, semi-transparent arcs that spiral outward in 3–8 strands, giving a dense, wispy, almost calligraphic texture. The dominant visible colours are gold/yellow (lower-right), blue (lower-left and mid-left), and deep red (upper region), with occasional pale-blue connector threads linking neighbouring rosette centres. A few tiny bright specks (additive dots) scatter within the flowers. The overall impression is of glowing, organic mandala-like forms packed edge-to-edge.

## How the code works

1. **Setup / grid generation (fffrrr.pde:90–109)**
   - `generate()` is called once from `setup()`. A 5×5 grid (jj, ii from −2 to 2, step `des = 1.0`) produces 25 candidate centres.
   - Each centre is jittered by `random(−0.12, 0.12)` in x and y, then pulled toward the canvas centre via `lerp` with a random factor in [0.14, 1.96] (clamped to ≤1 effectively). A random per-point scale `sca` in roughly [0.8, 3.0] is stored as the z-component of a `PVector`.

2. **Background (back.pde:3–38)**
   - `background(10)` sets a very dark grey.
   - A rejection-sampling loop (10 000 attempts) places non-overlapping circles with noise-modulated radii (3–18 px). The actual drawing (ellipses) is commented out, so the visible effect is just the dark background.

3. **Connections (connects.pde:2–40)**
   - A nearest-neighbour spanning tree is built over the 25 points (Prim-like: repeatedly pick the closest unreached point to the reached set).
   - Each edge is drawn by `lines()` (connects.pde:42–69): the segment is subdivided into `dis*6` short line segments. Each sub-segment's colour comes from `getColor(noise(x*detCol*2, y*detCol*2)*2*len + desCol + jitter)`, giving a noise-driven palette sampling. Alpha is high (random(255,255)→~255) but stroke weight is very thin (`dis*pow(v,0.8)*0.006`), producing faint pale threads. 20 % of segments use `blendMode(ADD)` for a slight glow.

4. **Flowers (flower.pde:2–90)**
   - For each of the 25 points, `flower()` is called.
   - A global scale is multiplied by `1.6 * lerp(1, map(cy,0,height,0.2,1.2), rand)` making lower flowers smaller.
   - `cc = random(3,8)` strands. Each strand:
     - Colour: `getColor(noise(cx*detCol, cy*detCol)*2*len + desCol + jitter)`, optionally lerped toward white.
     - Radius oscillates between `r1` (~48 px) and `r2` (~72 px) raised to a random power, modulated by `osc = 1 + sin(v²·TAU·oscAmp)·0.24 + sin(a·6)·0.2`.
     - The strand is walked over `sub ≈ 4800–9600` steps. At each step a tiny arc (`arc2`) is drawn at the current polar position. The arc's angular span is determined by two simplex-noise values (det = 0.002·v), creating an irregular, organic arc shape.
     - Alpha is `26·sin(πv)·rand(0.6,1) − rand(2)`, so strokes fade in at the start/end of the strand.
     - 20 % of steps also draw a tiny additive dot (`ellipse` with `blendMode(ADD)`).
     - A secondary positional offset `cos(xx*2.01)*1.8` adds a subtle wobble.
     - `def()` (fffrrr.pde:120–125) applies a ±12 px simplex-noise displacement to each arc's centre, further organicising the shape.

5. **Blending / renderer**
   - P3D renderer with `smooth(8)`, `pixelDensity(2)`.
   - `blendMode(ADD)` is used for the occasional dots and for 20 % of connector sub-segments, creating local glow.
   - `DISABLE_DEPTH_TEST` is set, so all geometry is painter's-order.

## Experiments
| variant | substitution | change score | observation | image |
| alp_60 | `float alp = 26*sin(PI*v)*random(0.6, 1)-random(2);` -> `60*sin(...)` | moderate | much brighter, more saturated; blue and yellow rosettes glow; red top more prominent; overall denser fill | variants/alp_60/frame_00001.png |
| cc_6_12 | `int cc = int(random(3, 8));` -> `int(random(6, 12));` | moderate | denser flowers, more overlapping strands; blue dominates more; individual rosettes less distinct | variants/cc_6_12/frame_00001.png |
| det_0.008 | `float det = 0.002*v;` -> `0.008*v;` | moderate | slightly rougher arc texture; more high-frequency wobble; overall structure similar | variants/det_0.008/frame_00001.png |
| sub_0.3 | `int(random(4000, 8000)*0.6*amp)` -> `*0.3*amp` | moderate | sparser, more delicate; individual spiral strands visible; more dark background showing; lighter/sketchy feel | variants/sub_0.3/frame_00001.png |
| colors_alt | palette -> `#FFB401, #072457, #EF4C02, #ADC7C8, #FE6567` | moderate | warm orange-gold, pink/salmon, white, navy; much lighter and pastel; gold and salmon dominant | variants/colors_alt/frame_00001.png |
| des_0.5 | `float des = 1.0;` -> `0.5;` | moderate | 100 flowers instead of 25; smaller, more numerous rosettes; dense carpet-like texture; blue/yellow still dominant but blended | variants/des_0.5/frame_00001.png |

## Modularisation notes
- **`nearestNeighborTree`** (connects.pde): generic Prim-like spanning tree; useful for any point-set connection visualisation.
- **`noisyArc` / `arc2`** (flower.pde:92–109): a parametric arc whose angular domain is perturbed by 2-D simplex noise. Could be a standalone drawing primitive.
- **`radialFlower`** (flower.pde): the core loop (polar walk + oscillating radius + noise arc + additive dots) is self-contained given (centre, scale, strandCount, iterations, noiseScale, palette). The `def()` noise offset and `osc` modulation are separable modifiers.
- **Parameter object**: `{ gridN (int), jitter (float), scaleRange [lo,hi], strandRange [lo,hi], iterationRange [lo,hi], noiseDetail (float), oscAmpRange [lo,hi], palette: int[], blendRatio (float), dotProbability (float) }`.
- The commented-out background dots and the dead code in `back()` are one-off art decisions with no current visual contribution.
