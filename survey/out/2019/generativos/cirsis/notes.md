---
sketch: 2019/generativos/cirsis
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1659
animated: false
techniques: [packing, dots-stippling, noise-field, polar]
primitives: [ellipse, line]
palette:
  colors: ["#BF28ED", "#1C0A26", "#0029C1", "#5BFFBB", "#EAE4E1", "#B4B4B4"]
  selection: noise-driven
composition: radial
parameters:
  - {name: attempts, default: 800, tried: [200], change: moderate, effect: "fewer packed discs; ring becomes sparse isolated discs with large grey gaps"}
  - {name: centerDiscR, default: 0.42, tried: [0.2], change: moderate, effect: "central stippled disc radius halved; packed-disc ring fills the freed central area"}
  - {name: dotSizeMax, default: 6, tried: [12], change: large, effect: "dots up to 2x larger; sparser, chunkier stipple everywhere"}
  - {name: spikeP, default: 0.2, tried: [0.5], change: none, effect: "no visible change; extra 1px hair lines below diff threshold"}
  - {name: discRadiusStep, default: 16, tried: [32], change: large, effect: "packed discs 2x larger (32..224 px); ring of big discs, fewer fit the packing"}
  - {name: spikeLen, default: 4, tried: [8], change: none, effect: "no visible change; doubled 1px hair length below diff threshold"}
reusable_candidates:
  - {name: packDiscs, signature: "packDiscs(canvas, attempts, radii[], gapFactor) -> PVector[]", note: "rejection-packed discs with cycling radii; z holds the radius"}
  - {name: speckledDisc, signature: "speckledDisc(cx, cy, radius, dotScale, paletteFn, shadow) -> void", note: "stippled disc: polar dots with center bias, rim falloff, noise-modulated size and colour, min-distance rejection"}
  - {name: noisePaletteColor, signature: "noisePaletteColor(palette, n) -> int", note: "wraps a noise scalar into a 3D noise walk over the palette with lerpColor and pow(t, 0.2)"}
---

## What it draws
On a flat grey (180) background, one large disc centred in the canvas is filled with
sparse, relatively big stippled dots in mint, blue, magenta, dark purple and cream, the
grey showing through between them. A ring of many smaller stippled discs crowds the area
around the central disc, denser and finer-grained. Thin hair-like lines radiate
outward from the disc field toward the canvas edges, and a few faint dot clusters sit
in the corners.

## How the code works
- `generate()` (cirsis.pde:42-74): seeds PRNG/noise from `seed` (harness sets it to 42),
  `background(180)` (47), translates to canvas centre (50).
- Disc packing (54-70): 800 attempts; disc radius cycles `16*(i%8+1)` i.e. 16..112 px
  (55); centre is random inside the canvas with a margin of one radius (56-57);
  rejected if within `(ss+o.z)*1.1` of an accepted disc (59-65); accepted discs are
  drawn via `circle(xx, yy, ss)` (68).
- `circle()` (76-131) stipple-fills one disc: `res = PI*r^2*0.1` candidate dots (82);
  each at random angle `a` and radius `d = sqrt(random(random(random(0.5,1)),1))` (86),
  a distribution biased toward the centre; dot size (89) =
  `random(2,6)*r*0.12 * (1-d)^0.9 rim falloff * lerp(0.2,1,noise(x*det2,y*det2)^0.8)`;
  dots closer than `(s+p.z)*0.56` are rejected (91-97).
- Each dot is drawn twice: a soft shadow ellipse `fill(0,40)` offset by `dd` (102-103),
  then the main ellipse (105-106) coloured by `getColor((ic + noise(dc+x*dt, dc+y*dt,
  dc+s*dt)) * colors.length * 3)` with alpha 240 — a 3-D noise walk through the 5-colour
  list (143), wrapped mod 5 and `lerpColor` with `pow(t, 0.2)` (154-159); `ic` (80) is a
  random per-disc palette offset so each disc lives in a different part of the palette.
- Spike pass (114-130): for 20% of the dots, redraw a tiny dark shadow + coloured dot at
  `s*0.2`, then a line (126-127) of length `4s` pointing away from the canvas centre
  (`atan2(y,x)` in the centred coordinate system) — the radiating hair lines.
- Finally `circle(0, 0, width*0.42)` (73) stipple-fills the large central disc last;
  because dots are sparse relative to the disc size, the grey background reads as the
  disc's colour.
- `draw()` is empty: fully static, drawn once in `setup()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| attempts_200 | `for (int i = 0; i < 800; i++) {` -> `... i < 200 ...` | moderate | ring of small discs much sparser: isolated fine discs with large grey gaps; central disc unchanged | variants/attempts_200/frame_00001.png |
| center_0.2 | `circle(0, 0, width*0.42);` -> `circle(0, 0, width*0.2);` | moderate | central stippled disc radius halved (blue/magenta dots); freed area around it filled by the packed-disc ring | variants/center_0.2/frame_00001.png |
| dotSize_12 | `random(2, 6)*radius*0.12` -> `random(2, 12)*radius*0.12` | large | every dot up to 2x larger; sparser, chunkier texture in both the central disc and the ring | variants/dotSize_12/frame_00001.png |
| spikeP_0.5 | `if (random(1) < 0.2) {` -> `if (random(1) < 0.5) {` | none | no visible change (baseline already dense with 1px hair lines; added ones below diff threshold) | variants/spikeP_0.5/frame_00001.png |
| discSize_32 | `float ss = 16*(i%8+1);` -> `float ss = 32*(i%8+1);` | large | packed discs 2x larger (32..224 px): ring becomes a band of big cream/magenta/blue/mint/dark discs, fewer discs fit | variants/discSize_32/frame_00001.png |
| spikeLen_8 | `x+cos(aa)*s*4, y+sin(aa)*s*4` -> `...s*8, ...s*8` | none | no visible change (hair lines 2x longer but 1px wide, below diff threshold) | variants/spikeLen_8/frame_00001.png |

## Modularisation notes
- `packDiscs` (54-70) is a generic Poisson-disc-style rejection packer with cycling
  radii; `gapFactor` (the 1.1) and the radius cycle are the only art knobs.
- `speckledDisc` (76-131) is the reusable core: polar dot scatter with centre bias,
  rim falloff, noise-modulated dot size and palette colour, and min-distance rejection.
  Its knobs: `dotScale` (0.12), the size range (2,6), the rejection factor (0.56), the
  noise details `det`/`det2`, and the palette function.
- `noisePaletteColor` (154-159 + 143) is a small, self-contained palette sampler worth
  extracting as-is.
- One-off art decisions: the grey `background(180)`, the big centre disc of radius
  `width*0.42` drawn last, the 20% spike probability and the spike length `4s` aimed
  radially outward, and the shadow-offset double-draw of each dot.
- A clean parameter object: `{canvas, attempts, radii[], gapFactor, dotScale, sizeRange,
  rejectFactor, det, det2, palette, spikeP, spikeLen, centerDiscR, background}`.
