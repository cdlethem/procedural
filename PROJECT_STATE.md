# Current project state

Updated 2026-09-17. Read with [AGENTS.md](AGENTS.md); open other documents only for the task.
This is a current snapshot. Historical plans and reviews are not an active assignment queue.

## Accepted capabilities

- Java implementation objective: **31 operations, 37 editable workflows**. Java 0.35 runtime
  baseline remains `d7f95a06f55fd0937ebb2c12bb2192c7644922c4`; see the
  [completion review](evidence/distribution/java-completion-review.json).
- p5.js: **67 conformant cores, 67 operations with scoped native coverage, 106 editable
  package workflows**, and four scoped technique attestations. These dimensions are separate.
  [Port status](docs/port-integration-status.md) links the historical integrations.
- [Survey coverage batch 1](evidence/coverage/batch1/integration-review.json) adds exactly
  seeded pixel grain, sampled-field displacement and octave gradient noise. Each has a
  reviewed contract, independent fixtures, an editable p5 study, native controls/reset/reload/save,
  performance evidence and a withheld source transfer. Other targets remain deferred.
- The grain original benchmark **failed SSIM 0.674 < 0.7** and earns no demonstrated credit.
  The two field studies demonstrate independent components. All three transfers are source
  walkthroughs; none is a rendered transfer recreation.
- Packages are reviewed local artifacts, not registry publications. This work does not imply
  a portable recipe executor, full-corpus certification or equivalent target ports.

## Target support

Counts derive from `catalog/validation/` and its bound reviews. Frozen contract prose and
old example headers are not current support authority.

| Target | Conformant core | Scoped native | Scoped technique |
|---|---:|---:|---:|
| Processing Java | 31 | 31 | 26 |
| p5.js | 67 | 67 | 4 |
| py5 | 10 | 10 | 4 |
| Processing Android | 10 | 10 | 4 |

The [coverage report](docs/survey-operation-coverage-report.md) now records **474/800 plausible**
recreations, including **381/800 operation-led**. Step0 reconciliation added20 to each original
439/346 total; the three new capabilities add another15. Demonstrated originals remain **4**.
The report includes all69 family dispositions and all three denominators:800 assessed,
826 snapshot notes and901 targets. Missing/unassessed cases never count as supported.

## Web application

- The [web app](apps/README.md) has90 gallery/Studio studies and generated API pages for67
  operations. The three coverage studies are packaged native examples; the web study count
  stays90. The app compositor remains separate from portable recipes/MCP.
- Layer editing, custom palettes, source inspection, undo/redo, local recovery, JSON/PNG export
  and Go storage are reviewed. [Workspace review](evidence/web/studio-workspace-review.json),
  [v3 review](evidence/web/app-v3-review.json) and [architecture](docs/web-app-architecture.md)
  describe layout, persistence and boundaries.
- Prompt drafts and applied source/layer revisions are covered by the
  [prompt integration](evidence/web/prompt-web-integration-review.json) and
  [saved-layer successor](evidence/web/generated-layer-review.json). See the
  [artist guide](docs/prompt-studio-guide.md). Generated artifact JSON needs the harness service.
- Named manual/generated palettes are covered by the
  [palette review](evidence/web/palette-library-review.json). This does not accept concurrent
  default-palette work or additional API exports.
- Reviewed live deployment remains the prior90-study release at
  https://eunoia.tailf03dad.ts.net:8443/ (Next3002, Go8088), from `.work/p5-tenfold-release`.
  `procedurals-web` and `procedurals-api` user services own the processes. The
  [deployment review](evidence/web/p5-tenfold/deployment.json) records its HTTPS checks;
  this coverage batch has not been deployed.
- Named projects live in `.work/web-projects`. The current release links shared prompt
  artifacts, saved layers and palettes under `.work/web-palettes-release/.work/harness`.

## Remaining work and ownership

The [batch-1 handoff](docs/handoff-survey-coverage-batch1.md) is implemented to the scoped
acceptance above. Stop after these three capabilities. [Roadmap](docs/roadmap.md) owns future
sequencing; rectangle partitions, heading wander, simplex noise and shader work are not
part of this batch. Reproduction failures and residual families are retained in its review.

- Other-target ports remain separate. The [port handoff](docs/porting-resume.md) tracks Python
  attestation reconciliation, Android ProfileMarks lifecycle validation and Java backlog.
  Three Python cores remain pending source; older Python/Android work at `2f9418e3` requires
  explicit transplant and review. SpringMarks p5 has scoped animation acceptance.
- Preserve concurrent Android ProfileMarks edits and `.gradle/` directories, external-art
  research, and web/default-palette work. The batch was checked in an isolated copy and its
  entrypoint review binds only its three exports. A later export needs its own successor.
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
