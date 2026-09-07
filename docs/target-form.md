# Target form: Processing-native reference library

**Decision:** build the reference implementation as a Processing 4 Java library, compiled to a JAR and imported from PDE sketches. Define observable behavior independently of Java so the same corpus can drive Processing.js, p5.js, or another web renderer. Keep runnable `.pde` examples and templates beside the library, but do not make copy-in tabs the primary API.

## Evidence considered

The surveyed corpus is Processing/Java and its important mechanisms depend directly on Processing types and renderer state: `PApplet`, `PGraphics`, `PShape`, `PVector`, `PShader`, `beginShape()`/`vertex()`, per-vertex colour, and P2D/P3D transforms. This appears across the reviewed notes, including the P3D textured cubes in `survey/out/2014/Generativos/circulos2/notes.md`, the shader-and-mesh city in `survey/out/2015/Generativos/cityPink3d/notes.md`, simplex displacement in `survey/out/2018/Generativos/ailan/notes.md`, and animated Delaunay geometry in `survey/out/2018/Generativos/araniaaas/notes.md`.

The corpus also contains small reusable calculations that should not own renderer state: rectangle subdivision, noise displacement, palette interpolation, packing, and angle fields. The reference Java library will keep these as renderer-neutral data generators and transforms. Processing-specific adapters will translate portable geometry and style commands to `PApplet` or `PGraphics`. That boundary supports both the generator/transform/sink composition model required in Phase 2 and direct ports to JavaScript without selecting the final public API before the complete corpus is available.

## Alternatives

### PDE template tabs plus a copy-in core tab

This is the lowest-friction option: no separate compiler, source remains visible, and code copied from the corpus can stay close to its original form. It is useful for the Phase 4 starter templates and examples.

It is not the primary package because copy-in code forks immediately. Fixes and documentation updates do not propagate; every sketch gains global symbols; module boundaries are weak; and 30–80 functions plus parameter/data types would turn one core tab into an unstructured namespace. Multiple sketches already use helpers named `rcol`, `getColor`, `grid`, and `circle`, so collision risk is concrete rather than hypothetical.

### py5

py5 is a supported Python target. It may begin as a thin adapter over the reference JAR where JVM interoperability preserves behavior, while pure algorithms may later receive native Python implementations driven by the same fixtures. Java remains first because the source corpus and proven headless renderer are Processing-native; py5 parity is measured rather than assumed.

### p5.js

p5.js is the primary web target. Its implementation shares the language-neutral behavioral specification, seeded conformance vectors, geometry-command fixtures, and visual benchmark cases with the Java reference. Only adapters know about `PApplet`, `PGraphics`, p5 canvas/WebGL objects, or host-specific shader APIs.

### Processing for Android

Android Mode is a supported Java target, not an afterthought. The portable core therefore cannot depend on AWT/Swing, desktop filesystem conventions, or desktop OpenGL. Android-specific lifecycle, assets, touch input, pixel density, and OpenGL ES support belong in an adapter with explicit capability results.

The trade-off is deliberate indirection: algorithms cannot casually read Processing globals or return Java-only host objects. This costs some convenience in the reference implementation but prevents renderer state, random-number behavior, floating-point assumptions, and desktop APIs from becoming accidental contracts.

## Trade-offs and constraints

A JAR adds a build step and requires a clear Processing-version target. Renderer adapters receive `PApplet`/`PGraphics` explicitly, but portable algorithms must not expose those types. Core inputs, outputs, and configuration must be representable as JSON-compatible scalars, arrays, records, geometry buffers, and command streams. Random sources, noise sources, clocks, asset loading, and renderer capabilities are injected rather than read from host globals. Shader assets and optional third-party JARs need portable fallbacks or an explicit unsupported-capability result.

The benefits outweigh those costs: one installable reference artifact, namespaced modules, typed contracts, reusable data types, testable pure calculations, and updates that propagate without copying source. The Phase 0 spike targets Processing 4.5.6 and proves that moving a corpus drawing loop into a JAR preserves the stored baseline. Phase 2 may refine module names and signatures only after all 901 sketches are surveyed; it must preserve the language-neutral boundary. Java is the first implementation, not the sole behavioral specification.
