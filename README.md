# Procedurals

An evidence-backed generative-art toolkit distilled from a survey of 901 Processing
sketches. Reusable operations compute geometry, fields, color, state and raster transforms;
editable workflows show how to compose them into artwork.

## Make something

- [Build and install Java](docs/building-java-from-source.md), then
  [choose a workflow by artistic intent](docs/choosing-java-workflow.md).
- [Compose drawings, partitions, image snippets and effects](docs/composing-java-effects.md).
- [Render seeded sketches, sweeps and frame sequences](docs/rendering-java.md).
- [Review actual generated images](docs/visual-review.md) in the local gallery.
- For JavaScript, see the [reviewed p5 integration and local package build](docs/port-integration-status.md).

Java is the reference implementation. Support for p5.js, py5 and Android is validated
independently. Packages are local reviewed artifacts, not registry publications. The
[operation reference](docs/reference/operations.md) gives current catalog support;
[PROJECT_STATE](PROJECT_STATE.md) records the accepted baseline and inventory.

The Java implementation objective is [accepted within its documented scope](evidence/distribution/java-completion-review.json).
This does not certify every original sketch or all targets. A
[Java recipe preview](docs/java-recipe-preview.md) is experimental. General portable recipes,
a browser composition application and MCP tools remain [roadmap work](docs/roadmap.md).

## Contribute

Agents read [AGENTS.md](AGENTS.md) and [PROJECT_STATE.md](PROJECT_STATE.md), then only the
contracts and task documents they need. [Architecture](docs/architecture.md) explains the
system; [artist capabilities](docs/artist-capabilities.md) explains admission decisions;
[agent briefs](docs/agent-briefs.md) defines bounded delegation.

| Path | Authority |
|---|---|
| `survey/snapshot.json`, `survey/out/` | Published evidence revision, notes and render measurements |
| `data/corpus.sqlite`, `reports/` | Generated corpus queries, sensitivity and diagnostics |
| `design/phase2/`, `design/capabilities/` | Reviewed decisions and explicit design drafts |
| `catalog/operations/`, `fixtures/operations/` | Language-neutral semantics and expected results |
| `catalog/validation/`, `evidence/` | Scoped implementation, native and reproduction acceptance |
| `packages/` | Reference implementation, ports, adapters and editable examples |
| `tools/`, `tests/`, `skills/` | Existing build/validation infrastructure and lifecycle guidance |

## Evidence workflow

The publishable snapshot is incomplete; the maintainer authorized incremental design and
implementation from it. Evidence gaps block the affected decision. Snapshot counts do not
establish live survey progress. Read [survey metadata](survey/snapshot.json) and
[corpus diagnostics](reports/corpus.md) for exact counts and limitations.

With Python 3.11+ and uv, rebuild the normalized analyses from checked-in data:

```sh
uv run python tools/ingest.py
uv run python tools/report.py
```

Use focused existing tests for the changed subsystem. `uv run python tools/check_catalog.py`
checks catalog/schema/source/reference consistency; it is not native or visual conformance.
Measured change is evidence for a control's effect, not automatically a useful default/range.
[Parameter sensitivity](reports/parameter-sensitivity.csv) preserves measured values and
warnings. Malformed frontmatter, normalization, nondeterminism and suspect shader renders
remain visible in the evidence.

Rendered survey images, copied assets, builds, logs and toolchains are excluded from Git.
Corpus queries work from a normal clone; visual conformance also needs external reference
images. See [survey maintenance](survey/README.md) for snapshot refresh and provenance, and
[recreation coverage](docs/recreation-coverage.md) for scoped versus full-corpus claims.

## Source and licensing

The evidence comes from [Manolo Gamboa Naon's AllSketchs](https://github.com/manoloide/AllSketchs).
Source sketches remain the author's work. Original notices and README are preserved under
[survey provenance](survey/provenance/); the survey methodology is retained under
[survey/methodology/](survey/methodology/).

Project code uses the [MIT License](LICENSE). Reused upstream material retains its own
copyright and notices, including those in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
and the numerical helper source files. Do not remove those notices when redistributing.
