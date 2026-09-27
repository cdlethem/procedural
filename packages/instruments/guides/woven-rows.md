# Woven rows

Make angular row patterns, sparse triangular growth or irregular binary textures; choose the mark shape independently of the pattern.

An elementary cellular automaton evolves a **binary initial row** one generation at a time. Every new cell reads the left, center and right cells directly above it, indexes the eight bits of **Rule** (0–255), and becomes either 0 or 1. Bars merely ink that retained state; changing the palette, pitch, mark size, shape or placement does not reroll its source. This is an independent grid of ink bars, not an over/under thread simulation.

| Control | What it changes |
| --- | --- |
| Columns / Rows | Width of the initial row and number of generations **including** that row. Their product cannot exceed 16,384 cells. No fit-to-canvas or automatic thinning. |
| Rule | Actual eight-bit elementary update (90 by default). A rule can leave an all-dead source all-dead; nothing is artificially reseeded. |
| Initial row / Binary word | Single center cell, alternating 1010…, random, or authored repeated 0/1 word (1–64 digits, default `1001000`). The word matters only for repeated mode. |
| Random live density | Per-cell probability from 0 to 1 in random mode only. Seed affects this mode only; density zero is legal. |
| Initial phase | Whole-cell shift of the initial binary sequence, wrapping across its width; also offsets the lone cell in single mode. |
| Boundary | ZERO treats neighbors beyond the left/right edge as dead; WRAP connects opposite edges. It applies to each generation, not just the input. |
| Column pitch / Row pitch | Independent pixel distances between cell centers, not glyph sizes. |
| Center X / Center Y / Orientation | Position or rotate the whole local grid, including off-canvas fragments; there is no enclosing panel. |
| Active mark / Mark scale | Bar, disc or triangle; relative width/height (0 makes no ink; above 1 may overlap). The woven preset starts with short bars. |
| Live palette slot / Live opacity | Which zero-based palette entry inks live cells and its 0–255 alpha. |
| Ink dead cells / Dead palette slot / Dead opacity | Optional separate ink for zero cells; off by default, so the untouched paper remains visible. |

**Woven band:** keep Rule 90, the repeated word `1001000`, ZERO boundary and short bars; raise Columns while reducing Column pitch to build a dense narrow textile strip. Decrease Row pitch for interlaced-looking bands; there is still no physical weaving or thread occlusion.

**A contrasting sparse fragment:** choose Single, Rule 30, WRAP, 33 columns and 18 rows; enlarge Column pitch and set Center X near an edge. Try discs with Mark scale 0.55, then switch Ink dead cells on at very low opacity to reveal the complete binary lattice without changing the live-cell trajectory.

**A seeded field:** choose Random, Density 0.25 and Rule 110. Reseed to alter the initial row; adjusting colors, opacity or glyph size preserves those exact generations. At Density 0, a rule that births from `000` (for example Rule 1) can still turn the next generation on; for Rule 90 it remains empty.
