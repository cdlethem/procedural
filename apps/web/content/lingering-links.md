# Lingering links

A moving constellation keeps links after pairs drift apart. The study replays the same authored 48-point motion from tick zero, queries nearby pairs, then advances contact history by caller ID. The link age and missing-step count affect drawing only.

| Control | Canvas effect |
| --- | --- |
| Ticks | Extends deterministic motion and contact history. |
| Radius | Changes the supplied proximity graph at every replayed tick. |
| Linger | Changes how long absent links remain visible. |
| Dot marks | Replaces link strokes with marks at their midpoints. |

The adapter calls `radius-pairs-2d` and `contact-history-2d`. It supplies no automatic identity tracking or opacity law beyond this editable composition. Palette changes redraw the retained result without advancing time.
