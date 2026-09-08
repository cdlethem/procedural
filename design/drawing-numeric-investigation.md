# Drawing numerics investigation

Root investigation, 2026-09-07. This supports the [drawing boundary](drawing-boundary.md),
not a frozen adapter contract. The previous turn settled responsibilities; this turn
produces executable evidence that changes how topology validation must be implemented.

## Exact topology

Use the sign of the exact determinant of the represented binary64 coordinates. A quad
in cyclic order is strictly convex when all four consecutive orientation determinants
are nonzero and share a sign. Repeated vertices, a collinear triple, crossing edges and
concavity fail. Reversing winding reverses all signs without changing validity.

The [investigation vectors](../fixtures/drawing/geometry-investigation.json) contain
15 quads and six binary32 rounding cases. Regenerate or verify them with:

```sh
uv run python tools/build_drawing_geometry_fixtures.py
uv run python tools/build_drawing_geometry_fixtures.py --check
```

The independent oracle uses rational arithmetic on represented values, including
nearest-binary32 ties-to-even rounding; host `struct` conversion is only a cross-check.
Sol's review prompted separate cases for four distinct converted vertices becoming
collinear and a binary64-minimum-subnormal rectangle. The generator also compares the
turn predicate against an edge half-plane characterization for all 3,024 ordered
distinct quads on a 3×3 integer grid. For
`a=(0,0)`, `b=(134217729,134217728)`, `c=(134217728,134217727)`, the exact
orientation is -1, while ordinary separately rounded binary64 products subtract to
zero. A valid parallelogram built from those vectors exposes the same cancellation.
A global epsilon would not fix the lost sign. Ports may use a proved adaptive exact
predicate or exact integer decomposition; they must match topology exactly. Selecting
the efficient implementation remains contract/implementation work.

The fixture domain intentionally includes values that may never be admitted by the
first rasterizer profile, such as subnormal dimensions. That distinguishes numeric
truth from a future engineering support bound. `geometry_outcome` describes topology
alone; it is not an assertion that any native host accepts or visibly renders the case.

## Host evidence and next domain decision

Canvas2D ignores a zero line width, leaving the previous width in effect. Java's
BasicStroke accepts zero as a device-dependent hairline. These documented semantics
support rejecting zero and positive widths that convert to zero before host calls.
They do not establish a safe maximum coordinate or width for the four target renderers.
Sources: [HTML line styles](https://html.spec.whatwg.org/multipage/canvas.html#line-styles),
[Java 17 BasicStroke](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/java/awt/BasicStroke.html).

Root inference: distinguish numeric representation bounds, a declared shared profile's
engineering domain, and runtime surface/resource availability. A capability preflight
cannot manufacture a documented universal safe rasterizer limit. Do not hard-code a
convenient power of two and describe it as proven from these references. Next investigate
the pinned target implementations and run a separately registered boundary suite before
advertising the profile. Android and browser native validation remain required.

## Error-order direction

Frame preflight verifies the complete profile (both command kinds and round caps), surface
readiness and environment before any batch. Per batch, inspect records in encounter order:
shape/types and required fields; finite numeric domains and colour/style; canonical
topology; binary32 conversion and profile-domain checks; converted topology. Unknown
kind/cap is an invalid command. The first invalid record aborts the frame with its absolute
encounter index. No commands in that batch draw until all pass. Converted collapsed
segments remain indexed no-ops. Native failures after validation cannot promise rollback.
Exact field-error precedence and the domain are still required in the catalog contract.
