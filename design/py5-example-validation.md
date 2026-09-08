# Editable py5 example validation

Register before executing the example entry point. One run of the actual FieldMarks
class with four paints (setup base, length, palette, bars) and one PNG save; one
corrective run only after a documented failure. Use pinned py5/JDK and forced AWT
display scale two. The example itself requests density one.

A test subclass calls the real setup and key handler synchronously on the sketch
thread. Set the Java key field explicitly for these programmatic handler checks;
this does not claim physical keyboard-event or human usability validation.

Compare the displayed canvas's decoded RGBA with the four already accepted py5 CP1
hashes. Reset other edit choices before each independent edit. Verify a single
revision increment per edit and unchanged retained attribute hash. Invoke S through
the same handler and decode the actual saved PNG; it must match the displayed bar
case. Assert density one and 640×640 logical/physical dimensions. Preserve full
failure chains. No rerender is needed for metadata freshness.
