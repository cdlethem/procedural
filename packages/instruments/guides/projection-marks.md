# Project paths away from discs

Arrange rows, columns or spokes and push their sampled paths away from one or two ordered discs. Disc placement is independent of the source paths: moving a disc changes projection, not the original path arrangement. Only the resulting strokes are painted, leaving outside regions transparent.

| Control | Canvas effect |
| --- | --- |
| Source paths / Paths | Rows, columns or spokes and the number of independent source paths. |
| Source jitter | Seeded perpendicular variation in the starts; zero preserves an ordered family. |
| Discs | Apply only the first disc or apply two in order. |
| Disc center X/Y and radius | Move and resize each projection's area of influence. Second-disc controls matter with two discs. |
| Projection strength | Scale the displacement; zero leaves the source paths unprojected. |
| Stroke weight / Palette | Change ink without moving projected path geometry. |

For two nested interruptions, start with evenly spaced rows (Jitter zero), place a large disc just off center, then a smaller one toward the upper edge. Raise Projection strength gradually to see how the discs redirect nearby samples. Swap Rows for Columns with the same disc configuration to compare directional effects. The second projection acts on the result of the first, so swapping centers is not generally equivalent. The released sequential-disc-projection operation moves the samples; source arrangement and mark treatment are instrument decisions.
