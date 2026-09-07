---
sketch: 2018/Generativos/Forms/forms002d
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 4129
animated: false
techniques: [image-source, noise-field, packing]
primitives: [image]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: 0, tried: [40], effect: "enables the rect subdivision loop: canvas breaks into many squares, each with its own noise offset -> distinct density/colour patches (mosaic look)"}
  - {name: sizeScale, default: 120, tried: [240], effect: "2x longer slivers: busier, spikier texture, strokes cross more; overall layout unchanged"}
  - {name: densityDiv, default: 26, tried: [13], effect: "2x candidate points: much denser, brighter mat; dark band narrows; overlap dominates"}
  - {name: tintAlpha, default: 180, tried: [255], effect: "subtle: slivers slightly more opaque, marginally more contrast, no layout change"}
  - {name: spriteAspect, default: 8, tried: [3], effect: "shorter, fatter slivers (1:3 vs 1:8 length ratio): soft fuzzy starfield instead of sharp hair-like strokes"}
  - {name: globalScale, default: 0.84, tried: [1.0], effect: "removes the black margin; composition runs edge to edge, same texture"}
reusable_candidates:
  - {name: spriteSheet, signature: "spriteSheet(path, cols, rows) -> PImage[]", note: "slice a square sprite sheet into N uniform sprites"}
  - {name: noisePackedScatter, signature: "noisePackedScatter(x, y, w, h, density, sizeScale, sizeNoise) -> PVector[]", note: "collision-culled random scatter whose point sizes come from layered 2-D noise"}
  - {name: sliverSprite, signature: "sliverSprite(img, x, y, size, aspect, angle, color, alpha) -> void", note: "draw a randomly rotated, tinted sprite stretched to a thin sliver"}
---

## What it draws
Thousands of thin, elongated slivers — stretched 60×60 sprites drawn at a ~1:20 aspect — scattered in random orientations over a black field, tinted from a five-colour orange/teal/indigo palette. Density and sliver size vary with noise: the top of the canvas is dense with large strokes, while a wide dark band through the centre-bottom is nearly empty. The whole composition sits inside a thin black margin, and the overall texture reads like a static storm or matted grass.

## How the code works
- `setup()` (L3–11): 960×960 P2D, `smooth(8)`, then `loadForms()` and `generate()`. `draw()` is empty (L27–28); regeneration only on key press (L30–36).
- `loadForms()` (L13–25): loads `../forms.png` and slices it into a 16×2 grid of 60×60 sprites (32 total).
- `generate()` (L38–74): seeds RNG/noise, `background(0)`, centred `scale(0.84)` (L44–46) which creates the black margin. Builds a list of rects: the full canvas plus three random squares of side 0.4w, 0.6w, 0.2w (L48–55). A subdivision loop that would quarter rects (L58–67) exists but is disabled by `sub = 0` (L57). Each rect is painted by `rectPaint` (L69–72).
- `rectPaint()` (L76–134): sets up three noise layers with random offsets/scales (L79–86). Candidate count `cc = int(w*h)/26` (L88); each candidate gets `s = 120*noise(des,xx,yy)*md` (L95) where `md` multiplies a second noise by a third near-flat noise raised to 1.8 (L93–94) — this mask is what produces the empty dark band. Collision culling (L96–104): a candidate is dropped if within `(s+p.z)*0.01` of an already-kept point, which makes large strokes repel their neighbours. Four tint colours are made by lerping a random palette colour towards a random grey (L108–111); each kept point draws a random sprite, randomly rotated, tinted at alpha 180, sized `s*0.4 × s*8` (L112–133) — hence the slivers.
- Palette (L140): `#FF3D20 #FC9D43 #3998C2 #3E56A8 #090D0E`; `rcol()` (L142–144) picks one at random.

## Experiments
| variant | substitution | observation | image |
|---|---|---|---|
| sub_40 | `  sub = 0;` -> `  sub = 40;` | subdivision loop enabled: canvas quarters into many squares, each with its own noise offset and tint -> visible mosaic of density/colour patches (blue patch top-centre, dark squares bottom) | variants/sub_40/frame_00001.png |
| size_240 | `    float s = 120*noise(...)` -> `float s = 240*noise(...)` | slivers ~2x longer: spikier, busier texture, strokes cross more; same dark-band layout | variants/size_240/frame_00001.png |
| density_13 | `  int cc = int(w*h)/26;` -> `int(w*h)/13;` | 2x points: dense bright mat, heavy overlap, dark band nearly filled; bright orange square patch top-centre | variants/density_13/frame_00001.png |
| alpha_255 | `    tint(col, 180);` -> `tint(col, 255);` | subtle (0.7% pixels): slightly more opaque strokes, faintly higher contrast; layout identical | variants/alpha_255/frame_00001.png |
| aspect_3 | `    image(img, 0, 0, s*0.4, s*8);` -> `s*0.4, s*3` | shorter fatter slivers: soft fuzzy starfield / matted texture instead of sharp hair-like strokes | variants/aspect_3/frame_00001.png |
| scale_1.0 | `  scale(0.84);` -> `  scale(1.0);` | black margin removed, composition full-bleed edge to edge; texture unchanged (moderate pixel diff is mostly the margin) | variants/scale_1.0/frame_00001.png |

## Modularisation notes
- **Generic / library-ready:** `spriteSheet` (sheet slicing) is trivially reusable; `noisePackedScatter` (noise-sized, collision-culled scatter inside a rect) is the core reusable primitive and is independent of the drawing style; `sliverSprite` (rotated, tinted, aspect-stretched sprite) is a general "stamp a sprite" helper.
- **One-off art decisions:** the specific three-noise-layer mask (L93–95) with its magic multipliers, the fixed palette, the 1:20 sliver aspect and alpha 180, the three hand-placed random squares, and the disabled `sub` loop (the author was mid-tuning the subdivision idea).
- **Clean parameter object:** `{rects: [{x,y,size}], densityPerPx (1/26), sizeScale (120), sizeNoise: {scale, offset}[], mask: {scale, offset, pow}, minSep (0.01), sprites: PImage[], spriteAspect (8), spriteAlpha (180), palette: int[], globalScale (0.84)}`.
