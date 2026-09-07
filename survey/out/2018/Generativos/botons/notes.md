---
sketch: 2018/Generativos/botons
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1678
animated: false
techniques: [subdivision, grid, polar]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#0F101E", "#11142B", "#28398B", "#323E78", "#4254A3", "#223593", "#1B6B90", "#17838D", "#DF603E", "#BC3820", "#810B0C"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(1000))", tried: [], change: null, effect: ""}
reusable_candidates:
  - {name: randomSubdivide, signature: "randomSubdivide(Rect r, int iterations, int minSplit, int maxSplit) -> Rect[]", note: "repeatedly replace one random rect with a 1..n x 1..n grid of children"}
  - {name: bevelFrame, signature: "bevelFrame(float cx, float cy, float w, float h, float inset, color col, float aIn, float aOut)", note: "four trapezoid strips around a tile edge, fading outward (srect)"}
  - {name: glowRing, signature: "glowRing(float x, float y, float r1, float r2, float stretch, color col, float aIn, float aOut)", note: "annulus of quads from r1 to r2, alpha fade (arc2)"}
  - {name: lerpPalette, signature: "lerpPalette(int[] colors, float t) -> color", note: "random index into list, lerp between adjacent entries (getColor)"}
---

## What it draws
A dark navy canvas broken into a mosaic of flat rectangles by recursive subdivision. With seed 42 the split is lopsided: the left ~40% is a dense band of narrow vertical slivers (tiny blues, teals, reds, a few pinwheel corner-triangle tiles), while the right 60% is two or three huge flat slabs of near-black and medium blue. Scattered on the tiles are glowing "buttons": two large soft red-orange discs with diffuse halos (one mid-canvas, one on the right slab), and a handful of small blue/teal glowing dots.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the piece is static (botons.pde:3-12).
- Subdivision (botons.pde:37-53): start with the full-canvas rect; `sub = int(random(1000))` times (line 39), pick a random rect from the list, replace it with a `cw x ch` grid of children where `cw, ch` are each `random(1, 4)` (lines 43-52). Repeatedly-split rects become thin slivers; rects that survive unsplit stay as giant slabs — this is what creates the lopsided layout.
- Per-rect decoration (botons.pde:55-95):
  - tile fill = random entry of `back[]` (5 dark navies, line 167).
  - 10% chance (`rnd == 0`, line 65): four corner triangles in another `back` colour form a pinwheel on the tile (lines 66-73).
  - three `srect` passes (lines 77-79): four trapezoid strips around the tile at insets 0.08, `random(0.6,1.8)` and `random(0.1,0.8)` times the min side, in black (alpha 20) and a random `back` colour (alpha 10/30) — a soft embossed button frame.
  - 80% of tiles (line 82) get a centre ellipse "button" sized `min(w,h) * random(0.6,1) * random(0.8)` (line 83), coloured by `getColor` over `cols1` (blues/teal) or `cols2` (reds) chosen 50/50 (lines 85-88): a random list index lerped with its neighbour (lines 173-183). A 5%-size microdot sits at the centre (line 91).
  - `arc2` (line 93) fills a full annulus between radii `ss/2` and `ss` (vertically stretched, `s2 = ss*2`) in the same colour at alpha 60 — the soft halo. `arc2` (lines 98-116) approximates the ring with `cc` quads, inner edge alpha `shd1`, outer edge alpha `shd2 = 0`, so the ring fades outward.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, reusable: the random subdivision loop (botons.pde:37-53) is a clean `randomSubdivide`; `srect` is a self-contained bevel-frame primitive; `arc2` is a generic fading glow ring; `getColor` is a palette lerp helper.
- One-off art decisions: the three hard-coded palettes (`back`, `cols1`, `cols2`), the 0.8 button probability, the 0.1 pinwheel probability, the 0.6-1.8 bevel inset range, the `ss*2` vertical stretch of the halo, and the alpha values (20/10/30/60).
- A clean parameter object would contain: canvas size, subdivision count, split range [1,3], tile palette, two accent palettes, button probability, button size multiplier, pinwheel probability, bevel inset range, ring alpha, ring stretch.
