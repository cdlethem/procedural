# Install FacetMarks on Processing Java

The local Java 0.9.0 package is assembled at
`.work/dist/cp9/java/procedurals-processing-0.9.0.zip`. Extract its `procedurals`
folder into your Processing sketchbook's `libraries` folder, replacing the
previous library installation. Restart Processing and open `FacetMarks` from
the library examples. This is a local archive, not a registry publication.

The package contains nine editable starters and twelve reusable operations.
Keep both FacetMarks tabs together: `FacetComposition.java` creates and retains
the geometry; `FacetMarks.pde` draws it and handles edits. This example requires
desktop Processing JAVA2D and no external assets.

Try **M** to switch filled facets to wire and then grain. **C** changes the
palette, **P** shows sites, **N** changes site count and **X** changes the source
to quadrant-cell centres. **R** advances the seed, **0** resets and **S** saves
the displayed canvas. See the [workflow guide](facet-marks.md) for the composition
boundaries and editable values.

For a development checkout with this repository's pinned JDK and Processing
toolchains and accepted CP8 archive already available:

```sh
python3 tools/prepare_facet_marks.py --output .work/examples/my-facet-build
```

Open the resulting `FacetMarks/FacetMarks.pde`. This command builds a candidate
JAR, stages both tabs, officially preprocesses the PDE and runs headless helper
checks. It preserves existing output directories; choose a fresh one when
preparing another copy. It does not render or install the library.

The accepted workflow ran the actual staged sketch through 18 edit/reset states,
checked exact drawing arguments and styles, and compared the saved image to the
completed canvas. All 12 distinct images were directly reviewed. This establishes
the registered Java workflow, not human usability testing, source-pixel identity,
other renderers or the deferred JavaScript, py5 and Android ports.
