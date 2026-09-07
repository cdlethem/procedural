---
sketch: 2019/generativos/intercep
year: 2019
renderer: P2D
size: [1920, 1080]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1550
animated: false
techniques: [grid, dots-stippling, packing]
primitives: [rect, shape]
palette:
  colors: ["#F94F00", "#F9BD18", "#4646EA", "#1E1E1E", "#EDEDED"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: lineLineIntersect, signature: "lineLineIntersect(x1,y1,x2,y2,x3,y3,x4,y4) -> PVector|null", note: "intersection of a horizontal and a vertical segment, null if none"}
  - {name: rectElbow, signature: "rectElbow(x1,y1,x2,y2) -> draws 2-segment elbow", note: "two-segment orthogonal connector between two grid points"}
  - {name: shadowRect, signature: "shadowRect(x,y,w,h,strokeW,col,shw1,shw2)", note: "hollow rect + 4 offset shadow quads = fake extrusion (Rect.show)"}
---

## What it draws
A near-black field (#1E1E1E) sprinkled with tiny 4–12px squares in orange, blue, yellow and white, some forming dense dotted grid patches. Over that sit ~50 large hollow square frames (80–800px) in the same palette, each with a thin offset "shadow" band giving a faux-3D extruded look, a small white dot at the centre, and small black tabs where frames cross other frames' edges. Thin black and white elbow lines (one bend) connect random pairs of frame centres.

## How the code works
- `settings()` (intercep.pde:15-20): 1920x1080 P2D, `smooth(8)`, `pixelDensity(2)` (not available on the display, warning only).
- `generate()` (intercep.pde:43) is called from `setup()`; `draw()` is empty, so the image is static (frames 10/60 identical to 1). `randomSeed(seed)` fixes all randomness (deterministic=true).
- Background: `rcol()` — one palette colour, here the dark `#1E1E1E` (intercep.pde:48).
- Pass 1 (intercep.pde:53-85): double loop over a 40px grid. Each cell gets a size `s = 4*int(random(1,4))` (4/8/12, halved with p=0.4); with p=0.4 a single small `rcol()` square is drawn; with p=0.03 additionally a `(2cc+1)^2` cluster of tiny squares around it (`cc` up to ~11, intercep.pde:70-77) — these are the dotted-grid patches.
- Pass 2 (intercep.pde:88-99): 400 medium squares, side 0–40px (`random(40)*random(1)` squared), grid-snapped, `rcol()` fill — the scattered mid-size specks.
- Pass 3 (intercep.pde:101-118): 52 `Rect` objects (Rect.pde:5-19): centre snapped to the 40px grid, side `80 + int(random(4)*random(random(40,200)))` (80–860), random stroke weight `str`, colour `rcol()`, plus two shadow colours `lerpColor(col, black, 0.1/0.2)`.
- Pass 4 (intercep.pde:121-129): `2*rects.size()` elbow connectors via `rectLine` (Rect.pde:143-164): a 2-segment orthogonal path between two random rect centres. Note intercep.pde:125 sets `stroke(r1.col)` but line 126 immediately overwrites it with `stroke(255*int(random(2)))`, so lines are always black or white; weight 0.5–2.5.
- Pass 5 (intercep.pde:132-148): each `Rect.show()` (Rect.pde:21-94): two `ADD`-blended quads (top/bottom half) with alpha 10–30 (soft glow), the hollow outline `rect` in `col` with weight `str`, a 20x20 white alpha-20 + 5x5 solid white rect at the centre, then four shadow quads (Rect.pde:59-93) offset by `str*0.5`/`str*0.25` on each side in `shw1`/`shw2` — the extruded look.
- Interception (intercep.pde:136-147, Rect.pde:96-141): for every rect pair, `lineLineIntersect` (Rect.pde:128-141, only handles the case where the 3rd-4th line is vertical) finds points where r2's vertical edges cross r1's horizontal edges; each hit draws an `Interception` (intercep.pde:151-209): a thin black quad (alpha 40) along one edge — the small dark tabs visible where frames cross.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `lineLineIntersect` (horizontal x vertical segment test), `rectElbow`/`rectLine` (2-segment orthogonal connector), the `Rect` "frame with offset shadow quads" as a `shadowRect` primitive, and the 40px-grid snap helper.
- One-off art decisions: the specific 5-colour palette, the ADD-glow quads, the 3% cluster probability, the 400-specks pass, the black-tab interception marks.
- A clean parameter object: `{grid: 40, speckProb: 0.4, clusterProb: 0.03, clusterMax: 12, midSpecks: 400, frameCount: 52, frameSizeRange: [80, 860], connectors: 2*frameCount, palette: [...]}`.
