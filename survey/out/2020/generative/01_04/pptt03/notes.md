---
sketch: 2020/generative/01_04/pptt03
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1738
animated: false
techniques: [distortion, grid]
primitives: [shape]
palette:
  colors: ["#F3B2DB", "#518DB2", "#02B59E", "#DCE404", "#82023B"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(20,40))*5 (seed 42)", tried: [100], change: large, effect: "more, thinner stripes; denser fine pinwheel at the center"}
  - {name: amp, default: "random(20,80)*0.4 (8-32)", tried: [4], change: large, effect: "much flatter: gentle S-flow instead of sharp zigzag; center pinch thinner"}
  - {name: rot, default: "random(10)*random(0.4,1)", tried: [0], change: moderate, effect: "center star-swirl gone, simple vertical pinch; outer regions unchanged"}
  - {name: osc2, default: "int(random(10,60))", tried: [3], change: large, effect: "coarser: long smooth waves instead of fine zigzag; center pinch a narrow funnel"}
  - {name: palette, default: "#F3B2DB #518DB2 #02B59E #DCE404 #82023B", tried: ["#354998 #D0302B #F76684 #FCFAEF #FDC400"], change: large, effect: "same geometry, colors now navy/red/pink/cream/yellow"}
reusable_candidates:
  - {name: wavyColumns, signature: "wavyColumns(cc, osc1, osc2, amp, rot, palette) -> void", note: "per-column quad strips displaced by sin(x,y) with a radial center warp"}
---

## What it draws
Full-bleed canvas of vertical wavy stripes in pink, blue, teal, yellow-green and deep maroon.
The stripes ripple with a regular vertical wave plus a fine horizontal wiggle. In the middle the
stripes are pulled into a pinched, star-shaped vortex: they swirl and compress toward the center
and flare out in six arms, like a pinwheel.

## How the code works
`setup()` calls `generate()` once (draw() is empty), so the image is static (pptt03.pde:21-35).
`generate()` (85-113) picks a column count `cc = int(random(20,40))*5` (91), column width
`ss = width/cc` (92), wave frequencies `osc1` (94, horizontal direction per column), `osc2` (95,
vertical), amplitude `amp` (96) and swirl `rot` (98). It then loops `i = -40 .. cc+40` and for
each column draws one `QUAD_STRIP` (103-111) stepping `j` from -200 to height+200 in 0.5 px
increments, emitting two vertices per step: `def(i*ss, j)` and `def((i+1)*ss, j)`.

`def(x, y)` (116-137) is the distortion: within `maxDist = width*0.4` of the center it lerps the
point toward a radially rotated position (`cos(ang + PI*v2*rot)`, line 127-128) with a `v1*v1`
radial squeeze, producing the star-shaped center pinch. Then a sinusoidal displacement
`x + cos((y/width)*TAU*osc1)*amp`, `y + sin((x/height)*TAU*osc2)*amp` (134-136) adds the wave.

Colour: per step the fill is `getColor(i + 40 + (j*5/height))` (105); `getColor(float)` (160-165)
takes the value mod 5, lerps between the two adjacent palette colours with `pow(frac, 0.6)`. So
colour cycles down each column in the 5-colour palette (149). No blend modes, no stroke
(`noStroke()`, 100). The `Quad` class (45-78) and `rcol()` (152) are unused in this flow.
SimplexNoise is imported but never used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_100 | `int cc = int(random(20, 40))*5;` -> `int cc = 100;` | large (mean 0.2406, 82.2% of pixels) | columns re-align to exactly 100 (9.6 px each): stripe pattern and 5-colour bands visibly shift vs baseline; center pinwheel denser and finer | variants/cc_100/frame_00001.png |
| amp_4 | `amp = random(20, 80)*0.4;` -> `amp = 4;` | large (mean 0.2448, 84.5% of pixels) | waves flatten: stripes run as a gentle S-curve instead of the baseline's sharp zigzag; center pinch remains but is narrower and less star-like | variants/amp_4/frame_00001.png |
| rot_0 | `rot = random(10)*random(0.4, 1);` -> `rot = 0;` | moderate (mean 0.1139, 39.3% of pixels) | center star-swirl gone: stripes pass through the middle with a simple vertical pinch; outer regions essentially unchanged | variants/rot_0/frame_00001.png |
| osc2_3 | `osc2 = int(random(10, 60));` -> `osc2 = 3;` | large (mean 0.2285, 81.1% of pixels) | across-canvas bow coarsens: long smooth undulation left-to-right instead of several small bends; center pinch narrows to a smooth funnel | variants/osc2_3/frame_00001.png |
| palette_alt | `int colors[] = {#F3B2DB, #518DB2, #02B59E, #DCE404, #82023B};` -> `int colors[] = {#354998, #D0302B, #F76684, #FCFAEF, #FDC400};` | large (mean 0.3363, 99.5% of pixels) | identical geometry, different palette: navy, red, pink, cream, yellow; stripe pattern unchanged | variants/palette_alt/frame_00001.png |

## Modularisation notes
The whole image is one generic block: a grid of distorted column strips with a radial center warp
plus sinusoidal displacement — a clean `wavyColumns(cc, osc1, osc2, amp, rot, palette)` function.
One-off art decisions: the specific palette (149), the `v1*v1` radial squeeze shape and the
`pow(frac, 0.6)` colour easing in `getColor`. The unused `Quad` class and `rcol()`/`triangulate`
import are dead code for this sketch.
