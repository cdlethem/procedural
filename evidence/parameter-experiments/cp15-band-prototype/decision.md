# Root decision: proceed to a scoped noise-band contract

Root inspected all three PNGs and the complete private Java source. The preregistered
question is answered positively: narrow tolerance yields connected contour-like lines;
wide tolerance yields visibly tangled, thicker bands with different extents; radial scalar
transfer yields concentric arcs through the same traversal. Exact accepted vertices were
resampled against their start levels, and deterministic replay was checked before rendering.
These observations justify retaining tolerance as a meaningful control. They establish
neither a default nor a continuous recommended range.

At196608 attempts/state,67,549/96,768/62,701 vertices were accepted for narrow/wide/radial.
Coordinate payload alone was about1.08/1.55/1.00MB. Recorded generation times were about
29/18/37ms. These are bounded feasibility observations, not benchmark guarantees or evidence
for the full source's ten-million-attempt workload. See experiment.json for image hashes,
objective differences, observations and explicit limitations.

The prototype confirms value without establishing a public callback API, source recreation,
Processing renderer support or release acceptance. Root chooses the existing portable noise
descriptor for the first public operation. The private analytic transfer is not shipped
support. Preserve the source's nested proposal and rejection-heading policy as an explicitly
scoped algorithm; choose the established portable RNG and elementary math profile in contract.
The source report's classification of randomized steering as one-off precludes calling this
a general contour extractor, but does not negate the demonstrated reusable proposal tracer.

Two prototype shortcuts must not become public behavior: retain the original start vertex
so the first accepted segment can be drawn, and use subpixel coordinates in the native
example. The experiment's integer-pixel Java2D drawing and accepted-only arrays were adequate
for this decision, not implementation acceptance. The private source remains a clearly
identified experiment; it is not in the library manifest.

Reproduce this experiment from repository root (output remains ignored):

```sh
mkdir -p .work/cp15-band-prototype/classes
.work/toolchains/jdk-17.0.20.1+1/bin/javac \
  -cp .work/cp14-consumer-root2/extract/procedurals/library/procedurals.jar \
  -d .work/cp15-band-prototype/classes \
  evidence/parameter-experiments/cp15-band-prototype/BandPrototype.java
python3 tools/with_native_render_lock.py --timeout 120 -- \
  .work/toolchains/jdk-17.0.20.1+1/bin/java -Djava.awt.headless=true \
  -cp .work/cp15-band-prototype/classes:.work/cp14-consumer-root2/extract/procedurals/library/procedurals.jar \
  BandPrototype
```

These machine-local input paths identify the experiment environment; native distribution
validation must use the normal fresh-output tools and accepted external inputs later.
