# Install LandscapeMarks on Processing Java

Extract `.work/dist/r3/java/procedurals-processing-0.14.0.zip` into your Processing
sketchbook's libraries folder and restart Processing. Open LandscapeMarks from the library
examples. Desktop Processing4 with P2D/OpenGL is required. This local archive contains
14 operations and14 editable starters; it is not a registry publication.

From the checkout, stage and compile into a fresh directory:

```sh
python3 tools/prepare_landscape_marks.py --output .work/examples/my-landscape-build
```

Open LandscapeMarks/LandscapeMarks.pde there. C changes colours, P changes stripe spacing,
R changes seed,0 resets and S saves the completed canvas. See [the guide](landscape-marks.md).
The core JAR remains byte-identical to the accepted Java0.13 package.
