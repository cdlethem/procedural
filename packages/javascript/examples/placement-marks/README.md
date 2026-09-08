# Placement marks in the browser

This source-checkout starter proposes circles first and draws rings or diamonds second.
It uses the browser implementations of `seededCirclePlacement2D` and
`orderedCircleFilter2D`, then calls native p5 `beginShape()` and `vertex()` for its
editable presentation. The canvas is 640×640 at density 1.

Serve this directory together with `packages/javascript/src/` and pinned p5 2.3.2,
mapping the p5 script to `/p5.js`. Open `index.html`, then use the visible controls or
keys:

- **R** advances the seed and rebuilds the seeded arrangement.
- **N** switches 5,000 and 10,000 seeded proposals.
- **G** switches separation scale 1 and 1.2, rebuilding either proposal source.
- **I** and **O** change the seeded radius interval between 4–64, 8–64, 4–32 and 8–32.
- **X** switches seeded proposals and five authored radial bands of 32 proposals each.
- **M** switches 64-vertex rings and four-vertex diamonds without rebuilding placement.
- **C** switches palettes without rebuilding placement.
- **S** saves the already displayed canvas.

When radial is selected, **R**, **N**, **I** and **O** intentionally do nothing: those
settings describe seeded proposals only. `placement-marks.js` keeps the authored radial
proposal generator and `vertexInto()` visible, so an artist can replace either without
reimplementing the ordered exclusion rule.

The exact placement core has no trigonometry. The radial proposal and ring vertices use
browser `Math.sin` and `Math.cos` as ordinary composition drawing; this example makes no
cross-host vertex-pixel identity claim. It is a browser workflow pending separate native
runtime acceptance, not a reproduction claim for caramelo, candy or studio.
