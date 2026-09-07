---
sketch: 2018/Generativos/arbolito3
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2985
animated: false
techniques: [noise-field, recursion, lines-hatching]
primitives: [line, ellipse]
palette:
  colors: ["#FCB466", "#F4D3DE", "#F7E843", "#409746", "#373787", "#E12E29"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 2500, tried: [800], change: moderate, effect: "fewer trees = sparser field, individual clumps visible, orange background shows through"}
  - {name: det, default: 0.005, tried: [0.002], change: large, effect: "lower = larger, smoother colour regions; individual branching trees read as distinct shapes"}
  - {name: branchAlpha, default: 240, tried: [80], change: moderate, effect: "smallest change of the set; overall same look, slightly more background showing through"}
  - {name: errAng, default: 0.09, tried: [0.3], change: moderate, effect: "higher = thinner, more vertical grass-like strokes, more visible tip dots"}
  - {name: totalIte, default: 14, tried: [8], change: large, effect: "lower = much shorter, coarser strokes, sparse with lots of background"}
reusable_candidates:
  - {name: noisePalette, signature: "noisePalette(x, y, det, colors) -> color", note: "2-D Perlin noise mapped to a continuous index into a palette, lerped between neighbours (getColor)"}
  - {name: recursiveBranch, signature: "recursiveBranch(x, y, angle, len, colorIdx, depth, shrink, errAng, branchProb)", note: "line segment + two probabilistic child branches, shrinking length and drifting colour index"}
---

## What it draws
Full-bleed field of hundreds of small, grass- or tree-like sprays of thin near-vertical strokes, each growing upward from a random base, with tiny dots at the branch tips. The strokes form large soft colour regions: pinkish-red dominating the centre, green and indigo patches around it, all over a warm orange background that peeks through in gaps. The texture is dense and feathery — thousands of overlapping thin lines.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (arbolito3.pde:4-12).

- `generate()` (22-36): seeds RNG/noise, fills the background `#FCB466` (26), then loops `cc = 2500` times (28). Each iteration: `cx = random(width)` (31), `cy = lerp(-height*0.1, height*1.3, pow(val, 1.2))` (32) — the `pow(…, 1.2)` biases bases toward the top of the canvas (some above the top edge), and `s = (800-60*(1-val))*random(0.6, 1)` (33) gives an initial size of ~740–800.
- `arbol()` (38-49): divides size by 5 (so first segment ~150 px), sets depth `totalIte = 14` (42), samples 2-D Perlin noise at detail `det = 0.005` to get a continuous colour index `c = noise(x*det, y*det)*colors.length` (44-45), and a second noise sample `ms` that modulates the overall size (46). This is what creates the broad, smooth colour bands.
- `rama()` (51-74): recursive. Draws one line segment from `(x,y)` in direction `a` of length `s` (52-60); stroke alpha 240, weight `8*str` proportional to local segment length (59). Shortens `s *= random(random(0.6, 0.8), 0.95)` (61). At depth 0, draws a small background-coloured ellipse at the tip (64-68). Otherwise spawns up to two child branches (probability 0.8 each, 71-72) rotated by `random(0.045, 0.09)` rad (from `errAng = 0.09`), each drifting the colour index by `+random(0.2)` (71-72).
- Colour: `getColor(float)` (90-96) takes the noise-driven index, `lerpColor`s between two adjacent entries of the 5-colour palette `#F4D3DE, #F7E843, #409746, #373787, #E12E29` (82). The pinkish-red seen in the image is the lerp between the pale pink and the red.
- The only randomness: base positions (31-33), size modulation (46), per-branch shrink factor (61), branch spawn probabilities and angle errors (71-72). Everything is deterministic under `randomSeed(seed)` (24).

## Experiments
| variant | substitution | change score | observation | image |
| cc_800 | `int cc = 2500;` -> `int cc = 800;` | moderate | sparser field: individual tree clumps clearly distinguishable, lots of orange background showing through | variants/cc_800/frame_00001.png |
| det_0.002 | `float det = 0.005;` -> `float det = 0.002;` | large | larger, smoother colour regions (big red mass centre, green/indigo around); individual branching trees read as distinct shapes | variants/det_0.002/frame_00001.png |
| alpha_80 | `stroke(getColor(c), 240);` -> `stroke(getColor(c), 80);` | moderate | smallest change of the set: overall same look, slightly more orange background showing through, tip dots marginally more visible | variants/alpha_80/frame_00001.png |
| errAng_0.3 | `float errAng = 0.09;` -> `float errAng = 0.3;` | moderate | thinner, more vertical grass-like strokes; small orange tip dots scattered throughout | variants/errAng_0.3/frame_00001.png |
| totalIte_8 | `totalIte = 14;//19  //int(random(8, 20));` -> `totalIte = 8;//19  //int(random(8, 20));` | large | much shorter, coarser strokes; sparse with lots of orange background showing through | variants/totalIte_8/frame_00001.png |

## Modularisation notes
- `getColor(float)` (90-96) is generic: "continuous noise-driven palette lookup with neighbour lerp" — a ready library function `noisePalette(x, y, det, colors) -> color`.
- `rama()` (51-74) is a generic recursive branching stroke: parameters are start position/angle/length, depth, shrink-range, max angle error, branch probability, colour drift, and a tip-drawing callback. The specific numbers (shrink 0.6–0.95, errAng 0.09, prob 0.8, drift 0.2) are the art decisions.
- `arbol()` (38-49) is mostly glue: the two independent noise samples (colour index + size modulation) are the reusable idea; the `PI*1.5` (always upward) direction and `s/5` scaling are one-off art choices.
- `generate()` (22-36): the y-position bias `lerp(a, b, pow(t, 1.2))` is a small reusable "vertical distribution" helper; `cc`, the size range 740–800, and the background colour are one-off decisions.
- A clean parameter object: `{count, baseYDist: {min, max, gamma}, sizeRange, depth, shrink: [lo, hi], errAng, branchProb, colourDrift, noiseDet, alpha, weightScale, tipSize, palette, background}`.
