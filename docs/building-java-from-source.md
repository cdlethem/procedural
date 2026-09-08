# Build the Java library from source

The source-bundle builder assembles Java0.23 directly from the checked-in sources, including
23 operations and 23 editable starters. PullMarks adds localized geometry warping; DepthMarks adds 3D fields and mesh coloring. PanelMarks adds irregular retained panels to the
closed-curve, noise-band, field, path, mesh and other workflows. The Java0.23 artifact
review is recorded in `evidence/distribution/cp20-java-review.json`. Each generated report records assembly
rather than automatically approving future changed inputs.

Supply Python 3.11 or newer, a JDK supporting `javac --release 8`, the audited
Processing 4.5.6 `core.jar`, the accepted GlyphMarks DejaVu Sans font,
and its complete license notice. Fonts and toolchains are external inputs, not tracked
project assets. The font is needed to preserve the complete23-starter bundle; it is not
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
input hashes, archive identity and acceptance scope. To install a reviewed bundle, extract
its `procedurals` directory into your Processing sketchbook's `libraries` directory and
restart Processing. Open File → Examples → Contributed Libraries → Procedurals →
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
