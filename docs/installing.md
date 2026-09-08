# Install the first field-marks slice

The local builders produce artifacts and editable starters without publishing to a
registry. Start with the [field-marks guide](getting-started.md) for the composition and
which edits to try. The package currently supplies regular grid, gradient noise and
cyclic palette operations; the starter owns the composition and mark treatment.

## Processing desktop

With a JDK and the Processing 4.5.6 desktop core JAR available:

```sh
python3 tools/build_java_artifacts.py --processing-core /path/to/processing/core.jar
```

Use `--java-home /path/to/jdk` if needed. The builder produces the core JAR, separate
desktop-adapter JAR and `procedurals-processing-0.1.0.zip` under `.work/dist/java/`.
Extract the ZIP's `procedurals` folder into your Processing sketchbook's `libraries`
directory. The folder contains `library.properties`, both library JARs, notices and
`examples/FieldMarks`. Open that example in Processing. Copy it into your own sketch
folder before editing.

Edit the constants in `FieldMarks.pde`. `MarkField.java` samples and retains the field;
`MarkCommands.java` constructs the marks and draws through this version's internal
adapter. Change `mark()` there to invent another treatment. Press S to save. The core-only
builder invocation, without `--processing-core`, instead packages the older direct
Processing example and omits the adapter; use the command above for the shared drawing route.

The packaged command starter passes official PDE preprocessing, compilation against its
extracted JARs, and four exact CP1 command comparisons. See
[consumer evidence](../evidence/distribution/java-starter.json). This is not a recorded
human IDE-installation or usability study.

## Browser

With Node, npm and the `zip`/`tar` commands available:

```sh
node tools/build_javascript_artifacts.mjs
```

Extract `.work/dist/javascript/procedurals-field-marks-browser-0.1.0.zip` into your project
directory, enter `procedurals-field-marks-browser`, then run:

```sh
npm install
npm start
```

Open the printed localhost URL. Edit the top-level `mark-field.js` and `sketch.js`, not
files under node_modules. The ZIP includes the local package tarball and dependency lock;
installation obtains pinned p5 from npm. The three internal drawing files under
`vendor/drawing` belong to this exact starter version and are not a stable public API.

## Python / py5

With Python, `uv`, Java 17, and a display (or Xvfb for the builder's import check):

```sh
python3 tools/build_python_artifacts.py --java-home /path/to/jdk-17
```

Extract `.work/dist/python/procedurals-field-marks-starter-0.1.0.zip` into your project
directory. It bundles the wheel alongside `field-marks/`. In your chosen Python
environment, enter `field-marks` and follow its README to install the adjacent wheel with
the `[py5]` extra. Set JAVA_HOME to Java 17, then run `python sketch.py`.

L changes length, P changes palette, B changes mark shape and S saves into the starter's
local `output/` directory. The starter imports the installed wheel; it has no dependency
on the repository layout. The [consumer check](../evidence/distribution/python.json)
installs the bundled wheel and real py5 extra in an isolated environment and loads the
extracted starter without running another render.

## Android

First build the portable core JAR with `python3 tools/build_java_artifacts.py` if you do
not already have it. With Java 17, Gradle 7.4.2, SDK platform33 and build-tools30.0.3:

```sh
python3 tools/build_android_artifacts.py \
  --java-home /path/to/jdk-17 \
  --sdk /path/to/android-sdk \
  --gradle /path/to/gradle-7.4.2/bin/gradle \
  --processing-core /path/to/AndroidMode/processing-core.zip \
  --core-jar .work/dist/java/procedurals-core-0.1.0.jar
```

The output is `.work/dist/android/procedurals-field-marks-android-0.1.0.zip`. Extract it
into your project directory. It includes the portable core and Android adapter JARs, four
editable example Java files, Gradle files and notices. It contains no SDK, runtime core,
build cache or signing key.

Follow the included README's public download URL and checksums for Android Mode4.6.0's
core. Copy its `processing-core.zip` to a file named `processing-core.jar` without changing
the bytes: Gradle needs the JAR extension. Configure your SDK with `local.properties` or
ANDROID_HOME, set JAVA_HOME to Java17, and compile inside the extracted project:

```sh
gradle -PprocessingCore=/absolute/path/processing-core.jar :app:assembleDebug
```

Use the resulting APK with your Android development tools. Android requires its own
Processing core, not the desktop Processing JAR. Length, Palette and Marks edit the
retained field; Save PNG writes its current640×640 snapshot to Pictures/Procedurals.
The [artifact consumer check](../evidence/distribution/android.json) compiles this extracted
project using external runtime dependencies. The separate [native review](../design/android-native-review.md)
covers the pinned API33 emulator; other device/runtime configurations remain unverified.
