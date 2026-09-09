# Sequential disc projection — bounded admission investigation

Root reviewed colidion's source at2019/generativos/colidion/colidion.pde, lines147–181,
and its checked note. Note SHA25683b2b257c17bbedb28aa89ccb71ceddf6637712c2202f681a3ef8412a97613e0;
upstream SHA256e3a84eff5f0bc70a425825f6a353fa0644d823e702c0c0422805bb88314eedba.
Terra's bounded comparison is in .work/colidion-review/findings.md; root retains admission.

The real missing component moves a supplied point outward when inside a supplied disc,
partway toward that disc's boundary, then tests the changed point against the next disc.
RadialPull2D instead sums inward power-profile contributions evaluated at the original
point. Negative strength or replacing a radius cannot reproduce the sequential dependency.
ClosedSpline2D can smooth a supplied contour but does not compute this deformation.

Artist entry point: deform existing contours or line families around local circular
influences, then retain those coordinates for drawing with different marks/colors. Keep
point generation, influence selection and drawing independent. Do not introduce an entire
flattenCircle operation containing size-dependent sampling, owner-ray blends, overlap-graph
construction and stipple rules merely because one source bundles them together.

Important evidence correction: the source stores distance from the owner center at each
original angular index after vertices have moved in two dimensions. Their angular positions
can change, and the later angle-bin lookup is not polygon containment. Do not claim its
stipple envelope keeps arbitrary points inside the resulting polygon. A single pass also
does not guarantee points end outside all discs; later projections can reenter earlier ones.
This is geometry deformation, not Voronoi, clipping or a collision solver.

The only measured flatten variant changes x interpolation from0.45 to0.8, leaving y at0.45.
The reported subtle effect does not validate a recommended symmetric-strength range. A
private controlled study must decide whether fractional strength merits exposure. Direction
normalization rather than atan2/cos/sin is a proposed independent mathematical specification;
exact-center positiveX is an explicit design convention, not a recovered geometric normal.
No public API or default is frozen at this investigation stage.

Next execute evidence/parameter-experiments/disc-projection/experiment.json. Root decides
keep/revise/reject from two concrete consumers and the order counterexample. If retained,
freeze portable finite/overflow/ownership/work-budget semantics and distinguishing fixtures
before Java production code. No extra source neighbor or corpus-wide search is necessary
for this decision. circNoi corroborates sampled polar outlines only, not projection.

## Root analytic distinctions for the future contract

These are exact one-dimensional examples of the proposed private math, not public fixtures.
At point(0,0), apply discs(center0,radius2) and(center1,radius2) with strength0.5.
PositiveX exact-center convention yields x=1 then x=2. Reversing the discs yields
x=-0.5 then x=-1.25. Thus order is observable even without trigonometric rounding.
At point(1.5,0), full strength with discs(center0,radius2) then(center3,radius2) yields
x=2 then x=1, reentering the first disc. A one-pass projection cannot promise exclusion.
Any retained API must document these cases and preserve supplied influence order.
The exact-center direction is necessarily a design convention; a supplied direction or
center-preserving alternative would need a different explicit contract, not a silent fix.
