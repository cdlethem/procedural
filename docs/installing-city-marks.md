# Install CityMarks on Processing Java

Extract `.work/dist/r2/java/procedurals-processing-0.13.0.zip` into the libraries folder
of your Processing sketchbook and restart Processing. Open CityMarks from the library
examples. Desktop Processing4 and P3D/OpenGL are required. This local archive includes
14 operations and13 starters; it is not a registry publication.

From this checkout, stage and compile into a fresh directory:

```sh
python3 tools/prepare_city_marks.py --output .work/examples/my-city-build
```

Open CityMarks/CityMarks.pde there. C changes colour, H changes height, R changes seed,
0 resets and S saves the completed canvas. See [the guide](city-marks.md) for composition
and fidelity details. The core JAR is unchanged from Java0.12.
