# OKLab orbits

Draw **open elliptical arc stacks**: offset shells, color fans, nearly closed loops or complete rings. Each orbit is an explicit segmented arc, not a shaded raster field. The unpainted remainder of a partial sweep stays transparent.

| Control | Canvas effect |
| --- | --- |
| Orbits, inner/outer radius, spacing power | Set rank count and first-to-last radius; spacing power redistributes intervening radii. One orbit starts at the inner radius and first center. |
| Ellipse aspect | Vertical-to-horizontal radius ratio before arc rotation. |
| Total drift X/Y | Move the center from the first to last rank by these total canvas-unit displacements. |
| Total twist | Rotate arc orientation progressively from first to last rank; not a per-orbit increment. |
| Arc start / Signed sweep | Choose where the arc begins and its signed span; negative sweep travels backward, ±360° produces a complete loop and zero draws nothing. |
| Segments / Stroke weight | Explicit straight segments per arc and line width. Zero weight draws nothing. |
| Color axis | **Rank** progresses from first to last orbit; **arc** progresses from start to end on each orbit. |
| Center / Global rotation | Place the first center and rotate both drift and the ellipses around that center. |
| Color source / Custom color stops / Reverse colors | Sample **all** layer palette stops or an independent JSON array of 2–32 hex colors, then optionally reverse the ramp. |

Try **Orbits** 15, **Drift X** 100, **Drift Y** -65, **Total twist** 95°, **Arc start** -145° and **Signed sweep** 260° for offset fan-like shells. A sweep of -260° reveals the opposite travel direction; 360° produces closed-looking nested rings. Set **Color axis** to arc and try custom stops `["#13233b","#77b8ad","#f8b75c"]` to run the same color transition along every shell, independent of the layer palette. Change **Segments** to control the visible polygonal character without changing the actual arc endpoints.

The real `color.oklab-ramp` operation samples the colors; radius progression, eccentric centers and signed polylines are independently inspectable geometry. No seed or raster source is involved.
