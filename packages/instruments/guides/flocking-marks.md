# Flocking marks

Draw collective, localized trajectories from a seeded population. At each tick, `radius-pairs-2d` finds actual nearby agents and `flock-steer-2d` combines their cohesion, alignment and separation before the instrument integrates velocities. Current-neighbor links and agent dots are optional rather than a mandatory web.

| Control | Canvas effect |
| --- | --- |
| Ticks | Extends synchronous steering and retained trajectories. |
| Agents | Changes the population and possible local neighbor density. |
| Source shape | Starts agents in an area, on a ring, or along a line. |
| Source X / Source Y | Relocate the population to make a composable accent. |
| Extent / Aspect | Change its width and vertical proportion. |
| Direction / Heading disorder | Rotate the start distribution, steer initial direction and spread headings. |
| Speed | Set initial motion and the integration speed ceiling. |
| Neighbor radius | Rebuild the proximity graph at each tick, not a fixed ring of indices. |
| Cohesion | Attract nearby agents toward one another. |
| Alignment | Tend toward nearby agents' directions. |
| Separation | Push agents away from nearby positions. |
| Stroke weight | Sets trail width and scales optional neighbor-link and trail-dot weight without rerunning steering; zero suppresses strokes, links and trail dots, not agent dots. |
| Trail strokes / Trail dots | Independently join trajectories or stamp spaced samples. |
| Neighbor links / Agent dots | Independently reveal the current actual proximity graph and positions. |

For a narrow migrating ribbon, start on a line with low disorder and moderate alignment. For an irregular cluster, try an area source, higher disorder and stronger separation. Empty neighborhoods impart no flock steering. The instrument has no walls or forced frame.
