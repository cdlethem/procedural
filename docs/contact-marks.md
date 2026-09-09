# Stop strokes at their first obstacle

The sketch draws colored strokes toward a four-sided outline. Each stroke stops at the first
edge it reaches, with a dot marking the meeting point. Faint lines show where the strokes would
continue without the obstacle.

[Install the Java library](building-java-from-source.md), then open **ContactMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| N | Moves one outline corner, changing where the strokes stop. |
| C | Changes the stroke and endpoint-dot colors without moving them. |
| 0 | Restores the starting composition. |
| S | Saves the displayed image. |

## Use it in your own drawing

Supply the strokes you want to draw and the lines that should stop them. Call
`NearestSegmentContact2D.find(config)`, then use `hitAt(i)` to find where stroke `i` first
meets an obstacle. Draw from that stroke’s start to the returned `x, y` position.

| Input | What it means for your picture |
| --- | --- |
| `queries` | Your proposed strokes, each `[startX, startY, endX, endY]`. The order of the two endpoints sets the drawing direction. |
| `obstacles` | The lines that stop strokes, in the same coordinate system. A polygon can be supplied as its individual edges. |
| `maxWork` | The allowed number of stroke–obstacle comparisons. Allow at least the number of strokes multiplied by the number of obstacles. This controls work, not appearance. |

A result gives the meeting point and `obstacleIndex`, which identifies the edge that was hit.
Use that index to color strokes by the edge they reach. If there is no contact, `hitAt(i)`
returns `null`; choose whether to omit that stroke or draw its full length.

A stroke that already touches an obstacle stops immediately at its starting point. Its far
endpoint also limits its reach: this does not extend short strokes into infinite rays. Leave
lines sharing a starting point out of one another’s obstacle lists if you do not want them to
stop each other there.

The endpoint limits the line’s center, not its painted width: thick strokes and endpoint dots
can cross the edge. For a drawing visible only inside a polygon, use [ClipMarks](clip-marks.md)
or a [mask](mask-marks.md). Calculate intersections when geometry changes and reuse them for
color edits; see [performance guidance](java-performance.md) for larger drawings.
