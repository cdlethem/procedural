# genart-survey: rules for the agent

You are surveying Processing sketches in `${PROCESSING_SKETCHES_ROOT}` to collect metadata for a
future generative-art library. Everything you produce goes under `out/` in THIS directory.

## Hard rules
- **Never modify anything under `${PROCESSING_SKETCHES_ROOT}`.** Read it only. Parameter changes are
  made through `render.py --sub`, which edits a temporary copy.
- No `sudo`, no package installs, no git commands in the sketch repo, no network.
- Time limits: one render at a time, each capped at 90 s. At most 8 renders per sketch.
  If a render times out, do not retry the same thing: halve the work (smaller `swidth`,
  fewer iterations) or drop that experiment and note why.
- Do not ask questions. If something is impossible, write what you found in `notes.md` and stop.
- Do not create files outside `out/<sketch>/`.

## Rendering
```
uv run tools/render.py <sketch rel path> --out out/<sketch rel path>/variants/<param>_<value> \
    --seed 42 --snaps 1,10,60 --budget 30 --sub 'OLD' 'NEW'
```
- `--sub OLD NEW` is a literal text substitution applied to every tab: TWO separate shell arguments,
  OLD then NEW, each single-quoted. Choose OLD so it is unique (copy a whole line). Repeat `--sub`
  for multiple substitutions. If OLD is not found the run fails with `bad_sub` and nothing is rendered.
  **Never write `--sub 'OLD=>NEW'` as one string** — an unquoted `>` is a shell redirection operator,
  not text, and silently breaks the command (creates a garbage file, corrupts the substitution). Always
  two separate quoted arguments: `--sub 'int cc = 100;' 'int cc = 300;'`.
- The baseline for every sketch is already rendered: `out/<sketch>/baseline/frame_00001.png`
  (and `frame_00010.png`, `frame_00060.png` when the sketch kept drawing) with `result.json`
  (status, renderer, timings, deterministic, imports).
- Frames are PNGs. Open them with your file-read tool; you can see images.
- `--seed N` changes the random seed; try one different seed only if the sketch looks empty.
- If `result.json` has `"uses_shader": true` and `"display": "xvfb"`, the image may be wrong: the software
  OpenGL used headless mis-renders some GLSL filters (a blur can come out as a flat colour). Say so in
  the notes, describe what the code intends, and do not spend experiments on the shader itself.
- `frame_00010.png` / `frame_00060.png` exist only when they differ from frame 1 (an animated or
  accumulating sketch). If only `frame_00001.png` is there, the sketch is static: look at that one image only.
- The harness saves frame 1 right after the first `draw()`. Sketches that regenerate on every
  frame look identical at frames 1/10/60; accumulating sketches change over frames.

## Libraries already provided (jars are copied automatically into the build)
toxiclibs 0021 (`toxi.*`), triangulate (`org.processing.wiki.triangulate.*`), PeasyCam,
Minim. Anything else (`manoloide.*`, video, kinect, GUI libs) is unavailable; those sketches are
skipped by the survey. Do not research classpaths or try to install libraries.

## Observation discipline (this is where notes go wrong)
- Report only what is visible in the image, never what the code "should" do. After each variant
  render, `render.py` prints `change vs baseline: none|subtle|moderate|large (mean ..., fraction of
  pixels)` and stores it in the variant's `result.json` as `diff_vs_baseline`. Your observation must
  agree with it: if it says `none` or `subtle`, write "no visible change" or "subtle: ..." even if you
  expected a big effect. A parameter that turns out not to matter is a useful finding.
- If `baseline/result.json` says `"deterministic": false`, differences between renders may be random
  noise; say so and compare only large changes.
- Describe colours as you see them (name the dominant 2-3), not from the hex values in the code.

## Notes schema
Write `out/<sketch>/notes.md` following `NOTES_TEMPLATE.md` exactly: YAML frontmatter first,
then the four sections. `techniques` vocabulary (pick all that apply):
noise-field, flow-field, particles, agents, recursion, subdivision, grid, polar, spiral,
voronoi-delaunay, packing, shader, image-source, typography, physics, l-system, 3d-pointcloud,
3d-mesh, lines-hatching, dots-stippling, blend-modes, pixel-ops, symmetry, distortion, curves.
Keep the notes factual and short; the frontmatter is machine-read by `tools/aggregate.py`.
