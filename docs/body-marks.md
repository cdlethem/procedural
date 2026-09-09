# Draw tapered bodies along a field

`BodyMarks.pde` is a self-contained Processing Java workflow for drawing tapered bodies from
current backward field traces. It composes `GradientPath2D`, `GradientNoise2D01`, and
`CyclicPalette`; it does not add a body, trail, agent, or offset API.

The sketch starts paused. **Space** runs or pauses the explicit tick loop, and **.** advances
one tick while paused. **M** transfers the same retained spines between tapered bodies and
centerlines. **W** changes the authored taper exponent from `0.7` to `2` without retracing.
**0** restores heads, spines, style, and pixels to the authored initial state. **S** saves the
cached displayed frame.

Each tick builds all candidate geometry before it commits anything. For every one of twelve
heads, it traces one forward field step, then traces a 24-step spine backward from that next
head with angle base π. If all traces succeed, the candidate heads and spines replace the
retained state and the tick advances. The work is bounded to `12 * (1 + 24)` path steps per
tick. Style changes read the retained paths without integration.

A 24-step trace has 25 points but only headings for samples 0 through 23. Body and centerline
drawing therefore use samples 0 through 23. Each strip samples the heading normal on both
sides with opposite traversal order and uses `pow(1 - i / 23, exponent) * 12` as its half
width. It is a sampled strip with no generic offset, join, cap, self-intersection, or width
preservation guarantee.

The 640-pixel canvas, twelve-head layout, field seed and mapping, four-pixel step, 24 samples,
12-pixel width, taper exponents, palette, and movement policy are authored settings. They are
not corpus useful ranges or library defaults. The composition follows the current-spine
direction recorded for [`2018/Generativos/peces`](../survey/out/2018/Generativos/peces/notes.md),
but does not copy its code or recreate its Processing noise, float behavior, lifetimes,
palette phases, trails, or imagery.

The [native review](../evidence/workflows/body-marks/root-review.json) validates taper and
centerline transfer, single stepping, reset, cached save and24-tick geometry replay.
Distribution acceptance is separate. No other-target support or source reproduction is claimed.
