# Triangle glyphs

Turn a rule-grown row pattern into clusters of triangles, dots or bars, with room for negative space.

The triangle preset uses the **same real elementary cellular automaton** as Woven rows; it begins with one live cell, Rule 110, 49 columns and 25 generations. Each triangle corresponds to one live binary cell, not to a decorative randomized triangle field. Its source remains unchanged when you swap glyphs, resize or reposition marks, or change the palette.

| Control | What it changes |
| --- | --- |
| Columns / Rows | The width of the starting row and total generations, including the initial row; at most 16,384 combined cells. There is no forced panel or auto-fit. |
| Rule | Bitwise transition for each left/center/right neighborhood, 0–255. |
| Initial row / Binary word | Single center 1 (preset), alternating 1010…, random, or a repeated 1–64-character binary word. Text is used only in repeated mode, and must contain 0 and 1 only. |
| Random live density / Initial phase | Density affects random mode only (0 and 1 are valid); signed integer phase shifts the initial sequence cyclically before any generations are computed. Seed affects only random input. |
| Boundary | ZERO makes neighbors beyond each end dead; WRAP joins ends for the automaton update. |
| Column pitch / Row pitch | Pixel spacing between glyph centers, independently adjustable to compress rows or stretch the progression. |
| Center X / Center Y / Orientation | Local placement and degree rotation of the complete row grid; partial off-canvas glyphs are allowed. |
| Active mark / Mark scale | Choose triangle, bar or disc; scale is a multiple of cell pitch from 0 to 2. This preset begins with triangles. |
| Live palette slot / Live opacity | Color slot and independent 0–255 alpha for active glyphs. |
| Ink dead cells / Dead palette slot / Dead opacity | Optional background glyphs at dead-cell positions; off by default. |

**Single-cell branching:** retain Rule 110 and Single but increase Row pitch to separate generations; try ZERO then WRAP to inspect how each edge changes the actual descendants. Rule 90 instead gives a symmetric, open triangular propagation from the same seed.

**Contrasting triangular texture:** choose Repeated with binary word `110010`, Rule 30, 64 columns and 38 rows. Lower Column pitch, raise Row pitch and shift Initial phase by three. Set Mark scale below 0.7 for isolated tesserae; choosing Bar changes only ink, not the automaton.

**Empty and alive are meaningful:** choose Random, Density 0, Rule 90 for empty paper when dead ink is off. Rule 1 births from three dead neighbors, so the same blank initial row instead evolves; no hidden live-cell fallback is inserted. For Random at nonzero Density, changing the seed changes the initial row; palette/mark edits cannot.
