# Build the Java library from source

The accepted Java0.35.0 source bundle contains31 operations and37 editable workflows.
Its archive identity and extracted-consumer validation are recorded in the
[ContactMarks distribution review](../evidence/distribution/contact-java-review.json).
Building a changed checkout produces a development build until separately reviewed.

Start with [the workflow chooser](choosing-java-workflow.md), then use
[the composition guide](composing-java-effects.md) to combine region callbacks, image
snippets, masks, image-derived controls and filtering. The archive includes source-derived
Java reference pages for core and Processing adapter classes in `reference/index.html`.
Build reports record assembly; distribution acceptance requires a separate root review.

Supply Python 3.11 or newer, a JDK supporting `javac --release 8`, the audited
Processing 4.5.6 `core.jar`, the accepted GlyphMarks DejaVu Sans font,
and its complete license notice. Fonts and toolchains are external inputs, not tracked
project assets. The font is needed to preserve the complete starter bundle; it is not
silently omitted or replaced by a system fallback.

```sh
python3 tools/build_java_source_bundle.py \
  --java-home /path/to/jdk \
  --processing-core /path/to/processing/core.jar \
  --font /path/to/GlyphMarks.ttf \
  --font-license /path/to/FONT-LICENSE.txt \
  --output .work/dist/my-java-source-build
```

Use a fresh output directory each time. The source build requires no prior local
release archive, staged Processing sketch or running native renderer. Processing core is
a compile-time input for the separate desktop adapter; it is not bundled into the library. Read the generated report for
input hashes, archive identity and acceptance scope. The command above creates
`.work/dist/my-java-source-build/procedurals-java-source-dev.zip`. You can install this
development bundle for editing; building changed sources does not grant them new reviewed
support claims. Use the sketchbook location shown in Processing Preferences:

```sh
mkdir -p /path/to/your/sketchbook/libraries
unzip .work/dist/my-java-source-build/procedurals-java-source-dev.zip \
  -d /path/to/your/sketchbook/libraries
```

If a `procedurals` library is already installed, move that directory aside first so old
files do not mix with the new bundle. Restart Processing. Open File → Examples → Contributed Libraries → Procedurals →
FieldMarks, then save a copy into your own sketch folder before editing. The archive
contains both `library/procedurals.jar` and `library/procedurals-processing-adapter.jar`;
keep both. Continue with [the field-marks edits](getting-started.md).

The required font SHA256 is
`b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c`;
the license notice SHA256 is
`63d3ba759d12804c5b31a9d5940d855c1820d1f5999e6b0872eb1c7ff045fbc9`.
These identities come from the accepted GlyphMarks distribution evidence. A differently
packaged notice or different font version needs review rather than a weakened hash check.

Compilation and packaging do not establish new renderer support. Current accepted behavior
and target scope remain in `catalog/validation/`; the source builder must preserve those
boundaries. Native checks, when needed, use the shared machine render-lock wrapper described
in [the porting handoff](porting-handoff.md).

The audited Processing core SHA256 is
`88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4`.
Use the core JAR from the corresponding Processing 4.5.6 distribution. Other versions
need review; selecting any installed Processing version is not equivalent.

The font and complete notice were obtained from `fonts-dejavu-core` version
`2.37-8build1`, as recorded in [the font provenance audit](../design/capabilities/cp8-font-environment-audit.md).
On a machine with those exact packaged bytes, pass these files directly (renaming is unnecessary):

```sh
python3 tools/build_java_source_bundle.py \
  --java-home /path/to/jdk \
  --processing-core /path/to/processing/core.jar \
  --font /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf \
  --font-license /usr/share/doc/fonts-dejavu-core/copyright \
  --output .work/dist/my-java-source-build
```

Those system paths are a verified source location, not portable defaults. On another OS,
supply the matching extracted package files or the font and notice from an accepted
Java bundle's `examples/GlyphMarks/data/` directory. A generic DejaVu download may have a
differently packaged notice. Automated acquisition of these exact external inputs is not
yet provided; the build checks their hashes before creating output.
