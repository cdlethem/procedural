# CP8 font environment audit

**Scope.** This is a local, Java-only environment audit for a possible
GlyphMarks workflow. It neither adds a font asset nor asserts a renderer,
operation, package, or fallback policy. The font evidence below is a reproducible
candidate for a later declared capability, not permission to rely on the host's
font selection.

## Local candidate font and license evidence

The installed package `fonts-dejavu-core` is version `2.37-8build1` and owns the
following file:

| Field | Observed value |
| --- | --- |
| file | `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` |
| SHA-256 | `b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c` |
| size | 759,720 bytes |
| Fontconfig family / full name | `DejaVu Sans` / `DejaVu Sans` |
| PostScript name | `DejaVuSans` |
| Fontconfig charset evidence | `20-7e` (therefore includes ASCII `0`--`9` and `A`--`Z`) |
| local licence record | `/usr/share/doc/fonts-dejavu-core/copyright` |
| licence-record SHA-256 | `63d3ba759d12804c5b31a9d5940d855c1820d1f5999e6b0872eb1c7ff045fbc9` |

The local Debian copyright record identifies the files as DejaVu fonts and
labels their licence `bitstream-vera`. It grants reproduction and distribution
of the font software provided the copyright/trademark notices and permission
notice are retained; it also imposes its stated renaming condition on modified
fonts. This is local evidence for a future redistribution review, not a copied
asset: this audit does not stage or package the TTF.

The absolute `/usr/share` path is an observation about this build host only. A
workflow that requires metrics or glyph identity cannot treat that path or the
fontconfig family name as a portable dependency; a later Java-only distribution
would need to declare and ship a byte-identified font asset with its licence
notice, or explicitly report the feature unavailable.

## Processing 4.5.6 surface found locally

The pinned desktop core is
`.work/toolchains/processing-4.5.6/core-4.5.6.jar`, SHA-256
`88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4`.
The matching portable Processing archive has SHA-256
`ddb816ca2c02e862a5dcf22b96bb4f81f412c4878673752b36837a7770970a6c`.
The local inspection used Temurin `17.0.20.1+1` and its `javap`.

`javap` against that core JAR exposes these relevant APIs:

```text
PApplet.createFont(String, float, boolean)
PApplet.createFont(String, float, boolean, char[])
PApplet.loadFont(String)
PApplet.textFont(PFont[, float])
PApplet.textAlign(int[, int])
PApplet.textWidth(char | String | char[], int, int)
PApplet.text(char | String | char[] ...)

PFont(Font, boolean)
PFont(Font, boolean, char[])
PFont.getFont()
PFont.getGlyph(char)
PFont.getShape(char[, float])
PFont.width(char), ascent(), descent(), kern(char, char)
```

The same local bytecode inspection shows that `PFont.findFont(String)` constructs
a Java `Font` from the requested name and emits a warning if the result resolves
to the system default. It still returns that font. Therefore a workflow whose
metrics matter must not treat `PApplet.createFont("DejaVu Sans", ...)` as a
successful asset preflight: a missing family could produce a plausible fallback.

The public `PFont(java.awt.Font, boolean, char[])` constructor makes a
Java-only explicit-asset adapter feasible: parse known bytes into `java.awt.Font`
with the JDK, construct a `PFont` from that font and a declared character set,
then use the ordinary `PApplet.textFont`, alignment, width, and draw calls. This
uses `java.desktop` and Processing's native text path, so it is an adapter
capability rather than portable core behavior. `PFont.getShape` exists in the
local API but was not exercised here and does not establish a contour contract.

## Proposed preflight for a later GlyphMarks workflow

This is a suggested reproducible sequence, not implemented code or a public
error contract.

1. Before constructing a renderer, read the **declared packaged asset** as
   bytes; reject missing, unreadable, or hash-mismatched bytes. Do not discover
   a family through fontconfig and do not call `createFont(String, ...)` as the
   asset check.
2. Parse those bytes with `java.awt.Font.createFont(Font.TRUETYPE_FONT, stream)`.
   Require a valid font and check `canDisplayUpTo("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
   == -1`. The local DejaVu candidate satisfies this coverage through its
   advertised `20-7e` charset; the runtime check verifies the actual staged
   bytes instead of trusting the host inventory.
3. Construct `new PFont(parsedFont, true, requiredChars)`. Check that
   `getFont()` is present and that each required character has a non-null
   `getGlyph(char)` before a drawing workflow is admitted. Record the asset
   hash, Java runtime version, Processing core hash, declared charset, and
   parsed font names in the preflight result.
4. In the actual Processing adapter setup, call `textFont(theVerifiedPFont,
   requestedSize)` and the required `textAlign` form explicitly. A subsequent
   native integration test must check the real draw path, origin/alignment,
   alpha compositing, and state isolation. This audit performs no renderer
   launch and makes none of those claims.

The failure exercise should use a deterministic staging directory that omits the
declared asset (and separately a byte-altered copy) and assert a stable
adapter-level missing/invalid-font result before `textFont` or `text()` is
called. A second negative fixture should use a valid font with a requested
character outside its declared coverage. These checks are stronger than asking
Processing to resolve a deliberately absent family name, because the latter is
documented by the local bytecode to permit a warning-and-default-font path.

## Capability boundary and remaining evidence

| Category | What this audit supports | What it does not support |
| --- | --- | --- |
| Required Java adapter capability | A byte-identified TTF, `java.desktop`, Processing 4.5.6 `PFont` construction, and text emission APIs. | Browser, py5, Android, or a font fallback claim. |
| Portable core | Explicit strings, positions, colors, and command ordering could remain plain data. | `PFont`, AWT `Font`, font paths, glyph metrics, or renderer contexts. |
| Native verification still needed | Actual text draw, alignment/baseline behavior, glyph appearance, renderer-state isolation, and missing-asset result. | Any pixel, contour, metric, or cross-target equivalence claim. |

The typography audit records four surveyed reports where a requested face fell
back during observation (`helve1`, `textureGridText`, `numbers`, and `salchis`).
That makes an explicit asset preflight material to a future Java workflow rather
than incidental environment hygiene. It remains unresolved whether a future
artist task needs only reproducible raster text, needs measurable metrics, or
needs geometry extraction; only the first has an identified local runtime route
here.
