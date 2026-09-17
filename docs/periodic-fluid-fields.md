# Dye Currents

Carry three pools of color through a looping current, then draw the retained dye as a soft
wash or contour lines. Open `/examples/dye-currents/` through
`node tools/serve_external_expansion_studies.mjs`. The editable
[study](../packages/javascript/examples/dye-currents/study.js) keeps velocity, dye and
presentation separate.

| Control | Canvas effect |
| --- | --- |
| Flow +30 | Advances thirty explicit logical flow steps from the current state. |
| Gentle / strong | Changes subsequent forcing while retaining the current dye. |
| Thin / viscous | Changes the diffusion used by subsequent velocity updates. |
| Dye contours | Draws or hides scalar-level contours without changing the retained fields. |
| Paper / midnight | Restyles the same dye values using another palette. |
| Soft / striped ink | Restarts with a different scalar texture while retaining the same flow setup. |
| Projection on / off | Shows how the pressure correction changes velocity divergence and later transport. |
| Reset / Save PNG | Restores the starting study / saves the displayed frame without advancing it. |

The portable operations use a periodic unit-cell grid. Dye lives at cell centers;
`u` horizontal face velocity is offset `[0.5,0]`, and `v` vertical face velocity is offset
`[0,0.5]`. `advectPeriodicScalar2D` backtraces and bilinearly samples a scalar at its declared
offset. `diffusePeriodicScalar2D` applies a four-neighbor explicit diffusion step followed
by retention. `projectPeriodicVelocity2D` uses a bounded weighted-Jacobi pressure solve and
returns divergence diagnostics with the corrected velocities. Callers choose the update
schedule, forcing, initial texture and logical time step.

Try replacing the initial dye with your own scalar mask while retaining the velocity, then
change the ink colors without rerunning any field computation. The optional contour marks
compose the existing `marchingSquares2D` operation with those same dye values.

The field wraps at both edges. Bilinear advection softens detail and does not conserve mass
exactly; finite pressure iterations do not guarantee exact incompressibility. Diffusion rate
must lie in `[0,0.25]`, and retention in `[0,1]`. At the diffusion endpoint a checkerboard can
oscillate rather than strictly smooth. The study's other settings are authored choices,
not corpus-derived recommended ranges. The operations use a CPU grid, with no GPU solver.
