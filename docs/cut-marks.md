# Edit retained rectangle regions

`CutMarks.pde` is an editable Processing Java workflow for working directly with retained
rectangle regions. It uses `RetainedRectangles2D` from the Java library: the sketch owns
its palette, initial cut sequence, holes, and marks, while the library owns current live
regions and their stable IDs.

Click a visible region to select it. **X** or **Y** cuts the selected region at its midpoint
and keeps the low-coordinate child selected. **Delete** or **Backspace** removes it. **A**
rebuilds the authored setup with aligned or staggered second cuts. **D** changes only the
decoration, so the current edits and IDs remain. **H** rebuilds with or without its authored
every-seventh-ID holes. **0** restores the initial authored state. **S** writes the cached
displayed frame as `cut-marks.png`.

The midpoint command deliberately becomes a no-op if binary64 rounding places it on a leaf
edge. That is an editor convenience; the core operation continues to reject an edge cut as
`INVALID_CUT`.

The seed `42`, twelve setup iterations, 25–75% initial ratios, palette, edge decoration,
and every-seventh-ID holes are piece settings. They are not defaults or recommended ranges
for `layout.retained-rectangle-cuts-2d`. The optional `configureRender` hook accepts only
the authored `staggered`, `decoration`, `holes`, and optional `edit` flags for local renderer
tools; artists can ignore it when working in Processing.

The retained-region capability was admitted from the supplied-region editing need recorded
for [`2019/generativos/griton`](../survey/out/2019/generativos/griton/notes.md). This PDE is
an independent composition: it does not recreate griton’s source selection, ratios,
omission behavior, or drawing code.

The [native workflow review](../evidence/workflows/cut-marks/root-review.json) validates selected
X cut, retained decoration, deletion, reset and cached save. The mouse selection is simulated
through the actual callback and keyboard events are posted to Processing. Distribution
acceptance is recorded separately; other-target support and upstream-sketch reproduction
are not claimed.

## Make a supplied cut directly

`RetainedRectangles2D.cut(id, axis, coordinate)` accepts exactly `"X"` or `"Y"`. The
coordinate is absolute in the root rectangle's caller coordinate system, not a fraction
or an offset from the selected leaf. It must lie strictly between that live leaf's
corresponding bounds. An X cut produces left/right children; a Y cut produces
low-y/high-y children. The returned IDs have that low-coordinate/high-coordinate order.

The parent ID stops being live. Keep the returned child IDs for later edits; unrelated
leaf IDs remain valid. Invalid IDs, axes or cut coordinates leave the live set and next
ID unchanged. As with other retained operations, representational limits are not a
promise that the host can allocate arbitrarily large state.
