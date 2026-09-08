# Install LatticeMarks on Processing Java

LatticeMarks is the eleventh editable starter in the local Java0.11.0 package. Its occupied
lattice path core and Processing4 JAVA2D workflow have scoped acceptance; ports remain deferred.

Extract `.work/dist/cp11/java-final/procedurals-processing-0.11.0.zip` and place its `procedurals`
folder in your Processing sketchbook's `libraries` folder. Restart Processing and open
LatticeMarks from the library examples. This is a local archive, not a registry release.

From a checkout, you can also stage and compile a standalone example:

```sh
python3 tools/prepare_lattice_marks.py --output .work/examples/my-lattice-build
```

Open `LatticeMarks/LatticeMarks.pde` inside that fresh output directory in Processing4.
The staging tool checks official PDE preprocessing and compilation. It preserves previous
attempts and requires a new output path each time.

Press **C** for palette, **M** for connected paths or dots, and **W** for stroke width;
these retain the arrangement. **L** changes move limit, **N** changes start count, and
**R** changes seed. **0** resets; **S** saves the displayed canvas. Edit the start layout
in `LatticeComposition.java` and the drawing helpers in the PDE.

Longer paths can occupy later starts, reducing the number of visible paths. The
[LatticeMarks guide](lattice-marks.md) explains this interaction and the authored settings.
The [workflow review](../evidence/reproductions/cp11-java2d/root-review.json) records native
and visual acceptance for640×640 JAVA2D at density1. No source-pixel equivalence is claimed.
