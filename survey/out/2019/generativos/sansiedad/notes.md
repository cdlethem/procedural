---
sketch: 2019/generativos/sansiedad
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1727
animated: true
techniques: [noise-field, polar, lines-hatching, blend-modes, distortion]
primitives: [shape]
palette:
  colors: ["#152425", "#1D3740", "#06263E", "#074B7D", "#094D88", "#1D6C9E", "#ff2000", "#ff2010"]
  selection: noise-driven
composition: radial
parameters:
  - {name: strokeAlpha, default: 16, tried: [64], change: large, effect: "4x alpha saturates much faster: big filled red disc with white core, brighter overall"}
  - {name: det, default: "random(0.8,0.1)*random(0.03,0.04)*0.3", tried: ["same *1.0"], change: large, effect: "more wobble: whole canvas saturates red/orange, ring structure nearly lost"}
  - {name: dc, default: "random(0.08,0.1)*0.4", tried: ["random(0.3,0.4)*0.4"], change: large, effect: "colour changes fast between rings: crisp concentric red/blue banded target"}
  - {name: div, default: "int(random(0.8,1)*15)", tried: ["int(random(0.8,1)*30)"], change: large, effect: "twice the rings: finer denser texture, stronger red field, same overall character"}
  - {name: sub, default: "int(random(0.6,1)*2000)", tried: ["int(random(0.6,1)*500)"], change: large, effect: "quarter the spokes: sparse long straight lines, tiny core, dark gaps"}
reusable_candidates:
  - {name: noiseLine, signature: "noiseLine(x1, y1, x2, y2, det) -> void", note: "simplex-noise-walked line anchored to both endpoints: wander a particle, then rotate/scale the polyline so it spans start->target"}
  - {name: noisePaletteColor, signature: "getColor(v) -> color", note: "map a float to a palette by index + smooth lerp between adjacent entries (pow 3.8)"}
  - {name: concentricSpokeRings, signature: "rings(div, maxRadius, spokesPerRing, colorOf) -> void", note: "concentric rings, each densely covered by noisy radial spokes"}
---

## What it draws
Frame 1 (captured right after the first `draw()`) is a near-white frame with a few sparse cyan specks —
a P3D first-frame capture artifact, since all drawing happens in `setup()`. Frames 10 and 60 are
byte-identical and show the finished composition: on a near-black square, a small bright white/pink
glowing core at the centre, wrapped in a dense cyan-blue cloud, with wide red aurora-like bands sweeping
across the upper and lower parts of the canvas. Thin, pale, nearly straight lines cross the whole image
at many angles, and sparse tiny cyan specks sit in the corners. Overall it reads as a radial,
accumulated "eye" or energy burst: cyan centre, red periphery, white streaks.

## How the code works
`settings()` (lines 14-19): 960×960 P3D, `smooth(8)`. `setup()` (21-29) calls `generate()` once;
`draw()` (31-32) is empty, so nothing is drawn per frame.

`generate()` (34-73):
- Seeds from `seed` (38-39), `background(0,1,2)` (near black, 42), then `blendMode(ADD)` (44) — every
  stroke adds light, so overlaps accumulate to white.
- Ring colour parameters: `ic` random noise offset (47), `dc` ≈0.032-0.04 noise step per ring (48),
  `det` ≈0.0007-0.0048 noise detail along a line (49).
- Matrix: translate to centre, three small random rotations X/Y/Z up to ~0.4 rad each (51-56) — the
  whole radial pattern is tilted slightly in 3D, which shears the rings into the sweeping band shapes.
- `div` = 12-13 concentric ring bands (59). For ring j, radii r1..r2 span 0..width*0.72 (61-62), i.e.
  the outer bands extend beyond the canvas edges. Each ring has `sub` = 1200-2000 spokes (63).
- Per spoke (65-69): angle a1 around TAU; stroke colour = `getColor(noise(ic+dc*j)*18)` at alpha 16
  (67) — colour depends only on ring j, so each ring is one lerp-blended palette colour chosen by 1D
  noise; palette (138) is mostly dark blues plus two reds. `noiseLine` (68) draws one noisy radial
  segment from r1 to r2.
- `noiseLine` (91-129): walks a particle up to `dist*0.8` steps of 1.2 px, turning by
  `(simplex(ix*det, iy*det)*2-1)*PI*24 + targetAngle` (103) — a chaotic wobble whose straightness
  depends on `det`; then rotates and uniformly scales the whole polyline (115-119) so its endpoints
  land exactly on the start and target points, and strokes it with `beginShape/vertex/endShape`
  (123-128).
- Accumulation: thousands of low-alpha (16) strokes in ADD mode build up the bright cyan core (many
  spokes overlap near the centre), the cyan cloud (blue palette rings), and the red bands (red palette
  rings, e.g. #ff2000). Spokes whose noise walk stays near the target angle render as the thin
  straight white lines; outer-ring spokes span the full canvas.

## Experiments
Score caveat: baseline frame_00001 was a near-white early-capture artifact, while every variant
frame_00001 captured the full composition, so the "large" scores are partly inflated; observations
compare each variant's frame 1 against the baseline's finished composition (frames 10/60, identical).

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| alpha_64 | `stroke(getColor(...), 16);` -> `..., 64);` | large (mean 0.3526, 0.976) | big filled red disc with white core, cyan haze, many long straight lines; red dominates, brighter overall | variants/alpha_64/frame_00001.png |
| det_1.0 | `float det = random(0.8, 0.1)*random(0.03, 0.04)*0.3;` -> `... *1.0;` | large (mean 0.1676, 0.625) | whole canvas saturates bright red/orange with a huge white blob at centre; ring structure almost lost | variants/det_1.0/frame_00001.png |
| dc_0.3 | `float dc = random(0.08, 0.1)*0.4;` -> `random(0.3, 0.4)*0.4;` | large (mean 0.1858, 0.652) | crisp concentric banded "target": red outer rings, cyan-blue inner band, white-pink core | variants/dc_0.3/frame_00001.png |
| div_30 | `int div = int(random(0.8, 1)*15);` -> `int(random(0.8, 1)*30);` | large (mean 0.1872, 0.707) | twice the rings: finer, denser texture, stronger red field, same radial character | variants/div_30/frame_00001.png |
| sub_500 | `int sub = int(random(0.6, 1)*2000);` -> `int(random(0.6, 1)*500);` | large (mean 0.2264, 0.751) | much sparser: long straight red/white lines, tiny red core, faint cyan cloud, large dark gaps | variants/sub_500/frame_00001.png |

## Modularisation notes
Generic, library-ready: `noiseLine` (noise-walked line pinned to both endpoints — the core primitive),
`getColor` (noise/palette lookup with lerp), and the concentric spoke-ring loop (ring count, radius
range, spokes per ring, per-ring colour function as parameters). One-off art decisions: the ADD blend
plus alpha 16 (the whole accumulation aesthetic), the specific blue/red palette, the small random 3D
tilt (creates the band shearing), the `PI*24` angle multiplier and `lar*0.8` step count in the walk,
and the `width*0.72` over-canvas radius. A clean parameter object: {div (rings), maxRadius, spokesPerRing,
ringNoiseStep dc, lineDetail det, noiseOffset ic, alpha, palette, tilt}.
