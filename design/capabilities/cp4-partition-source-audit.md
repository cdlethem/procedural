# CP4 partition source audit

Root follow-up: the selection-direction statements below quote the survey and are not
verified geometry conclusions. The source-bound [numeric check](cp4-selection-numeric.md)
finds the opposite direction for leaf-depth disparity and area concentration across five
seeds. Original survey images have not been inspected here. Do not propagate the quoted
“roughly uniform” direction into public controls without resolving this discrepancy.

This is a factual capability investigation for the artist task “divide a surface into
changing regions,” recorded in [artist capabilities](../../docs/artist-capabilities.md).
It is not an operation decision, contract, or public-API proposal. The current ledger has
explicitly reopened the prior broad subdivision merge: a split topology and the policy
that chooses a live leaf are separate observable computations.

## Evidence and provenance

The decisive surveyed records and checked-in note hashes are:

| record | candidate signature | note SHA-256 | current review status |
| --- | --- | --- | --- |
| `2018/Generativos/mosaic02#0` | `biasedQuadtree(width, height, iterations, bias) -> Rect[]` | `94598aad3ded856d78414ab21fd454aba3802612bb2a1abe0fa0f466ac0165c5` | `review_required` / `reviewed_defer` |
| `2017/Generativos/chinasseForms#0` | `subdivideQuads(canvas, iterations, maxSub, minEdge) -> Quad[]` | `aeb1c2e5532fa9c41a680a1e24f20f0b02262b642ecc0729f096fca5e94cba66` | `review_required` / `reviewed_defer` |

Both records are currently associated with `layout.quad-subdivide`, whose family status
is pending. The record audit says that `mosaic02` must preserve first-half selection
separately from four equal children, and that `chinasseForms` is variable rectangular-grid
refinement rather than evidence for a common four-child quadrilateral operation.

I also read the upstream PDEs in the existing local `AllSketchs` checkout at commit
`69bdd8513e4482a5e6018e36887d4bc208660eb5`:

| upstream file | SHA-256 | source locator |
| --- | --- | --- |
| `2018/Generativos/mosaic02/mosaic02.pde` | `d02a09f0179627ae7f358d26db41a5321555b11025959763da19162a40b7a2ff` | [pinned source](https://github.com/cdlethem/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/mosaic02/mosaic02.pde) |
| `2017/Generativos/chinasseForms/chinasseForms.pde` | `1827c420b9339d9efc609de7cb2ded7d34aed2b12c2ca6ba3bd75f1b365b6f84` | [pinned source](https://github.com/cdlethem/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/chinasseForms/chinasseForms.pde) |

The local checkout’s upstream MIT `LICENSE` hashes to
`98abe149fa5183cb8edbcaac0a4bc3a7d01218f63e4fee5d779c05ecbb119dc4`.
No upstream source is copied into this repository by this audit.

## What the two decisive sources actually do

### `mosaic02`: equal four-child replacement plus an age/order-sensitive scheduler

Source facts, from `mosaic02.pde:43–53,64–70`:

- The leaf representation is axis-aligned `x, y, w, h`, despite the historical
  “quadtree” candidate name.
- One selected rectangle is split at `w * 0.5` and `h * 0.5` into exactly four
  equal half-width/half-height children. The fourth children use the residual
  `w-mw` and `h-mh`; the source does not construct arbitrary four-corner quads.
- Children are appended in a fixed clockwise-ish traversal order: top-left,
  top-right, bottom-right, bottom-left. The parent is then removed by object.
- The generation begins with one full-canvas rectangle and executes exactly 100
  split iterations in the checked source.
- Each iteration selects an array index in `random(rects.size()*0.5)`. This is
  direct source evidence for a first-half-of-the-current-list scheduler, not a
  general size-weighted selector. Because children are appended and parents later
  removed, the list’s mutation order is part of the observable schedule.

The source mutates a shared list and returns nothing. The surveyed `Rect[]` output is an
extraction candidate, not a literal source signature. Likewise, “bias toward larger tiles”
is supported by the note and by the measured variant, but the source itself selects indices,
not dimensions; treating index order as a generic size ordering would be an inference.

### `chinasseForms`: variable-grid replacement with skipped undersized leaves

Source facts, from `chinasseForms.pde:27–52`:

- `Quad` is also an axis-aligned `x, y, w, h` record. No bilinear interpolation,
  rotated leaf, or arbitrary-quadrilateral child construction occurs in this loop.
- The source initializes a single canvas leaf. It chooses a random live-list index
  across the whole list on every attempted pass.
- Its pass count `c` is itself sampled once from `random(3, 200)`; `maxSub` is
  sampled once from nested random calls. These are sketch choices, not a stable
  public range.
- A selected leaf with `min(w,h) < 8` is skipped with `continue`: it stays live,
  the parent is not removed, and that attempted pass does not replace any leaf.
- A splittable leaf receives independently sampled `sw` and `sh`, then is replaced
  by `sw * sh` equal cells. Children are appended row-major (`j` outer, `i` inner)
  and the parent at the original index is removed after all children are appended.

Again, `Quad[]` is an extracted output, not a source return. The source makes a rectangular
grid, whose child count can exceed four and differs from both equal quadrant replacement and
binary splitting. It also combines leaf selection, a minimum-edge eligibility predicate,
and random grid dimensions in one loop. The candidate’s word “recursive” is a useful
high-level description but the checked source is an iterative mutable-list process.

## Split, selection, and stopping are not interchangeable

| source / nearby record | child topology | chosen leaf policy | stopping / eligibility | evidence status |
| --- | --- | --- | --- | --- |
| `mosaic02#0` | exactly four equal axis-aligned children | first half of current mutation-ordered list | fixed 100 successful replacements in source | direct source + measured notes |
| `chinasseForms#0` | variable `sw × sh` axis-aligned grid | uniform index over all current leaves | random pass count; narrow leaf is retained and consumes a pass | direct source + measured notes |
| `2018/Generativos/NeoGeo#0` | four children at independently random width/height ratios | random existing rectangle | random iteration count; its minimum-size guard is commented out | nearby note; `reviewed_defer` |
| `2018/Generativos/mosaic#0` | four equal quadrants | first-half selection | fixed source loop described in note | nearby note; `reviewed_defer` |
| `2019/generativos/caritas#0` | four half-size quadrants | random index with an additional random multiplier | under-4px leaf skipped | nearby note; `reviewed_defer` |
| `2019/generativos/casca#0` | four quadrants | random leaf | random-depth number of iterations | nearby note; `reviewed_defer` |
| `2019/generativos/dadano#0` | four integer-grid children at random integer cuts | random rectangle | fixed 30 iterations in the surveyed code | nearby note; `reviewed_defer` |
| `2019/generativos/lavita03#0` | two axis-aligned children after parent jitter | strongly first-index biased expression | fixed 400 passes | nearby note; `reviewed_defer` |

The nearby note hashes, for re-reading rather than treating the table as a merged
specification, are: NeoGeo `af2ee01f786c31c90ae5b461b686e7db8a79a034371b8da976bdabcf39c9384f`,
mosaic `6dc21353fdd4f167a91effe614ecdefdd57876778a1f59668734b25233067621`,
caritas `7dc1c0e022de2da6454e0ed677d3e1873fd9c79fe8075cd1f0f01513025ebbdc`,
casca `d8dd5222f748dc250c1ef91de040b5433b8066d90776a1e75bd1f077c96b23c9`,
dadano `a45773dcdd40f6b57b0758d2b412849960120602f9069367569bf944fb5acf0f`,
and lavita03 `dac9a4cb9a8eb071e23e430afe85e8663ec9bcfb492d94a0d1a24ba68512af8e`.

This comparison is evidence against merging “subdivision” into one operation now. It
separates at least: two-way versus four-way versus variable-grid children; equal,
random-ratio, and integer-cut geometry; leaf scheduler; and whether a stop condition
removes, freezes, or merely skips a leaf.

## Measured controls and confounds

`mosaic02` provides direct measured evidence relevant to region layout:

- Raising 100 iterations to 200 had a **large** change: a finer, denser mosaic while
  big blocks remained.
- Changing the selectable fraction from 0.5 to 1.0 had a **large** change: tile sizes
  became roughly uniform and the mixture of huge blocks and tiny clusters disappeared.

Those observations establish that split count and the first-half scheduler matter in this
specific complete composition. They do not isolate a geometry-only effect: each leaf also
receives fill, diagonal shading, ellipse, dot, and a centre that changes the subsequent
Delaunay mesh. The palette substitution was also large but leaves layout unchanged; mesh
retention was moderate; dot-scale change was measured as none. Those are content/overlay
facts, not evidence for partition parameters.

`chinasseForms` provides two relevant large changes:

- Reducing its sampled subdivision-pass upper behavior from the default expression to
  `random(3,40)` made the mosaic coarser.
- Allowing `maxSub` to reach 40 made very fine busy clusters coexist with large untouched
  cells.

The default values are sampled per generation, so neither experiment isolates a single
fixed pass count or grid dimension distribution. Its 4px gap was subtle and is drawn after
partitioning; branch probability and palette variants changed visible content/style rather
than leaf construction. The measured results therefore support the value of variable-grid
region layouts, but do not establish portable defaults, limits, or a common scheduler.

## Reuse and transfer observations

Both sketches demonstrate a useful separation for an artist composing changing regions:
leaf geometry can be reused for independent cell content. In `mosaic02`, the same leaves
feed rectangles, centre motifs, and a later mesh. In `chinasseForms`, leaves select between
flat colour/icon content and dense panel content. This is source-backed evidence for keeping
region construction distinct from the content recipe.

There is also a plausible transfer boundary to investigate, not a proposed API: an
axis-aligned rectangle leaf representation may be shared by equal-four-way and variable-grid
sources if their child constructor, leaf selection schedule, stop/eligibility rule, ordering,
and random stream ownership remain separately specified. The notes do not support treating
arbitrary quadrilateral subdivision, integer-cell splitting, and two-way jittered bisection
as substitutions for either named source.

## Remaining ambiguities for an architecture decision

1. Whether the next capability should prioritize the visibly meaningful biased four-way
   schedule, the variable-grid refinement, or a deliberately narrow non-stochastic cell
   transform is a maintainer decision. These sources do not decide it.
2. A future contract would need to state leaf order, child order, whether parent removal
   happens before or after child insertion, and exactly what a skipped leaf means. The
   sources demonstrate different answers.
3. Neither note establishes a portable RNG, seed interface, numeric rounding policy,
   allocation bound, immutable-result convention, or error/access behavior.
4. Neither named source supplies evidence for whole-cell containment, non-overlap after
   jitter, arbitrary quad interpolation, or a universal minimum-size policy.
5. The variable `maxSub` expression can produce edge cases whose exact Processing
   `random(2,maxSub)` behavior is not resolved by the notes. A source-faithful port would
   require a separate targeted behavioral decision rather than silently normalizing it.

No render was run for this audit. The factual source and note evidence above is sufficient
for root to choose whether further architecture work is warranted.
