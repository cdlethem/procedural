# Feature-complete Java buildout

Current maintainer objective: build a feature-complete Java implementation. Ports are
paused per `porting-resume.md`; recipes/MCP/web remain a separate roadmap, not prerequisites
for making the native Java library useful. This plan does not claim feature completeness
or replace the project's mission with the current15 operations.

## Completion requirements

1. A competent Processing user can install the source-built Java library and reach a
   working, editable sketch from a short getting-started guide. Installation and example
   execution must be verified from extracted distributions, not only the development tree.
2. Each major corpus idiom has a clear Java entry point and reusable operations for its
   defining algorithms. Distinguish actual algorithms from combined technique tags and
   ordinary artistic drawing. Record genuine exclusions and remaining gaps with evidence;
   unknown families cannot silently count as supported.
3. Every admitted operation has reviewed semantics, traceable source evidence, parameter
   provenance, meaningful focused checks and a representative native workflow. New features
   need a demonstrated edit and a transfer use; starters do not count as original recreations.
4. Existing operations compose without sketch-specific algorithm escapes. Track which
   assessed originals become practical, without projecting a small cohort over the corpus.
5. Java documentation, reference, examples, seeded-render/sweep tooling, licensing and
   packaging agree with the delivered behavior. Performance is bounded at representative
   sizes and errors do not leave partial results. Unsupported targets remain explicit.

These requirements are an acceptance checklist, not a fixed operation-count target.
The broader corpus benchmark remains a separate strict certification claim.

## Existing capability baseline

Java0.15 delivers15 operations and15 workflows: field marks, integrated paths, constrained
circle placement, quadrant regions, triangle grain, endpoint and interior-cut branching,
radial-profile meshes, glyph placement, Delaunay facets, target springs and occupied lattice
paths, plus relief/city/landscape compositions. Only three selected original structural
recreations are demonstrated. Consult current operation attestations rather than historical
status paragraphs in the provisional API design.

## Bounded next batch: raster warping

Artist task: render a pattern once, bend its pixels with a spatial displacement field, then
change the field strength or pattern without reimplementing image sampling. This adds a
raster transform capability currently absent from the package.

Decisive initial evidence: `survey/out/2016/Generativos/colorRamp/notes.md` describes copying
an image and bilinearly sampling displaced coordinates, with noise supplying displacement
angles. The source also contains an independently positioned color ramp. The report records
moderate changes for displacement detail/amplitude; that does not establish recommended
ranges or isolate the sampler from the full composition. Its prose disagrees about dot
color versus position, so the implementation walkthrough/source must resolve that detail.

Root's proposed boundary is image resampling from explicit coordinates/displacements,
separate from the chosen noise field, palette, pattern and renderer. The next source audit
must resolve clamping, interpolation, alpha/color conventions, coordinate meaning, ownership
and work bounds BEFORE signatures are frozen. Avoid a callback that hides a new field
algorithm or a noise-specific monolith that prevents transfer.

Delivery order:

1. Root reads decisive source/notes and writes the keep/extraction decision and exact
   contract. Terra retrieves at most two computational neighbors; no corpus-wide audit.
2. Terra implements the frozen Java core and focused distinguishing tests. Root reviews
   numerical, image-boundary and ownership decisions directly.
3. Deliver WarpMarks using existing layout/palette/field operations plus the admitted
   raster transform. Demonstrate displacement edits and a second supplied field. Root
   inspects native results; no porting or new renderer framework is required.
4. Integrate a reviewed source-built Java distribution and update reference/technique docs.

This is the first batch, not the entire definition of Java completeness. After it, assess
remaining real gaps in color control, field/path constraints, region construction and
renderer-bound raster/text/mesh workflows against the checklist above. CP12 band-constrained
walking remains an explicit unresolved capability; general grammar engines and Voronoi cells
are not inferred from mislabeled line-pool/Delaunay examples.

## Decisions from the initial bounded screens

- Voronoi: colidion describes circle-outline deformation; globologia/metro describe
  Delaunay triangles. These do not justify bounded nearest-site polygons. No claim that
  the full corpus lacks them; no general Voronoi implementation admitted from these reports.
- Ribbons: linescurvis/datido/nando define strip edges directly. They do not establish a
  general supplied-path offset algorithm with joins/caps. Keep their composition patterns
  available without inventing a generic offset API from the tag.

Root owns admission and final acceptance. Luna/Terra perform bounded evidence and frozen
implementation work. Sol remains paused. Reuse existing infrastructure and run focused
checks once per meaningful change; repair failures without widening acceptance criteria.
