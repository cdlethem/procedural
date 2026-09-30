# Procedurals — agent brief

## Read on resume

Read this file and [PROJECT_STATE.md](PROJECT_STATE.md), then only the documents needed
for the assigned task. Do not preload old checkpoints, the full operation reference,
all skills or the candidate ledger. Current user instructions override older scheduling.
Git history preserves prior handoffs; it is not an active task queue.

## Mission and architecture

Build a reusable generative-art toolkit informed by the surveyed Processing corpus and
other useful artistic and technical inputs. Processing 4 Java is the reference implementation;
language-neutral contracts support independent p5.js, py5 and Android implementations.
Native sketches are editable examples, not the core API.

Capability and clarity take priority over completeness. Start from what an artist wants
to make and the algorithmic work the package removes. Prefer composing existing operations
before adding public surface. One-off aesthetic choices belong in examples.
Useful compound conveniences are allowed when they preserve
substitution points and share the underlying contracts. Function counts are not a quota.

Artist-facing work follows [creative-quality.md](docs/creative-quality.md): root freezes
meaningful construction controls, separates slider intervals from hard limits, then
personally explores the real interface and reviews diverse outcomes and responsiveness.
Rendering/replay/export checks alone do not admit a study. Existing entries are subject
to the same standard; preserve historical technical evidence without grandfathering quality.

The current artist-facing goal is a **p5.js apparatus of discovery and a tool for
incrementally building a unique canvas**. Expose consequential construction decisions,
not only styling of hardcoded scenes. Seeds should produce structural alternatives where
chance belongs; appearance changes should not reroll them. Useful fragments and negative
space matter as much as attractive defaults. Review real layered compositions, not only
standalone screenshots. The next-release direction is **broad capability expansion through
functional composition**: separate placement from marks, paths from materials, regions from
fillers, and fields from their consumers; techniques may take compatible techniques as inputs.
Improve and extract reusable parts of existing entries alongside substantial new compositions,
not as an exhaustive prerequisite. Consolidate or retire entries that add nothing distinct.
Existing web-Studio artwork is disposable: saved-work compatibility, migration shims and legacy
renderers must not constrain this baseline. Reusable instrument definitions, drawing code and
study guides belong to the library; the web app consumes a versioned package and owns its UI,
composition document, persistence and renderer lifecycle. Follow [roadmap](docs/roadmap.md)
and [next-release progress](docs/next-release-progress.md) for authoritative scope and sequencing.

Evaluate the tool holistically. The survey in `../genart-survey/out/` is one source of
mechanisms, control relationships and visual ideas, not a recreation checklist. Do not
require recreation-versus-borrowing labels for creative work. Judge an addition by what
artists can discover and compose with it, how it complements existing capabilities and
whether its controls expose useful decisions.

Study exploration and public API admission are different lifecycles. A p5 composition
using existing operations needs a short creative brief and real interface review, not a
new operation contract, corpus recreation, target port, full-catalog recertification or
new validation framework. Original studies need not imitate surveyed artwork. Keep
contracts/fixtures for new or changed public computations, and provenance for reused
material. Run checks relevant to changed behavior; unrelated historical binding debt
must not block creative iteration. Reliability checks protect the artist's work but do
not establish that an instrument is interesting.

Root owns capability selection, public boundaries, important semantics and final integration.
Personally inspect decisive reports, implementation and representative native images.
Workers propose or implement frozen behavior; they do not independently admit public APIs,
author root acceptance records or accept shared target support.

For a new public capability, read [artist-capabilities.md](docs/artist-capabilities.md).
Record the artist task, computation removed, alternative, reusable output, meaningful
edit, transfer case and evidence limits. Ordinary artistic drawing is allowed.
Use [recreation-coverage.md](docs/recreation-coverage.md) only when making an explicit
recreation or corpus-coverage claim; its taxonomy is not a creative-development gate.

## Evidence and admission

The checked-in [survey snapshot](survey/snapshot.json) and `survey/out/index.jsonl`
identify the evidence revision and targets. Notes live at `survey/out/<sketch>/notes.md`;
baseline/variant JSON records accompany them. Query `data/corpus.sqlite` and generated
`reports/` for provenance and measured parameter sensitivity. Images are separate inputs.

The maintainer authorized work from the incomplete snapshot; do not reinstate the original
901-report gate. An evidence gap blocks its dependent decision, not the whole project.
Reconcile changed notes by hashes before carrying forward affected decisions or contracts.
Missing reports never prove family absence. Preserve raw records and normalization diagnostics.

Cluster by computation, not names or frequency. Verify exact candidate identity, parent-note
passage, inputs, outputs and state before keep/merge/reject. Separate extracted components
from composite helpers and preserve unresolved ingredients. A written API design and reviewed
operation contract precede implementation. `tools/check_phase2_design.py --contract-cluster
<id>` checks recorded prerequisites; it does not approve semantics.

Keep motivating sketch citations in API references, contracts and evidence. Artist guides
lead with the visible result, explain how to use it, and put controls and editable parameters
in tables describing their canvas effects. Keep provenance and acceptance bookkeeping out
of teaching copy. Exposure, defaults, hard bounds and
recommended ranges are separate decisions. Measured change does not alone establish useful
ranges; none/subtle results, nondeterminism and suspect headless shader runs weaken evidence.
Do not invent ranges or visual behavior. Distinguish corpus observations from design choices.

## Implementation and acceptance

`catalog/operations/` specifies behavior; shared fixtures specify expected results.
`catalog/validation/` and its bound root reviews determine current target acceptance.
Historical status prose in example headers, frozen contracts or old plans is not current
support authority.
Keep RNG, noise, time, ordering, numeric behavior, ownership and failure semantics explicit.
Resolve contract ambiguity once with root, not separately in each target.

Java-only capability slices are permitted; ports can follow in bounded batches. Never infer
native or technique support from a core fixture pass, another platform, compilation or mocks.
Define exact, structural/perceptual or technique-level reproduction scope before rendering.
A selected suite is not full-corpus certification. Do not weaken checks, omit failures or
mark incomplete work accepted to publish a checkpoint. Clearly labelled drafts may be tracked.

Use the relevant existing skill only when its lifecycle applies:

| Task | Skill |
|---|---|
| Parameter exposure/default/range evidence | [parameter-evidence](skills/parameter-evidence/SKILL.md) |
| Approved computation to portable contract | [operation-contract](skills/operation-contract/SKILL.md) |
| RNG, noise, time, ordering or portable arithmetic | [deterministic-generative-semantics](skills/deterministic-generative-semantics/SKILL.md) |
| Core or target implementation | [portable-operation-implementation](skills/portable-operation-implementation/SKILL.md) |
| Renderer, image, font, assets or lifecycle | [capability-and-adapter-boundaries](skills/capability-and-adapter-boundaries/SKILL.md) |
| Motivating native reproduction | [corpus-reproduction](skills/corpus-reproduction/SKILL.md) |
| Count/frame/resolution/mesh-sensitive work | [generative-performance](skills/generative-performance/SKILL.md) |
| Derived reference, UI, MCP or export metadata | [catalog-surface-synchronization](skills/catalog-surface-synchronization/SKILL.md) |
| Persisted recipes, execution or export | [recipe-execution-and-validation](skills/recipe-execution-and-validation/SKILL.md) |

Before natural-language recipe planning or its first prompt benchmark, use the existing
`skills/prompt-to-recipe-evaluation/SKILL.md`. Its semantic, provenance, execution,
cross-target, visual and coverage criteria apply to planner claims, not to ordinary
interactive study exploration. No skill-creation gate remains outstanding.

## Sustainable work and delegation

Use bounded batches with clear deliverables, ownership, acceptance commands and stopping
conditions. [Agent briefs](docs/agent-briefs.md) supplies the assignment template.
Luna handles focused evidence, docs and routine established checks; Terra handles coherent
implementation/example slices and first-pass debugging. Root reviews consequential decisions
and final results, and may implement directly when delegation overhead exceeds its benefit.
There is no standing Sol review gate or requirement to occupy all worker slots.

Pass short task-specific context, not full history. Reuse existing harnesses and packaging.
Run focused checks once per meaningful change; repeat for changed inputs, failures or a
specific unresolved concern. Do not default to new checkers, dossiers or render matrices.
Report capabilities and scenarios rather than loop-expanded assertions. Do not invent quota
balances or reliable completion dates. Do not continue speculative work merely to stay busy.

## Native rendering and visual review

Every native render from every checkout must use the shared machine lease:

```sh
python3 tools/with_native_render_lock.py -- <existing native command>
```

The lease is `/home/colin/dev/procedural/.work/native-render-machine.lock`. Checkout-local
locks are subordinate; never bypass the shared lease or delete its file to resolve contention.
Prefer reading over rendering; render when visual evidence is needed.

Register meaningful outputs in `docs/visual-review.json`, with review-stage labels and evidence
links, then run `python3 tools/build_visual_review.py`. The local gallery is
`.work/visual-review/index.html`. Link original images rather than copying them; gallery
inclusion is navigation, not acceptance. Images and contact sheets stay out of Git.

## Repository integrity and publishing

Keep public toolkit work in this repository and private gallery/Studio work in
`/home/colin/dev/procedurals-web`; do not restore extracted app code here. Temporary work
belongs in the relevant checkout's ignored `.work/`.
Never add rendered images, toolchains, environments, logs, temporary builds or copied assets
to Git. Preserve source authorship, licensing and explicit provenance for reused code,
including third-party numerical helpers. Prefer independently specified operations.

Do not hand-edit generated `survey/`, `data/`, `reports/`, `benchmarks/corpus.json`,
`analysis/phase2/` or `design/phase2/candidate-triage.json`; use their tools.
`design/phase2/cluster-decisions.json` is authored state: never replace it with suggestions.
Preserve historical acceptance records and artifact hashes; document successors explicitly
when changing a live bound implementation. Historical package contents need not match HEAD.

Root is authorized to commit and push tested, reviewed milestones to main without asking.
Check remote state and integrate safely first. Never force-push, discard work or overwrite
another worker's changes. Use useful integration checkpoints, not every intermediate edit.
Port workers use separate branches pinned to an agreed baseline and return patches/evidence;
root accepts semantic decisions, native results and shared support before integration.

Keep PROJECT_STATE as a current snapshot: replace stale entries instead of prepending history.
Put standing rules here, future sequencing in the roadmap and target work in the port handoff.
Link evidence rather than copying logs. Keep the normal resume read to roughly 250 lines.
