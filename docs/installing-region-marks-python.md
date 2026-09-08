# Install RegionMarks for py5

Build the local Python0.4 wheel and starter in a prepared checkout:

```sh
python3 tools/build_region_marks_python.py --output .work/dist/cp4/python-region2
```

Use a fresh output directory. The builder uses uv, JDK17 and Xvfb for its isolated
installed-wheel and starter-import checks. Extract the generated
`procedurals-region-marks-python-starter-0.4.0.zip`, enter `region-marks`, set `JAVA_HOME`
to JDK17 and follow the included README:

```sh
python -m pip install "../procedurals_python-0.4.0-py3-none-any.whl[py5]"
python sketch.py
```

The wheel extra pins py5 to0.10.11a0. Dependency installation needs network access or
cached packages. The archive includes notices and editable composition/sketch sources;
it excludes Java, environments and rendered images.

R changes the seed, N the split count, G the selection fraction, X seeded/authored cells,
M single/grid marks, C palette and S saves the displayed frame under `output/`. R/N/G
are ignored for authored cells; M/C retain the layout. Edit `region_marks.py` for cells
and `sketch.py` for content. These settings are example choices, not recommended ranges.

Use the operation directly with:

```python
from procedurals.quadrant_partition import seeded_quadrant_partition_2d, PartitionError
```

The [packaging review](../evidence/distribution/cp4-python-review.json) covers installed
module identity, geometry and extracted-starter import. The separate
[native review](../evidence/conformance/quadrant-py5-root-review.json) covers the reviewed
py5 drawing workflow. Packaging adds no new native render or registry release claim.
