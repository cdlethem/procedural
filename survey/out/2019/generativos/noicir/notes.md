---
sketch: 2019/generativos/noicir
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1646
animated: false
techniques: [polar, particles, noise-field, distortion, symmetry]
primitives: [point]
palette:
  colors: ["#F20707", "#EFB632", "#C5B7E8", "#2E3AE8", "#000000"]
  selection: noise-driven
composition: radial
parameters:
  - {name: areaFactor (ccc), default: 0.3, tried: [0.6], change: none, effect: "no visible change; doubling point count (156k->312k) does not change the look, density saturates the same regions"}
  - {name: alpha, default: "random(20,40)*2.4", tried: ["random(20,40)*0.6"], change: none, effect: "no visible change; quartering alpha leaves petals at the same apparent density"}
  - {name: sectorAngle, default: "PI/3", tried: ["PI/2"], change: subtle, effect: "subtle: same 5-6 petal layout, petals slightly thinner/sparser"}
  - {name: maxDisplacement, default: 180, tried: [60], change: subtle, effect: "subtle: same petal layout, edges slightly sharper/less spread"}
  - {name: bandStep, default: "6+i*0.31", tried: ["20+i*0.31"], change: none, effect: "no visible change; radial banding is invisible anyway because fbm displacement (up to 180px) far exceeds the band step"}
reusable_candidates:
  - {name: fbm, signature: "fbm(x, y) -> float (4 octaves of 2-D value noise)", note: "hand-rolled value noise in fbm.pde with ridge()/ridgedMF() variants"}
  - {name: fbmDisplace, signature: "fbmDisplace(x, y, angDetail, angSeed, disDetail, disSeed, maxDisp) -> PVector", note: "per-point displacement along a noise angle with noise magnitude (dis(), noicir.pde:99)"}
  - {name: quantizedPolarScatter, signature: "quantizedPolarScatter(count, radius, sectorAngle, bandStep) -> points", note: "polar points with angle quantised to sectors and radius quantised to bands (noicir.pde:77-85)"}
---

## What it draws
A solid blue field with five or six petal-like fans of densely packed tiny points
radiating from the centre, like a slightly irregular pinwheel or flower. The fans
are pale lavender-blue and fade into the blue background at their edges; a small
yellow-gold cluster sits at the hub where all the petals meet. The petal outlines
are soft and grainy, not sharp. Static image (frames 10 and 60 identical to 1).

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the piece is static.
  `settings()` opens a 960x960 P3D canvas with `smooth(8)` and `pixelDensity(2)`
  (the latter warns it is unavailable for the display) [noicir.pde:14-19].
- Background is one random palette colour (`rcol()`) — blue here [noicir.pde:62, 119-121].
- `generate()` draws `ccc` points, where `ccc = PI*0.5*radius^2*0.3` with
  `radius = width*0.6`, about 156k points [noicir.pde:75-76].
- Each point's angle is uniform in `TAU` then quantised into 60-degree sectors by
  `ang -= (ang%(PI/3))*random(random(0.7), 1)` [noicir.pde:78-79]; this is what
  creates the discrete petals (six sectors, some nearly empty per seed).
- The radius is `radius*sqrt(random(1))*random(0.6, 1)` then quantised to growing
  radial bands by `dis -= (dis%(6+i*0.31))*random(1)*random(0.9, 1)` [noicir.pde:80-81],
  giving the banded, layered petal structure.
- A per-point angular wobble `cos(dis*a1)*amp1 + cos(dis*a2)*amp2 + dis*rot`
  (a1/a2 in [0, 0.04], amps in [0, 1], rot in [-0.002, 0.002]) bends the straight
  radial fans [noicir.pde:69-73, 83].
- Points are then displaced by `dis(xx, yy)` [noicir.pde:86]: a direction
  `fbm(...)*PI*6` and a magnitude `fbm(...)*180`, both from the 4-octave value
  noise in fbm.pde, parameterised by four random noise offsets/Details
  (`detAng`, `desAng`, `detDes`, `desDes` ~0.001-0.0014) [noicir.pde:64-67, 99-103].
  This fbm warp is what softens the hard sector edges into flowing petals.
- Colour: `stroke(getColor(noise(ang*0.2+dis*0.01*0.2, dis*0.04*0.02)*colors.length), alp)` —
  a noise-driven index into the 5-colour palette, lerped between adjacent entries
  [noicir.pde:90, 125-130]; with seed 42 the noise index lands mostly near the
  blue/lavender end, with yellow at the centre (where `dis` is small).
- Alpha is `random(20, 40)*2.4` (48-96) so the ~156k overlapping points build up
  density as a soft fill [noicir.pde:89]. Blend mode is always `NORMAL`
  (an `ADD` mode line is commented out) [noicir.pde:92-94].

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ccc_0.6 | `int ccc = int(PI*0.5*radius*radius*0.3);` -> `...*0.6);` | none (mean 0.0093, 2.2% of pixels) | no visible change: same petals, same fill density | variants/ccc_0.6/frame_00001.png |
| alp_0.6 | `float alp = random(20, 40)*2.4;` -> `*0.6;` | none (mean 0.0091, 2.4% of pixels) | no visible change: petals keep the same apparent density | variants/alp_0.6/frame_00001.png |
| sector_PI2 | `ang -= (ang%(PI/3))*random(random(0.7), 1);` -> `(ang%(PI/2))...` | subtle (mean 0.015, 4.5% of pixels) | subtle: same 5-6 petal layout, petals slightly thinner/sparser | variants/sector_PI2/frame_00001.png |
| disp_60 | `float des = fbm(desDes+xx*detDes, seed+desDes+yy*detDes)*180;` -> `*60;` | subtle (mean 0.0184, 5.5% of pixels) | subtle: same petal layout, edges slightly sharper, less outward spread | variants/disp_60/frame_00001.png |
| band_20 | `dis -= (dis%(6+i*0.31))*random(1)*random(0.9, 1);` -> `(dis%(20+i*0.31))...` | none (mean 0.0002, 0.0% of pixels) | no visible change: banding is invisible anyway; fbm displacement (up to 180px) far exceeds the band step | variants/band_20/frame_00001.png |

## Modularisation notes
- Generic / library-ready: the whole `fbm.pde` tab (value noise, `fbm`, `ridge`,
  `ridgedMF`) is self-contained and reusable as-is. The `dis()` displacement
  (noise angle + noise magnitude per point) is a clean, parameterised function.
  The quantised polar scatter (sector quantisation + band quantisation + per-point
  angular wobble) is a reusable "petal field" generator.
- One-off art decisions: the specific 5-colour palette and which random seed's
  noise offsets are kept; the commented-out `ADD` blend and second `point()` call;
  the exact constants (0.3 area factor, 60-degree sectors, band step 6, *180
  displacement, alpha range).
- A clean parameter object would contain: pointCount (or areaFactor), radius,
  sectorAngle, bandStep, bandGrowth (0.31), wobble (a1, a2, amp1, amp2, rot),
  displacement field (angDetail, disDetail, maxDisp, seeds), alpha range,
  palette + colour mode (noise-driven index), blendMode, background colour.
