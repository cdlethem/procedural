# Cut branch marks

Make split, twig-like line fragments from one freely positioned starting segment.

The source is the **Start X/Y** to **End X/Y** line segment in canvas coordinates. `seededLinePool2D` repeatedly selects and cuts a retained segment, adding zero to two new segments per successful cut. Editing either endpoint rebuilds the *source before splitting*: it does not rotate or scale an already completed image. There is no mandatory guide line. The final segment set can contain its original stem and branching continuations; no unsupported inferred cut-node locations are painted.

| Controls | Effect |
| --- | --- |
| Start X/Y, End X/Y | Set the true initial segment endpoints, including off-center and off-canvas arrangements; no automatic fit. |
| Minimum cut length | Selected segments shorter than this are skipped; a high threshold leaves a coarse structure. |
| Cut attempts, seed | Set the number of selections and the seeded selection/cut outcomes. Skips still use attempts; zero attempts retains exactly the starting segment. |
| First-cut angle scale | Change the turn spread only for first cuts of undivided segments; subsequent cuts follow the core's repeat-cut geometry. Zero is allowed. |
| Final segments, Stroke weight, Opacity, palette | Render the actual retained segment pool or leave its treatment empty; styling does not rebuild the source. |

For a small corner thicket try **Start** (145, 520), **End** (305, 330), **Cut attempts** 1800, **Minimum cut length** 6 and **First-cut angle scale** .9. Contrast with a broad, open diagonal: **Start** (130, 500), **End** (515, 270), **Cut attempts** 350, **Minimum cut length** 18, **First-cut angle scale** 1.7 and **Opacity** 180. With **Cut attempts** 0, the only final segment is the original source line. Attempts are capped at 6000, so even if every cut adds two segments the source can never exceed 12,001 retained segments. A cut attempt does not necessarily create a new segment.
