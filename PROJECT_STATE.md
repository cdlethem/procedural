# Current project state

Updated 2026-09-30. Read with [AGENTS.md](AGENTS.md); open other documents only for the task.
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

- Multi-tenant work continues separately in the private successor,
  [cdlethem/procedurals-web](https://github.com/cdlethem/procedurals-web).
  Public toolkit inputs are published as [`web-toolkit-v0.2.3`](https://github.com/cdlethem/procedural/releases/tag/web-toolkit-v0.2.3)
  (source `a98a0ae`): JavaScript operations, catalog and the instruments package with
  **174 study IDs / 156 canonical instruments**, control groups and `inspectorItems`.
  The private app pins all three release URLs and npm integrity records, renders the grouped,
  visibility-filtered inspector, and ships the matching private preview release. Checkpoint B
  extraction remains historical evidence; tenant checkpoints C–F stay separate.
  No tenant or visitor launch acceptance is claimed.
- **Unreleased since 0.2.3: control stages and featured knobs** ([control groups](docs/control-groups.md)).
  Every top-level control group states its `stage` (`form`, `process`, `material`, `color`,
  `frame`; `CONTROL_STAGES` fixes the order), nested groups inherit it, loading derives
  `Parameter.stage`, and `stageItems(id, values)` buckets the visible inspector by stage.
  `InstrumentDefinition.featured` names one to four first-touch controls (numbers or selects,
  visible at the defaults); `featuredControls(id)` falls back to the first `form` group. All
  174 definitions are staged; six carry `featured` (hyperbolic-gardens, crossing-lace,
  dry-bristles, river-ribbons, point-clouds, aggregation-colonies). `tests/control-groups.test.ts`
  covers the contract; the full instruments suite passed 1648/1648 after the change. The
  Every instrument also states its `procedure` (exactly two active sentences, 60–360 characters,
  validated by `validateProcedure`): what the code does to make the image, shown by the app beside
  the live picture. All 174 were rewritten by hand from the guides. The full suite passes 1650/1650. The private app's landing tour and staged study
  controls consume this through the local toolkit preview and need a `web-toolkit-v0.2.4` release to pin.
- Unreleased instruments can still preview in the private app: its `npm run toolkit:local`
  runs `tools/build_web_toolkit.mjs --allow-dirty` and installs those tarballs unsaved.
  Dev server: https://eunoia.tailf03dad.ts.net:46590 (443 belongs to the separate Airflow
  project, whose workers call its execution API there).
- Checkpoint A containment removed app ingress on 8443 and 8444 and stopped the
  working preview. Historical storage remains loopback-only; its artwork need not migrate.
  The release/preview URLs in the historical reviews below are not currently served.
  Do not reopen the shared-store application for visitors.

- The historical extraction baseline generated 106 gallery/Studio workflows and 92 API
  entries, bound to `66da2c7f786aec46853cfb811a694e3dac29bac5039cba2f0da0b746104de634`.
  The current library has **117 workflow IDs / 99 canonical instruments / 14 families**.
  [The library baseline review](evidence/web/instrument-library-baseline.json) binds its
  released artifacts, standalone installed rendering and private app consumption.
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
- Historical named projects in `.work/web-projects` and prompt artifacts, saved layers
  and palettes in `.work/web-palettes-release/.work/harness` remain private/offline.
  Saved Studio artwork is disposable, not a migration requirement or public toolkit input.

## External reference research

The [corpus](docs/external-art-corpus.md) contains 6,497 distinct local images across 24 artist/studio
groups, representing 1,988 of 2,023 selected records; 383 source URLs remain unavailable.
The [58-family p5 expansion plan](docs/external-art-p5-expansion-plan.md) and its
[root review](evidence/external-art/2026-09/root-review.json) are historical research;
many proposed families are now implemented. The new [24-group visual synthesis](docs/next-release-visual-review.md)
records the 229-sheet delegated survey and root's 58 mapped original-image views, with
source/process/installation distinctions and access limits. No recreation is accepted.

## Remaining work and ownership

The next-release program is **built, released and live**: all **56 capability briefs** of the
[roadmap](docs/next-release-roadmap.md) have studies (W0–W4 plus brief 27), published as
[`web-toolkit-v0.2.3`](https://github.com/cdlethem/procedural/releases/tag/web-toolkit-v0.2.3)
with **174 study IDs / 156 canonical instruments**, control groups and conditional controls
(F9/F10), 1,645 package tests. The private app adopted it and passed an authenticated real-Studio
check (new studies layered over an existing draft, grouped/filtered inspector, save/reload,
PNG export). The [progress snapshot](docs/next-release-progress.md) records the evidence, the
review standards adopted and the remaining open items (inert-but-visible controls, ratio locks,
discovery taxonomy, two retrofit candidates). This is not whole-gallery creative acceptance,
cross-target parity or a portable recipe executor.

- Separate placement/marks, paths/materials, regions/fillers and fields/consumers. Ordinary
  functions serve code authors; Studio needs serializable equivalents backed by the same
  implementations. Extract and improve existing instruments alongside new compositions.
  The earlier “strengthen everything first” ordering is superseded. Keep consequential
  controls, purposeful seed variation, useful fragments, negative space and real layered
  review. Consolidate redundant entries; existing artwork is disposable.
- Every instrument declares semantic [control groups](docs/control-groups.md) with
  ratio-lockable `proportional` clusters; drawing is unchanged. Released in 0.2.3; the app
  renders `inspectorItems` but has no ratio lock yet.
- Reusable controls, construction, drawing, preparation, metadata, guides and source now
  live in `packages/instruments/`. The private `/home/colin/dev/procedurals-web` host owns
  UI, document envelopes, transforms/opacity, p5 lifecycle and storage—not copied drawers.
  Its released gallery is at 174 workflows / 156 canonical instruments / 92 API entries (0.2.3).
- The preceding bounded pass scanned the 55 IDs not revised previously, revised 27, and
  added **Harmonic Traces, Phyllotactic Whorls and Contour Relief**. The subsequent color pass
  brought that historical checkpoint to **81 revised existing IDs plus eleven additions**
  with scoped creative reviews. The three new reference studies are admitted separately above;
  neither checkpoint is whole-gallery creative acceptance.
  Revised sources include mesh profiles, annular fragments, spring/force replay, costs,
  vector fields, cell relaxation, binary rows, connector tiles and reusable path materials.
- In the preceding pass, root exercised all 30 changed studies and reviewed 60 distinct
  recipes, improved defaults and 15 layered pairs in both orders. All 27 predecessor
  defaults replay pixel-identically; all 60 edited canvases match the actual Studio and
  harness compositors. Historical technical/visual evidence is preserved, not overwritten.
- Eight additional shared families consolidate equivalent instruments; Grammar Paths and
  Path Materials gain another recipe. All old URLs and IDs remain. Root exercised 35
  picker selections across the 14 families and three additions, refreshed all 30 detail
  previews and six live-carousel previews, and fixed stale carousel inset/reseed controls.
- Perceptual Bands now exposes a piecewise silhouette, gaps, global trim and editable color
  stops; Oklab Orbits exposes eccentric/twisted arc construction and rank/arc coloring;
  Quantized Stripes accepts weighted color sequences and area-correct strip/tile layouts.
  Root explored their real controls, reviewed nine variants, checked 19 exact Studio/harness
  replays and six layered compositions, and refreshed their guides and previews.
- The remaining **25 retained IDs** have source-level dispositions, not new creative
  acceptance. All 117 installed defaults rendered independently of the app and matched
  the reviewed source PNGs exactly. Packaging is technical evidence, not creative admission.
- Contour Relief intersects its actual grid triangles with horizontal height levels; it
  does not drape unrelated marching-squares curves over a different surface. Flat contour
  views retain marching squares. Harmonic Traces is parametric drawing, not pendulum
  physics; Phyllotactic Whorls is ranked placement, not botanical growth or packing.
- The instrument release advances reusable web-study packaging, not shared target support.
  No deployment or authenticated Studio persistence/export claim: the isolated preview
  lacks its private backend. Deterministic instruments expose no cosmetic seed.
- Existing-operation study compositions do not wait on new operation contracts, corpus
  recreation, target parity or historical binding reconciliation. Preserve deterministic
  replay, bounded execution, compositing and honest export behavior, not saved-work migration.
  New/changed public algorithms retain their own contract and fixture requirements.
- The [external expansion execution record](docs/external-expansion-execution.md) preserves
  prior implementation and evidence. Its older imperative to finish every family is not
  the current scheduling rule. Historical dynamics and operation reviews remain evidence
  of their stated scope, not exemptions from the new creative review.
- Private tenant work and the [multi-tenant plan](MULTI_TENANT_WEB_PLAN.md) are separate.
  Preserve its active work and disabled public ingress; use isolated local previews.

- Other-target ports remain separate. The [port handoff](docs/porting-resume.md) tracks Python
  attestation reconciliation, Android ProfileMarks lifecycle validation and Java backlog.
  Three Python cores remain pending source; older Python/Android work at `2f9418e3` requires
  explicit transplant and review. SpringMarks p5 has scoped animation acceptance.
- Preserve concurrent Android ProfileMarks edits, `.gradle/` directories and unrelated work.
  The [export successor](evidence/conformance/external-expansion-surface-review.json) binds the
  two new operations and default palette data while preserving historical acceptance bytes.
- The [Java recipe preview](docs/java-recipe-preview.md) is a prototype. The
  [prompt-evaluation skill](skills/prompt-to-recipe-evaluation/SKILL.md) exists; use it for
  planner work rather than recreating it or making it a gate for interactive p5 studies.

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
