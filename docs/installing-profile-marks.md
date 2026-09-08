# Install ProfileMarks on Processing Java

The local Java 0.7.0 archive is at
`.work/dist/cp7/final/procedurals-processing-0.7.0.zip`.

Extract the archive and place its `procedurals` folder in your Processing sketchbook's
`libraries` folder. Restart Processing and open `ProfileMarks`. The archive contains all
seven editable starters plus the core and Processing adapter JARs.

ProfileMarks requires the Processing 4 `P3D` renderer. Its two editable tabs are the PDE
drawing code and `ProfileComposition.java`. Start with `P` to change the profile, `D` to
change angular subdivisions and `C` to change colour. The
[workflow guide](profile-marks.md) explains the controls and substitution points.

The Java core, extracted package and installed P3D example have scoped validation. The
rendered run used Mesa software OpenGL, including its registered EGL/X11 diagnostics;
hardware coverage and the other platform ports of this operation remain unvalidated.
