---
sketch: 2020/generative/05_08/shatree
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2089
animated: false
techniques: [recursion, image-source, dots-stippling]
primitives: [image, shape]
palette:
  colors: ["#021408", "#375585", "#9FBF96", "#1D551B", "#E6C5CD"]
  selection: random-from-list
composition: centered
parameters:
  - {name: treeDepth, default: 7, tried: [10], change: subtle, effect: "deeper recursion adds only fine sub-branches; tree size/shape barely changes"}
  - {name: groundDots, default: 200000, tried: [50000], change: subtle, effect: "lower-half fog ~4x thinner/lighter; tree reads more clearly"}
  - {name: branchChildren, default: "2..4", tried: ["3..6"], change: subtle, effect: "bushier tree: more branches, larger/denser foliage canopy"}
  - {name: leafSize, default: "w*16", tried: ["w*30"], change: none, effect: "no visible change; leaf clusters only marginally denser"}
  - {name: upperSpecks, default: 200, tried: [800], change: subtle, effect: "more dark specks in upper region; tree unchanged"}
reusable_candidates:
  - {name: rama, signature: "rama(x, y, w, h, angle, depth) -> void", note: "recursive branching tree: textured tapered QUAD per branch, N child recursions, leaf cluster of brush images at depth 0"}
  - {name: scatterBrushes, signature: "scatterBrushes(count, xRange, yRange, sizeRange, rotRange, tint) -> void", note: "draw count random-placed/rotated/scaled/alpha-tinted brush PImages; used for clouds, specks, and the dense ground fog"}
---

## What it draws
A near-monochrome grey composition on a light-grey (240) ground. The upper third is filled
with soft, low-contrast cloud-like brush washes plus a scatter of small dark specks. The lower
half is a dense stippled field of thousands of tiny dark marks that reads as ground fog, thickest
near the bottom edge. In the centre sits a single tree: a thin tapered trunk rising from near the
bottom, forking into a few diagonal branches, with fuzzy dark-grey brush clusters at the branch
tips that read as foliage.

## How the code works
`setup()` loads 4 brush PNGs (`brush/brush01..04.png`, lines 26-29) then calls `generate()`.
`draw()` re-calls `generate()` every frame but the output is deterministic (seeded), so frames
1/10/60 are identical.

`generate()` (line 54) resets `randomSeed`/`noiseSeed`, clears to `background(240)`, then draws
four stacked layers, all monochrome via `tint(brightness, alpha)` where brightness is ~210-250 and
alpha is the second tint arg:

1. **Clouds** (lines 63-73): 20 large, faint brushes (`tint(random(210,250), random(100,200))`,
   scale up to `width*1.2`) placed/rotated anywhere → the soft grey washes in the top.
2. **Mid brushes** (lines 75-85): 20 more, tint *0.4 (darker/more opaque), upper 60% of height,
   scale *0.4 → darker grey smudges in the upper region.
3. **Specks** (lines 87-99): 200 tiny, dark brushes (`tint(...*0.05, ...*1.4)`, scale *0.2*0.05),
   upper 60% → the scattered dark specks.
4. **Ground fog** (lines 101-111): 200000 tiny brushes, `tint(...*0.01, ...*0.5)` (very dark, low
   alpha), y in the lower half, rotation ~`HALF_PI` (near-vertical) and squashed `sca*random(0.3)`
   → the dense stippled field. This is the expensive loop.

The **tree** is one call at line 115: `rama(width*~0.5, height*0.9, width*0.04, height*0.4,
PI*1.5+aa, 7)`, i.e. rooted near centre-bottom pointing up (`PI*1.5`), 7 levels deep. `rama`
(line 131) decrements `ite`; while `ite>0` it draws a tapered textured QUAD branch (base width
`w*0.8` → tip `w*0.1`, lines 143-155) whose texture is a random brush, then recurses into
`int(random(2,4))` children at a lerped, angle-jittered point with reduced `w`/`h` (lines 157-162).
At `ite<=0` it draws 3 brush images clustered around the node (lines 164-177) → the fuzzy foliage.
Randomness enters via `random()` for position, rotation, scale, branch count, child angle, and
leaf placement. Colour: everything is grey through the tint args; the declared `colors[]` palette
(line 186) and `rcol()`/`getColor()` are not used in the active path (`rcol()` only appears in the
commented-out block at line 170).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| treeDepth_10 | `...PI*1.5+aa, 7);` -> `...PI*1.5+aa, 10);` | subtle (5.5% px) | tree silhouette nearly identical; extra depth only adds fine sub-branches, no size change | variants/treeDepth_10/frame_00001.png |
| groundDots_50000 | `i < 200000; i++)` -> `i < 50000; i++)` | subtle (17.6% px) | lower-half fog ~4x thinner/lighter; tree reads more clearly against lighter ground | variants/groundDots_50000/frame_00001.png |
| branchChildren_3_6 | `cc = int(random(2, 4));` -> `int(random(3, 6));` | subtle (10.8% px) | noticeably bushier: more branches, larger/denser foliage canopy | variants/branchChildren_3_6/frame_00001.png |
| leafSize_30 | `w*16*sca, w*16*sca` -> `w*30*sca, w*30*sca` | none (3.8% px) | no visible change; leaf clusters only marginally denser, tree shape & background unchanged | variants/leafSize_30/frame_00001.png |
| upperSpecks_800 | `i < 200; i++)` -> `i < 800; i++)` | subtle (14.3% px) | more dark specks scattered across the upper region; tree unchanged | variants/upperSpecks_800/frame_00001.png |

## Modularisation notes
- `rama` is the reusable core: a generic recursive branching-tree function (position, width,
  length, angle, depth) that emits textured tapered quads for branches and a leaf cluster at the
  leaves. A library version would take the branch width profile, child-count range, and leaf
  callback as parameters.
- The four `generate()` loops are all the same "scatter N tinted/rotated/scaled brush images over a
  rectangle with a y-bias" operation differing only in count/size/tint/rotation — one
  `scatterBrushes(...)` helper could replace all four.
- A clean parameter object: `{brushes, seed, cloudCount, midCount, speckCount, fogCount, fogY0,
  fogRot, tree:{x, y, w, h, angle, depth, childMin, childMax, leafCount, leafScale}}`.
- One-off art decisions: the specific grey tint values, the 0.4/0.6 height bias, the `PI*1.5`
  upward start, and the 200000 fog count (a pure density/quality knob, not an art parameter).
