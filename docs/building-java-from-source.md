# Installation help and custom builds

Start with the [README getting-started steps](../README.md#get-started). One installer
sets up the full Java library and all examples; no separate example packages are needed.

## Common questions

| Problem | What to do |
| --- | --- |
| Where should the library go? | Copy **Sketchbook location** from Processing Preferences and pass it to `--sketchbook`. The installer adds `libraries/procedurals` itself. |
| Python is missing or too old | Install Python 3.12 or newer. On Windows use `py -3`; on macOS or Linux use `python3`. |
| A download fails | Check your internet connection and run the command again. Completed downloads are reused only when their checksums match. |
| The library does not appear | Restart Processing, check that Java mode is selected, and confirm the sketchbook path matches the one you supplied. |
| I already have Java | Add `--java-home "/path/to/jdk-17"` to the installer command. Use a full JDK, including `javac` and `javadoc`. |
| I edited the old installed examples | Find the complete previous installation under `procedurals-backups` in your sketchbook. Keep future edits in your own saved sketch copies. |
| I want to uninstall | Close Processing and remove `libraries/procedurals` from your sketchbook. Your saved sketches and installation backups are separate. |

The installer downloads its build tools into `.work/installer` in the source checkout.
It does not change your system Java installation or install Processing itself.

## Supply every build input yourself

This is optional. Use it for an offline build after obtaining the inputs, or when managing
your own toolchains. The regular installer handles these details automatically.

```sh
python3 tools/build_java_source_bundle.py \
  --java-home /path/to/jdk-17 \
  --processing-core /path/to/core-4.5.6.jar \
  --font /path/to/GlyphMarks.ttf \
  --font-license /path/to/FONT-LICENSE.txt \
  --output .work/dist/my-java-build
```

Use a new output directory. Extract `procedurals-java-source-dev.zip` from that directory
into your sketchbook’s `libraries` folder. Move an existing `procedurals` folder aside
first, then restart Processing.

The builder checks the Processing core, font and complete license against
[`packages/java/source-bundle.json`](../packages/java/source-bundle.json). The installer’s
cached `core-4.5.6.jar`, `GlyphMarks.ttf` and `FONT-LICENSE.txt` are suitable inputs.
Both `procedurals.jar` and `procedurals-processing-adapter.jar` must stay in the installed
library. Compilation does not establish support for additional Processing versions or ports.
