# Field marks in py5

This development example requires py5 0.10.11a0 and Java 17. Its actual setup,
programmatic key-handler edits and saved PNG pass the registered native check;
physical keyboard and human usability testing remain separate. The adapter has scoped
native pixel, failure-path and interruption validation for this pinned runtime.

From an environment containing py5, run from the repository root:

```sh
python packages/python/examples/field_marks/sketch.py
```

Focus the sketch window. **L** toggles maximum length 16/32; **P** changes the
palette; **B** switches lines/bars; **S** saves the visible piece to
`.work/examples/py5-field-marks/field-marks.png`. Saving replaces that example output.
Edits reuse the same 25,600 field samples. The window title shows current choices.

Change seed, columns, rows or pitch in `setup()` to alter the field itself. In
`mark_field.py`, `create_mark_field()` retains position, heading, length factor and
colour phase; `mark_commands()` is the place to replace the mark. Constants are
choices for this piece, not recommended artistic parameter ranges.

The example composes the public Python grid, noise and palette operations and the
internal py5 drawing adapter. It is not a published py5 package or a full-corpus
reproduction. Its field-mark mechanism is motivated by
`survey/out/2018/Generativos/pelines/notes.md`.
