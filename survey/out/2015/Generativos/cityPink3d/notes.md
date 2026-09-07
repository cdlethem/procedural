---
sketch: 2015/Generativos/cityPink3d
year: 2015
renderer: P3D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 2023
animated: false
techniques: [noise-field, grid, 3d-mesh, shader, distortion]
primitives: [line, shape]
palette:
  colors: ["#FE4365", "#FC9D9A", "#F9CDAD", "#C8C8A9", "#83AF9B", "#FF8059", "#000000"]
  selection: random-from-list
composition: radial
parameters:
  - {name: cc, default: 300, tried: [600], change: none, effect: "no visible change — terrain mesh barely visible at this camera angle"}
  - {name: det, default: 0.002, tried: [0.008], change: subtle, effect: "slightly finer, busier ripple in the faint terrain mesh near the frame edges"}
  - {name: terrainH, default: 1000, tried: [3000], change: none, effect: "no visible change"}
  - {name: ccc, default: "random(600,2000)", tried: ["random(600,3000)"], change: subtle, effect: "denser field of towers, slightly more crowded radial lines"}
  - {name: towerH, default: "random(200,1000)*random(0.5,1)", tried: ["random(200,3000)*random(0.5,1)"], change: moderate, effect: "towers reach much higher, taller stepped columns fill more of the frame, terrain pushed further back"}
  - {name: sep, default: 20, tried: [40], change: none, effect: "no visible change"}
reusable_candidates:
  - {name: prismTower, signature: "prismTower(sides, layers, baseRadius, height, amp) -> QUADS mesh", note: "stacked-prism tower with radius alternating per layer (j%2*amp) for a chevron profile"}
  - {name: noiseTerrain, signature: "noiseTerrain(cells, sep, detail, height) -> QUADS mesh", note: "one big QUADS grid whose y is noise(x*det, z*det)*h, single fill colour"}
  - {name: vintageFilter, signature: "vintageFilter(blurOffset, scanFreq, vignettePow) -> PShader", note: "frag.glsl: 3x3 gaussian-like blur + horizontal scanlines + radial vignette mixing orange then black"}
---

## What it draws
A view from inside a 3D city looking up at the sky: a strong pink/magenta field with dozens of
stepped prism towers in mint green, cream, and pale pink standing on all sides and rising away
from the centre. Thin white diagonal lines criss-cross the whole frame (a depth-disabled
background grid), a faint wavy mesh of low-poly terrain is visible near the edges, and a warm
vignette brightens the centre while the corners darken, with a soft blur and faint scanline
texture over everything.

## How the code works
`setup()` (line 12) creates an 800x800 P3D canvas, loads `frag.glsl` as `vintage`, and calls
`generate()` once; `draw()` is empty (lines 20-21), so the sketch is static.
`generate()` (line 28):
- reseeds noise with a random int (line 34) and paints `background(rcol())` — a random palette
  colour (line 36).
- With `hint(DISABLE_DEPTH_TEST)` (line 38) it draws parallel diagonal `line()`s (lines 42-44)
  spaced `sss = random(20,80)` px, weight `sss*random(0.2,0.6)`, in near-white `stroke(255,240)`.
  These ignore depth so they read as a grid over everything (lines 42-44).
- The camera is translated to the centre and pushed down (`translate(width/2, height/2,
  random(-4000,200)`, line 54) and randomly rotated (lines 55-56), so we look up from below
  the city.
- Terrain: a `cc x cc` (300x300) grid of QUADS, `sep = 20` px, `y = noise(x*det, z*det)*h` with
  `det = 0.002`, `h = 1000` (lines 59-83); one random fill and dark thin stroke (`stroke(0,30)`).
  This is the faint wavy mesh.
- Towers: `ccc = random(600,2000)` of them (line 85). Each is a stack of `ch` (up to 60)
  layers of `sub` (3-10) sides; radius `anc` is multiplied by `1 - amp*(j%2)` so odd layers
  inset, making the stepped chevron profile (lines 96-121). Each tower gets its own
  `fill(rcol())` and is placed at a random (x, +500, y) within a ±2000 cube (lines 88-90).
- 20 huge translucent quads (`fill(rcol(), random(20))`, random 3-axis rotations, lines 130-149)
  add ghost planes.
- `filter(vintage)` (line 150) applies the fragment shader: a 9-tap weighted 3x3 blur
  (frag.glsl 42-44), a scanline modulation `0.99+cos(uv.y*iResolution.y*1.8)*0.01` (line 47),
  and a radial vignette mixing orange `vec4(1.0,0.5,0.35)` then black by
  `pow(distance(uv, 0.5), …)` (lines 51-54). This produces the warm centre / dark corners and
  the soft film texture.
- `rcol()` (line 153) picks uniformly from the 5-colour palette (lines 1-7). Randomness enters
  via the noise reseed, camera, line spacing, and every tower/plane parameter; `noise()` is only
  used for terrain height.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_600 | `int cc = 300;` -> `int cc = 600;` | none | no visible change | variants/cc_600/frame_00001.png |
| det_0.008 | `float det = 0.002;` -> `float det = 0.008;` | subtle | subtle: terrain ripple near the edges slightly finer and busier | variants/det_0.008/frame_00001.png |
| terrainH_3000 | `float h = 1000;` -> `float h = 3000;` | none | no visible change | variants/terrainH_3000/frame_00001.png |
| towers_3000 | `int ccc = int(random(600, 2000));` -> `int ccc = int(random(600, 3000));` | subtle | subtle: more, denser towers in the radial field | variants/towers_3000/frame_00001.png |
| towerH_3000 | `float h = random(200, 1000)*random(0.5, 1);` -> `float h = random(200, 3000)*random(0.5, 1);` | moderate | clearly taller stepped towers fill more of the frame; overall composition taller and busier | variants/towerH_3000/frame_00001.png |
| sep_40 | `float sep = 20;` -> `float sep = 40;` | none | no visible change | variants/sep_40/frame_00001.png |

Key finding: the terrain parameters (cc, det, terrainH, sep) are nearly invisible — the noise
terrain is a faint mesh mostly occluded behind the towers, so the look is dominated by the tower
count and height, plus the palette, camera, and vignette. To make the terrain matter, the camera
would need to look down on it, or the towers removed.

## Modularisation notes
Generic: `noiseTerrain` (grid + noise height, single colour), `prismTower` (stacked n-gon prism
with per-layer inset), the `vintage` shader (blur + scanlines + vignette), and the
depth-disabled line grid. One-off art decisions: the camera pushed to the city centre and
looking up, the pink-dominated 5-colour palette, the specific vignette colours/powers, and the
random placement volume (±2000 cube, y+500). A clean parameter object would carry:
`palette[]`, `terrain{cells, sep, detail, height, color}`, `towers{count, sidesRange, layersMax,
heightRange, radiusRange, ampRange, volume, yOffset}`, `grid{spacingRange, alpha, weightFactor}`,
`planes{count, alpha, size}`, `shader{blurOffset, scanFreq, vignetteColor, vignettePow}`.
