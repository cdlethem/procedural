# Start making a sketch with Procedurals

This folder is a Processing desktop Java library. It contains the core JAR, desktop
adapter JAR, editable examples, Java source and generated reference. Keep both JARs in
`library/`. Processing itself is an external requirement; use Processing 4.5.6 for the
recorded validation environment.

## Install and make your first edit

1. Move this entire `procedurals` folder into your Processing sketchbook's `libraries`
   directory. Find the sketchbook location in Processing Preferences. If an older copy
   exists, move it aside first to avoid mixing versions.
2. Restart Processing and open File → Examples → Contributed Libraries → Procedurals →
   FieldMarks. Save a copy into your own sketchbook before editing it.
3. Run the sketch. Follow [the FieldMarks guide](docs/getting-started.md) to change its
   marks and palette, then save an image. Keep any companion Java tabs and data folders
   with the sketch when copying examples.

For a smaller starting point, paste the complete sketch from the
[direct Java guide](docs/java-api.md) into a new Processing sketch. It combines grid
positions and palette colors with ordinary drawing calls.

## Choose what to compose

| What you want to do | Open this packaged example |
| --- | --- |
| Grow lines through a field | [PathMarks](examples/PathMarks/PathMarks.pde) |
| Arrange differently sized forms | [PlacementMarks](examples/PlacementMarks/PlacementMarks.pde) |
| Put drawings or image snippets inside irregular windows | [MaskedPartitionMarks](examples/MaskedPartitionMarks/MaskedPartitionMarks.pde) |
| Clip retained paths to an outline | [PathClipMarks](examples/PathClipMarks/PathClipMarks.pde) |
| End strokes at obstacles | [ContactMarks](examples/ContactMarks/ContactMarks.pde) |
| Let an image control marks | [ImageFieldMarks](examples/ImageFieldMarks/ImageFieldMarks.pde) |
| Build three-dimensional forms | [ProfileMarks](examples/ProfileMarks/ProfileMarks.pde) |

The [workflow chooser](docs/choosing-java-workflow.md) covers the other examples.
The [composition guide](docs/composing-java-effects.md) explains local versus canvas
coordinates, content callbacks, crops, masks and blending. Examples choose artwork and
editing controls; reusable operations compute the values you can draw in other ways.

Read the [Java reference](reference/index.html) for classes and signatures and the
[value guide](docs/java-result-values.md) for palette and placement ownership rules.
[Render and compare variants](docs/rendering-java.md) describes repository helper tools;
those tools require a source checkout and are not executables included in this folder.

## Scope and provenance

`library.properties` identifies this build's version. The
[build guide](docs/building-java-from-source.md) distinguishes source assembly from
reviewed distribution acceptance. Some documentation links refer to evidence, source
sketches or development tools in the repository; those materials are not all bundled.
The supported Java workflows do not imply equivalent support on other language targets.

Keep [LICENSE](LICENSE), [third-party notices](THIRD_PARTY_NOTICES.md) and the bundled
font notices when redistributing. GlyphMarks carries its font and complete notice in its
own data directory. Source sketches are provenance, not included artwork assets.
