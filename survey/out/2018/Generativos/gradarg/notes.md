---
sketch: 2018/Generativos/gradarg
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1730
animated: false
techniques: [noise-field, packing, shader, distortion, particles]
primitives: [ellipse]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: noisePackedCircles, signature: "noisePackedCircles(passes, candidatesPerPass, noiseScale, noiseOffset, sizeMap) -> PVector[]", note: "rejection-sampled non-overlapping circles whose radii come from a 2-D noise field; early passes get larger radii"}
  - {name: blurVignetteGrain, signature: "blurVignetteGrain(blend, grain, satBoost) -> PShader", note: "post.glsl: 3x3 gaussian blur mixed ~90%, 2% white-noise grain, radial brightness/saturation vignette"}
---

## What it draws
A full-bleed 960x960 field of a few hundred softly blurred discs scattered over a medium
blue ground. Most discs are filled in red-orange, amber, cyan, or near-black; a visible
share are filled with the background blue and register only as faint thin outlines. Disc
sizes range from tiny dots to large blobs, and random 3-D tilt squashes many into ellipses.
Edges are soft (blur), the whole image has fine grain, and corners are slightly darker with
a touch more saturation than the center (vignette from the post shader).

## How the code works
`setup()` loads `data/post.glsl` and calls `generate()`; `draw()` is empty, so the piece is
static (gradarg.pde:15-27). Randomness enters only via `randomSeed(seed)` (line 49).

- Background: one random palette color (`background(rcol())`, line 51; `rcol()` at 150-152
  picks uniformly from `colors[]` at line 148: red-orange #FF3D20, amber #FC9D43, cyan
  #3998C2, blue #3E56A8, near-black #090D0E).
- Point generation (53-72): 20 passes x 300 candidates = 6000 random points. Each candidate's
  radius is `s = noise(des + x*det, des + y*det) * a * width` (line 61) where `det =
  random(0.004)` (noise scale), `des = random(10000)` (noise offset), and `a = map(k, 0, 20,
  0.1, 0.02)` (line 60) so early passes can reach ~96 px radius and late passes ~19 px. A
  candidate is kept only if it is at least `(p.z + s) * 0.5` from every kept point (line 65)
  -- a non-overlapping packing; noise makes large discs cluster where the field is high.
- Drawing (74-85): each kept point is drawn as an `ellipse(0,0,p.z,p.z)` (line 83) with
  `fill(rcol())` (random palette color per disc) after random rotations about X, Y and Z by
  up to `mr = 0.4` rad (lines 80-82), which squashes the circle into a tilted ellipse in
  P3D.
- Post filter (88-89): `filter(post)` applies post.glsl -- a 3x3 gaussian blur mixed 90%
  toward the blurred image (glsl:63), 2% white-noise grain (glsl:67), then `csb()` with
  brightness 1.2 and saturation 1.1 at center rising to ~1.7 at corners, multiplied by a
  radial `dis` that darkens the corners (glsl:65-68). This is why edges look soft and
  background-blue discs appear as faint outlines (the blur leaves a rim where a disc edge
  meets a differently colored neighbor).
- `arc2`, `arc3`, `lineDashed` (97-146) are dead code, never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, reusable: the noise-driven rejection packing (53-72) is a clean library function
  ("noisePackedCircles") -- passes, candidates per pass, noise scale/offset, and a
  size-per-pass curve are the natural parameters. The post shader (blur + grain + vignette)
  is a generic post-process, parameterizable by blend amount, grain amount, and vignette
  strength.
- One-off art decisions: the 5-color palette and uniform random pick per disc, `mr = 0.4`
  tilt limit, and the specific glsl constants (1.2 brightness, 2.6 saturation boost).
- A clean parameter object: {passes, candidatesPerPass, noiseScale, sizeMax, sizeMin,
  tiltMax, palette[], backgroundFromPalette, blurAmount, grainAmount, vignetteStrength}.
- Dead helpers `arc2`/`arc3`/`lineDashed` should be dropped in any library port (they come
  from a shared sketch template, not this piece).
