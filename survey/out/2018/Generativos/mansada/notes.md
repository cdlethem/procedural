---
sketch: 2018/Generativos/mansada
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3799
animated: false
techniques: [grid, polar, dots-stippling]
primitives: [rect, shape, ellipse, line]
palette:
  colors: ["#DDD3C9", "#EE9A02", "#EB526E", "#0169B3", "#024E2C"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(8, random(30))", tried: [12], change: large, effect: "fewer, larger cells (ss = width/cc); layout re-randomizes, larger bursts and prominent solid wedge bars"}
  - {name: c, default: "cc*random(3)", tried: [6], change: large, effect: "only ~6 burst centers; much sparser, background dot grid visible between bursts"}
  - {name: sub, default: "random(20, 120)", tried: [40], change: large, effect: "uniform segment count per ring; smoother, more regular fan rhythm across all bursts"}
  - {name: div, default: "random(20, 120)", tried: [60], change: moderate, effect: "uniform ring count per burst; finer, denser stippled trapezoid texture"}
  - {name: gridAlpha, default: 20, tried: [200], change: none, effect: "no visible change; 3x3 black grid dots are nearly hidden under the dense burst layers (472 px differ)"}
  - {name: innerArcAlpha, default: "random(220, 240)", tried: [60], change: moderate, effect: "bright inner-ring dashes darken; fans look flatter and more uniformly translucent"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2) -> void", note: "fan of trapezoid quads along an annulus, one alpha per radial edge (alpha gradient across the ring)"}
  - {name: radialBurst, signature: "radialBurst(cx, cy, cell, rings, segments, jitter, palette) -> void", note: "concentric shrinking rings of trapezoids with per-ring angle drift"}
---

## What it draws
A dense, busy full-bleed composition on a warm cream ground. Dozens of circular "bursts" are scattered over the canvas; each burst is made of many concentric rings of tiny colored trapezoids (orange, red-pink, blue, dark green) that fan outward from a center, plus broad translucent wedge/sector shapes radiating from the same centers and a few thin dark spokes. Each burst also ends in a stack of solid concentric dots (e.g. a dark-green disc with a blue center, or a flat pink disc). A faint grid of tiny dark dots underlies everything.

## How the code works
`setup()` → `generate()` (mansada.pde:7); `draw()` is empty, so the image is static (frames 1/10/60 identical in baseline). `randomSeed(seed)` (line 25) makes the whole layout deterministic.

- Ground grid (lines 30–36): `cc = int(random(8, random(30)))` (line 27) sets the cell count; a double loop draws `(cc+1)^2` tiny 3×3 black rects with alpha 20 at every cell corner — the faint stippled grid. Cell size `ss = width/cc` (line 28) scales everything else.
- Bursts (lines 38–83): `c = int(cc*random(3))` (line 38) burst centers, each at a random grid intersection (lines 40–41).
  - Two large translucent outline rings `arc2(..., ss*10, ss*6, ...)` and `(..., ss*5, ss*3, ...)` (lines 45–46).
  - The main body (lines 48–62): `div` rings, `sub` segments each; amplitude decays linearly from `ss*10` to 0 across rings (lines 53–54); each segment drawn three times via `arc2` — outer edge alpha 30, inner edge alpha 20, plus a brighter narrower inner arc at alpha `random(220,240)` (line 58). Each ring covers only ~40% of the circle (`da = (TAU/sub)*random(0.4)`, line 50), and the ring angle drifts by `random(-0.1, 0.1)` per ring (line 61) — that is what makes each burst a twisting spiral of partial-ring fans rather than full annuli.
  - Wedges (lines 64–74): `ccc = int(random(5))` broad sectors of radius `ss*10` (a1→a2, random width ~0.2 rad) at alphas 80/120, plus a thin spoke line to radius `ss*5` (line 73) — the radiating translucent wedges and dark lines.
  - Dot stack (lines 76–82): three concentric ellipses, diameters `ss*3` (alpha 80), `ss`, `ss*0.5`, each a fresh random palette color — the solid center dots.
- `arc2` (lines 91–109) is the core primitive: splits an annular sector into `cc = max(4, arclen)` quads, each quad filled with alpha `alp1` on its outer edge and `alp2` on its inner edge, i.e. a per-ring alpha gradient; the high alphas (220–240) on the narrow inner arcs make the bright dot-like dashes.
- Color: `rcol()` (lines 152–154) picks uniformly from the 4-color palette `{#EE9A02, #EB526E, #0169B3, #024E2C}`; background is `#DDD3C9` (line 23). `getColor` (lines 158–163, lerps between palette entries) is defined but never called.
- No blend modes; the whole look comes from low alpha accumulation in P2D.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = int(random(8, random(30)));` -> `int cc = 12;` | large | larger cells (ss=80px): bigger trapezoids and bigger bursts, prominent wide solid wedge bars; layout re-randomizes (fixed cc drops one random draw), overall denser and busier | variants/cc_12/frame_00001.png |
| c_6 | `int c = int(cc*random(3));` -> `int c = 6;` | large | only ~5-6 burst centers with large ring systems, big central dot stacks and wide translucent sectors; sparse, readable, faint dot grid visible between bursts | variants/c_6/frame_00001.png |
| sub_40 | `int sub = int(random(20, 120));` -> `int sub = 40;` | large | all bursts share one angular resolution; fans look smoother and more regular in rhythm, similar overall density to baseline, different layout (stream shifts) | variants/sub_40/frame_00001.png |
| div_60 | `int div = int(random(20, 120));` -> `int div = 60;` | moderate | uniform 60 rings per burst; finer, denser stippled trapezoid texture, ring systems look more filled in | variants/div_60/frame_00001.png |
| gridAlpha_200 | `fill(0, 20);` -> `fill(0, 200);` | none | no visible change (verified: only 472 px differ, max delta 122; the 3x3 grid dots sit under the dense burst layers and read the same at image scale) | variants/gridAlpha_200/frame_00001.png |
| innerAlpha_60 | `rcol(), random(220, 240), 0` -> `rcol(), 60, 0` | moderate | bright dash-like inner arcs gone; rings look flatter, more uniformly translucent, slightly calmer overall | variants/innerAlpha_60/frame_00001.png |

## Modularisation notes
Generic, library-worthy: `arc2` (alpha-gradient trapezoid fan over an annulus) and the `radialBurst` loop (lines 48–62: rings × segments, decaying amplitude, per-ring angle jitter) — a clean parameter object would be `{seed, cellCount, burstCount, rings, segments, angleJitter, amplitudeDecay, palette, alphas}`. The ground dot grid (lines 30–36) is a trivial generic grid primitive. One-off art decisions: the wedge sectors + spokes (lines 64–74), the three-disc center stack (lines 76–82), the specific 4-color palette and the `ss`-relative sizing. `srect` (lines 111–149) and `getColor` are dead code, never called.
