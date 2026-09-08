# GrainMarks p5.js example

Draft browser workflow using the reviewed triangle cores. Native interaction/rendering
acceptance and standalone packaging are pending. This folder expects a localhost server
that serves the repository modules and pinned p5 at `/p5.js`; it is not yet an installer.

Supply triangles and density in `grain-marks.js`; change how retained samples are drawn in
`sketch.js`. R changes seed, N density, B cycles uniform/first-vertex/edge concentration,
X transfers to quadrant cells, M toggles dots/strokes, C palette, 0 resets and S saves.
M/C preserve the same sample objects. Geometry controls rebuild. Strokes may extend beyond
the triangle: sampled centres and complete-mark containment are different requirements.

The uniform entry point owns the contract's private xoshiro stream. Biased coordinate pairs
are caller composition using an example-only Java Random sequence so the complete model
can be compared to the accepted Java GrainComposition. This is neither a new public RNG
nor a promise to reproduce source sketch images. Examples are motivated by
`survey/out/2018/Generativos/puntis/notes.md` and `puntis3/notes.md`; density, palettes and
mark dimensions are editable choices, not measured recommended ranges.

Dot marks use filled1px p5 circles. The pinned p5 point primitive produced a coordinate
cutoff in the tested browser; this explicit motif avoids its epsilon-line implementation.
Stroke marks remain4px lines. Native dot rasterization is not a Java pixel-identity claim.
