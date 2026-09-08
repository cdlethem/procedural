# PathMarks (py5)

This editable CP2 starter traces 24 retained paths from a 6×4 grid, then draws either every movement segment or perpendicular endpoint marks. It is motivated by `ciserp`, `mantel`, `natalata`, and `limo002`; it does not reproduce their simplex fields, closures, branches, or source pixels.

From a repository checkout with Python, Java 17, and py5 available:

```sh
PYTHONPATH=packages/python python packages/python/examples/path_marks/sketch.py
```

The sketch is 640×640 at density 1 with a fixed background. Its controls are:

- `M`: movement trace / perpendicular marks
- `L`: mark length 12 / 24
- `C`: base / alternate palette
- `N`: 2,000 / 2,001 advances; rebuilds paths
- `D`: distance 0.4 / 0.8; rebuilds paths
- `S`: save the already displayed canvas to `output/path-marks.png`

`M`, `L`, and `C` repaint from the same retained `PathMarks` object. `N` and `D` are movement controls and construct replacement paths. Commands are generated in batches and never retained as one command list.

The movement and raw mark stream remain unchanged. For this fixed 640px starter,
the drawing route omits only a segment whose complete bounding box misses the canvas
padded by one pixel (`[-1,641]²`). It does not clip, clamp, or change retained paths;
validation records raw and submitted counts separately.

The composition constants are choices for this piece. They are not defaults or recommended ranges for `path.gradient-trace-2d`.
