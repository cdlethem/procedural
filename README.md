# Procedurals

Procedurals makes it easier to create procedural art with Processing. It adds a higher-level
API for turning simple drawing primitives, randomness and carefully chosen parameters into
rich visual compositions.

Processing gives you the tools to draw. Procedurals supplies reusable ways to arrange,
connect, grow, distort and combine what you draw: paths that follow a field, shapes packed
with space between them, branching structures, subdivided surfaces, and images used as
material for new compositions.

You still choose the palette, the marks and the composition. The library handles the
underlying algorithms, leaving more room to experiment with the decisions that make a
piece your own.

## What can you make?

- **Fields of marks and flowing lines.** Arrange strokes across a surface, trace wandering
  paths, or place your own shapes along a curve.
- **Patterns, panels and packed forms.** Scatter shapes without overlap, divide a canvas
  into regions, or turn a collection of points into a network of triangles.
- **Branches and responsive structures.** Grow fine branching drawings or use springs to
  move an arrangement toward changing targets.
- **Three-dimensional forms.** Build meshes from profiles, create annular forms, and use
  spatial fields to vary their appearance.
- **Layered image compositions.** Crop and fit images into regions, use image values to
  control marks, warp a drawing, or blend sharp and filtered layers through masks.

The [example guide](docs/choosing-java-workflow.md) helps you find a starting point based
on the kind of piece you want to make.

## Build a composition, then explore it

The operations work together. Generate a set of paths, clip them to an outline, and draw
short strokes along the visible sections. Divide a canvas into panels, then fill each
panel with a different drawing or crop from a larger image. Reuse the same geometry while
trying another palette or mark treatment.

Seeds make random variations repeatable. Parameters let you change structure deliberately:
the spacing between forms, the shape of a curve, the strength of a distortion, or where a
color transition happens. The editable examples show which controls affect the arrangement
and which change its appearance.

Read [Composing drawings, partitions and image effects](docs/composing-java-effects.md)
for ways to combine these tools in your own sketches.

## Get started

The most complete version is for **Processing 4 in Java mode**. Installation currently
requires building the library from source.

1. [Build and install the library](docs/building-java-from-source.md).
2. Open **File → Examples → Contributed Libraries → Procedurals** in Processing.
3. Save a copy of an example and start changing its parameters, colors and drawing code.

[FieldMarks](docs/getting-started.md) is a simple first sketch: change the lengths and colors
of marks across a field, then replace the marks themselves. If you prefer an empty canvas,
the [Java API guide](docs/java-api.md) shows how to use the library directly.

When you want to compare variations, the [rendering tools](docs/rendering-java.md) can
produce seeded renders, parameter sweeps and frame sequences.

Ports for **p5.js, py5 and Processing for Android** are also underway, with a smaller set
of available features. For a browser example, try [BandMarks](packages/javascript/examples/band-marks/README.md).
A visual browser-based composition editor is planned.

## Credits and license

Inspired by the generative work of [Manolo Gamboa Naon](https://github.com/manoloide/AllSketchs).

Project code is available under the [MIT License](LICENSE). Reused material retains its
original attribution and license notices; see [third-party notices](THIRD_PARTY_NOTICES.md)
and the notices included with the source.
