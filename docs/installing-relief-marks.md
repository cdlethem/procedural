# Install ReliefMarks on Processing Java

The local Java0.12.0 archive is
`.work/dist/r1/java/procedurals-processing-0.12.0.zip`. Extract its `procedurals` folder
into the `libraries` folder of your Processing sketchbook, restart Processing, and open
ReliefMarks from the library examples. It requires desktop Processing4 and P3D/OpenGL.
The archive includes14 operations and12 starters; it is not a registry publication.

From a checkout, stage and compile the accepted example into a fresh directory:

```sh
python3 tools/prepare_relief_marks.py --output .work/examples/my-relief-build
```

Open `ReliefMarks/ReliefMarks.pde` inside that directory. This uses the accepted Java0.11
core JAR unchanged: the recreation adds an example, not a new algorithm implementation.

C changes colour, H changes relief height, R changes seed,0 resets, and S saves the completed
canvas. The [guide](relief-marks.md) explains how to edit the composition and the declared
structural fidelity limits. The PDE carries the upstream MIT notice for its translated face
pattern. Other platform ports and source-pixel equivalence are not claimed.
