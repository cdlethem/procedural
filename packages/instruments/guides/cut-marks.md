# Build retained cuts

Start from a seeded panel layout and then divide or remove individual regions without moving the other panels. The caller supplies the drawing canvas and any interaction; the instrument only replays its plain input and paints the surviving rectangles. Openings are transparent and can reveal another layer.

| Control | Canvas effect |
| --- | --- |
| Cut rounds | Number of seeded divisions before direct edits are applied. |
| Cut spread | Moves seeded split ratios away from their midpoints. |
| Staggered | Adds a perpendicular split across a child every third round. |
| Inset / Opacity | Change the painted panels, not the underlying partition or its region IDs. |
| Seed | Selects the initial division ratios. |
| `cutEdits` | Ordered direct `{kind:"cut",id,axis,coordinate}` or `{kind:"remove",id}` edits. |

Use `createInstrument("cut-marks")` for defaults and `createCutModel(input).leaves()` to inspect live region IDs and bounds. To split a region, choose one live ID, an X or Y axis, and an **interior coordinate** along that axis; append a cut edit to `input.cutEdits`. To leave a gap, append `{kind:"remove",id}` instead. `validateInstrument(input)` checks both edit shape and replayability: stale IDs and cuts outside the live rectangle are errors, rather than silently ignored. Up to 64 direct edits may be recorded. Use a caller-owned hit test against the leaves if building an interactive editor.

For a loose unequal layout, raise Cut spread and lower Cut rounds; add one direct vertical split through a large remaining panel, then remove a smaller neighbor. Increase Inset to expose clear seams without changing the partition. The same seed and direct edit sequence reconstruct the same geometry. Changing seed or structural controls changes the starting regions; inspect IDs again before reusing edits. Palette and treatment changes preserve them. `cutEdits` must be `[]` on other instruments.
