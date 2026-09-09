# Use colors from an image

From the repository root, with the existing Python/Pillow dependencies:

```sh
uv run python tools/extract_palette.py /path/to/reference.png --colors 5 --output .work/palettes/reference.json
```

The command prints a Java `int[] colors = {...};` declaration. In FieldMarks, replace the
values in its existing `COLORS` array with those printed values, keeping the name `COLORS`.
Run again to recolor the same geometry. The JSON is an extraction record; Java does not
automatically load it.

Inputs are PNG or JPEG, first frame only, at most 100 MiB and 32 million pixels. For
transparency, choose an explicit background, for example `--matte FFFFFF` for white.
The helper composites alpha before reducing the image to at most 256 by 256 pixels with
BOX sampling, then uses Pillow MEDIANCUT quantization without dithering. Colors are RGB24
integers ordered by decreasing sampled pixel count, with numerical RGB order breaking ties.
A uniform image may return fewer colors than requested. Choose 1–32 colors; this is a
helper limit, not an evidence-backed artistic range.

This is a Pillow-dependent helper, not a portable Java operation. It uses decoded channel
values without ICC conversion or EXIF orientation correction. Counts refer to the reduced
sample. Quantization approximates colors; it does not recover an author's original palette
or choose a useful cyclic color order. Reorder the array when transition order matters.

The record includes source path and SHA256, Pillow version, settings, colors and counts.
Keep the source and Pillow version when repeatability matters. Use a fresh `.json` path
beneath this checkout's ignored `.work/`; existing outputs are preserved. Source images
and generated records are not added to Git.

The [native application review](../evidence/tooling/palette-application-review.json)
demonstrates this handoff using colors extracted from the CutMarks image and the accepted
FieldMarks example. Both outputs keep seed42 and the same layout/drawing settings; review
them in the local visual gallery's palette-application group.
