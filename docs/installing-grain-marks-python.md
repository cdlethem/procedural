# Install GrainMarks for py5

Build a fresh local wheel and extracted starter:

```sh
python3 tools/build_grain_marks_python.py --output .work/dist/cp5/python-grain1
```

Extract `procedurals-grain-marks-python-starter-0.5.0.zip`, enter `grain-marks`, set
`JAVA_HOME` to JDK 17, and run:

```sh
python -m pip install "../procedurals_python-0.5.0-py3-none-any.whl[py5]"
python sketch.py
```

The builder checks installed-wheel origin, all nine portable operations, six complete
retained GrainMarks geometry configurations, archive bytes, and an import-only py5
starter load. It does not launch or render a sketch.

R changes seed, N density, B distribution, X transfers grain to cells, M selects dots or
strokes, C changes palette, 0 resets the example, and S saves under `output/`.

The [package review](../evidence/distribution/cp5-python-review.json) accepts the local
wheel/starter. The separate [native review](../evidence/conformance/triangle-py5-native-root-review.json)
covers editing and cached saving. No registry publication or source-sketch recreation
is claimed.
