# Pull marks

Source paths bend toward one or two radial centers. Choose rows, columns or spokes to change the structure before the pull; moving a center changes where the paths gather. The study leaves clear space around its paths for layers underneath.

| Control | Canvas effect |
| --- | --- |
| Source paths | Starts with horizontal rows, vertical columns or radial spokes. |
| Paths | Changes how many separate source paths enter the field. |
| Source jitter | Offsets source samples perpendicular to their path before pulling. Zero keeps them orderly. |
| Influences | Uses the first pull alone or both pulls. |
| First/second center X and Y | Places each pull in the canvas. |
| First/second radius | Sets how far each pull reaches. |
| First/second falloff | Changes how quickly displacement fades toward each radius. |
| Stroke weight | Changes path thickness without recomputing their positions. |
| Palette | Colors separate paths in order. |

Try one off-center pull over orderly rows, then switch to spokes while keeping that pull. Add the second pull with a different radius and falloff to make an asymmetric field. Use a path layer below to see it through the gaps.

The study transforms explicit source samples with `geometry.radial-pull-2d`. The three source path layouts and strokes are editable example choices; the pull operation itself does not create paths or draw them.
