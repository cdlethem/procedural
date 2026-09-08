# RegionMarks Python port (native workflow checked)

`region_marks.py` supplies seeded nested cells or an authored rectangular-cell alternative.
It ports the project-owned Java RegionComposition, with the same normalized3×3 mark grid.
The pure quadrant module, composition and editable py5 sketch have been checked.
The native callback sequence passed on py50.10.11a0/JAVA2D; public convenience exports
and distribution integration remain pending. Run `sketch.py` using the prepared py5
Python environment with Java17. Root review records the tested runtime and limitations.

The controls match Java and p5.js: R seed, N split count, G selection fraction,
M mark motif, C palette, X authored cells, S cached save. Palette and motif edits retain
geometry. R/N/G apply only to seeded layouts. These controls and the640-square canvas
are example choices, not defaults or continuous useful ranges of the core operation.

Provenance: independently ported project-owned RegionComposition.java; motivating
mosaic02/mosaic evidence is in catalog/operations/seeded-quadrant-partition.json.
No upstream source code or assets copied.
