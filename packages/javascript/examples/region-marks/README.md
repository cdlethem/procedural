# Region marks (port in progress)

Divide a rectangle into nested cells and draw your own content inside them. This ports
the accepted Java RegionMarks example; browser native validation and distribution are
pending. It imports the draft quadrant module directly and does not imply package support.

The page expects the repository server to serve pinned p5.js at `/p5.js`. Open
`packages/javascript/examples/region-marks/index.html` through that server.

- R changes the seed; N toggles100/200 splits; G toggles selection fraction0.5/1.
- M switches between a centred mark and a3×3 grid; C changes the palette. Both reuse cells.
- X substitutes an authored list of rectangular cells. R/N/G do nothing in this mode.
- S saves the displayed canvas without rebuilding or repainting it.

Edit `region-marks.js` to change the cell source and `sketch.js` to change its contents.
Canvas dimensions, colours and these discrete settings are example choices, not defaults
or general useful ranges of the operation. Longer replacement runs share history but their
final cell arrays are not prefixes of shorter runs.

Provenance: independently ported from project-owned
`packages/java/examples/RegionMarks/RegionComposition.java` and
`packages/java-processing/examples/RegionMarks/RegionMarks.pde`. The original motivating
sketches and parameter evidence are recorded in
`catalog/operations/seeded-quadrant-partition.json`. No upstream sketch code or assets copied.
