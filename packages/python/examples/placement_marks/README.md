# PlacementMarks (py5)

This editable CP3 starter places differently sized circles with the accepted
`seeded_circle_placement_2d` operation, or switches its proposal source to an
authored 5×32 radial pattern that passes through the same public
`ordered_circle_filter_2d` exclusion operation. It is motivated by `caramelo`,
`candy`, and `studio`; it does not reproduce their source pixels, and the radial
source is a transfer example, not `studio`'s random radial distribution.

From a repository checkout with Python 3, Java 17, and py5 available:

```sh
PYTHONPATH=packages/python python packages/python/examples/placement_marks/sketch.py
```

The sketch is 640×640 at density 1 with a fixed background. Its controls are:

- `R`: seed +1; rebuilds placements (ignored while radial)
- `N`: 5,000 / 10,000 proposals; rebuilds placements (ignored while radial)
- `X`: seeded / authored radial proposal source; rebuilds placements
- `G`: separation scale 1 / 1.2; rebuilds placements
- `I`: minimum radius 4 / 8; rebuilds placements (ignored while radial)
- `O`: maximum radius 64 / 32; rebuilds placements (ignored while radial)
- `M`: ring / inscribed-diamond motif
- `C`: base / alternate palette
- `S`: save the already displayed canvas to `output/placement-marks.png`

`M` and `C` repaint from the same retained placement object. `R`, `N`, `X`, `G`,
`I`, and `O` rebuild placements. The radial host trigonometry (band angles and
motif vertices) is composition, outside the exact circle predicate/RNG
semantics; circle output for identical explicit inputs remains exact across
hosts.

The canvas, radius settings, and authored radial pattern are choices for this
piece. They are not defaults or recommended ranges for
`sampling.seeded-circle-placement-2d` or `sampling.ordered-circle-filter-2d`.
