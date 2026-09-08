# PlacementMarks p5 acceptance

Root owns native acceptance after the frozen JavaScript placement/filter core passes review.
The example ports the accepted Java PlacementComposition and PlacementMarks controls.
Terra owns the four browser example files; core and browser workers have disjoint ownership.

Required environment: existing pinned p5/Chromium runtime, Canvas2D,640x640,pixelDensity1.
Ordinary p5 beginShape/vertex calls consume retained portable circles; this example does not
add a public renderer adapter. Palette, authored radial trigonometry and ring/diamond motif
vertices belong to composition, outside exact circle predicate/RNG semantics. No Java/p5
pixel identity claim. Circle output for identical explicit inputs remains exact across hosts.

One bounded native sequence, preserving failed attempts and sources/runtime hashes:

| Edit | Required observation |
| --- | --- |
| Baseline | seed42,5000attempts,radii4..64,scale1;424accepted (accepted Java evidence) |
| M then M | diamonds/rings; same retained result; visible change then exact pixel restoration |
| C then C | alternate/base palette; same result; visible change then exact restoration |
| G then G | scale1.2/1; regenerated geometry; restoration to baseline |
| I then I | minimum8/4; regenerated geometry; restoration |
| O then O | maximum32/64; regenerated geometry; restoration |
| N then N |10000/5000attempts;517accepted then424; extended exact accepted prefix |
| R | seed43;432accepted; regenerated arrangement |
| X | authored5x32radial proposals; ordered filtering, same circle-result access |
| R,N,I,O while radial | ignored; same geometry, settings and paint revision |
| G then G while radial | spacing changes/regenerates; restoration to radial pixels |
| S | decoded download equals displayed canvas; no generation/paint during300ms quiet observation |

Count expectations come from evidence/reproductions/cp3-java2d/pde-result.json and apply to
seeded geometry only. Radial host trig is explicitly outside core semantics; do not weaken
exact explicit-input fixtures if native radial coordinates differ in their last bits.
Capture distinct baseline,diamond,palette,spacing,size-min,size-max,count,seed,radial and
radial-spacing frames for root review; restoration states need hashes, not extra images.
Check actual click controls and at least one keyboard-triggered edit. Verify the browser
loads the delivered module, retained identity on style edits and all drawn circle/motif
counts. Page/console errors or incomplete controls fail acceptance. Save uses native p5
canvas download, no regeneration. No additional test framework or whole-corpus render pass.

Core validation and the editable workflow are separate evidence. Browser acceptance cannot
replace the exact shared fixtures, and a Node fixture pass cannot establish browser support.
After root visual/native acceptance, update only the two target attestations and package the
new workflow with prior JavaScript examples preserved. Python and Android remain pending.
