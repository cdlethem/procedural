---
sketch: 2016/Generativos/circlesquads
year: 2016
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1712
animated: false
techniques: [subdivision, pixel-ops]
primitives: [ellipse, shape, pixels]
palette:
  colors: ["#513C3C", "#2A769A", "#41C3BE", "#F7F36B", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {}
reusable_candidates:
  - {name: subdivideQuadTree, signature: "subdivideQuadTree(center, rootSize, iterations) -> PVector[]", note: "random quad subdivision: each step replaces a random quad with 4 half-size children (circlesquads.pde:24-37)"}
  - {name: pixelJitter, signature: "pixelJitter(satBoost, whiteLerpAmount) -> void", note: "per-pixel HSB saturation boost + random lerp toward white (circlesquads.pde:71-79)"}
  - {name: randomArcs, signature: "randomArcs(count, maxSize, maxSweep) -> void", note: "scattered random white arcs/crescents with random alpha on a dark field (circlesquads.pde:84-93)"}
---

## What it draws
A black full-bleed canvas scattered with a few hundred to a few thousand small white arcs and crescents, mostly tiny (a few pixels to ~10 px), in faint-to-brilliant white, like a starfield of open circles and slivers. There is a faint larger crescent near the centre. No colour, no structure, no visible grid.

## How the code works
Static sketch: `setup()` (line 3) calls `generate()` once; `draw()` (line 9) is empty.

1. **Quad-subdivision layer (hidden).** `generate()` starts with a light-grey background (line 23) and a single 921-px square centred on the canvas (line 25). `sub = int(pow(2, random(4, 14)))` (line 27) iterations of random subdivision: each step picks a random quad and replaces it with 4 half-size children (lines 28-37). Each quad is then drawn as a two-tone square split horizontally via `quad2()` (lines 96-106, top half and bottom half get independent `rcol()` palette picks) plus a faint double-stroked circle, a small filled palette circle, and a random half-arc (lines 41-69), all from the 4-colour palette `pallet` (line 108: brown `#513C3C`, blue `#2A769A`, teal `#41C3BE`, yellow `#F7F36B`).
2. **Per-pixel pass (hidden).** A 960x960 loop (lines 71-79) bumps each pixel's saturation by +16 (HSB, lines 74-75) and lerps it 3% toward a random white value (line 77) — a subtle grain/brightening.
3. **Wipe.** `background(0)` (line 81) overpaints the entire canvas black, hiding layers 1-2 completely.
4. **Visible arc layer.** `cc = int(random(500, 2000))` (line 84) white arcs are scattered at random positions (lines 86-87), size `s = random(14)*random(0.1, 1)` (line 88), sweep `a1 -> a1 + random(PI*0.8)` (lines 89-90), stroke `stroke(255, random(256)*random(1)*random(1)*random(1))` (line 91) — the triple `random(1)` product makes most alphas very low, hence the faint look. This is the only layer the viewer sees.

`data/post.glsl` exists in the sketch folder but is never referenced; the baseline `result.json` confirms `uses_shader: false`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / reusable:** `subdivideQuadTree` (random quad replacement, lines 24-37) is a clean standalone primitive — a parameter object would be `{center, rootSize, iterations}`. `pixelJitter` (lines 71-79) is a self-contained post pass, parameterised by `{satBoost, whiteLerp}`. `randomArcs` (lines 84-93) is a self-contained scatter primitive, parameterised by `{count, maxSize, maxSweep, alphaFn}`.
- **One-off art decisions:** the two-tone `quad2` split with independent palette picks; the specific palette `pallet`; the deliberate `background(0)` wipe that discards the first two layers (an art decision, or a leftover from an earlier version — either way it defines the final look); the triple-`random(1)` alpha falloff.
- **Clean parameter object for this sketch:** `{subdivisions, palette, satBoost, whiteLerp, wipeColor, arcCount, arcMaxSize, arcMaxSweep, alphaCurve}` — the wipe colour is the single most impactful switch (black reveals only arcs; any other value exposes the quad layer).
