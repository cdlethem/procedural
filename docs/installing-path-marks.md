# Install PathMarks 0.2.0

This local release adds retained gradient paths to the existing grid, field and palette
operations. Start with the [PathMarks guide](path-marks.md) for the composition and edits.
These artifacts are built locally; they have not been published to a package registry.
The earlier [FieldMarks 0.1.0 installer](installing.md) remains available separately.

Build once from a checkout using the commands below. Builders preserve an existing
output directory and stop instead of overwriting it. Generated archives belong under
`.work/dist/cp2/` and are not tracked in Git.

## Processing desktop

With JDK 17 and the pinned Processing 4.5.6 runtime/preprocessor available:

```sh
uv run python tools/build_path_marks_java.py --java-home /path/to/jdk-17
```

The builder uses `.work/toolchains/processing-4.5.6/` for the pinned preprocessor
dependencies. `--processing-core /path/to/core-4.5.6.jar` can select the same pinned
runtime elsewhere. This is currently a source-checkout build prerequisite, not a
self-installing toolchain command.

Extract `.work/dist/cp2/java/procedurals-processing-0.2.0.zip`. Put its `procedurals`
folder in your Processing sketchbook's `libraries` directory, replacing an older
Procedurals installation if present. Keep your edited sketches separately. Open
`examples/PathMarks/PathMarks.pde` in Processing and run it with JAVA2D.

The folder includes the core and adapter JARs plus three editable sources. The
[consumer check](../evidence/distribution/cp2-java.json) preprocesses and compiles
those extracted sources against the extracted JARs, verifies installed class origin,
and checks the path fixture and distance controls without another render.

## Browser

With Node and npm available:

```sh
node tools/build_path_marks_javascript.mjs
```

Extract `.work/dist/cp2/javascript/procedurals-path-marks-browser-0.2.0.zip`, enter
the `procedurals-path-marks-browser` directory, then run:

```sh
npm install
npm start
```

Open the printed localhost URL. Edit `path-marks.js` for the movement and mark
construction, and `sketch.js` for the controls. The starter includes its local
Procedurals tarball and installs pinned p5 2.3.2. Its internal drawing files are
versioned with this starter; they are not an additional stable public API.

The [consumer check](../evidence/distribution/cp2-javascript.json) installs that
tarball, checks its public path fixture and replay, loads the example's movement
module and verifies the browser import graph. Native behavior is established by the
separate [browser review](../evidence/reproductions/cp2-p5js/review.json).

## Python / py5

With Python, uv, JDK 17 and a display or Xvfb available:

```sh
uv run python tools/build_path_marks_python.py --java-home /path/to/jdk-17
```

Extract `.work/dist/cp2/python/procedurals-path-marks-python-starter-0.2.0.zip`.
Set `JAVA_HOME` to JDK 17, enter its `path-marks` directory, and use your chosen
Python environment:

```sh
python -m pip install "../procedurals_python-0.2.0-py3-none-any.whl[py5]"
python sketch.py
```

Edit `path_marks.py` for movement and marks. Saving writes `output/path-marks.png`
inside this starter. The [consumer check](../evidence/distribution/cp2-python.json)
installs the bundled wheel and pinned py5 extra, verifies installed module origins,
checks all four core operations and imports the extracted sketch without running
another render.

## Android

Build the 0.2.0 Java core first. With Java 17, Gradle 7.4.2, SDK platform 33,
build-tools 30.0.3 and the pinned Processing Android Mode core available:

```sh
uv run python tools/build_path_marks_android.py --build \
  --java-home /path/to/jdk-17 \
  --sdk /path/to/android-sdk \
  --gradle /path/to/gradle-7.4.2/bin/gradle \
  --processing-core /path/to/AndroidMode/processing-core.zip
```

Extract `.work/dist/cp2/android/procedurals-path-marks-android-0.2.0.zip` and
enter `procedurals-path-marks-android`. Its README gives the pinned Android Mode
download and checksums. Set `JAVA_HOME` to Java 17 and configure the SDK in
`local.properties` or `ANDROID_HOME`. Copy the verified Processing Android core
to a filename ending in `.jar`, then compile:

```sh
gradle -PprocessingCore=/absolute/path/processing-core.jar :app:assembleDebug
```

Android Gradle Plugin uses its ordinary local debug key. The archive includes the
Procedurals core and adapter JARs and four editable Java sources; the SDK, Processing
runtime and signing key stay external. Use your Android development tools to install
the resulting APK. Mode, Length and Palette retain paths; Count and Distance rebuild
them. Save PNG writes the cached image to Pictures/Procedurals.

The [consumer check](../evidence/distribution/cp2-android.json) compiles the extracted
project and checks its packaged core fixture. The source example has separate
[accepted API33 emulator evidence](../evidence/reproductions/cp2-android/review.json).

These installation checks and native reviews have defined runtime scopes. They are
not a recorded human installation study or full-corpus pixel reproduction.
