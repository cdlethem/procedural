# Delivery roadmap

[PROJECT_STATE](../PROJECT_STATE.md) records what is accepted and the active assignment.
[AGENTS](../AGENTS.md) defines standing rules. This roadmap records remaining product work;
it does not automatically launch a new batch or reopen completed Java milestones.

## Delivered foundation

Evidence ingestion, the language-neutral catalog, shared fixtures, Java operations and
artist workflows are implemented. The scoped Java implementation objective is
[accepted](../evidence/distribution/java-completion-review.json). The requested p5 feature
branch is [integrated](port-integration-status.md). Target support remains operation-specific.
Native workflows, seeded rendering, sweeps, gallery tooling and composition guides already
exist; do not recreate their infrastructure as a prerequisite for downstream work.
The [web gallery/Studio](../apps/README.md) now lives in the private
`cdlethem/procedurals-web` repository. The released library baseline has 117 workflow IDs,
99 canonical instruments and 14 discovery families. The historical Go-store architecture
is not the current persistence authority; private tenant work remains separate.

The [collection report](external-art-corpus.md) records the expanded source corpus, and the
[default palette library](default-palettes.md) supplies 50 reusable color choices. The research
plan prioritizes new artist capabilities in p5.js; target parity remains a separate workstream.
The [first implementation batch](external-expansion-first-batch.md) delivers three motif
compositions, radius queries and synchronous pair responses with two native interaction studies.

## Remaining work and dependencies

### Current creative priority

The 27 September 2026 next-release direction supersedes both the old expansion-by-family
queue and the “strengthen all existing studies first” ordering. The authoritative
[next-release roadmap and implementation guide](next-release-roadmap.md) now specifies
56 capability briefs, functional composition, dependency waves and acceptance scenarios.
[Current progress](next-release-progress.md) records completion state and the next bounded slice;
[visual research](next-release-visual-review.md) records the 24-group evidence and its limits.

Greatly expand the p5.js apparatus of discovery and incremental canvas composition:
closer to **50 substantial artistic additions than ten**, without a manufactured quota.
The primary architecture is **functional composition**: techniques consume compatible
techniques, with placement independent of marks, paths independent of materials, regions
independent of fillers, and fields independent of their consumers. A dot is one possible
action at a site, not the only action a distribution algorithm can perform.

Extract useful parts of existing instruments, improve them and create new compositions
in coordinated slices. Prefer reusable computations and higher-order composition over
dozens of independent renderers. Consolidate redundant entries. Existing web-Studio artwork
is disposable. Apply [creative quality](creative-quality.md): consequential construction
controls, reproducible structural alternatives, useful fragments and real layered work.
No function count or preset count substitutes for artistic capability.

The [library-owned baseline](../evidence/web/instrument-library-baseline.json) is released
as `web-toolkit-v0.2.2`. Future web integration consumes `@procedurals/instruments` for
controls, construction, rendering, preparation, metadata and guides; UI, document storage
and renderer lifecycle remain in the app. The three flagged color studies now have
editable construction and scoped real-interface/composition reviews. The next-release
research compares this exact baseline against the expanded visual corpus; historical
family plans do not establish current gaps. Packaging does not admit the 25 source-assessed
retained studies or advance other-target support.


| Workstream | Next bounded outcome | Acceptance boundary |
|---|---|---|
| P5.js creative instruments | Implement W0 from the [next-release guide](next-release-roadmap.md): freeze typed local contexts, extract existing producers/materials, and prove point/path/region substitution in Studio before broad rollout | Real-interface exploration, meaningful structural choices, reproducible discovery and useful layered compositions; no unrelated port or certification gate |
| Target parity | Review/port accepted capabilities using the [port handoff](porting-resume.md) | Frozen semantics/fixtures, actual target-native evidence and root integration; no inherited support claims |
| Recipe execution/export | Reconcile the [Java prototype](java-recipe-preview.md) and [execution direction](../design/recipes/execution-direction.md), then freeze a bounded catalog-backed composition slice | Explicit seed/canvas/time/assets/capabilities, type validation, round-trip serialization and installed exported replay for claimed targets |
| Browser composition | Extend the current Studio with new supported bindings and explicit asset/renderer adapters | Preserve working edits, catalog identities, keyboard controls, bounded rendering and honest export scope |
| MCP and prompt planning | Follow the [harness proposal](prompt-studio-harness.md): workflow candidates, isolated p5 source, Processing Java profile and blind pilot | Shared catalog, bounded execution, editable layers, isolated benchmark and per-target evidence; MCP wraps the same handlers |
| Evidence and recreation coverage | Reconcile new snapshot records and investigate concrete missing artist capabilities | Root-reviewed evidence changes; demonstrated recreation kept separate from projected coverage |

Browser study work need not wait for target parity, private tenant milestones or unrelated
historical catalog bindings. Use an isolated local preview; do not reopen disabled visitor
ingress. Persistence/security changes retain their separate validation requirements.
Target-specific portable exports and general operation graphs still require separate execution contracts and evidence.
The [MCP/web requirements](mcp-web.md) remain the broader target; the prototype does not
satisfy the general portable recipe or four-target export objective.

## Gates for future implementation

- Start from the artist task and evaluate existing composition before adding operations.
  Use [artist-capabilities](artist-capabilities.md); use [recreation coverage](recreation-coverage.md)
  only for explicit recreation or coverage claims, not as a gate on original studies.
- Freeze the affected portable contract and fixtures before independent target work.
  New snapshots require hash-based reconciliation of affected decisions, not a blanket reset.
- Use existing recipe-execution and catalog-synchronization skills before accepting persisted
  recipes, executors, exporters or generated product surfaces. Use the now-created
  [prompt-evaluation skill](../skills/prompt-to-recipe-evaluation/SKILL.md) before
  natural-language planning or its first benchmark.
- Prompt evaluation must accept semantically equivalent recipes and separately score intent,
  provenance, execution, cross-target behavior, visual results and coverage. Recorded planner
  outputs test protocol behavior; live-model quality is a separate observation.
- Keep full-corpus benchmark certification separate from scoped releases. Missing required
  references or outputs, empty evaluations and filtered runs cannot establish certification.

## Batch planning

For each selected workstream, root records the bounded deliverable, frozen dependencies,
file ownership, distinguishing checks and stopping condition. Delegate independent work
using [agent briefs](agent-briefs.md); integrate at useful checkpoints. Reuse established
render/package infrastructure and update current state by replacement, not accumulated history.
