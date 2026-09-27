# Sensing trails

Trace moving lines through a seeded landscape of compact scalar peaks. Each agent samples paired probes ahead of it, turns toward the sampled difference, and leaves a transparent trajectory. Move the source to make a small accent or enlarge it to occupy more of the canvas.

| Control | Canvas effect |
| --- | --- |
| Ticks | Extends every agent's trajectory by explicit sensing steps. |
| Agents | Sets the number of independent trajectories. |
| Source shape | Starts agents in an area, on a ring, or along a line. |
| Source X / Source Y | Position the starts and the center about which scalar peaks scatter. |
| Extent / Aspect | Set the width and vertical proportion of the start population. |
| Direction / Heading disorder | Point the initial probes and rotate the start distribution; disorder spreads individual headings. |
| Speed | Sets movement per sensing step. |
| Peaks | Counts the seeded scalar hills. |
| Peak spread | Scatters hill centers near the source; zero stacks them at its center. |
| Peak radius | Widens or sharpens each hill. |
| Turn gain | Signs and scales the right-minus-left probe response; zero follows initial headings. |
| Probe distance / Probe angle | Set how far ahead and how far apart the paired samples are taken. |
| Stroke weight | Sets connected-trail width and spaced-dot weight without changing trajectories; zero suppresses those marks, not agent dots or an opted-in field. |
| Trail strokes / Trail dots / Agent dots | Independently draw paths, spaced samples, and latest positions. |
| Show field | Opt-in translucent sample tiles; off by default for layering. |

Try a compact ring with broad hills and short probes for turning loops, then a narrow line with sharper scattered hills and reversed turn gain. `sensor-motor-step-2d` computes sensing and movement; the instrument supplies the replaceable scalar grid and seeded starts. The scalar field is stationary and wraps at the canvas boundary; trajectories themselves are not clipped by a page.
