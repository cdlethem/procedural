---
sketch: 2015/Generativos/FFt/prueba4
year: 2015
renderer: P3D
size: [640, 640]
libraries: [minim]
deterministic: true
ms_first_frame: 1714
animated: true
techniques: [3d-mesh, polar]
primitives: [shape]
palette:
  colors: ["#141414", "#7F7F7F"]
  selection: fixed
composition: centered
parameters:
  - {name: lar, default: 100, tried: [300], change: "", effect: ""}
  - {name: div, default: 10, tried: [4], change: "", effect: ""}
  - {name: ang, default: PI*1.5, tried: [0], change: "", effect: ""}
  - {name: background, default: 20, tried: [200], change: "", effect: ""}
  - {name: translateZ, default: -200, tried: [0], change: "", effect: ""}
reusable_candidates:
  - {name: tubeQuadMesh, signature: "tubeQuadMesh(length, aroundSegs, lenLayers, angleOffset) -> void", note: "3D tube as a QUADS grid: length along X, circular (cos/sin) cross-section in YZ"}
  - {name: regularPolygon, signature: "poly(x, y, diameter, sides, angle) -> void", note: "2D regular polygon via cos/sin (defined but unused in this sketch)"}
---

## What it draws
On a near-black background, a small 3D tube/cylinder sits roughly centred (slightly right of centre), tilted about 45° so it reads as a diagonal barrel. Its surface is a grid of quadrilateral cells — about 5 cells along the long axis and 10 around the circumference — drawn as light/white lines over dark (background-coloured) cells, giving a wireframe-tube look. The tube rotates slowly: by frame 60 it has turned further around its axis, so its long axis swings from diagonal toward horizontal and we see a flatter, wider face of the grid.

## How the code works
- `setup()` (L8-19): `size(640,640,P3D)`, `frameRate(30)`; creates a Minim `AudioPlayer` from `../idm1.mp3` and loops it, builds an `FFT` (buffer 512) with `fft.linAverages(16)`; then calls `generar()`.
- `generar()` (L53-57): sets the three geometry constants `lar=100` (tube length), `div=10` (circumference segments), `ang=PI*1.5` (angular offset). Set once, never changed.
- `draw()` (L23-41): `background(20)` near-black (L24); `translate(w/2, h/2, -200)` centres and pushes the tube back in depth (L25); `rotateX(PI/4)` gives the ~45° diagonal tilt (L26); `rotateZ(frameCount*0.01)` is the only time-varying term — a slow spin, which is what animates the frames (L27).
- The mesh: `beginShape(QUADS)` (L30). Outer loop `j = 0..4` (5 layers along the length), inner loop `i = 0..div-1` (10 slices around). Each quad's four vertices (L34-37) put the two X-ends at `-ml + lar/5*j` and `+ml + lar/5*j` (each layer offset along X by `lar/5 = 20`), and the two angular positions at `i` and `i+1` on a circle of radius `ml = lar/2 = 50` (`cos/sin(i*da+ang)*ml`, `da = TWO_PI/div`). The cos/sin cross-section is the polar part; the offset X-ends across the 5 layers produce the longitudinal grid. Net shape: a cylinder ~100 long × radius 50, 10 around.
- No `fill()`/`stroke()` is ever set, so the mesh uses Processing's default grey (≈#7F7F7F) for both; the light lines over the dark cells are the default stroke.
- `poly(x,y,d,c,a)` (L43-51) is a 2D regular-polygon helper that is defined but never called (dead code).
- The audio/FFT is created in `setup()` but **never read in `draw()`** — despite living in an "FFt" folder, the music does not drive the geometry. The only animation is the `rotateZ(frameCount*0.01)` spin.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic:** `tubeQuadMesh(length, aroundSegs, lenLayers, angleOffset)` — the `beginShape(QUADS)` double loop is a reusable 3D tube/grid primitive (length, ring count, layer count, phase). The unused `poly(...)` regular-polygon helper is also reusable as-is.
- **One-off art decisions:** the specific constants (`lar=100, div=10, ang=PI*1.5`), the `rotateX(PI/4)` tilt + `rotateZ(frameCount*0.01)` spin, the `z=-200` depth, and the near-black `background(20)`.
- **Clean parameter object:** `{ length, aroundSegs, lenLayers, angleOffset, bg, spinRate, tiltX, zOffset }`. The audio/FFT is currently dead weight; a real "audio-reactive" version would feed `fft.linAverages()` into `aroundSegs`/`length`/`angleOffset` per frame, which is presumably the sketch's original intent.
