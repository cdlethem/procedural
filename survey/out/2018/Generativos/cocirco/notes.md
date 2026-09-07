---
sketch: 2018/Generativos/cocirco
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1807
animated: false
techniques: [polar, symmetry]
primitives: [shape, ellipse]
palette:
  colors: ["#F19617", "#251207", "#15727F", "#CEAB81", "#BD3E36"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: ribbonCount, default: 1000, tried: [2000], change: large, effect: "denser ribbon mesh; also reshuffles all 50 discs because the extra iterations consume random values from the single shared stream"}
  - {name: ribbonDiv, default: "random(32, 120)", tried: ["random(64, 240)"], change: subtle, effect: "finer two-color stripes on the ribbons; composition unchanged"}
  - {name: discDiv, default: "random(16, 69)", tried: ["random(32, 138)"], change: moderate, effect: "finer radial wedges on the sunburst discs; composition unchanged"}
  - {name: dd, default: 0.72, tried: [1.2], change: moderate, effect: "ribbon endpoints on a larger circle; bands reach the corners and crossing angles change; composition unchanged"}
  - {name: dotSize, default: 0.2, tried: [0.5], change: subtle, effect: "center dots clearly larger (up to ~2.5x radius); composition unchanged"}
  - {name: palette, default: "5-color warm set", tried: ["6-color set: yellow/orange/pink/purple/green/cyan"], change: large, effect: "same composition, every color replaced"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alphaIn, alphaOut)", note: "annulus strip between two radii built from quads, one fill alpha per vertex pair -> smooth radial alpha gradient; used for halo and rim shading"}
  - {name: ribbonBand, signature: "ribbonBand(x1, y1, x2, y2, w1, w2, div, colA, colB)", note: "tapered band between two points: half-length alternating stripe quads over a base fill, plus translucent dark edge strips"}
  - {name: sunburstDisc, signature: "sunburstDisc(x, y, s, div, amp, colBase, colStripe, dotScale)", note: "ellipse + pie-slice wedges (each covering amp of its slice so base shows through gaps) + gradient halo ring + center dot"}
---

## What it draws
A dense, full-bleed flat collage. Dozens of circular "pinwheel" discs of varying size, each made of radial stripes in two of the five palette colors (orange, teal, tan, red, near-black brown), most with a small contrasting dot at the center and a faint dark halo ring around the edge. Behind and between the discs, the whole canvas is woven with a dense mesh of long thin tapered ribbons running at all angles; each ribbon is striped in two colors with soft translucent-dark edge strips, giving a woven, layered-paper feel. No strokes, no gradients except the subtle arc2 alpha halos; everything is flat filled shapes.

## How the code works
- `setup()` (L4-10): 960x960 P2D, `smooth(8)`, calls `generate()` once; `draw()` (L12-13) is empty so the image is static. `keyPressed` regenerates with a new seed (L15-21).
- `generate()` L23-41: `background(rcol())`, then two independent loops.
- **Ribbon loop** (L29-108): 1000 iterations. Two random angles `a1`, `a2` place endpoints on a large circle of radius `dd = width*0.72` around the canvas center (L28, L35-38) — so every ribbon spans the whole canvas. `r1`, `r2` (L32-33) are small random half-widths (max ~0.04w each); `ang` (L39) is the perpendicular to the ribbon axis.
  - L62-78: two translucent black quads (`fill(0, 80)`) offset ±2r from the axis — after the body is drawn they leave dark strips of width r on each edge (soft shadow).
  - L81-87: solid base quad of the full band width, color `rcol()` (color A).
  - L89-107: `div = random(32, 120)` stripe quads, each spanning only half a slice (`m1 = j/div`, `m2 = (j+0.5)/div`, L92-93), all filled one color B (L90); the base color A shows through the other half of each slice → the two-color stripe pattern. Width tapers `r1 -> r2` via `lerp` (L99-100).
- **Disc loop** (L110-140): 50 discs at random positions (L111-112), size `s = width*random(0.8)*random(1)*random(1)` (L113) — product of two randoms biases sizes toward small.
  - L115: `arc2(x, y, s, s*1.4, 0, TAU, color(0), 60, 0)` — dark halo ring fading outward (alpha 60 → 0).
  - L117-118: base ellipse, color `rcol()`.
  - L121: `arc2(..., 0, s, ..., rcol(), 0, 20)` — faint dark rim at the disc edge.
  - L123-133: `div = random(16, 69)` pie wedges, each covering only `amp = random(0.4, 0.6)` of its slice (L131), all filled `c1` (L130) over base color (L118) — base shows through the gaps → radial two-color stripes; `arc2(..., c2, 0, 20)` (L132) adds a faint rim per wedge.
  - L135-139: center dot — small halo ring + ellipse of size `ss = s*random(0.2)` in a new `rcol()`.
- **Color**: `rcol()` (L171-173) picks uniformly from the 5-color `colors[]` array (L169); every color choice is an independent draw. `getColor` (L174-182) is unused.
- **`arc2`** (L143-161): general annulus-strip primitive. Splits the arc into `cc ≈ max(r)*PI*angularFrac` quads (≈ one per unit of arc length) and sets one fill alpha on the inner vertex pair and another on the outer pair — Processing interpolates fill across the shape, giving a radial alpha gradient in a single primitive.
- Randomness: the harness calls `randomSeed(42)` once before `generate()`; every `random()` call (endpoints, widths, all colors, div counts, sizes) draws from one shared stream. Consequence (verified in experiments): a substitution that changes the NUMBER of draws (loop counts) reshuffles the entire downstream composition, while substitutions that keep the draw count (value ranges, geometry, palette) leave the composition exactly in place.

## Experiments
| variant | substitution | change score | observation | image |
| ribbons_2000 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 2000; i++) {` | large (0.2467, 86.5% of pixels) | whole composition reshuffled: all 50 discs at new positions/colors (stream shift), and the ribbon mesh visibly denser with more overlapping bands | variants/ribbons_2000/frame_00001.png |
| divRibbon_240 | `int div = int(random(32, 120));` -> `int div = int(random(64, 240));` | subtle (0.0353, 13.8% of pixels) | same composition; ribbon stripes visibly finer — the woven bands become a tighter, smaller-scale weave | variants/divRibbon_240/frame_00001.png |
| divDisc_138 | `int div = int(random(16, 69));` -> `int div = int(random(32, 138));` | moderate (0.0737, 27.4% of pixels) | same composition; sunburst discs have noticeably more, thinner radial wedges (the big teal disc reads as a fine pinwheel) | variants/divDisc_138/frame_00001.png |
| dd_1.2 | `float dd = width*0.72;` -> `float dd = width*1.2;` | moderate (0.0783, 28.7% of pixels) | same composition; ribbon endpoints move to a circle past the canvas corners, so more bands run into the corners and the crossing pattern of the mesh changes | variants/dd_1.2/frame_00001.png |
| dot_0.5 | `float ss = s*random(0.2);` -> `float ss = s*random(0.5);` | subtle (0.0189, 5.7% of pixels) | same composition; center dots clearly larger (the big orange dot on the large teal disc roughly doubles in radius) | variants/dot_0.5/frame_00001.png |
| palette_6 | `int colors[] = {#F19617, #251207, #15727F, #CEAB81, #BD3E36};` -> 6-color set `#FACD00, #FB4F00, #F277C5, #7D57C6, #00B187, #3DC1CD` | large (0.2531, 95.3% of pixels) | same composition; entire color scheme replaced by a bright yellow/orange/pink/purple/green/cyan set | variants/palette_6/frame_00001.png |

## Modularisation notes
- **Generic (library candidates)**: `arc2` (L143-161) is a clean standalone "gradient annulus" primitive — radial alpha falloff in one call; useful for halos, rims, and shaded rings anywhere. The ribbon band (L62-107) and sunburst disc (L110-140) are each self-contained draw routines parameterized by (position, size, div count, two colors, alpha) — both are reusable as-is with a small parameter object.
- **Art decisions (one-off)**: the choice to place ribbon endpoints on a centered circle of radius `width*0.72` (guarantees full-canvas crossings), the 5-color palette, the `random*random` size bias for discs, the amp 0.4-0.6 wedge gaps, and the translucent-black edge strips as a depth cue.
- **Clean parameter object**: `{ribbonCount, ribbonWidthMax, endpointRadius, ribbonDivRange, discCount, discSizeMax, discDivRange, wedgeAmp, dotScale, palette, shadowAlpha}`.
