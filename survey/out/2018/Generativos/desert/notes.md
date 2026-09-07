---
sketch: 2018/Generativos/desert
year: 2018
renderer: P3D
size: [1280, 960]
libraries: []
deterministic: true
ms_first_frame: 2073
animated: false
techniques: [noise-field, particles, polar, image-source]
primitives: [shape, ellipse]
palette:
  colors: ["#B4AFBD", "#8D98B7", "#4772A0", "#2C5D92", "#1D4C7C", "#95694C", "#7F5532", "#A96A3E", "#815317", "#4C311C", "#37493E", "#FACD00"]
  selection: random-from-list
composition: full-bleed
parameters: []
---

## What it draws

A flat, faux-3D desert vista filling the whole frame. The upper band is a smooth sky
gradient from pale lavender-blue at the top to warm cream/yellow at the horizon,
dotted with a few pastel "sun" blobs (yellow, pink, teal) and fine dust specks.
Below a hazy horizon line, a brown dune field with soft undulating bands recedes to
the horizon, scattered with dozens of capsule-shaped cacti: large, dark green-grey in
the foreground, shrinking to thin slivers near the horizon. A faint grain overlay
covers the whole image.

## How the code works

`setup()` calls `generate()` (line 14); `draw()` is empty so the scene is static
(any key regenerates with a new seed). All drawing is 2D shapes in a P3D context
(`size(960,960,P3D)`, line 7; the harness renders at 1280x960).

- `generate()` (line 28): picks `back = rcol(sky)` (line 30) and `uh = random(0.2,0.36)`
  setting the horizon at `hh = height*uh` (lines 35-36). Randomness enters via
  `randomSeed(seed)` (line 32) and every `random()` call after.
- Sky (lines 42-83): 3 stacked passes. Each pass fills a trapezoid that fades to
  transparent at the top with `lerpColor(back, rcol(colors), 0.5)` (line 47), scatters
  1000 tiny ellipses in `colors[]` (lines 51-57), and draws 5 large soft "suns":
  an `ellipse` plus concentric `arc2` glow rings built from many small trapezoids in
  polar space with low alpha (lines 59-73). A translucent `back` trapezoid (lines
  75-82) dims each pass, so later passes are fainter.
- Dune texture (lines 86-126): 400 small 8-vertex ridge shapes masked by Perlin
  noise `noise(des+x*det, des+y*det) < 0.6` (lines 89-112), then 3 noise-wobbled
  dune-edge bands along the horizon (`h = height*(uh+0.01-noise(i*det)*0.02)`,
  line 121).
- Sand body (lines 128-155): 4 layers, each 20 horizontal strips (perspective: rows
  compressed toward the horizon by `pow(..., 3)`, lines 135-140). Each strip is a
  quad textured with `noise`, a 1920x1920 `PImage` of random greyscale pixels
  (`createNoise()`, lines 309-316), tinted with `lerpColor(rcol(sand), back, f)`
  where `f` grows with depth and alpha fades with layer index. This produces the
  banded, grainy dune surface.
- Haze (lines 157-164, 220-227): translucent `back` trapezoids above and below the
  horizon.
- Cacti (lines 166-218): 600 candidate positions (line 168), y distributed with
  `pow(t, 10)` so most land near the horizon, size `ss = dy*60*1.2` growing with
  depth (line 173); a rejection loop (lines 175-182) keeps them apart. Each is
  drawn by `cactus2` (s1 < 60) or `cactus`: a 3-point Catmull-Rom `Spline` (lines
  610-696) bent ~vertically, sampled into segments and drawn as two half-quad
  light/dark facets per segment plus triangular rounded caps (lines 384-484,
  486-564); `cactusShadow` adds a soft quad shadow (lines 567-608). Colours:
  `rcol(cactus)` lerped toward black/white for the two facets.
- Finish (lines 266-267): the whole random-noise `PImage` is drawn over the canvas
  with `tint(255, 18)` — the fine grain.

Palettes (lines 365-368): `colors` (yellow/orange/pink/purple/green/teal accents),
`sand` (5 browns), `sky` (5 cool blues/lavender), `cactus` (3 dark greens).

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

- Generic, reusable: `Spline` (Catmull-Rom sampling with arc-length `getPoint`/
  `getAngle`) is a clean library class; `arc2`/`arc3` (polar glow-ring builder) and
  `holeGrad` (polar gradient blob) are generic primitives; `rcol`/`getColor`
  palette helpers.
- One-off art decisions: the horizon composition (sky trapezoids + haze bands),
  the `pow(t,10)` depth distribution + rejection-based cactus placement, the
  3-facet cactus body/cap construction, the 4x20 sand-strip texture tiling.
- A parameter object would contain: `horizon: {uhRange: [0.2, 0.36]}`,
  `sky: {suns: 5, sunSize: [0.1, 0.6]*width, dust: 1000, passes: 3, palette}`,
  `sand: {layers: 4, rowsPerLayer: 20, palette, texture: {w, h}}`,
  `cacti: {count: 600, sizeScale: 72, minSize: 60, palette}`,
  `grain: {alpha: 18}`.
