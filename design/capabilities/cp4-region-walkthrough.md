# CP4: compose inside changing regions

Root's next Java-first capability investigation. CP3 delivery is closed; this is the next
artist workflow in `docs/artist-capabilities.md`. Sol review is paused for this sprint.
This document selects a concrete investigation, not a frozen public contract.

## Artist task and reusable boundary

Start with a surface broken into cells. Change how many times regions are refined; then
change each cell from a colour panel with a central mark to a small field of marks. The
second edit must keep the cell geometry. The artist should receive usable rectangle
bounds and be able to iterate them without managing a mutable subdivision tree.

The proposed library responsibility is retained axis-aligned leaf geometry, with explicit
selection and replacement order. Palette, inset, motifs and repeated content stay in the
editable example. The existing regular-grid operation is useful *inside* a cell but cannot
choose and replace live cells at different depths. Conversely, a four-corner interpolation
helper would leave almost all of the region-generation algorithm in caller code.

Root is investigating a seeded equal-quadrant convenience first, with a deliberate route
to explicit refinement. The convenience must not force callers to recreate RNG plumbing
and live-leaf bookkeeping. An explicit refinement route would let the artist supply a
selected leaf and grid division, sharing the replacement machinery. Whether that route
merits a second public operation depends on a working transfer example; do not add it
merely to make the implementation symmetric with CP3.

The return shape should expose rectangle bounds and stable identity independent of its
current list index. Identity is a design requirement for associating content with cells;
the source sketches use list positions/shared RNG and do not demonstrate that guarantee.
Identity here means a creation identity within one refinement run, surviving removal of
other leaves; it does not promise correspondence across different seeds or selection
policies. The exact identity representation and its storage cost remain contract decisions.

## Source evidence and limits

Root read the full reports for `2018/Generativos/mosaic02`,
`2017/Generativos/chinasseForms`, `2018/Generativos/NeoGeo` and
`2018/Generativos/mosaic`, and the pinned mosaic02 source. The exact source/note hashes
and candidate identities are in [the source audit](cp4-partition-source-audit.md).

- `mosaic02#0` supplies equal four-child replacement, append-child/remove-parent ordering,
  first-half live-list selection and a fixed number of successful replacements. Its
  measured 100-to-200 edit changes the complete drawing substantially.
- `chinasseForms#0` supplies independently chosen rectangular grid dimensions and skipped
  undersized selections. It supports the importance of independently composed cell
  content; it is not equivalent to an equal-quadrant generator.
- `NeoGeo#0` supplies unequal random-ratio four-child splitting. Its report has no measured
  parameter experiments. Defer a public split-ratio range; do not infer one from 0.4–0.6
  source literals.
- `mosaic#0` is nearby equal-quadrant evidence, but its pending parameter records are not
  completed measurements.

The mosaic02 report's claim that full-list selection makes sizes more uniform appears
in tension with its actual append/remove schedule. Root's inference is that restricting
selection to older leaves can instead reduce depth disparities. A bounded numeric
investigation will test this. Until reconciled, do not describe the selectable fraction
as “size bias,” recommend a direction, or propagate the report's prose as established
geometry behavior. The measured large pixel difference alone cannot settle direction. Root also checked
`survey/out/2018/Generativos/mosaic02/variants/bias_1.0/result.json`: the intended
substitution applied once, seed 42 was used, rendering succeeded on display `:2`, and
the recorded changed fraction is 0.759 (mean 0.1815). Baseline and variant both warn
that density 2 is unavailable. These records establish an executed change, not its
geometric direction; the original images are absent from the published snapshot.

## Private walkthrough to prepare

Use one small Processing JAVA2D piece with no external assets or fonts. Freeze a seed,
canvas, palette and cell-content rule before rendering. Do not reproduce the source's
Delaunay overlay or gradient shader treatment: acceptance is technique-level cell layout
and editing, not source-pixel identity.

The investigation should compare at most six distinct images:

1. A baseline with 100 equal-quadrant replacements and first-half leaf selection.
2. Only replacement count changed to 200.
3. Only selection changed to the full live list.
4. Baseline geometry, with cell content replaced by a fitted grid of small marks.
5. A small explicit refinement plan that replaces selected cells with rectangular grids,
   using the same content code. This is a design transfer, not a chinasseForms reproduction.
6. Reserve one image only if the first four reveal an actual readability question; choose
   and register its value before execution, not as an automatic render retry.

Before a render, register exact configuration, source hashes, comparison criteria and
attempt budget through the parameter-evidence workflow. Root must inspect the resulting
images. Numeric preflight should verify positive finite bounds, area conservation for
these dyadic cases, non-overlapping interiors, deterministic leaf order, and successful
replacement count. Do not advertise a continuous useful range from these discrete edits.

Accept the convenience only if split count and selection each offer a meaningful edit,
content substitution reuses retained geometry, and the code removes the live-list/RNG
burden. If the explicit transfer adds little beyond four lines of example code, retain it
privately instead of expanding the catalog. If it requires reimplementing replacement or
identity semantics, consider a distinct explicit operation before freezing contracts.

## Deliberate exclusions from this slice

Arbitrary quadrilateral warping, random-ratio cuts, integer-grid cuts, jittered binary
partitions, variable random grid distributions and three-dimensional boxes remain separate
unresolved computations. They are not rejected technique families. No broad subdivision
merge is reopened implicitly, and none of their candidates is reassigned by this brief.

The full source composition's random preludes, content randomness and mesh ordering are
not a portable default. A private explicit stream and geometry/style separation are
independent package-design choices and must be labelled as such in eventual contracts.
