# Compare saved variants

Save several versions of a piece with descriptive filenames, then put them side by side.
Keep the seed fixed while changing one artistic choice if you want to isolate its effect.
For example, [FieldMarks](getting-started.md) separates maximum mark length, palette and
mark treatment. Save each result with **S**, then give the saved files distinct names.

From the repository root, with the existing Python dependencies installed through `uv`:

```sh
uv run python tools/contact_sheet.py \
  /path/to/baseline.png /path/to/longer-marks.png /path/to/new-palette.png \
  --columns 3 --cell-size 240 --output .work/comparisons/field-marks.png
```

Open the printed output path in your image viewer. Images appear left to right, then top
to bottom, in the command's input order. Each cell shows its input number and filename;
long names are shortened to fit. Use explicit filenames when order matters: a shell wildcard
expands according to the shell's ordering, not seed or parameter values.

The sheet fits each image above its label without stretching or cropping it. Transparent
areas appear over white. PNG and JPEG inputs are supported. It reads the first frame of each supplied image; for animation,
pass individual saved frames in the order you want to compare. Original files remain intact.

Use a fresh `.png` output path under this checkout's ignored `.work/` directory. Existing
outputs are preserved, and unreadable inputs fail the whole command. The helper accepts
up to 64 images, 1–8 columns and cell sizes of 64–512 pixels, within a 20-million-pixel total sheet limit. Each source image is limited to
32 million pixels and 100 MiB. These are tooling limits, not useful artistic parameter ranges.

A contact sheet helps you inspect composition and differences. It does not measure visual
conformance or establish recreation coverage; those claims still require the existing
benchmark and review process. For an opt-in JAVA2D sketch, [render a seeded image or parameter sweep](rendering-java.md).
Other renderers and animation batch rendering remain pending.
For palette extraction, see [Use colors from an image](extracting-palettes.md).
