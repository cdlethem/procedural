# Path marks

This in-development Processing 4 JAVA2D starter draws retained gradient paths as movement
segments or perpendicular marks. Public native validation and packaged installation are
pending; the accepted first-slice installer still supplies FieldMarks.

For source-checkout development, use the core sources including `GradientPath2D`, the
matching `java-processing` adapter, and `packages/java/examples/PathMarks/PathMarkComposition.java`
as an additional Java tab/source. `PathMarks.pde` is the main sketch and
`PathMarksCanvas.java` owns the native frame. The upcoming packaging step must include
all three sources and the matching newly built JARs, rather than the older I1 artifacts.

- **M:** switch between movement and perpendicular marks.
- **L:** switch mark length between 12 and 24; movement stays retained.
- **C:** switch palettes; movement stays retained.
- **N:** switch between 2000 and 2001 steps. The shorter trace is an exact prefix.
- **D:** switch step distance between 0.4 and 0.8; later field queries change.
- **S:** save the displayed canvas.

Start by editing the values at the top of the PDE. Change `PathMarkComposition.mark` to invent
another treatment of each endpoint and its incoming heading. Change the starting grid
or field mapping in `PathMarkComposition.create` to reshape movement. These constants describe
this composition; they are not recommended library ranges.

The field can produce converging paths, canvas exits and horizontal runs. This example
illustrates feedback integration and reusable marks, not a simplex reproduction of its
motivating sketches. Provenance and acceptance: `design/capabilities/cp2-public-example.md`.
