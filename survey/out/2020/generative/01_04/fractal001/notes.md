---
sketch: 2020/generative/01_04/fractal001
year: 2020
renderer: P2D
size: [640, 640]
libraries: []
deterministic: true
ms_first_frame: 1432
animated: false
techniques: [shader, image-source]
primitives: [rect]
palette:
  colors: ["#000000", "#6B0000", "#E63200", "#FF8C00", "#FFD700", "#FFFFE0"]
  selection: image-sampled
composition: full-bleed
parameters:
  - {name: scale, default: 1.2, tried: [], change: none, effect: ""}
  - {name: center, default: "(0.2, 0.9)", tried: [], change: none, effect: ""}
  - {name: max_iter, default: 100, tried: [], change: none, effect: ""}
  - {name: mix_distort, default: 0.01, tried: [], change: none, effect: ""}
reusable_candidates:
  - {name: shaderFractal, signature: "shaderFractal(center, scale, maxIter, distortAmount, paletteImage) -> PShader", note: "full-screen fragment shader iterating a (perturbed) Mandelbrot map, coloured by escape iteration sampled from a 1-D palette strip"}
---

## What it draws
Full-bleed black canvas with a V- or U-shaped fractal structure in the centre, rendered in a fire palette: deep red on the outside, brightening through orange to yellow/white at the boundary. The boundary is extremely intricate and filamentary, with many small islands and spikes. A large black region occupies the top of the frame (points that escape quickly), and the bottom fades from dark red to black. The image is static over time.

## How the code works
The .pde is a thin wrapper (fractal001.pde:4-19): `setup()` loads a 256x1 palette image `pal.png` (black-darkred-red-orange-yellow-white-yellow-...-black, left to right); every `draw()` loads `data/shader.glsl`, binds the palette as `grad`, sets `resolution` and `time`, and draws a full-canvas `rect` with the shader. All the image is produced in the fragment shader (data/shader.glsl:7-32):

- The pixel's normalised position is mapped to a complex constant `c` with an x-axis stretch of 1.3333 (line 17), a global `scale` (line 10, 1.2) and a `center` offset (line 9, (0.2, 0.9)) — this is why the visible structure sits off-centre and looks like a V rather than a classic cardioid.
- A Mandelbrot iteration loop (lines 22-30) runs up to 100 steps, but each step perturbs x by mixing in `cos(x*80.2)` with weight 0.01 (line 25), so the set is a slightly warped Mandelbrot, not the exact classic one.
- The loop breaks when |z| > 4 (line 27); the escape index `i` is used as a 1-D sample of the palette strip (line 32, `i/100`), so slow-escaping boundary regions land on the bright white/yellow part of the strip and fast-escaping regions (the black top) on the dark ends. Points that never escape keep `i=100` and sample the right-hand black end of the strip — hence pure black interiors.
- `time` is set from `millis()` but the shader never uses it (the uniform is unused, see baseline stderr), so the output is static; frame 10/60 md5s are identical.
- No randomness at all: the sketch is fully deterministic (no `random`, no noise).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The whole visual is one self-contained fragment shader; the .pde contributes nothing but boilerplate and palette loading. A library function would expose the GLSL as a parameterised shader factory: `shaderFractal(center: vec2, scale: float, maxIter: int, distortAmount: float, palette: PImage)` — the four numeric knobs in the shader (center, scale, iteration cap, mix weight) are the natural parameter object. The 1-D palette-strip colouring (escape index -> horizontal sample of a gradient image) is a generic, reusable technique independent of the fractal itself. The x-stretch 1.3333 and the `cos(x*80.2)` perturbation are one-off art decisions (aspect fudge and character-warp); a clean version would drop the stretch to 1.0 and make the perturbation an optional flag. The unused `time` uniform should be removed.
