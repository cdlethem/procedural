# Spring Marks

Draw converging filaments, looping traces or spare spokes by moving starting bodies and targets independently.

Each body has its **own fixed target**. Every retained history position is the result of a real `targetSprings2D` step: target attraction updates velocity, the updated velocity moves the body, then damping retains a fraction of that velocity. These are independent target springs, **not** springs between bodies. Ticks are discrete source steps, not animation time or a visual trail density setting. Nothing auto-fits the source or paints a compulsory guide frame.

| Control | What it changes |
| --- | --- |
| Bodies / Ticks | 1–256 independent bodies, 0–600 core steps, with at most 80,000 body-steps. Zero ticks retains the initial positions. |
| Strength / Damping | Target attraction and post-step velocity retention (0–1); zero strength gives unforced drift. |
| Initial arrangement | Ordered sunflower area, ring, line or rectangular grid. These choose actual starting positions, not a new force law. |
| Initial extent / aspect / X / Y / angle / disorder | Local source scale, proportions, center, rotation and seeded positional variation. Aspect changes X and Y inversely. Zero disorder makes positions independent of seed. |
| Target arrangement | Ring, line, grid or one common point, independent of initial layout. Every body retains one target at its corresponding index. |
| Target extent / aspect / X / Y / angle | Independent target placement. Extent sets ring radius, line half-length or grid half-width. Point mode uses the center alone. |
| Velocity heading / speed / spread | Initial velocity direction, magnitude and seeded angular variation. Zero spread eliminates velocity seed dependence. Zero disorder **and** zero velocity spread make the complete history seed-independent. |
| Trails / Trail stride / Trail weight | Optional actual history paths connecting every Nth retained tick and the final tick. The full history is still computed; changing stride/weight/palette never changes the simulation. Zero weight hides trails. |
| Body dots / Body size | Optional dots at the final actual body positions. Zero size hides them. |
| Target dots / Target size | Optional fixed-target dots. Zero size hides them. |
| Spokes / Spoke weight | Optional final body-to-own-target displacement lines. Spoke weight retains the old `weight` key but does not control independent trails. No spokes are compulsory. |
| Palette | Body-index colors; independent of the motion source. |

For **open trajectory fragments**, start with the defaults: 28 bodies on a partly disordered initial ring, a separately offset target ring, 48 ticks, every second history step and no spokes. For **one-point convergence**, use 16 bodies on a grid centered (265, 310), initial extent 145, target point at (410, 270), strength .038, damping .93, 65 ticks, trails on and target dots on: the destination is not secretly arranged on a ring. For **ordered ballistic filaments**, choose a line of 20 initial bodies, target grid with extent 90 at (380, 310), initial speed 7 and heading −45°, spread 0, disorder 0, strength .01, damping .98, 35 ticks, trail stride 1, no body dots or spokes. Recolor or resize marks without shifting any path; adjust targets or force to change the trajectories themselves.
