# Field marks in the browser

From the repository root, run:

```sh
node tools/serve_field_marks.mjs
```

Open the printed localhost URL. The first run installs pinned p5 2.3.2 into the
repository's ignored `.work` directory if needed. Node and npm are required. Stop the
server with Ctrl-C.

Change maximum length, palette or mark shape, then save a PNG. These edits reuse the
same 25,600 field samples. To change the composition itself, edit `createMarkField()`
in `sketch.js`: seed changes the field, pitch changes the distance between marks, and
columns/rows set how many positions it contains. The canvas is 640×640.

`mark-field.js` shows the composition: a regular grid supplies positions; one explicit
noise field supplies heading, length and palette phase; `markCommands()` builds lines
or bars from retained attributes. Its constants are example choices, not promised
artistic parameter ranges. Change that generator to try another mark.

This is a native development example using the internal drawing adapter. It is not
yet a published npm package or the future general browser editor. Scoped runtime
validation covers the recorded p5/Chromium configuration; py5 and Android remain separate.
