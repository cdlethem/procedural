---
sketch: 2015/Generativos/FFt/fft_prueba1
year: 2015
renderer: P3D
size: [640, 640]
libraries: [minim]
deterministic: false
ms_first_frame: 3031
animated: true
techniques: [shader, grid, 3d-mesh]
primitives: [box]
palette:
  colors: ["#DCDCDC", "#FFFFFF", "#000000"]
  selection: fixed
composition: centered
parameters:
  - {name: background, default: 220, tried: [120, 40], change: large, effect: "darker base => much stronger shader vignette; 120 = brighter white centre with a darker gray ring, 40 = near-black field"}
  - {name: cc, default: 8, tried: [3], change: none, effect: "no visible change at frame 1 (boxes have ~0 size before audio grows them)"}
  - {name: sep, default: 80, tried: [120], change: none, effect: "no visible change at frame 1 (boxes have ~0 size)"}
  - {name: boxSize, default: 0.0, tried: [70], change: moderate, effect: "forcing a fixed size reveals the 8^3 box lattice front-on as a near-solid block, muting the bright centre into a flatter mid-gray"}
reusable_candidates:
  - {name: postShader, signature: "postShader(tex, blurOffset, vignettePow) -> vec4", note: "post.glsl: 3x3 gaussian-like blur + radial black vignette + time-banded modulation"}
  - {name: voxelGrid, signature: "voxelGrid(n, spacing, boxSize) -> void", note: "n^3 lattice of 3D boxes, centered and slowly rotated"}
---

## What it draws
Frame 1 (seed 42) is a smooth radial gradient: a bright near-white centre fading to a mid-gray
ring at the corners and edges — a soft vignette on a flat gray field. No distinct shapes are
visible at frame 1. The sketch is animated and audio-reactive: by frame 60 faint light-gray
slivers of a 3D lattice begin to emerge at the top and bottom as the box size grows with the
music, but the grid stays very faint against the near-white centre.

## How the code works
- `setup()` (lines 13-25): opens a P3D 640x640 canvas at 30 fps, loads `../idm1.mp3` through
  Minim (buffer 512), loops it, builds an `FFT` with 16 linear averages, and loads `post.glsl`.
- `draw()` (lines 27-59), every frame:
  - `randomSeed(seed)` (line 35) reseeds from the `seed` field, which is incremented only when
    `fft.getBand(0) > 36` (line 33). With no/little low-band energy the seed holds, so the
    `background(220)` (line 36) gray is the base field.
  - The camera is translated to centre (line 38) and rotated on all three axes by small
    `frameCount`-scaled angles (lines 39-41), so the grid slowly tumbles.
  - `boxSize` (line 42) is a smoothed lerp toward `fft.getBand(8)+fft.getBand(2)*3` — i.e. the
    box size is driven by mid/high FFT bands and grows/shrinks with the music. At frame 1 the
    value is still ~0, so the boxes are effectively invisible.
  - A triple loop (lines 48-57) places `cc*cc*cc` boxes (`cc = 8`, line 44) on a cubic lattice
    with spacing `sep = 80` (line 45), each `box(boxSize)`, after `noStroke()` (line 46) and a
    centring `translate(-sep*cc/2, ...)` (line 47). No `fill()` is set, so boxes use the default
    white fill.
  - `filter(post)` (line 58) applies the post shader each frame.
- `post.glsl` is what dominates the image: a 3x3 weighted blur (lines 42-44), a small
  time-modulated brightness wobble (line 47), and a radial mix toward black
  `pow(distance(uv,0.5,0.5),1.2)` (line 54) that produces the vignette. The blue-tint line
  (line 53) is commented out, so the output stays grayscale.
- `generar1()`, `cross()`, `poly()` (lines 61-120) are dead code: the body of `generar1()` is
  commented out and none of these are called from `draw()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| bg_120 | `background(220);` -> `background(120);` | large | much stronger vignette: bright white centre with a darker gray ring | variants/bg_120/frame_00001.png |
| bg_40 | `background(220);` -> `background(40);` | large | near-black field with a faint lighter centre; vignette dominates | variants/bg_40/frame_00001.png |
| cc_3 | `int cc = 8;` -> `int cc = 3;` | none | no visible change (boxes ~0 size at frame 1) | variants/cc_3/frame_00001.png |
| sep_120 | `float sep = 80;` -> `float sep = 120;` | none | no visible change (boxes ~0 size at frame 1) | variants/sep_120/frame_00001.png |
| boxSize_70 | `boxSize += ((fft.getBand(8)+fft.getBand(2)*3)-boxSize)*0.9;` -> `boxSize = 70;` | moderate | reveals the 8^3 box lattice front-on as a near-solid block; mutes the bright centre into a flatter mid-gray | variants/boxSize_70/frame_00001.png |

## Modularisation notes
- **Generic / reusable:** the post shader (blur + radial vignette + time band) is a self-contained
  `PShader` with `iResolution`/`iGlobalTime`/`texOffset` uniforms — a clean `postShader()` library
  function. The centered `n^3` box lattice with a size/spacing parameter is a reusable `voxelGrid()`.
- **One-off art decisions:** tying `boxSize` to specific FFT bands (8 and 2, with a 3x weight on
  band 2), the exact rotation speeds, the audio source, and the grayscale vignette exponent are all
  author choices baked into the audio-reactive logic.
- **Parameter object:** `{n, spacing, boxSize, rotX/Y/Z speed, bgGray, vignettePow, blurOffset,
  audioBands:[...]}`. The `seed` field only gates the (unused) random background, so determinism is
  effectively controlled by the audio stream, not the seed — hence `deterministic: false`.
