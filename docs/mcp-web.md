# MCP server and companion web application

## Goal

A user can describe a piece in natural language, receive a valid sketch assembled from this package's evidence-backed operations, preview and tune it in a browser, and export it for Processing Java, p5.js, py5, or Processing for Android.

This is a required delivery target. Concrete MCP tool names, operation schemas, and recipe nodes remain gated on the complete-corpus Phase 2 API design; implementing them now would freeze the API from partial evidence.

## Architectural constraint

The MCP server and web application are adapters over one language-neutral operation catalog. They must not maintain a second hand-written description of the library.

The eventual catalog records, for every retained operation:

- stable operation identifier and semantic version;
- JSON-compatible input/output schema;
- generator, transform, or sink role;
- defaults and useful ranges backed by parameter-sensitivity provenance;
- supported capabilities and target adapters;
- deterministic/random/time behavior;
- motivating sketch notes and examples;
- pure, command-stream, adapter, and visual conformance fixture IDs.

Java, p5.js, py5, Android, MCP tool schemas, documentation, parameter controls, and exporters are generated from or validated against this catalog. A change that cannot be represented there is not a portable public API change.

## Prompt-to-sketch boundary

Natural-language planning produces a declarative, JSON-serializable sketch recipe rather than host-language source code. The recipe is validated before execution and references only catalog operations. Target emitters or runtime adapters consume the same validated recipe.

This boundary provides four properties:

1. The model cannot invent library calls that do not exist.
2. The browser preview and exported project execute the same operation graph.
3. A recipe can be replayed across all target languages and compared objectively.
4. Provenance, defaults, and parameter ranges travel with the result rather than disappearing into generated code.

The exact recipe schema and composition model are Phase 2 outputs. It should support a minimal sequence/graph of generators, transforms, and sinks, explicit seed and canvas settings, named assets, animation/time inputs, and target capability requirements. It must not embed arbitrary JavaScript, Python, or Java.

## MCP responsibilities

The server will expose the catalog, corpus evidence, examples, and rendering/validation workflow through MCP resources and tools. Required capabilities, independent of final tool naming:

- search corpus techniques, candidates, parameter sensitivity, and motivating sketches;
- retrieve operation schemas, provenance, examples, and target support;
- turn a prompt into a candidate recipe;
- validate and explain a recipe, including unsupported target capabilities;
- create or mutate parameters without losing the seed or provenance;
- render a throttled preview through a selected adapter;
- compare output with relevant conformance/corpus cases;
- export a complete project for Processing Java, p5.js, py5, or Android Mode.

Rendering remains one-at-a-time and pausable on this workstation. MCP requests must use bounded canvas sizes, frame counts, generation counts, and timeouts. The server must not expose arbitrary shell execution or unrestricted filesystem paths.

## Companion web application

The web application is a client of the same recipe/catalog contract:

```text
prompt -> MCP planner -> validated recipe -> p5.js preview
                                 |-> schema-derived controls
                                 |-> evidence/provenance panel
                                 |-> target compatibility report
                                 `-> Java / p5.js / py5 / Android export
```

The first preview adapter is p5.js. Rendering runs in an isolated worker or sandboxed frame with explicit asset allowlists and resource limits. Controls are generated from parameter schemas and measured ranges; the UI does not encode operation-specific forms by hand. Exports include the recipe and conformance metadata so they remain reproducible.

## Objective prompt benchmark

Language conformance and natural-language planning are separate measurements. A port can render correctly while a planner chooses the wrong operations; an attractive image can hide an invalid recipe.

After Phase 2 defines the operation catalog, build a versioned prompt suite from corpus-backed idioms. Each case contains:

- prompt and optional negative constraints;
- required/allowed techniques and composition characteristics;
- target and capability constraints;
- seed, canvas, and animation requirements;
- acceptable operation families, not one exact recipe;
- parameter predicates derived from measured useful ranges;
- required provenance citations;
- reference sketches or visual benchmark cases where appropriate.

Evaluation layers:

1. **MCP protocol:** tool/resource schemas, errors, cancellation, progress, and bounded-render behavior.
2. **Recipe validity:** schema-valid output, catalog-only operations, type-compatible graph, explicit environment, and target-capability success.
3. **Prompt intent:** required/forbidden operations, composition predicates, parameter bounds, animation/static requirements, and provenance.
4. **Execution:** recipe runs without warnings or state leakage in the target adapter.
5. **Cross-target semantics:** pure and command-stream fixtures match across Java, p5.js, py5, and Android.
6. **Visual result:** rendered frames enter the corpus visual benchmark and report raw metrics, profile gates, and coverage.

Deterministic protocol and recipe tests use recorded planner outputs or a fixed local model configuration. Live-model runs are scored distributions and never replace deterministic server tests. Prompt success is based on structural predicates plus execution and visual evidence—not brittle source-text matching.

The final prompt suite must cover dominant clusters and every retained rare family such as flow fields, Voronoi/Delaunay, physics, L-systems, and typography. Coverage is defined only after the full survey; until then, build the harness but do not freeze the prompt inventory.
