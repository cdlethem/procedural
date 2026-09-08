# ProfileMarks Python package

Python0.7.0 packages eleven operations and the ProfileMarks py5 P3D starter. This is a
reviewed local wheel/starter distribution, not a registry release. Android ProfileMarks
support remains pending.

Build with the repository's existing uv/Python infrastructure:

```sh
python3 tools/build_profile_marks_python.py --output .work/dist/cp7/python-profile-new
```

Use a fresh output directory. The builder produces a wheel and
`procedurals-profile-marks-python-starter-0.7.0.zip`, installs the bundled wheel in an
isolated environment and compares twelve complete meshes with the source example.
It records py5 class loading as a separate pending check. To perform that check using
an installed JDK17 and Xvfb, without creating a sketch:

```sh
python3 tools/with_native_render_lock.py --timeout 120 -- xvfb-run -a \
  python3 tools/check_profile_python_starter.py \
  --build .work/dist/cp7/python-profile-new \
  --output .work/validation/profile-python-import-new \
  --java-home /path/to/jdk17
```

Extract the starter ZIP, set `JAVA_HOME` to JDK17 and enter `profile-marks`:

```sh
python -m pip install "../procedurals_python-0.7.0-py3-none-any.whl[py5]"
python sketch.py
```

The validated runtime uses Python3.13 and pinned py5 0.10.11a0. Installation requires
access to py5 and its dependencies; runtimes and rendered assets are not bundled.

P selects a form, D changes subdivisions, B/T toggle caps, C changes palette, X shows
all three forms, 0 resets and S saves the acknowledged image. Edit
`profile_composition.py` to supply increasing axial/radius pairs. The package root exposes
`RadialProfile3D` and `RadialProfileError`; example choices are not measured recommendations.

Acceptance: `evidence/distribution/profile-python-review.json`. Native workflow evidence
is separate from archive and import checks. No cross-renderer pixel identity or original
sketch recreation is claimed.
