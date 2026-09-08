# Build the Java library from source

The source-bundle builder assembles Java0.15 directly from the checked-in sources.
Root verified a clean-checkout build against the accepted Java0.15 class, example-tab and
font payloads; see `evidence/distribution/java-source-bundle-review.json`. Each generated
report still records assembly rather than automatically approving future changed inputs.

Supply a JDK supporting `javac --release 8`, the accepted GlyphMarks DejaVu Sans font,
and its complete license notice. Fonts and toolchains are external inputs, not tracked
project assets. The font is needed to preserve the complete15-starter bundle; it is not
silently omitted or replaced by a system fallback.

```sh
python3 tools/build_java_source_bundle.py \
  --java-home /path/to/jdk \
  --font /path/to/GlyphMarks.ttf \
  --font-license /path/to/FONT-LICENSE.txt \
  --output .work/dist/my-java-source-build
```

Use a fresh output directory each time. The source build requires no prior local
release archive, staged Processing sketch or native renderer. Read the generated report for
input hashes, archive identity and acceptance scope. To install a reviewed bundle, extract
its `procedurals` directory into your Processing sketchbook's `libraries` directory and
restart Processing.

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
