---
sketch: 2018/Generativos/tteett
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1635
animated: false
techniques: [subdivision, symmetry]
primitives: [shape]
palette:
  colors: ["#FEFEFE", "#FDCB0A", "#06B2C4", "#0B2240", "#EA048B"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(80))", tried: ["int(random(10))"], change: large, effect: "far fewer, larger cascade triangles; coarser, more open cluster and more dark navy background visible"}
  - {name: seedSize, default: "width*random(2.4, 3.8)", tried: ["width*random(1.2, 1.6)"], change: large, effect: "smaller central motif; the 3x3 tile wrap dominates and the canvas becomes a busier all-over of overlapping frames"}
  - {name: r2, default: "s*0.35", tried: ["s*0.25"], change: subtle, effect: "no visible change; nested rings essentially identical"}
  - {name: s2, default: 0.2, tried: [0.6], change: moderate, effect: "inner ring of each frame lerps much further toward black; bevel/depth shading noticeably stronger"}
  - {name: palette, default: "bright 5-colour list (line 114)", tried: ["sketch's commented-out dark indigo list"], change: large, effect: "same geometry, monochrome dark blue with very low contrast"}
reusable_candidates:
  - {name: triangleFrame, signature: "triangleFrame(x, y, angle, size, color) -> void", note: "draws a triangle as three nested flat trapezoid 'rings' with black-lerped bevel shading and a faint alpha-20 shadow band"}
  - {name: radialSubdivide, signature: "radialSubdivide(tris, iterations) -> Triangle[]", note: "replaces each triangle with 4 half-size children (one flipped at the center, three offset 0.25*s at angle a and a±120°), building a fractal branching cluster"}
  - {name: tile9, signature: "tile9(draw) -> void", note: "stamps the same motif 9 times at ±width/±height offsets for edge-to-edge wrapping tiling"}
---

## What it draws
A full-bleed composition of flat, nested triangle "frames" (hollow triangle rings with a faked 3D bevel) in gold, teal, magenta, dark navy and white. A large triangle occupies the center; toward its lower-left it branches into a cascade of smaller and smaller nested triangles that shrink to a point, like a fractal. The remaining canvas is filled with the same motif at several sizes, tiled so triangles wrap across the canvas edges. A dominant gold field sits under large navy and teal frames, with small white and magenta accents.

## How the code works
`setup()` calls `generate()` once (tteett.pde:7); `draw()` is empty, so the piece is static (frames 10/60 identical to frame 1). `generate()` (lines 77-106):
- Line 79: background = one random palette color (drawn before `randomSeed` on line 80, so it is fixed by the pre-seed RNG state — dark navy `#0B2240` here); line 80 seeds the RNG with `seed`.
- Line 83: one seed `Triangle` at the canvas center with a random orientation (`random(TAU)`) and size `width*random(2.4, 3.8)` — far larger than the canvas, this is the dominant gold field.
- Lines 86-93: subdivision loop, `sub = int(random(80))` iterations (line 85). Each iteration replaces every triangle with four children at half size: one rotated 180° at the same center (line 88) and three offset by `0.25*s` at angles `a`, `a+120°`, `a-120°` (lines 89-91). This builds the branching fractal cascade of smaller triangles.
- `show()` (lines 34-74) draws each triangle as three 120°-spaced "frames": for each corner pair an outer shadow quad filled `fill(0,20)` (lines 47-54) plus two nested trapezoids between radii `r1 = s*0.5` -> `r2 = s*0.35` -> `r3 = s*0.2` (lines 36-38), whose fills are the triangle's color lerped toward black with factors `s1 = 0` and `s2 = 0.2` (lines 44-46, 56-72) — this lerp is what fakes the bevel/depth. `noStroke()` throughout.
- Colour: each triangle picks one random palette entry once, in its constructor (line 31, `rcol()` line 115-117); the palette is the 5-colour list at line 114.
- Lines 96-105: final loop stamps every triangle 9 times, translated by `xx*width, yy*height` for `xx, yy ∈ {-1,0,1}` — a 3×3 translational tiling that makes the motif wrap across all four edges (the source of the "symmetry").

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_10 | `int sub = int(random(80));` -> `int sub = int(random(10));` | large (mean 0.2008, 0.379) | coarse cascade: a few large nested frames instead of the dense run of tiny triangles; cluster more open, dark navy background shows through more | variants/sub_10/frame_00001.png |
| size_1.6 | `width*random(2.4, 3.8)` -> `width*random(1.2, 1.6)` | large (mean 0.3502, 0.808) | central motif shrinks to ~canvas scale; the 3x3 tiling wrap now dominates, giving an all-over pattern of overlapping large frames in gold, teal, magenta and white | variants/size_1.6/frame_00001.png |
| r2_0.25 | `float r2 = s*0.35;` -> `float r2 = s*0.25;` | subtle (mean 0.0271, 0.003) | no visible change; the nested rings look the same as the baseline | variants/r2_0.25/frame_00001.png |
| s2_0.6 | `float s2 = 0.2;` -> `float s2 = 0.6;` | moderate (mean 0.089, 0.395) | the inner ring of every frame is markedly darker, lerped toward black; the faked 3D bevel reads much stronger and deeper | variants/s2_0.6/frame_00001.png |
| palette_dark | bright 5-colour list -> commented-out indigo list | large (mean 0.3889, 0.991) | identical geometry recoloured into a monochrome dark indigo scheme; very low contrast, frames nearly merge into the background | variants/palette_dark/frame_00001.png |

## Modularisation notes
- Generic: `triangleFrame` (the three-ring beveled triangle motif), `radialSubdivide` (the 4-child replacement rule is a small generic branching operator), `tile9` (edge-wrap stamping), `rcol` (random palette pick).
- One-off art decisions: the exact radii ratios (0.5/0.35/0.2), the lerp factors (0/0.2), the child offset 0.25*s and the ±120° geometry, the 5-colour palette, the 2.4-3.8×width seed size, and the random(80) iteration count.
- A clean parameter object: `{seed, palette, seedSizeMul, iterations, childOffsetMul, radii: [r1, r2, r3], lerp: [s1, s2], tile: bool}`.
