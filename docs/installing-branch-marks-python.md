# Install BranchMarks for py5

In a prepared checkout, build a fresh local package:

```sh
python3 tools/build_branch_marks_python.py --output .work/dist/cp6/python-branch3
```

Extract `procedurals-branch-marks-python-starter-0.6.0.zip`. With Python3.13 and JDK17
available, set `JAVA_HOME` to that JDK, enter `branch-marks`, then run:

```sh
python -m pip install "../procedurals_python-0.6.0-py3-none-any.whl[py5]"
python sketch.py
```

R/N/G/W/B/X change seed, depth, narrowing, spread, slot count and forest roots. M/C
change taper/tips and palette while retaining geometry. 0 resets; S saves under `output/`.
Edit `branch_composition.py` for growth and `sketch.py` for native mark treatment.

Ten operations are exported, including `seeded_endpoint_branches_2d` and `BranchTreeError`.
The [package review](../evidence/distribution/cp6-python-review.json) covers module bytes,
installed consumers and extracted import. The [native review](../evidence/conformance/branch-py5-native-root-review.json)
covers17 editing states. This local distribution does not claim registry publication.
