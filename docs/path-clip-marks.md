# Clip field-generated paths to a region

It turns several precomputed paths into line segments, clips them to a notched region, and
draws only the parts inside. The outside movement remains available as a faint overlay.

[Install the Java library](building-java-from-source.md), then open **PathClipMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| N | Switches the notch shape and reclips the same paths. |
| C | Switches path colors. |
| O | Shows or hides the unclipped paths. |
| 0 | Restores the starting view. |
| S | Saves the displayed image. |

Generate positions with any path source, connect consecutive positions into segments, then clip
those segments. `sourceToPath` and `sourceToStep` identify each input segment; `sourceIndexAt`
identifies each returned piece. Use those values for path color, step marks, or other styling.
Draw returned pieces separately so excluded gaps stay open.

Changing the boundary clips the same movement again; it does not steer or regenerate a path.
Clipping trims mathematical centerlines, so a thick painted stroke can pass the edge. Use a
mask when you only need visibility, and retain clipped geometry until the source or boundary
changes. Advanced details are in [Java performance guidance](java-performance.md).
