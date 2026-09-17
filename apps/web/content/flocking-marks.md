# Flocking marks

A supplied ring-and-chord graph steers fifty-four moving marks. Their paths are accumulated from synchronous old-state steering and a visible example-owned speed cap.

| Control | Canvas effect |
| --- | --- |
| Ticks | Extends the deterministic steering replay and trails. |
| Open chain | Replaces ring-and-chord neighbors with a fixed chain. |
| Separation | Changes the outward neighbor contribution to steering. |
| Dot marks | Replaces connected trails with sampled point marks. |

`flock-steer-2d` calculates steering vectors; the example supplies graph edges, velocity integration, and drawing. It does not find neighbors, resolve collisions, or impose walls.
