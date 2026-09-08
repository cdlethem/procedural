# Install BranchMarks on Processing Java

Extract `.work/dist/cp6/java/procedurals-processing-0.6.0.zip`.
Place its `procedurals` folder in your Processing sketchbook's `libraries` folder. Restart
Processing, then open the supplied `BranchMarks` example. The archive includes all six starters and both the core and Processing adapter JARs.

The example has two editable tabs: the PDE drawing code and `BranchComposition.java`.
Start by running the unmodified piece, then use `N` to add a generation or `M` to change
the marks. `C` and `M` reuse the retained geometry. The [workflow guide](branch-marks.md)
explains the controls and where to change rules or drawing code.

BranchMarks0.6 also has reviewed local packages for [p5.js](installing-branch-marks-javascript.md),
[py5](installing-branch-marks-python.md) and [Android](installing-branch-marks-android.md).
Native support remains scoped to the tested runtimes in the
[operation reference](reference/operations.md); no source-pixel recreation is claimed.
