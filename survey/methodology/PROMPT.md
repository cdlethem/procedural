Survey the Processing sketch `{{SKETCH}}` (source: `${PROCESSING_SKETCHES_ROOT}/{{SKETCH}}`, read-only).
Its baseline render with seed 42 is already in `out/{{SKETCH}}/baseline/` (`frame_00001.png`; `frame_00010.png`
and `frame_00060.png` exist only if the sketch changes over time; plus `result.json`). Follow `AGENTS.md`. You have a hard time
limit of 30 minutes for everything, so keep reasoning short and act.

Do exactly this, in order:

1. Read every `.pde` tab of the sketch and `out/{{SKETCH}}/baseline/result.json`. Look at
   `out/{{SKETCH}}/baseline/frame_00001.png` (and `frame_00060.png` only if that file exists).
2. IMMEDIATELY write a first version of `out/{{SKETCH}}/notes.md` following `NOTES_TEMPLATE.md`:
   complete YAML frontmatter, "What it draws" (plain visual description), "How the code works"
   (connect each visual feature to the loop / noise / random / palette / transform / blend mode / renderer
   that produces it), an empty "Experiments" table, and "Modularisation notes". This file must exist
   before you render anything.
3. Pick 4 to 6 numeric values in the code most likely to change the look (counts, sizes, noise detail,
   alpha, stroke weight, palette, angles). For each one run ONE variant render that changes ONLY that
   value relative to the baseline:
   `uv run tools/render.py {{SKETCH}} --out out/{{SKETCH}}/variants/<param>_<value> --seed 42 --snaps 1,10,60 --budget 30 --sub 'OLD' 'NEW'`
   — OLD and NEW are two SEPARATE quoted arguments (never `'OLD=>NEW'` as one string; an unquoted `>`
   is a shell redirect and silently breaks it). Use a whole unique source line as OLD. Run them one after another (you may chain several commands
   with `;` in one tool call). At most 8 render commands in total, including failures. If one is too slow,
   make it cheaper once (smaller `swidth`/counts) and say so in the notes; otherwise skip it.
4. Look at each variant's `frame_00001.png` only (never its later frames) and read the `change vs baseline` score that render.py
   printed. Add one row per variant to the "Experiments" table (including the score's label) and fill
   the `parameters` list in the frontmatter (name, default, tried, effect). Report what you SEE; if the
   score says none/subtle, say "no visible change" rather than the effect you expected.
5. Stop. Do not ask questions, do not edit any other file, do not re-render the baseline.
