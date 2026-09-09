# City marks in the browser

This source-checkout starter is a structural recreation of Manolo ide's
`ciscis002`: `layout.seeded-quadrant-partition-2d` supplies building sites,
`topology.delaunay-2d` turns them into a mesh of triangular building
footprints, `layout.regular-grid` lays out each building's window grid, and
`color.cyclic-palette` supplies the building colors. The building-policy
derivation (height, palette phase, ground visibility/tone, window
counts/lit state, wall proportions) is this module's own authored
`java.util.Random`-driven logic, ported line-for-line from
`CityComposition.java` and cross-checked against a real
`CityComposition.create(42)` Java run (580 buildings, 624,033 windows;
five early buildings' full policy and one deep into the sequence, all
byte-identical) before writing the JS model test.

C shifts the palette, H toggles building height, R generates a new seed, 0
resets, and S saves without redraw. The Java source recreates a specific
motivating sketch; the operations it composes are accepted.

This starter is not a browser-native conformance or reproduction claim; it
is a scoped port of the CityMarks composition's generation mechanism to
p5.js WEBGL. Window boxes are drawn as two faces instead of six (a
disclosed WebGL performance accommodation at this object count); every
window's position, size, count, and lit state is unaffected.
