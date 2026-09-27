# Registered Screens

Two independently editable ink line screens occupy a shared rectangular source footprint. Their near-alignments and misregistrations form optical beats on the canvas; this draws only the actual clipped strokes, with no raster, paper-colored panel or simulated overlay interaction. Unlike Interference Lace, it does **not** extract contours from a sum of fields. Everything outside the drawn strokes stays transparent.

## Control map

| Controls | Canvas effect |
| --- | --- |
| Screen A / Screen B, A / B line weight | Show either screen independently and set each stroke width; disabled or zero-weight screens leave no ink. |
| A / B pitch, A / B direction | Set perpendicular line spacing and each family's angle; a slight angle difference creates broad optical beats. |
| A / B phase, A / B offset X/Y | Slide lines along their normals or move their source centers relative to the shared crop; offsets also shift curved waves along their axes. |
| A / B bend, A / B wave cycles | Curve lines by a normal displacement and set cycles over the longest footprint dimension; zero bend stays straight. |
| Source width / height, Source X/Y | Crop both screens to the same unpainted rectangle and position that rectangle on the canvas. |

Each screen has its own **enable** switch, **pitch**, **direction**, **phase**, **offset X/Y**, **bend**, **wave cycles** and **line weight**. Pitch measures perpendicular spacing between successive lines. Direction is their angle in degrees; a 2–6° difference from the other screen makes broad changing registrations. Phase slides the whole screen along its normal in pixels. Offset X/Y places that screen's source center relative to the shared footprint; unlike phase, offset also moves a curved screen along its wave axis. Bend is the normal displacement of a line as it runs across the source; wave cycles measure waves per longest footprint dimension. Zero bend produces straight lines regardless of wave cycles. Zero weight or a disabled screen leaves that family unpainted. The shared **Source width/height** crop both screens, while **Source X/Y** position the crop. The crop's border is never drawn.

Try a long, understated moiré field: both pitches 16, directions 0° and 4°, B phase 8, bends zero, weights 1.2, footprint 520×460. To separate beat zones, keep those pitches but bend A by 12 at 1.5 cycles and B by 8 at 1.2 cycles; slide B phase in quarter-pixel steps. For a compact crosshatched accent, set pitch A/B to 14/17, directions -43°/42°, width 160, height 190, center (460, 190), bends 0/6. Disable either switch to see that screen alone. Neither palette nor line weight changes its line source. No randomness participates: seed has no effect and reseeding is intentionally unavailable for this study.

Clipping uses [clip segments to a simple polygon](https://github.com/cdlethem/procedural/blob/web-toolkit-v0.2.2/catalog/operations/clip-segments-simple-polygon-2d.json) on each screen's actual line segments. Curved paths sample at 16 steps per wave; straight lines need a single segment. The combined source has a hard limit of 12,000 segments (2,400,016 core work units with a rectangular footprint). Excess density/curvature/footprint combinations are rejected rather than silently sampled more coarsely or dropped. Exact entry admits footprint dimensions 1–1600 pixels, pitches 3–160 pixels, bends 0–100 pixels and cycles 0.1–12, subject to that joint budget.
