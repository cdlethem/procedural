# Make a field of marks

To start from an empty sketch, use the [direct Java API guide](java-api.md), which
includes a complete grid-and-palette example without starter-specific tabs.

For another kind of piece, [choose a Java starting point](choosing-java-workflow.md).

Start with a working piece, then change its length, palette or mark. The example
uses three operations: a regular grid supplies positions, a seeded field supplies
spatial attributes, and a cyclic palette supplies colours. Drawing remains ordinary
Processing code that you can change.

Build and install the current Java package using the
[source-bundle guide](building-java-from-source.md). It lists the required external inputs.
Open its **FieldMarks** library example in Processing 4 and save a copy into your own
sketch folder. Keep both installed library JARs: this example uses the desktop drawing
adapter as well as the portable core. Press **S** to save the current image.

The packaged example has passed official preprocessing, compilation, JAVA2D execution
and a programmatic save-handler check; this has not yet been a human usability test.

In the first tab, try these edits one at a time and run again:

| intention | change | what stays fixed |
|---|---|---|
| Make longer strokes | `MAX_LENGTH = 32` | spacing, positions, headings and colour samples |
| Recolour the piece | replace `COLORS` with the alternate list in the comment | mark geometry |
| Use heavier marks | `DRAW_BARS = true` | positions, headings, lengths and colours |

Save your edits with distinct filenames and use [a contact sheet](comparing-variants.md)
to compare them side by side.

The example's constants describe this piece, not universally useful ranges. Keeping
the seed fixed makes reruns repeatable. A palette phase of one means one full trip
through the palette, regardless of how many entries it contains; repeated colours
still occupy entries.

Open the `MarkField.java` tab to go further. `create()` makes and retains the five
attributes; its frequency and coordinate offsets are visible there. In `MarkCommands.java`,
`paint()` applies the chosen palette and length, while `mark()` is the small method to
replace when you want a different mark. Length is the total endpoint-to-endpoint extent.
The arrays belong to your example and can be inspected or edited. Repainting does not
sample the field again. The drawing adapter is internal to this starter's matched package.

The field-marks mechanism comes from
[pelines](../survey/out/2018/Generativos/pelines/notes.md). This new piece deliberately
uses a different noise algorithm, canvas, opacity and background, and separates
spacing from maximum length. It is not an exact copy of that sketch. The independent
colour-progression edit also has evidence in
[mountain4](../survey/out/2018/Generativos/mountain4/notes.md).

The measured four-variant JAVA2D check is recorded in the
[validation result](../evidence/reproductions/cp1-java2d/result.json). The check uses
the actual Java drawing tab. See the [inspection decision](../evidence/reproductions/cp1-java2d/decision.md)
for what passed and the remaining target limits. The separate
[PDE lifecycle record](../evidence/reproductions/cp1-java2d/pde-result.json) checks the
example's source through the official preprocessor. These historical validation runs
have consumed their registered render budgets; use the editable sketch above to make
your own work rather than rerunning the validation tool.

For the browser development example, from the repository root run:

```sh
node tools/serve_field_marks.mjs
```

Open the printed localhost URL. Length, palette and mark controls reuse the retained
field; **Save PNG** downloads the current canvas. The first run installs pinned p5 into
the repository's ignored runtime directory if needed. Node and npm are required.
See the [browser example](../packages/javascript/examples/field-marks/README.md) for
the source-editing path. The actual page's four edits match the accepted CP1 pixel
hashes, and its PNG download matches the displayed canvas; see the
[UI validation](../evidence/conformance/p5js-ui.json).

For the Python development example, use an environment with py5 0.10.11a0 and
Java 17, then run:

```sh
python packages/python/examples/field_marks/sketch.py
```

Focus the window and press **L** for length, **P** for palette, **B** for bars,
or **S** to save. The [py5 example README](../packages/python/examples/field_marks/README.md)
explains the source edits and output location. Its actual setup, programmatic edit
handlers and saved PNG pass [native validation](../evidence/conformance/py5-adapter-ui.json).
The adapter also passes scoped failure-path and interruption validation, with
[independent review](../design/py5-adapter-review.md).

The Android checkout example has the same independent Length, Palette and Marks controls;
**Save PNG** exports its current 640×640 image to Pictures/Procedurals. With the pinned
[Android prerequisites](../design/android-native-prerequisites.md) installed, build it with:

```sh
python3 tools/prepare_android_field_marks.py --build
```

The [example README](../packages/java-android/examples/FieldMarks/README.md) identifies the
generated project and source files. Its actual eight-state edit sequence and cached-image
export passed on the pinned API33 emulator, with
[scoped independent review](../design/android-native-review.md). This checkout command
uses the repository's local toolchains; standalone installation is covered by the
[installation guide](installing.md).

To make movement accumulate along a field, continue with
[paths and their marks](path-marks.md). That example retains whole paths so you can
change their mark treatment and palette independently from integration.
