# Editable py5 example acceptance

The initial registered example run passes: `evidence/conformance/py5-adapter-ui.json`.
It executes the real FieldMarks setup and key handler on the sketch thread. Each
independent length, palette and bar edit preserves the retained model and increments
the displayed revision exactly once. All four primary-canvas RGBA hashes match the
previously accepted CP1 renders. The real S handler saves a PNG whose decoded pixels
match the visible bar composition. Actual logical/physical dimensions are 640×640
at density one despite the forced density-two AWT display.

Root accepts this as a runnable development entry point; Sol reviewed its synchronous
image transfer followed by owned-buffer release and found no lifecycle blocker.
This is programmatic handler validation, not a physical keyboard or human usability
test. Full adapter failure-path review remains separate. No corrective example run
was necessary. Source and runtime bindings are in the report; images stay ignored.
