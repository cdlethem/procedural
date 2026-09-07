# Cross-language portability and conformance

The Processing 4 JAR is the reference implementation, not the specification. Observable behavior must be defined in language-neutral data and exercised by the same fixtures in Java and the three planned targets: p5.js, py5, and Processing for Android/Android Mode.

This constraint applies when Phase 2 designs the API. It does not authorize choosing functions or signatures before the survey is complete.

## Architecture constraints

1. **Portable core, thin adapters.** Generators and transforms operate on plain scalars, arrays, records, geometry buffers, and drawing-command streams. Host classes (`PApplet`, `PGraphics`, `PVector`, `PShape`, `PShader`, p5 objects, py5 wrappers, Android views) appear only in adapters. Each adapter translates the same portable outputs to its host.
2. **Explicit environment.** Seeded randomness, noise, clocks, assets, pixel density, colour space, and renderer capabilities are inputs. Core code must not read Processing or browser globals.
3. **Specified numeric behavior.** Each algorithm documents coordinate system, angle unit, interval inclusivity, rounding, overflow, colour encoding, floating-point tolerance, ordering, mutation, and degenerate-input behavior. Ports do not infer these from Java implementation details.
4. **Portable stochastic behavior.** Library-owned randomness uses a specified cross-language generator with published state-transition and output vectors. Where reproducing Processing's random/noise stream is required, that compatibility source is explicit and separately tested. No function silently chooses the host RNG.
5. **Serializable configurations.** Public parameter objects must have a stable JSON representation. Java convenience builders may exist, but JSON-compatible data is the interchange contract.
6. **Capability checks, not fake fallbacks.** P2D/P3D, shaders, text/font metrics, image sampling, and third-party geometry support vary by host. Adapters report unsupported capabilities explicitly. A fallback is allowed only when its changed semantics are named and benchmarked.
7. **Deterministic command order.** Geometry and drawing commands have defined order. Hashable command streams make a port testable before antialiasing, fonts, GPU drivers, or canvas implementations introduce raster differences.

## Planned target matrix

| target | implementation boundary | constraints the shared contract must expose |
|---|---|---|
| Processing 4 desktop | Java reference core + Processing adapter | JAVA2D/P2D/P3D, desktop shaders and fonts; establishes reference command streams and renders |
| p5.js | JavaScript/TypeScript core port + Canvas2D/WebGL adapter | Java `float` versus JavaScript `Number`, canvas/WebGL antialiasing, asynchronous assets/fonts, pixel density, browser shader dialect |
| py5 | Python-facing core port or thin adapter over the reference JAR, selected per module | Python collection/value semantics, JVM bridge conversions, py5 drawing-state names, headless execution; pure fixtures must pass even when rendering reuses Processing |
| Processing for Android / Android Mode | Android-compatible Java core + Android Processing renderer adapter | no AWT/desktop APIs, constrained filesystem/assets, OpenGL ES shader capabilities, lifecycle/context loss, touch input, device pixel density, compatible Java bytecode/toolchain |

The portable core must remain usable on Android: no `java.desktop`, Swing/AWT, reflection-based serialization, host filesystem assumptions, or desktop-only concurrency. Build output may have target-specific adapters, but core source behavior and conformance fixtures stay shared.

## Conformance layers

Every retained public function eventually needs coverage at all applicable layers.

### 1. Schema and metadata

Language-neutral JSON Schema validates configuration objects, fixture inputs, outputs, provenance, numeric tolerances, and capability requirements. Every public function records at least one motivating survey note and the measured-useful parameter ranges.

### 2. Pure golden vectors

Portable calculations—random generators, palette interpolation, subdivision, displacement, packing, sampling, coordinate transforms—receive JSON inputs and emit canonical JSON outputs. Fixtures include:

- normal observed inputs from motivating sketches;
- useful parameter boundaries from sensitivity records;
- zero/empty/degenerate geometry;
- fixed seeds and several sequential RNG states;
- ordering and mutation checks;
- invalid input with a specified error code.

Exact integers and bit patterns compare exactly. Floating-point values use per-field absolute/relative tolerances recorded in the fixture; no port-wide blanket epsilon.

### 3. Geometry-command goldens

Renderer-independent generators emit canonical commands or geometry buffers. Fixtures compare command kind, order, vertex/index counts, topology, transforms, colours, and style state before rasterization. Floats use declared tolerances. This is the primary fast-agent loop because failures locate semantic drift without image ambiguity.

### 4. Adapter integration

A small matrix renders canonical commands through each host adapter. It verifies renderer capability negotiation, state isolation (`push`/`pop` equivalence), colour modes, transforms, pixel density, text/font handling, shader uniforms, and asset loading. Tests must run in each port's native runtime, not through mocked drawing APIs.

### 5. Corpus visual benchmark

`benchmarks/corpus.json` inventories every available baseline frame in the current survey. Candidate ports write images at `<candidate-root>/<sketch>/frame_NNNNN.png`; `tools/benchmark.py` compares them with the survey baselines and emits per-case JSON plus an aggregate score and coverage.

Raw metrics are always retained:

- dimensions and exact SHA-256 equality;
- RGB mean absolute error and changed-pixel fraction;
- block structural similarity (SSIM);
- RGB histogram intersection;
- edge-map cosine similarity;
- 64-bit difference-hash distance.

The aggregate score is:

$$100 \times (0.40\,SSIM + 0.20\,(1-MAE) + 0.15\,histogram + 0.15\,edge + 0.10\,(1-dHash/64)).$$

Profiles provide explicit gates:

- `exact`: dimensions and SHA-256 must match.
- `portable-deterministic`: dimensions match, score $\ge 75$, SSIM $\ge 0.70$, histogram intersection $\ge 0.70$.
- `portable-nondeterministic`: dimensions match, score $\ge 60$, histogram intersection $\ge 0.65$, edge similarity $\ge 0.35$; spatial SSIM is reported but not gated.
- `suspect-shader`: informational and excluded from pass/fail when the reference shader was rendered under Xvfb.

These are initial suite gates, not claims that every future abstraction is correct at those values. Phase 3 reproduction work must calibrate case-specific overrides where repeated reference renders prove a profile too strict or too weak. Raw metrics and the scoring formula stay stable so results remain comparable.

## Suite completeness

A port's corpus result reports both quality and coverage. Missing required candidates fail; an average over a convenient subset cannot pass. Informational shader cases and survey stubs are listed separately, never silently omitted. Animated sketches contribute every stored baseline frame, so matching frame 1 cannot hide broken state evolution.

A release candidate passes only when:

- all language-neutral schemas validate;
- all applicable pure and command-stream fixtures pass;
- its native adapter integration suite passes;
- every required corpus case is present and passes its profile or case-specific calibrated override;
- unsupported capabilities are enumerated in the report;
- the aggregate report includes failures, missing files, informational cases, and coverage denominator.

## Growth policy

`tools/build_benchmarks.py` regenerates the manifest idempotently as survey notes arrive. During Phase 3, each accepted reproduction adds or calibrates its case and contributes pure/command fixtures for the functions it exercises. A bug fixed in any implementation adds the smallest language-neutral regression fixture that would have caught it; all ports consume that fixture unchanged.
