# LatticeMarks: bounded starter acceptance

Root defines this one static Java starter before implementation. The operation contract
and fixtures are accepted in design/operations/cp11-contract-review.md. No rendering is authorized by this document alone;
a source-bound plan and accepted core precede the existing serialized native runner.

## Working piece

Use a 24 by24 integer lattice mapped to cell centres on a640 by640 JAVA2D density1
canvas: centre coordinate44+24*index. Draw pale cell boundaries inside the32pixel margin.
All geometry is ordinary retained integer paths from the accepted occupied-lattice
operation. No fonts, assets, shaders, animation or external geometry libraries.

Author36 possible starts from the6 by6 lattice of indices2,6,10,14,18,22 in each axis.
Traverse these possible starts in index order (13*i)%36 so smaller prefixes cover several
rows rather than filling the top first. This visible deterministic arrangement rule is
example glue, not a public sampling operation or source reproduction. Use12 starts
initially; the alternate count is36. Use maxSteps12 initially and36 alternatively.
Initial seed42; maxCells is the explicit potential count starts.length*(maxSteps+1).
These are authored settings, not library defaults or recommended ranges.

The first treatment draws each nonempty path as a thick orthogonal stroke with a small
offset shadow and contrasting endpoint dots. One-cell paths draw a visible dot without
assuming there is an edge. Occupied-start empty paths draw nothing. The alternate treatment
draws small coloured dots at the same retained vertices, demonstrating transfer of the
output without rewriting occupancy or resampling. Use CyclicPalette for per-path colours.
Scene shadows, mark sizes and palette do not consume the operation's structural RNG.

## Edits

C changes palette; M selects connected paths or vertex dots; W changes authored stroke
width from0.35 to0.65 cell units. These retain the same geometry object and RNG output.
L toggles the successful-move limit12/36; N toggles requested starts12/36; R increments
the explicit uint32 seed. These regenerate. Some later starts can legitimately be
occupied and return empty; documentation explains the completion reasons instead of
promising the requested number of visible paths.0 restores all settings and seed42.
S saves the completed cached canvas without another generation or draw.

Use the existing static noLoop/redraw example pattern. Put seed, starts and coordinate
mapping in a small editable helper; keep the drawing in the PDE. No new session, recipe
executor or rendering framework. One guide explains lattice paths,
shared occupancy, move limits and retained restyling.

## Registered scenarios

The native sequence is baseline,C,M,0,W,0,L,0,N,0,R,0,S:12 rendered states and one save.
Check palette/mark/width edits preserve retained geometry and output RNG; structural
edits change the corresponding input and build a new result. Do not assume every seed
or count increases visual coverage monotonically. Every reset must match baseline
geometry, style and pixels. Save must match the final completed canvas.

Instrument actual preprocessed PDE drawing arguments/styles and public path vertices;
shared fixtures already cover adjacency, uniqueness, occupancy and completion reasons.
Do not duplicate all core fixtures in the render probe. Inspect every distinct capture
and verify useful connected/dot treatments and visible structural edits. If a chosen
edit is visually ineffective, correct the starter and retain the attempt; do not inflate
its claimed coverage. No per-parameter experiment matrix is planned for authored styles.

Success is technique-level: explicit starts generate reusable occupied orthogonal paths,
with structural limits and independent styling. Full source output, four-retry source
consumption, unrestricted guagua paths, other platforms and full-corpus certification
are outside this particular acceptance claim, without cancelling their roadmap decisions.

## Root pre-implementation geometry check

Root evaluated the authored start ordering through the independent tracked oracle,
`tools/diagnostics/cp11/build_lattice_fixtures.py`, before starter implementation:

| Setting | Emitted cells | Nonempty paths | Completion reasons |
| --- | ---: | ---: | --- |
| Baseline: 12 starts, 12 moves, seed42 | 155 | 12 | 11 step-limit, 1 blocked |
| L: 12 starts, 36 moves, seed42 | 245 | 8 | 4 step-limit, 4 blocked, 4 occupied-start |
| N: 36 starts, 12 moves, seed42 | 342 | 28 | 22 step-limit, 6 blocked, 8 occupied-start |
| R: 12 starts, 12 moves, seed43 | 156 | 12 | 12 step-limit |

This verifies that the planned inputs produce distinct retained geometry. It is not a
render or visual acceptance. The longer-path edit consumes more cells but leaves fewer
visible paths because earlier paths claim later starts. Explain this useful interaction
in the artist guide: move limit and start count control a shared arrangement, not isolated
independent strokes. Native visual review must still judge the treatments and editing value.
