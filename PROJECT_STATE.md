# Current project state

Updated 2026-09-21. Read with [AGENTS.md](AGENTS.md); open other documents only for the task.
This is a current snapshot. Historical plans and reviews are not an active assignment queue.

## Accepted capabilities

- Java implementation objective: **31 operations, 37 editable workflows**. Java 0.35 runtime
  baseline remains `d7f95a06f55fd0937ebb2c12bb2192c7644922c4`; see the
  [completion review](evidence/distribution/java-completion-review.json).
- p5.js: **89 conformant cores, 89 operations with scoped native coverage, 125 editable
  package workflows**, and five scoped technique attestations. These dimensions are separate.
  [Port status](docs/port-integration-status.md) links the historical integrations.
- [Survey coverage batch 1](evidence/coverage/batch1/integration-review.json) adds exactly
  seeded pixel grain, sampled-field displacement and octave gradient noise. Each has a
  reviewed contract, independent fixtures, an editable p5 study, native controls/reset/reload/save,
  performance evidence and a withheld source transfer. Other targets remain deferred.
- The first grain candidate failed SSIM0.674. Its [replay successor](evidence/reproductions/survey-coverage-batch1/grain-replay/root-review.json)
  restores the recorded source-layout RNG and passes the unchanged gate at **SSIM0.995**,
  adding one demonstrated structural recreation. Both field studies remain independent
  components. All three withheld transfers remain source walkthroughs.
- [External expansion batch A/B](evidence/expansion/first-batch/root-review.json) adds radius-pair
  queries, synchronous pair-force steps and five original editable studies. Source and installed
  package lifecycle checks pass; no artist recreation or new technique attestation is claimed.
- [Dynamics and fields batch](evidence/expansion/second-batch/root-review.json) adds 15 p5 cores,
  a retained-frame WEBGL adapter and ten package studies: contact memory, sensing/flocking,
  width-aware geometry, connected/elastic growth and periodic dye transport. Source and
  installed package checks pass across83 paired frames; new web integration is still pending.
- [Visual operations acceptance](evidence/expansion/visual-operations/root-review.json)
  attests the five exported operations: weighted-image sampling and centroids,
  recorded-control sampling, mesh surface attributes and implicit ray marching. Each has a
  conformant p5.js core and four new scoped native studies (weighted-image-atlas,
  word-echo, surface-attribute-vessel, implicit-volumes) with re-run harness evidence.
  Technique attestations are out of scope, and the generated reference file update waits on
  the catalog binding reconciliation.
- Packages are reviewed local artifacts, not registry publications. This work does not imply
  a portable recipe executor, full-corpus certification or equivalent target ports.

## Target support

Counts derive from `catalog/validation/` and its bound reviews. Frozen contract prose and
old example headers are not current support authority.

| Target | Conformant core | Scoped native | Scoped technique |
|---|---:|---:|---:|
| Processing Java | 31 | 31 | 26 |
| p5.js | 89 | 89 | 5 |
| py5 | 10 | 10 | 4 |
| Processing Android | 10 | 10 | 4 |

The [coverage report](docs/survey-operation-coverage-report.md) now records **474/800 plausible**
recreations, including **381/800 operation-led**. Step0 reconciliation added20 to each original
439/346 total; the three new capabilities add another15. Demonstrated originals are now **5**, including the accepted grain replay.
The report includes all69 family dispositions and all three denominators:800 assessed,
826 snapshot notes and901 targets. Missing/unassessed cases never count as supported.

## Web application

- Multi-tenant extraction is the current web task. The private successor is
  [cdlethem/procedurals-web](https://github.com/cdlethem/procedurals-web).
  Public toolkit inputs are published as `web-toolkit-v0.2.1`; the private source is
  recoverable remotely. Checkpoint B clean-image verification and public cutover are
  still in progress; no tenant or visitor launch acceptance is claimed.
- Checkpoint A containment removed app ingress on 8443 and 8444 and stopped the
  working preview. Legacy storage services remain loopback-only as migration inputs.
  The release/preview URLs in the historical reviews below are not currently served.
  Do not reopen the shared-store application for visitors.

- The extracted baseline generates 106 gallery/Studio workflows and 92 API entries,
  with `studioBinding.catalogSha256` unchanged at
  `66da2c7f786aec46853cfb811a694e3dac29bac5039cba2f0da0b746104de634`.
  These app counts are not target-support attestations.
- Preserve both completed visual baselines. The
  [logo-led identity review](evidence/web/logo-led-site-identity.json) records **art with knobs**,
  IBM Plex typography, brick-red accents and stepped geometry. The
  [quality release review](evidence/web/creative-quality-live-release.json) binds the
  pre-containment release at `eb2bdfdc` in `.work/study-quality-release`.
  Its [copy-release predecessor](evidence/web/study-copy-live-release.json) and
  [restoration review](evidence/web/completed-redesign-restoration.json) remain historical.
- [Workspace](evidence/web/studio-workspace-review.json),
  [v3](evidence/web/app-v3-review.json),
  [prompt integration](evidence/web/prompt-web-integration-review.json),
  [saved layers](evidence/web/generated-layer-review.json) and
  [palette library](evidence/web/palette-library-review.json) retain their exact historical
  source bindings. The [architecture](docs/web-app-architecture.md) documents the old
  shared-store boundary, not tenant authorization.
- The [historical-source archive review](evidence/conformance/public-web-historical-source-archive-review.json)
  preserves exact missing-source recovery for 49 bound app files and two app-only
  render runners. It supersedes the [initial app-only binding](evidence/conformance/public-web-historical-source-archive-review-initial.json),
  preserved from `f19481fc`; it does not accept changed sources or repair unrelated stale reviews.
- Preserve migration inputs: named projects in `.work/web-projects`; shared prompt
  artifacts, saved layers and palettes in `.work/web-palettes-release/.work/harness`.
  These remain private/offline migration inputs, never public toolkit assets.

## External reference research

The [corpus](docs/external-art-corpus.md) contains 6,497 distinct local images across 24 artist/studio
groups, representing 1,988 of 2,023 selected records; 383 source URLs remain unavailable. The
[58-family p5 expansion plan](docs/external-art-p5-expansion-plan.md) compares current capabilities
and prioritizes future work. [Root review](evidence/external-art/2026-09/root-review.json) records
visual scope and access gaps; no external artwork recreation is accepted by this research.

## Remaining work and ownership

Current assignment is the complete [multi-tenant plan](MULTI_TENANT_WEB_PLAN.md),
checkpoints A–F, with private application work in its successor repository. Preserve
both completed web redesigns and the [creative-quality standard](docs/creative-quality.md).
The capability/port backlog below remains separate from this assignment.

The survey batch and first [external expansion batch](docs/external-expansion-first-batch.md)
are complete at their declared scope. The maintainer now requires the **entire external expansion
plan implemented**. [Execution scope](docs/external-expansion-execution.md) carries the current
starting point, the ranked next actions and the open findings; batch completion is an
integration checkpoint, not the task endpoint. The
[integration checkpoint](evidence/web/main-integration-checkpoint.json) records what the prior
merge settled: the nine dynamics studies are now interactive (worst single edit 635ms, was 9.2s).
The [visual operations acceptance](evidence/expansion/visual-operations/root-review.json) now
records root acceptance for the five exported operations (weighted-image, recorded-controls,
mesh-attribute, implicit-ray), with conformant p5.js cores and four scoped native studies. The
nine dynamics studies are art-directed and pass creative review (see the
[creative review](docs/dynamics-creative-review.md)); the catalog
binding reconciliation (stale hashes for the shared web surface, the package index and py5
records) is complete. The Design-family gate is settled: the intersection-graph editing
and RNG-evolution studies deliver as compositions of the four accepted
connected-growth-and-graphs operations; the neighborhood-growth study carries the
node-insertion coupling (deterministic proposal pool plus an explicit old-density interval),
both studies pass the 18 September creative review, and the four replay-model studies now
prepare their step chains cooperatively, with every edit answering under 0.2s in the
measured interface (worst cold-cache key change 1.0s, main thread responsive). The first
I-family slice, `fractal.flame-accumulate-2d`, the second, `complex.escape-distance-2d`
(bounded escape-time iteration plus the derivative distance estimate), and the third,
`growth.space-colonization-step-2d` (tips growing toward distributed sources with source
consumption and branching), are each implemented with a reviewed contract, bound fixtures
and an editable p5 study; the remaining I-family slices (diffusion-limited aggregation,
multiscale competition, maps) and the deeper-audit gaps are next. The additive barrel
exposure keeps the pre-existing binding backlog stale, so the reference regeneration stays
blocked by that backlog, not by the I-family slices.

- Other-target ports remain separate. The [port handoff](docs/porting-resume.md) tracks Python
  attestation reconciliation, Android ProfileMarks lifecycle validation and Java backlog.
  Three Python cores remain pending source; older Python/Android work at `2f9418e3` requires
  explicit transplant and review. SpringMarks p5 has scoped animation acceptance.
- Preserve concurrent Android ProfileMarks edits, `.gradle/` directories and unrelated work.
  The [export successor](evidence/conformance/external-expansion-surface-review.json) binds the
  two new operations and default palette data while preserving historical acceptance bytes.
- The [Java recipe preview](docs/java-recipe-preview.md) is a prototype. Before natural-language
  recipe planning/its first prompt benchmark, create the missing prompt-to-recipe evaluation
  skill after catalog/executor work, as required by AGENTS.md.

## Evidence and focused commands

Use [survey/snapshot.json](survey/snapshot.json), exact note hashes and linked raw evidence.
The authorized incomplete snapshot has826 reports including26 unassessed blank baselines;
75 target sketches are outside it. Native rendering always uses the shared machine lease.

```sh
uv run python tools/check_catalog.py
uv run python tools/check_phase2_design.py --contract-cluster <id>
python3 tools/update_survey_coverage.py --check
python3 tools/with_native_render_lock.py -- <native command>
python3 tools/build_visual_review.py
node tools/build_ported_javascript_package.mjs .work/dist/<fresh-directory>
```

The local [visual gallery](.work/visual-review/index.html) links reviewed images; inclusion
is navigation, not acceptance. The [artist architecture](docs/artist-capabilities.md),
[agent briefs](docs/agent-briefs.md) and [generated reference](docs/reference/operations.md)
cover admission, bounded delegation and current operation semantics.
