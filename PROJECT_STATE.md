# Project state

## Prototype nested diagnostics fixed and failure probes added

Previous turn pushed prototype 94615533. Root independently wrote
tests/native/RecipePrototypeFailures.java and found arithmetic failures in nested maps
lost all iteration context. Root fixed map/statement loops to accumulate context before
iteration charging and enrich own failures while preserving existing native diagnostics.
The probe now also checks statement-loop and failed iteration-budget locations, lazy
branches/type errors, preallocation array limits, command limits and fresh-run recovery.
Five failure groups pass. Integrated probe into existing runner and reran all nine exact
composition comparisons against final sources at .work/recipe-prototype-root4; all pass.
Updated source-bound prototype evidence, with no accepted executor/native/export claim.
Next finish accounting/ownership/replay cases and catalog runtime admission. Unrelated JS
index export remains unstaged. Full milestone goal active.

## Java recipe evaluator prototype underway

Previous turn pushed static validation 60ed990c. Root selected command-level prototype
implementation against the current four immutable operation contracts and draft expression/
accounting rules. Terra owns packages/java-recipe-prototype/.../RecipeEvaluator.java outside
the accepted core/package. Root owns tools/run_recipe_java_prototype.py, which reuses the
established Java literal fixture generator and compares existing full Java streams across
nine baseline/edit scenarios. No new JSON parser, renderer or copied generative algorithm.
Initial runner passed seven raw command cases, then found Path distance outside the drawing
profile. Root added the source workflow's explicit canvas visibility expressions to the
Path draft and switched its comparison target to streamForCanvas; checks stay intact.
Worker corrected query shape/native errors and reran: all nine command scenarios pass.
Luna expanded formatting and verified bytecode instruction equivalence. Root reran final
source-bound comparison at .work/recipe-prototype-root3: all nine scenarios pass exact
raw numeric/structural comparisons (PathMarks after explicit canvas visibility). Structured
prototype evidence: evidence/conformance/recipe-java-prototype-commands.json.
Runtime failure/accounting/diagnostic/invalidation review remains pending; no acceptance. Runtime failure/budget cases and native/export work remain after
command equivalence. Catalog/execution schema are still drafts; prototype does not grant
shared support. Full goal active.

## Bounded static recipe validator implemented

Previous turn made progress by pushing 55c7a971. Added the required
skills/recipe-execution-and-validation/SKILL.md now that schema/composition inputs exist;
validated with skill-creator quick_validate. This does not approve the draft schema.
Terra implemented tools/validate_recipe_draft.py and focused tests. Root reviewed bounded
reads, declared-port scope, direct-call limits, and replaced a mocked stale-check test with
an actual copied-contract hash mutation. 8 static-validator + 5 grammar tests pass; both
complete recipes return static-valid-draft with dynamic/target/runtime/native checks pending.
Root runtime-accounting.md defines per-call reservations for hidden core work and copied
values, including path steps, plus provisional host budgets. These runtime limits are not
yet implemented or benchmarked. Draft metadata stays outside the accepted catalog.
Next complete runtime binding/type/error/budget fixtures and catalog synchronization for
evaluator admission, then Java command comparison of both compositions and native export.
No operation/support count changed; full milestone goal remains active.

## Complete FieldMarks and PathMarks recipe drafts mapped

Prior interrupted work made progress: root wrote FieldMarks draft and Terra completed
PathMarks draft. Root reviewed source composition order and exact palette remainder, then
factored PathMarks endpoint/trig computations into branch-local bindings. Both pass schema
and scratch lexical reference/shadow checks; five draft grammar tests now include them.
Files design/recipes/examples/*.draft.json remain explicitly unaccepted execution drafts.
README there records FieldMarks pure-query scheduling change, PathMarks unculled stream
scope and JSON verbosity. No native render or operation count/support change.
Next freeze dynamic type/error/resource rules and catalog-owned execution metadata, create
the recipe skill, then implement evaluator and compare full commands plus edits. Goal active.

## Recipe grammar and binding drafts implemented (D3)

Previous turn pushed architectural direction 467eafd2. Root specified tagged expressions,
ordered scopes/statements, lazy conditions, binary64 arithmetic and remainder, instance/data
separation, and precise failure requirements in design/recipes/expression-model.md. Terra
implemented strict recipe.schema.json and four grammar tests; root reviewed and corrected
record field key constraints, schema identifier and explicit grammar-only test naming.
Root authored execution-bindings.json after reading Java accessors; all four catalog IDs,
versions, hashes and input/query/output schema pointers checked. Draft schema meta-validation
and `uv run python -m unittest tests.test_recipe_draft_schema` pass. No accepted persisted
recipe, evaluator, capability claim or catalog mutation.
Next translate complete FieldMarks and PathMarks into this grammar, assess clarity and
missing semantics, freeze resource/typing/binding rules, then create recipe skill at schema
acceptance before evaluator work. Full milestone scope remains active.

## Recipe execution architecture started (D3 prerequisite to X1)

Previous turn made progress: contact-sheet helper pushed as 5de3c712. Root inspected the
actual FieldMarks/PathMarks compositions and four existing contracts; Luna independently
returned a bounded schema/binding inventory. Root direction is recorded in
design/recipes/execution-direction.md: explicit ordered composition, constructed instances
versus values, catalog-owned expression/traversal/sink infrastructure, retained/frame split,
and resource budgets. This is an architectural draft; no recipe schema, executor or export
is accepted. Existing operation and target claims remain unchanged.
Key gap: native method bindings are prose and schemas are heterogeneous; arithmetic/iteration
and mark construction are currently example-owned code. A wrapper around starter parameters
would not satisfy the declarative composition requirement. First schema acceptance must cover
both FieldMarks and PathMarks, then Java execution/command equivalence, then native export.
Next resolve exact expression, traversal and instance semantics and execution descriptors,
apply catalog synchronization, then create the required recipe skill before persisted inputs.
Full scope still includes all retained capabilities, explicit animation/assets, four-target
exports and downstream MCP/web; separate porting ownership is unchanged.

## Contact-sheet helper accepted (X2 partial)

Previous turn made progress by pushing adapter correction ebdf1ee4. Terra implemented
tools/contact_sheet.py and five focused tests; root reviewed input bounds, source reopening,
no-overwrite publication and docs. Root tightened decompression/IO error reporting.
`uv run python -m unittest tests.test_contact_sheet` passes. Actual CLI built a 720x240
sheet from saved CP10 baseline frames 0,30,120; root inspected requested order, readable
labels and preserved proportions in .work/comparisons/contact-sheet-root1.png. No native
render was launched and no source assets/images are tracked.
Guide docs/comparing-variants.md is linked from getting started. This enables comparison
of saved PNG/JPEG variants, not automatic sweeps or conformance claims. Five focused cases
cover aspect/alpha/order, corrupt input, output preservation/location, CLI limits and JPEG.
Next commit/push this helper, then continue remaining roadmap work. Seeded sweep execution,
palette extraction, recipe schema/executor/exporters and MCP/web remain incomplete; ports
remain owned by the separate checkout. Full goal active.


## Source-bundle adapter correction accepted

Previous turn pushed 631f26aa, but root and Luna onboarding audit found its source builder
omitted the separate Processing adapter required by FieldMarks and PathMarks. The earlier
source-bundle review is explicitly withdrawn in the replacement review history; original
Java0.15 remains accepted. Terra fixed builder/tests against root manifest and root reviewed.
Two fresh-checkout builds match byte-for-byte; exact two-JAR inventory, all 78 class payloads
(77 core + 1 adapter), and 33 tabs + 2 font/license assets match accepted Java0.15. Extracted
FieldMarks and PathMarks Java tabs compile with the two packaged JARs plus explicit Processing
core; both fail without the adapter. 7 builder + 11 attestation tests and catalog check pass.
Corrected README/start guide selects current package and actual MarkCommands editing path.
Documented pinned external font provenance and Processing core; acquisition automation remains
unimplemented. Root review: evidence/distribution/java-source-bundle-review.json.
Next push this correction, then resume bounded Java work independently of separate ports.
No new native support claimed; shared machine render lock remains required. Full goal active.


## Source-only Java builder accepted for identical Java0.15 payloads

Root took over stalled builder assignment and completed readable implementation plus5focused
unittests. Clean baseline checkout build initially caught a .work-only spring mutation proof;
promoted exact JSON to evidence/conformance/target-springs-atomicity-mutation.json, preserved
original review, added portable review and updated affected attestation references. No
semantic/support changes.5builder+11attestation tests and catalog checker pass.
Two isolated builds byteidentical; all77classfiles and33exampletabs+2font/licenseassets match
acceptedJava0.15. Initial overly broad comparison included obsolete pending-validation
PathMarksREADME; intentionally omitted that stale doc while including current guides.
Root acceptance evidence/distribution/java-source-bundle-review.json. New tool uses explicit
JDK/font/license, frozen sourcebundle input manifest and accepted attestations; no prior
archives/stages/renders needed. Updated usage docs. Shared render SIGTERM hardening included
in this checkpoint. Final current-docs builds also match each other and all accepted executable/example payloads.
Next commit/push reviewed integration, then select bounded Java artist
capability/helper work independently of separate porting checkout. Fullgoalactive.


## Shared native lease termination hardened

While sourcebundle worker remains live, root reviewed sharedrender supervisor lifecycle.
Child now inherits lease descriptor and wrapper handles SIGTERM by terminating its process
group before releasing the lease. Focused subprocess checks passed: second checkout-style
command blocked while held, child gone after supervisor SIGTERM, next command reacquires.
No renderer was launched. This prevents early lease release on ordinary supervisor termination;
SIGKILL cannot provide process-group cleanup guarantees. Changes await coherent integration
commit with sourcebuilder. Previous turn preparedcleancheckout; currentturn strengthens the
cross-checkout coordination explicitly requested bymaintainer. Fullgoalactive.


## Clean-checkout source-bundle test environment prepared

Root extracted only pushed baseline tracked files into .work/source-bundle-clean1; verified
it has no prior.work artifacts. Accepted font/license supplied separately under ignored
.work/source-bundle-external-inputs. Final builder will be copied into that checkout after
Terra freezes implementation/tests. Prepared source-build usage doc clearly marked underreview.
No sourcebundle acceptance or commit yet; current Java0.15 remains accepted. Next execute
final builder in isolated checkout and compare exact class/example/font payloads. Previous
turn assignedsourcebuilder; this turn prepares the meaningful clean-input validation.


## Pushed baseline; source-only Java packaging underway

Baseline e5a604acc42e9e47f5d843888350a8672d786485 was pushed to origin/main and remote SHA
verified; worktree was clean. Separate porting work stays outside root's Java batch.
Root identified current historical package builders' dependency on prior ignored archives.
New bounded source-only builder task assigned Terra line_pool_java: builder+focused tests,
explicit JDK/font/license, acceptedsource bindings,15starter assembly, deterministic archive.
Root acceptance plan design/java-source-bundle-acceptance.md. Independent fresh javac--release8
output matches all77 accepted Java0.15 classfiles exactly, so identical final executable/font/
example payloads can reuse native acceptance without redundant rendering. No new release or
builder acceptance yet. Next review/test actual sourcebundle and document clean-checkout use;
commit/push only the completed integration checkpoint. Full goal active.


## Baseline publication and port ownership handoff

Maintainer authorizes reviewed commits/pushes directly to main, no approval required.
Root is establishing the current project-owned baseline; no force-push/discard. Porting
moves to a separate pinned checkout/branch; in-flight JS core/example files are frozen
unaccepted drafts. See docs/porting-handoff.md for accepted15Java operations/workflows,
pending ports, runtime/font dependencies and root review requirements. All native renders
must use tools/with_native_render_lock.py with the fixed cross-checkout machine lease.

Baseline audit:965 initial untracked source/text files, no unignored binary assets; full MIT
notices in copied/derived PDE/prototype files verified, third-party algorithm provenance
preserved.142unit tests pass, catalog/drawing/structural ledger checks pass,15Java sources
compile--release8. JS port draft syntax passes; final core/native acceptance still pending.
Remote main matched local parent on initial fetch; root will recheck immediately before
pushing. Previous turn prepared browser port; user now prioritizes pushed baseline handoff.
Full project goal active; no completion or additional port support claimed.


## PlacementMarks browser port assigned; acceptance frozen

Root read actual Java helper/PDE and existing p5 PathMarks harness. Terra placement_browser
owns only new examples/placement-marks files; line_pool_java continues frozen JS core/tests.
Root froze design/capabilities/placement-marks-p5-acceptance.md: same controls,640density1,
retained style identity, exact restoration/cache save, radial ignored controls and spacing
transfer. Seeded baseline424/extended517/seed43=432 from accepted Java native evidence.
Authored radial trig and motif rendering remain outside exactcore crosshost semantics.
No browser run yet; core acceptance precedes native execution. Next review completed core
and example, integrate exports and adapt existing browser runner for the frozen sequence.
Previous turn began ports; this turn defines/assigns complete artist-facing port acceptance.
Java0.15 unchanged; full goal active.


## I2 deferred ports started; CP12 remains deferred

Root reread complete venas report and pinned PDE, retained CP12 scheduling deferral in
design/capabilities/cp12-post-java15-decision.md. Existing paths/line pools do not close its
band-acceptance gap; no coverage credit or final candidate rejection. Move to deferred ports
rather than another speculative Java capability. Batch plan: design/port-batch-01.md.
Terra line_pool_java now owns packages/javascript/src/circle-placements.js and
 tests/native/circle-placements-javascript.mjs for frozen ordered-filter/seeded-placement
contracts, all37+31cases and applicable auxiliary fixtures/native ownership requirements.
Root owns exports, browser workflow, attestations and packaging; no browser claim from core
checks. First deliver JS CP3, then Python/Android slices; all11Java-only operation ports remain
in I2 scope. Worker inventory mistakenly inferred missing Android layout from packages/android;
root corrected actual packages/java-android and Java already validated CP3 state.
Next review completed JS core, then native PlacementMarks integration using existing p5 harness.
Previous turn delivered0.15; current turn records bounded architecture choice and begins ports.
Java0.15 remains accepted delivery; full goal active.


## Current delivery: Java0.15 accepted

Root built and independently reviewed .work/dist/line-pool/java/procedurals-processing-0.15.0.zip.
SHA256 c975370773a8afd788fb6e63bb11f5918f21026129d9ae6eefca468fd2e1973d.
15operations/15starters,82archive members; all14previous starters and74previous core members
byte-preserved. Six new LinePool2D classes; other changes only library.properties and generated
reference plus five new example/catalog/docs files. Actual JAR/helper/PDE match native stage.
Acceptance evidence/distribution/line-pool-review.json; builder report line-pool-java.json.
Luna builder first attempt preserved; root tightened mandatory native/stage bindings before
final build. Updated README/roadmap. Future new-core packaging assignments go to Terra and
must exercise real build path before handoff, avoiding repeated root debugging of drafts.

Next: bounded CP12 reconsideration against completed line-pool capability, as recorded in
post-cohort-priorities.md. Decide its remaining artist value/API cost from existing evidence;
then move to the deferred I2 port batch if no further Java addition is justified. Do not start
another open-ended corpus audit or new rendering framework. Recipes/exporters/MCP/web remain
downstream and the full goal remains active. Previous turn accepted workload; this turn
completes0.15delivery. Historical entries below describe earlier states.


## Recreation objective clarified

The maintainer proposes original-sketch recreation coverage as an operation-value measure,
with explicit concern about overfitting. Existing recreation-coverage.md already establishes
fidelity, ordinary artistic glue, hidden-algorithm exclusions and honest denominators.
Added a compact before/after statement to that policy and agent briefs: complete workflows
unlocked versus partial help, distinct patterns, API cost and transfer outside the motivating
composition. Root retains admission judgment; no new corpus-wide audit or test infrastructure
is required. This policy clarification changes no shipped or demonstrated coverage counts.

## Line-pool core and editable native workflow accepted

Root reviewed Terra core and removed avoidable per-cut temporary allocations before
acceptance. Luna runner executes all14 live fixtures; ownership/access checks pass.
Root independently compared9000attempts/4362segments against object-list oracle, all
coordinate bits/flags/counters matching. Core review: evidence/conformance/line-pool-java-root-review.json.
Staged candidate1 adds LinePool2D classes to accepted0.14 JAR with inherited members
preserved; actual Processing preprocessing and compilation pass. Native P2D edit run
passed11frames/11keys in4.66s; root viewed6distinct images and accepted single-pool workflow.
Baseline12616segments, sparse4362; angle, alternate stroke, seed and colour edits visible;
reset/cache-save pixels exact. Narrow preset touches/crosses fixed viewport, no autofit claim.
Terra preparing separate true30x90000/1920P2D workload runner; no render authorization to
worker. Next root review/run workload under lock, then documentation/attestation/package.
Accepted distribution remains0.14/14operations/14starters; no whole-brotes coverage yet.
Previous goal turn clarified admission policy; this turn advances implementation and native
acceptance. Full goal active.

## Full line-pool workload accepted; distribution integration in progress

Root ran frozen Terra workload at true30x90000attempts,1920P2D density1,512MiB max:
594036segments,371693cuts,2328307skips. Viewed dense branching image; accepted scoped
technique/workload, not whole-brotes coverage. Generation+checksum/config/accounting0.271s,
render+readback+PNGsave1.072s, wholeprocess3.33s; single desktop observation only.
Heap afterrender191795200bytes, packed payload estimate19603188bytes; independently peaking
pool sum not simultaneous maximum. Evidence/reproductions/line-pool-p2d/workload{,-review}.json.
Added root catalog attestation and regenerated reference; catalog checker passes.
Root reviewed artist guide, corrected maxSegments byte-budget implication, prepared install
instructions. Luna preparing archive builder; root found JAR-reader prefix error and source
review variable shadowing before build, requested repair and first-pass candidate execution.
Next inspect corrected builder/output, produce and independently verify final0.15 archive,
then update current delivery/readme/roadmap. No0.15 distribution accepted yet;0.14 remains
current. Previous turn accepted core/singlepool; this turn accepted fullworkload. Goal active.

## Current phase

Phase 2 is active on the checked-in snapshot. The maintainer explicitly authorized
starting at 826/901 reports (91.7%), superseding the former full-corpus gate. Clustering
and API design are authorized now; implementation requires a written design and reviewed
operation contracts, not survey completion. The project remains library-first. The maintainer now prioritizes Java-only capability
expansion and complete workflows, batching p5.js/py5/Android ports later. Sol reviews are
paused during this buildout sprint; root reviews architecture and implementation directly. See `docs/roadmap.md` and `docs/agent-briefs.md`.

## CutBranchMarks workflow and acceptance prepared

Root froze line-pool-workflow-acceptance.md:960P2D editable single-pool workflow with colour,
angle/work, alternate stroke, seed/reset/save plus separate true30x90000-attempt1920 workload.
No whole-source coverage claimed from workload. Root authored CutBranchComposition.java and
CutBranchMarks.pde against frozen LinePool2D API; no cutting logic duplicated in example.
Terra still owns core implementation; helper/PDE not compiled or rendered yet. Next review
core when frozen, stage actual PDE and execute declared native checks under lock. Previous
turn integrated contract/fixtures; current turn supplies complete artist workflow inputs.
Full goal active; Java0.14 remains accepted distribution.

## Line-pool catalog/fixtures reviewed; Java implementation delegated

Added reviewed catalog/operations/seeded-line-pool-2d.json and14exact-json fixtures. Root
contract review includes native ownership and unfulfilled transfer/workload obligations.
Initial checker found missing provenance evidence_sha256; supplied exact ledger binding,
refreshed fixture catalog hash and generated reference via check_catalog --write-reference.
Catalog schemas/source bindings/fixtures/reference pass. This adds a contract, not shipped
support: accepted Java0.14 still14operations/14starters. Terra line_pool_java owns only
LinePool2D.java and focused diagnostics against frozen contract, no rendering or packaging.
Next root review core/error/access behavior, then actual editable native workflow and
second-stroke/30pool acceptance. Previous turn reviewed errors; current turn integrates
contract and delegates implementation. Full goal active.

## Line-pool error precedence and reachability reviewed

Root executed three conflict cases: spread overflow before capacity; invalid cap before
zero-work return; short skips atcap with huge unused angle. All match stated precedence.
Added to candidate fixtures (14total). line-pool-error-review.md distinguishes reachable
overflows from defensive stages bounded by finite squared length, avoiding impossible test
requirements. Next finalize live catalog/reference/fixture integration and native access
requirements, then production implementation. Previous turn accepted candidate oracle
checks; current turn adds executed precedence evidence. Goal active; Java0.14 unchanged.

## Corrected oracle cases crosschecked; candidate fixtures prepared

Root verified corrected first-choice0/1/2 word traces against independent integer oracle,
actual output sizes, equal-threshold cut, revisit continuation flag, zero-append cap success,
actual append failure and seed20 spread_negative overflow. All match. Prepared11candidate
cases in design/operations/line-pool-candidate-fixtures.json; all input/output schemas pass.
Review evidence/investigations/line-pool-oracle-review.json binds source and artifacts.
Requested worker final freeze; no further case expansion needed. Next finalize catalog
metadata/fixture integration and review arithmetic-stage reachability/error precedence
before production implementation. Previous turn crosschecked manual8cases; goal active.

## Eight manual cases independently crosschecked

Root preserved current corrected oracle source in .work/diagnostics/line-pool/root-crosscheck1,
compiled independent RootManualCases runner and compared all8 outputs/errors against hand-derived
expectations. All match; evidence/investigations/line-pool-manual-crosscheck.json binds exact
snapshot and results. Worker still completing final actual-choice/overflow cases; root requested
bounded completion and freeze. Snapshot pass is not final oracle approval. Next inspect frozen
artifact, verify first-choice integer vectors and actual error outcomes, then fixture admission.
Previous turn localized seed-search bug; current turn executes independent semantic checks.
Full goal active; no package change.

## Oracle review found conditional-draw seed-search error

Root read current LinePoolOracle.java while worker running. Transition evaluator broadly
matches written order, but seedForChoice assumes fixed15words despite conditional range
sampling. Requested actual-trace search and assertions, maxSegments ceiling validation,
and actual overflowing seed search; preserve provisional artifacts. Root independently
computed integer RNG/schedule vectors:seed0 choice2/14words,seed3 choice1/14words,
seed12 choice0/15words; saved line-pool-first-choice-oracle.json and sent to worker.
No oracle fixtures accepted. Next crosscheck corrected output/manual8cases and inspect
error evidence. Previous turn expanded edge expectations; current turn identifies and
localizes real fixture bug. Goal active; production package unchanged.

## Line-pool edge-case expectations expanded

Root reviewed extreme-coordinate behavior while line_pool_oracle is confirmed running.
Added4manual cases (8total): zero-work extremes succeed, finite-delta square overflow,
squared-sum overflow, tiny squared-length underflow/skip. Independent scalar calculations
confirm arithmetic classifications. Draft explicitly disallows silent hypot substitution;
zero work performs no distance arithmetic. Sent cases to oracle worker for crosscheck.
Oracle source not yet present at inspection; no completed fixture claim or restart. Next
review actual oracle output and resolve mismatches before catalog admission. Previous turn
inlined transition/delegated oracle; current turn adds distinguishing expectations. Goal active.

## Line-pool transition arithmetic inlined; oracle delegated

Root inlined full transition pseudocode and dynamic error stages into contract draft;
separate source at design/operations/line-pool-transition.txt. Actual append cap precedes
cut/child endpoint calculation; policy scalar draws/arithmetic retained even for unselected
children; no partial mutation. Root hand-derived4small zero/skip/overflow fixture expectations
in line-pool-manual-fixtures.json. Terra line_pool_oracle independently implements object-list
StrictMath/xoshiro evaluator from specification, with bounded branch-case seed search;
no production or live fixture code delegated. Next crosscheck oracle/manual cases and audit
ambiguities before catalog admission. Previous turn drafted schemas; goal remains active.

## Machine-readable line-pool contract draft prepared

Root wrote design/operations/seeded-line-pool.contract-draft.json with exact input/output
schemas, source hashes, private existing RNG, reproducible numeric profile, resource limits,
result invariants, target deferrals and explicit outstanding review. Both JSON Schemas and
representative configuration validate. Draft intentionally outside live catalog, whose
checker admits only reviewed contracts; no claimed implemented-operation count increase.
Next inline complete arithmetic stage names and create independent exact fixtures before
catalog admission. Previous turn resolved numeric policy; full goal active, Java0.14 current.

## Line-pool reproducible math decision resolved

Root inspected installed JDK StrictMath source specification: sin/cos/atan2 require fdlibm5.3
semantics. Recorded language-neutral numeric requirement, Java StrictMath realization and
explicit later-port obligation in line-pool-numeric-decision.md. No coordinate tolerance may
hide topology drift; no Java implementation copied. Specified input/length/range/cap/endpoint
failure order and packed-storage representation bound; no resource/default range claims.
Next materialize catalog and independent fixture oracle, review then implement. Transfer and
30-pool workload still required. Previous turn progressed deterministic draft; goal active.

## Line-pool deterministic semantic draft written

Root applied deterministic-generative-semantics and drafted design/operations/line-pool-semantics-draft.md:
private existing xoshiro stream, explicit reversed-range draw rule, cut/revisit/skip order,
actual-append resource cap, detached final outputs and discriminating fixtures. Source RNG
changes declared; prototype is not portable acceptance. Identified consequential numeric
issue: trig-derived lengths drive later topology, so coordinate tolerances cannot excuse
cross-target branching drift. Next resolve reproducible math/target capability and arithmetic
failure ordering BEFORE catalog freeze; no new core code or public support claim yet.
Previous turn completed reviewed admission; full goal active, Java0.14 unchanged.

## Line-pool operation candidate admitted for contract preparation

Root wrote line-pool-admission.md and narrowed topology.branch-subdivide architecture to
reviewed operation_candidate. Audited brotes#0 component extraction; initial placement,
30independent pools and renderer/style remainder explicitly accounted. Source ordering/mutation
invariants retained; CP6/2020brotes not merged. Updated authored ledger summary after status
change. Contract-cluster checker passes1934-record structural check, not contract approval.
Inputs include explicit minimum cuttable length for caller units; no artistic range/default
claim. Next freeze numerical/RNG/errors/fixtures contract and validate transfer/full workload.
Previous turn completed native parameter evidence; current turn completed admission work.
Java0.14 remains accepted package; full goal active.

## Line-pool five-case experiment completed and reviewed

Terra froze prototype; root reviewed active source transitions and accepted private experiment.
All5P2D cases pass in2.65s process; root viewed all full960images.9000 sparse scaffold,
90000 dense fine clusters,180000 diminishing change; angle.7/1.4/2.1 changes spread readably.
Decision evidence/parameter-experiments/line-pool-controls/decision.md advances compact contract
DESIGN only: attempts explicit work budget, first-cut angular scale candidate control; no
public default/continuous range. Original experiment bytes saved in run directory before
appending results. No whole30-pool source reproduction or portable implementation claim.
Next operation-contract/semantic design and required admission ledger work, with second
seed/stroke transfer and full workload obligations retained. Previous turn added executor;
current turn completed native experiment and evidence-based boundary decision. Goal active.

## Line-pool executor prepared; prototype worker live

Root authored tools/diagnostics/linepool/run_frames.py with fresh attempts, root source-review
gate, runtime/input hashes, render lock,180s timeout and per-case RGB/pixel-change measures.
Syntax check passes. No render or prototype acceptance claimed. Agent line_pool_prototype
was confirmed running through collaboration.list_agents; source file not yet present at
inspection. Root requested status while completing independent executor work. Next inspect
worker completion, review source transition order, write prototype-review.json then execute.
Previous turn progressed preregistration and delegation; current turn adds runnable executor.
Full goal active, accepted package unchanged Java0.14.

## Line-pool parameter experiment registered

Registered evidence/parameter-experiments/line-pool-controls/experiment.json: source-faithful
single-pool baseline90000 attempts/angle1.4, two count variants9000/180000 and two angle
variants.7/2.1, fixed960P2D seed42/style. Root decision rules separate work budget from useful
density and require visible angular control; no continuous range/public default inferred.
Terra line_pool_prototype owns private numeric source translation and five-case diagnostics;
root authored LinePoolFrames.java fixed-style renderer. No render launched; helper not frozen.
Next review prototype semantics, compile renderer and bind exact inputs before serial run.
Previous turn progressed actual host-semantic measurement; current goal active.

## Mutable line-pool host ambiguity resolved

Root applied parameter-evidence skill and inspected actual Processing4.5.6 bytecode plus
native pure diagnostic: reversed random bounds return low without another RNG draw.
Seed42 sampled81046 reversed/equal cases of100000; evidence/investigations/line-pool-host-semantics.json.
Not visual evidence. Wrote line-pool-direction.md: private source-faithful bounded prototype,
final ordered mutable endpoints/flags, no ancestry fiction or policy callback framework.
Next preregister parameter experiment for attempt budget/angular spread before rendering;
no public API/default/range yet. Previous turn progressed gap/priority decision. Goal active.

## Post-cohort breadth decision recorded

Root compared roadmap I2, artist entry points, rare-family commitments and current delivery
in design/capabilities/post-cohort-priorities.md. Selected bounded mutable line-pool branching
assessment, not another recreation starter. Reread exact brotes source:30independent pools,
90000attempts each, mutable cuts/revisits absent from endpoint branching; no measured trials.
Next architecture/parameter-evidence decision must precede any public contract or code.
CP12 remains deferred, ports remain next scheduled I2 phase after justified breadth choices.
Previous turn progressed Java0.14 archive acceptance and cohort closure; full goal active.

## R3 Java0.14 accepted; recreation cohort01 complete

Archive .work/dist/r3/java/procedurals-processing-0.14.0.zip independently checked:77members,
14operations,14starters, all13priorstarters and core JAR byte-preserved; only inherited version
metadata changed. Acceptance evidence/distribution/r3-review.json. README/install/guide and
roadmap updated. Three selected originals now demonstrated structurally with zero new APIs.
No corpus-wide percentage; earlier cohort intermediate claims are historical, final section
supersedes. Previous turn progressed reviewed helper, actual P2D run and visual acceptance.
Next inspect remaining I2 artist-capability/rare-family commitments and choose a bounded
unmet capability rather than extending this selected cohort indefinitely. Full roadmap,
deferred ports and later milestones remain active and unfinished.

## R3 LandscapeMarks native recreation accepted

Terra helper passes50proposal, radius/separation/source-index, seed replay/variation checks:
seed42 accepted47,81faces. Root reviewed helper and actual PDE compilation passes in
.work/examples/r3-candidate1 using unchanged accepted JAR. Native seven-state P2D run passes
in4.84s; all required layers counted, style identity retained, seed changed, reset/save
pixels equal. Root viewed all four distinct960images: wavy horizon, bands, depth sizes,
shadows/glows, mesh/specks and useful edits. Acceptance evidence/reproductions/r3-p2d/root-review.json.
Inherited reset-height ID denotes stripe-power reset, documented in review. No core API added.
Next package Java0.14 with14operations/14starters, prior content preserved, then reconcile
cohort coverage and select next roadmap work. Current accepted archive remains Java0.13.
Previous goal turn progressed frozen scope, delegation and PDE; full goal remains active.

## R3 implementation underway

Frozen retained helper/P2D edit acceptance in parapara-recreation-acceptance.md. Terra
landscape_helper owns numeric helper and pure diagnostic only. Root authored LandscapeMarks
PDE including noisy horizon, two stripe layers, triangle overlay, source-style shadow/halo
fans and centroid specks, with MIT provenance. C/P retain scene;R/0 regenerate;S cached save.
prepare_landscape_marks.py stages against accepted Java0.13 unchanged JAR. Await helper
review before compile and native run. No new operation, recreation credit or package yet.
Previous turn progressed full source mapping and radius/noise corrections; goal active.

## R3 parapara source mapping completed

Root read full pinned source and note; wrote parapara-recreation-walkthrough.md. Plausibly
supported with existing noise, palette, ordered filtering and Delaunay, but not demonstrated.
Critical corrections: source ss is diameter; use radius=ss/2,separationScale1.2 (not .6);
three active noisy horizon strips were omitted from earlier cohort summary; preserve nine
palette entries including duplicate; source shared triangle edges overdraw. Easing can map
phase into existing CyclicPalette, ring fans remain explicit renderer glue. Source lifecycle
oddity and independent noise divergence recorded. No new API or ledger mutation.
Next freeze retained R3 composition and scoped P2D acceptance, then bounded implementation.
Previous goal turn progressed native edit acceptance and Java0.13 packaging. Goal active.

## R2 CityMarks accepted and packaged as Java0.13

Seven actual P3D edit/reset states and cached save pass in17.64s. Root inspected palette,
low-height and new-seed images; baseline pixel-identical to reviewed first frame. Source
and image acceptance: evidence/reproductions/r2-p3d/root-review.json. Preserved probe report
uses inherited label spikes for window box count and unused vertices0; review clarifies.
Archive .work/dist/r2/java/procedurals-processing-0.13.0.zip independently verified:73members,
14operations,13starters; all12oldstarters and core JAR unchanged. Only inherited version
metadata changed. Accepted in evidence/distribution/r2-review.json; README/roadmap updated.
Cohort now2demonstrated structural originals of3selected, no corpus-wide percentage.
Next bounded work: parapara complete source mapping before further API/code decisions.
Previous turn progressed root correction, native full-density run and visual admission.
Full roadmap and deferred ports remain unfinished; goal active.

## R2 full-density first frame passes

Root corrected ambiguous policy RNG brief after detecting shared height/colour/visibility
and wall probability/footprint draws; Terra changed each to independent draws, recompiled
and preserved diagnostics. Root reviewed corrected helper; actual PDE staging passes in
.work/examples/r2-candidate1 against unchanged accepted JAR. Native one-frame diagnostic
passes:301 leaves,580 faces,624033 actual box calls,1.999s draw,3.832s process.
Root inspected full960image: coloured triangular roofs, varied towers and dense facades.
Accepted to proceed with edit validation in evidence/reproductions/r2-p3d/first-frame-review.json.
First runner preflight saw transient java process and stopped before render; subsequent ps
showed no live runtime, fresh attempt2 build preserved prior compile. Only one render ran.
Next scoped colour/height/seed edits, reset/cache-save verification then package; no new API.
Previous turn progressed implementation and delegation; full roadmap remains active.

## R2 implementation in progress

Frozen helper/drawing/one-frame admission in ciscis002-recreation-acceptance.md. Terra
agent city_helper owns CityComposition.java and pure diagnostic only; root authored
CityMarks.pde and prepare_city_marks.py using unchanged Java0.12 JAR staging pattern.
Root also authored tools/diagnostics/r2/CityFirstFrame.java for a single actual frame,
checking dimensions, all boxes and elapsed draw time; not compiled or launched yet.
PDE includes source MIT provenance, native roof/wall/window drawing, retained colour/height
edits and cached save. Not yet compiled or rendered: wait for helper, review then stage.
One source-density frame must pass cost/image review before multi-state native validation.
Previous turn progressed by completing source mapping; current package stays Java0.12.

## R2 ciscis002 complete source mapping

Root read exact pinned PDE and note and mapped all active computation in
`design/capabilities/ciscis002-recreation-walkthrough.md`. Plausibly supported by existing
partition, Delaunay, RegularGrid and CyclicPalette; no new API admitted. Facade placement
is affine drawing glue, unused noise/shader excluded. Source unmatched beginShape and
palette overwrite explicitly resolved for structural fidelity. Window count can approach
866,844 boxes/frame: next freeze a compact retained composition and one-frame performance
acceptance before any multi-state native run. R2 is not demonstrated or shipped.
Previous goal turn was progress: accepted and documented Java0.12 archive. Full goal active.

## R1 Java 0.12 package accepted

Local archive `.work/dist/r1/java/procedurals-processing-0.12.0.zip` is accepted in
`evidence/distribution/r1-review.json`: 14 operations, 12 starters, 69 file members.
Root independently verified archive integrity, source hashes, exact staged example bytes,
all 11 prior starters and unchanged core JAR. Catalog check passes. Native/visual acceptance
is reused for the identical packaged example; no redundant render or core test campaign.
Recreation coverage: one demonstrated structural original (`momito`) in three selected,
not a corpus-wide estimate. No new API needed. README/install/roadmap now point to 0.12.
Next bounded task: complete ciscis002 source-to-package walkthrough before adding code.
Full roadmap remains active; deferred ports and remaining milestones are unfinished.

## R1 structural recreation accepted; packaging next

Single native P3D attempt r1-relief-marks-root1 passed7states/save. Original result.json
failed inherited640PNG check; corrected960size and actual savefilename in runner and
reevaluated unchanged captures through tools/diagnostics/r1/evaluate_relief_capture.py.
Original failure/runner snapshot preserved, no rerender. evaluated-result.json passes.
Root viewed4distinct960pixel contents and accepted in evidence/reproductions/r1-p3d/root-review.json:
multiscale relief, visible size-linked spikes, palette/height/seed edits and reset/save.
Distinctness uses decoded pixels (PNG encoding hashes differ for some resets). Cohort now
1demonstrated structural original of3selected, zero newcoreoperations; no corpus percentage.
Next package local Java0.12 with14operations/12starters and update guide/install/docs.
Current shipped package0.11 unchanged until archive acceptance. Full goal active.

## R1 staged PDE and complete geometry generation pass

Root added tools/prepare_relief_marks.py using existing source-bound staging/preprocessor
pattern, extracting the accepted Java0.11 JAR byte-for-byte (no new core classes). Actual
ReliefMarks PDE compiles in .work/examples/r1-candidate1; result.json binds stable inputs
and staged artifacts. Root ran independent helper geometry check from accepted JAR for42/43:
seed42:871 leaves,1716 faces,791 spikes,622739 work; seed43:871 leaves,1721 faces,800 spikes,
609816 work. Raw check source/result in .work/diagnostics/r1. All leaf centers finite and
spike heights positive. This is geometry evidence, not visual recreation acceptance.
Located existing coherent CP7 Processing4.5.6 P3D JAR/native runtime and known diagnostics
for reuse. Next implement focused R1 native probe against staged PDE, register source-bound
seven-draw acceptance plan, render under lock and inspect all distinct images. No render yet.

## R1 root corrected incomplete worker composition

Root reviewed completed cohort evidence and corrected9 candidates to10 and the conclusion:
zero demonstrated originals does not imply zero plausible structural recreations. Source-
specific colours/distributions are not automatically missing algorithms. Momito remains
plausibly supported; ciscis002/parapara boundaries unresolved, no new APIs admitted.
Terra delivered helper/PDE/guide but omitted drawing spikes, changed palette/face emission,
and minified code. Root rewrote helper/PDE: centered partition, retained metadata mapping,
actual size-linked boxes, source palette/light setup, exact intended9vertex face pattern,
readable methods and full upstream MIT notice/provenance. Helper compiles against accepted
Java0.11 JAR in .work/build/relief-root. No core/catalog changes or render yet.
Next root stages official PDE and prepares the scoped P3D probe/run; source frame-role/RNG
and density divergences remain explicit. Full goal active, shipped counts unchanged.

## R1 Momito recreation scope fixed before code

Root selected one actual recreation without waiting on unrelated cohort evidence. Written
acceptance in design/capabilities/momito-recreation-acceptance.md: ReliefMarks composes installed
Java0.11 partition+Delaunay,871 leaves, source-like open relief and size-linked spikes,
explicit canonical vertex roles/RNG/density differences. Seven-draw C/reset/H/reset/R/reset
sequence plus cached save; no new core operations or framework. Root will own staging/native
visual review. Coverage remains plausible until actual implementation/run/inspection.
Next bounded helper/PDE/guide implementation against accepted JAR, while Luna finishes cohort.

## Momito direct source-to-package walkthrough completed

Root read active source including later commented alternatives and compared quadrant selection
and Delaunay contracts. Added design/capabilities/momito-recreation-walkthrough.md: plausibly
supported at explicitly structural/technique fidelity with existing operations, no demonstrated
recreation yet. Source290 splits gives871 leaves, correcting report's1161; preserved survey.
Three triangles/face is artistic drawing glue, not automatically an extrusion API. Documented
RNG/precision and canonical-face-role divergences, native P3D requirements and inactive shader/
wire code. Sent decisive facts to Luna's still-assigned cohort evidence task. Next complete
cohort comparison and choose one actual recreation or justified algorithm gap.

## CP12 deferred; current-library recreation cohort selected

Root made the priority decision in design/capabilities/cp12-priority-decision.md: defer public
band-walker work, preserve the rare idiom and evidence, leave ledger unadjudicated. One
projected recreation does not alone establish enough value for unresolved steering/work
semantics; a prototype or stronger transfer evidence can reopen it. No rejection or scope loss.
Selected three-original cohort ciscis002/momito/parapara in recreation-cohort-01.md to map
accepted operations and remaining algorithms before another API addition. No support credited
yet, no corpus percentage. Next bounded evidence walkthrough then root composition/gap decision.

## CP12 marginal coverage screen recorded

Previous turn persisted the new admission criterion. Root this turn verified Luna still
running, searched noise-band/iso-level/tolerance terminology and inspected relevant candidate
excerpts. Added design/capabilities/cp12-coverage-screen.md: venas is one projected original,
zero new demonstrated recreations, no additional distinct use yet established. Sandi,
citypop02, lislis and triste receive no band-walker coverage credit from their different
computations/terminology. This is a targeted screen, not a corpus prevalence assertion.
Root sent exact findings to Luna and asked it to finish bounded evidence without broadening.
Luna completed its815-word brief this turn; root read it and checked all five variant
mean/changed-fraction records plus note SHA. The reported density2 was unavailable in the
survey display (stderr); retain that renderer limitation. Its three exact heading-walk
neighbours add no band-tracing coverage. Next admission must weigh rare-idiom value and traversal/work/API cost explicitly; no code
or public signature approved yet. Java0.11 accepted delivery unchanged, full goal active.

## Recreation-coverage criterion persisted and applied to CP12

Previous user-facing turn acknowledged the criterion but changed no authoritative files.
This turn root added docs/recreation-coverage.md and updated AGENTS.md/artist-capabilities:
whole-sketch computation coverage, ordinary glue vs missing algorithms, demonstrated/plausible/
unsupported/unassessed statuses, explicit fidelity, unique identities vs distinct patterns,
and marginal gain versus API/maintenance cost. No invented percentage or corpus-wide audit.
CP12 direction now records venas as one projected candidate only; missing band traversal is
known, neighbour reach unknown. CP11 starter is explicitly not automatic original-tata or
guagua recreation credit. Luna verified running and received this steering for evidence brief.
Next review its exact neighbours and decide CP12 admission with coverage/cost visible.

## CP12 bounded noise-band investigation selected

Previous goal turn delivered CP11. Root this turn reviewed roadmap, found its current-delivery
paragraph stale and refreshed it to accepted Java0.11/14 operations/11 starters. Root read
venas report and exact pinned PDE and selected a bounded investigation in
 design/capabilities/cp12-noise-band-direction.md. Source has accepted-step heading overwrite,
attempt counting, no boundary rejection and ten-million-proposal nominal work; note's generic
versus one-off steering classification is unresolved. Luna spring_native_checks assigned exact
identity/variants and at most3 neighbours, evidence only. No public API or implementation
admitted. Next root evaluates evidence and chooses operation/workflow/defer explicitly.

## CP11 delivered as local Java0.11.0

Root built and accepted .work/dist/cp11/java-final/procedurals-processing-0.11.0.zip,
SHA595a892ebf37ca689a18db0acf7d0e113f7c94da855e4c2a462a431e98cf6495.
14 operations,11 starters,65 archive files. All ten earlier starters and68 prior core JAR
file entries byte-preserved;6 lattice core classes added. Only old JAR/version/reference
members changed. Acceptance evidence/distribution/cp11-review.json; builder record cp11-java.json.
Catalog attestation uses a standard-map catalog review pointing to preserved core/native
acceptance records; original reviews/stage/render bindings were not rewritten. Generated
reference passes, full142 Python tests pass. First .work/dist/cp11/java archive is retained
as pre-attestation draft; java-final is accepted. README/install guide point to final delivery.
CP11 batch complete, full goal remains active. Next root chooses the next useful Java capability
from roadmap under sustainable bounded-batch policy; ports remain deferred and Sol paused.

## CP11 native artist workflow accepted; packaging next

Root wrote tools/diagnostics/cp11/LatticeMarksProbe.java and tools/run_lattice_marks_pde.py
using existing static runner/lock helpers. Probe compiles against candidate2 and instruments
actual ordered drawing primitives/styles, retained values/RNG/object identity, changed
structural inputs, exact resets, and cached save. Registered source-bound plan then ran
one serialized attempt: .work/reproductions/cp11-lattice-marks-root1, terminal passed.
12 captures plus save, seven distinct images. Root viewed all seven at full640resolution,
confirmed useful treatments and visible structural edits, and accepted technique-level
JAVA2D in evidence/reproductions/cp11-java2d/root-review.json. Result/plan/source/image hashes
bound there. No source equivalence, other renderer or port claim. Next package Java0.11 under
cp11-delivery-brief.md, update guide/install path and catalog validation attestation using
existing tools. Shipped package still Java0.10 until actual archive accepted. Full goal active.

## CP11 root completed staging; actual PDE compiles

Terra again ended with incomplete tools after a routine patch failure. Root took over
integration rather than continue partial handoffs. Added tools/prepare_lattice_marks.py
using the accepted prior staging pattern and actual CP11 review keys; one tool handles
source-bound staging and official PDE preprocessing/compile, avoiding a duplicate checker.
Root rewrote PDE into readable drawing helpers and contrasting endpoints, and separated
start layout/config lines in the helper. Candidate1 passed; helper formatting then required
fresh candidate2, also passed. Current stage is .work/examples/cp11-candidate2/result.json:
68 prior JAR file entries preserved,6 new core class entries. No native Processing launch.
Next root prepares focused static probe/runner using FacetMarks conventions and the existing
12-state LatticeMarks acceptance scope, then launches serialized render and views all unique
captures. Core and catalog remain frozen. Terra idle; Sol paused; full goal active.

## CP11 starter draft reviewed; bounded staging assignment active

Terra returned helper/PDE but incomplete tooling. Root read both and required readable
artist-editable source plus contrasting dots at both endpoints (one for single-cell paths),
matching existing acceptance. Current dots used same stroke colour and only the final end.
After another partial handoff root narrowed the next assignment: Terra completes these source
fixes and prepare_lattice_marks.py/check_lattice_marks_pde.py, stages cp11-candidate1 and
preprocesses actual PDE. Native probe/runner follows as a separate bounded assignment.
No renders yet; no acceptance of the draft. Core remains frozen and accepted.

## CP11 delivery requirements grounded in accepted archive

Previous goal turn accepted the core and assigned Terra the starter slice. Root this turn
read the prior builder and inspected the actual Java0.10 archive: SHA matches recorded
f045387a...,60 file members,68 core JAR file entries, ten named starters. Wrote the bounded
delivery brief at design/capabilities/cp11-delivery-brief.md to require byte preservation,
actual CP11 source/evidence bindings and root visual acceptance before Java0.11 packaging.
No builder or archive produced early. Terra remains responsible for starter implementation;
root next reviews its handoff and launches serialized native validation when ready.

## CP11 Java core accepted; starter next

Root finished direct review and ran .work/conformance/cp11-occupied-lattice-java-root1.json:
14/14 exact shared cases and45 focused native assertions passed. Root's corrected benchmark
is preserved in .work/performance/cp11-java-root1/{attempt,result}.json: authored24x24 alloc9728B,
scaled48x48 alloc18496B, sparse maximum dims688B per generation on this desktop; repeated
checksums agree. These are bounded observations, not universal guarantees. Root inspected
formatting token differences (two safe added statement braces) and stopped Luna formatting
before final verification. Current core SHA is bound in evidence/conformance/occupied-lattice-java-root-review.json.
Conformance and performance records are in evidence/conformance/occupied-lattice-java.json
and evidence/performance/cp11-java.json. Core accepted; no artist/runtime delivery claim yet.
Next assign Terra the LatticeMarks helper/PDE and native static validation preparation under
existing design/capabilities/cp11-lattice-marks-acceptance.md. Root owns renders/acceptance.
Accepted package stays Java0.10,13 operations,10 starters; CP11 is not shipped. Full goal active.

## CP11 root finishing edits; formatting handoff pending

Terra's finishing conformance passed14 vectors/43 native assertions at
.work/conformance/cp11-occupied-lattice-java-terra-final.json. Root read the changed native
checks and benchmark and found the caller-input mutation case missing and the benchmark's
"authored" case incorrectly using every24x24cell as a start. Root added input preservation
and post-generation mutation checks, and corrected benchmark inputs to the actual12-start,
12-step authored ordering plus a scaled48x48/24-step case. These edits await focused rerun.
Luna spring_native_checks is formatting only the core; file now571lines. Root observed safe
grouped-declaration splits beyond whitespace and requested an explicit account rather than
false token equality. Root read formatted RNG/Storage sections. Wait for Luna handoff, run
one final core conformance and preserved performance capture with source hashes, then record
core acceptance if sound and assign the starter. No renders or runtime acceptance yet.

## CP11 first stable core handoff reviewed; finishing pass assigned

This turn verified Terra live and waited on the current worker twice rather than restarting.
Terra delivered a stable core with .work/conformance/cp11-occupied-lattice-java-terra-5.json:
14 available/14 executed exact Java fixture cases and31 focused native assertions, binding
core/native/runner hashes. Root read the runner, corrected core sections, native checks and
performance source. Fixture execution and high-capacity arithmetic corrections are sound
for the current vectors. Worker also fixed offsets allocation found during performance.
Root requested one bounded finishing pass: remaining compressed core formatting; assigned
ownership/native numeric and wide-product checks; >16-path storage regression; actual stable
checksum assertion and generation allocation measurement in performance (the first probe
printed passed without assertions). Authored24x24 plus one larger comparable case, sparse
maximum dimensions, no framework or render expansion. Acceptance remains pending this pass.
Next review only changed sections and resulting evidence, then the LatticeMarks starter.

## CP11 initial core review found concrete acceptance gaps

Previous turn progressed by reviewing the guide. This turn root found the new Java class,
native test and runner and read all three while Terra retains edit ownership. Root sent
these actionable findings: primitive occupancy threshold multiplication and table doubling
can overflow; start x bounds must precede y inspection; compressed core helpers need readable
formatting. The runner currently counts/hashes shared fixtures but executes only hardcoded
native examples, so it must actually execute all shared inputs and compare complete exact
outputs/errors. Evidence must bind core/native/runner hashes. The one-item LinkedList case
cannot detect indexed traversal; use a get-rejecting list or meaningful traversal check.
Terra was messaged with these requirements and continues routine fixes. No root edits to
in-flight code, no acceptance, and no duplicate worker. Next review the corrected coherent
handoff and actual results before starter work. Accepted package remains Java0.10.

## CP11 artist guide reviewed; core still in flight

The previous turn made progress by checking authored geometry and assigning a bounded guide.
This turn collaboration.list_agents confirmed both workers running, followed by a wait on
that live team. Luna completed docs/lattice-marks.md; root read the whole draft and corrected
comparison wording (each structural edit starts from baseline), linked the oracle counts,
and made the width toggle explicitly discrete. Guide remains implementation pending and
claims no runnable starter or visual acceptance. Terra core assignment remains in flight;
no restart or duplicate implementation. Next inspect core handoff, then implement the starter.

## CP11 starter inputs checked while core implementation runs

Previous goal turn made progress by freezing the reviewed contract and assigning Terra.
This turn collaboration.list_agents confirms Terra is running; no core file was present
at the initial filesystem check. Root evaluated all four authored structural settings with
the independent oracle and recorded exact occupancy/reason counts in the LatticeMarks
acceptance document. Longer paths claim more cells but suppress four later starts; this
interaction belongs in the artist guide. Geometry evidence is not visual acceptance.
Updated stale draft wording in that acceptance plan. Next remains Terra core code/evidence
review, then starter implementation and serialized native acceptance. Full goal active.

## CP11 contract frozen; Terra implementing Java core

Root accepted the corrected contract and fixtures in design/operations/cp11-contract-review.md.
Direct oracle execution reproduced all ten success vectors exactly and verified source/catalog
bindings. Four error vectors await native execution. Contract status is reviewed; no target
runtime support is claimed. Catalog checker passed after regenerating the operation reference
with its checked-in tool. Frozen hashes are in the root review.
Terra spring_java_core was assigned the bounded Java core slice using
 design/operations/cp11-java-implementation-brief.md. Root retains catalog/fixture ownership
and will inspect actual code and evidence before acceptance. No rendering is underway.
Next: review Terra's core handoff, then the separate LatticeMarks artist workflow and packaging.
Current accepted delivery stays Java0.10 with13 operations and10 starters. The new catalog
entry is a specification, not a shipped feature. Sol paused; ports deferred; full goal active.

## CP11 root contract and fixture review

The previous goal turn made progress: root read the full catalog and identified contradictory
access-error precedence and incomplete materialization complexity; Terra is correcting these.
This turn root read the independent RNG/walk oracle and all shared vectors. The purported
three-neighbour fixture actually offers four neighbours; Terra is adding a real three-option
case and a sparse maximum-dimension case, and moving the reproducible oracle from .work
into tools/diagnostics/cp11 while preserving the private original. Contract remains draft.
Focused catalog tests pass (29 tests); catalog check reports only the draft-status gate.
No Java implementation or support approval yet. Root wrote the bounded implementation brief
at design/operations/cp11-java-implementation-brief.md for use after actual contract acceptance.
Next inspect the corrected fixture handoff, verify oracle equality and freeze if sound, then
assign Terra the core implementation slice. Accepted delivery remains Java0.10,13 operations,
10 starters. Sol paused, ports deferred, full goal active.

## CP11 fixture-format integration identified

This turn verified Terra tasklive and located checker mismatch: existingmaterialized-output
requires trace-specific positions_abs/headings_abs. Root explicitlyrejected addingmeaningless
headingmetadata. Terra nowwrote authoritativecatalogdraft andprivateoracle
.work/diagnostics/cp11/build_lattice_fixture_draft.py; sharedfixture remainsinflight.
Worker willuse exact-json-output, explicitlypending smallgenericcheckerextension byroot.
No newvalidationframework or Javaimplementation. Runtimecross-field invalidcases muststay
separate frompureJSONSchema validation; nativeconformance willcheckactualsemantics.
NEXT collectdraftfixtures, reviewcontract+oracle once, implementminimalexactJSON checker
support andfreeze onlywhenadequate. Latestacceptedpackage0.10unchanged; wholegoalactive.

## CP11 contract drafts in flight; static starter scope fixed

Previous goal turn progressed admission/proposal review. This turn root defined the
single LatticeMarks workflow in design/capabilities/cp11-lattice-marks-acceptance.md:
24x24grid, explicit deterministic startprefix12/36, move limit12/36, retained stroke/dot
andpalette/width edits, seed/reset/cache save.12rendered states planned (notrun), using
existing staticrunner rather than newframework. Source/artisticdivergences explicit.
Terra spring_java_core still owns only authoritativecatalog/fixture drafts; no Java code
or rendering yet. Root awaitingactualhandoff for single review. Luna idle. Accepted
Java0.10 package unchanged; wholeobjectiveactive andeconomicalbatchpolicy maintained.

## CP11 admission recorded; proposal reviewed for catalog preparation

This goal turn progressed: root admitted path.occupied-lattice-paths-2d fromtata#0,
explicitcomponentextraction/remainder/designdivergence, guaguaunchanged. Ledgerpreserves
all1934identities;27keep/100merge/18reject/1789review_required. Priorledger
.work/investigations/cp11-admission/ledger-before.json. Contract-clustergate andcatalog
checkpass; existingacceptedpackage remains0.10/13ops/10starters.
Root reviewed Terra1350wordproposal andselected staticpotential-output maxCells with
correcttwo-coordinate ceiling1073741823 (notCP10sixscalarbound), unsignedlong[]state,
exactexistingRNG mapping, nativeaccess/errorprecedence corrections in
 design/operations/cp11-proposal-review.md. No code/contractfreeze yet.
Next boundedworker prepares authoritativecatalog/sharedfixture drafts against review;
rootapprovesactualsemantics/vectors beforeJavaimplementation. No rendering/newframework.
Userquota policy andfullgoal retained.

## Current selection — CP11 semantic direction chosen; concise proposal in flight

Previous goal turn made progress: selected one boundedlattice investigation. This turn
root reviewed Luna's evidencebrief andselected completeoccupiedpaths in
 design/capabilities/cp11-lattice-decision.md. Emit/reserve starts, sharedoccupancy,
fixedNESW available-neighbour choice, successfulmoveslimit, actualblocked termination;
occupiedstartvalidempty/noRNG. Deliberately differsfromtata retry/omittedstartpolicy;
guagua remainsseparate. No sourcepixelequivalence, publicdefaults orrangeclaim.

Terra spring_java_core owns only cp11-lattice-contract-proposal.md (~3pages) resolving
existingRNG, exactinteger/worklimits, ownedoutput/accesssurface andsmallfixtureplan.
No code/catalog/ledgerchanges delegated. Root reviewsproposal andrecords candidate
admission beforefreeze/implementation. Luna tinyfollowupadds exactartifactcitations for
otherwiseunboundguaguameasurements orremovesthem; no newexperiments. Latestaccepted
package0.10/13ops/10starters unchanged. No tests/renders needed for decisiondocuments.
Economicalonecapabilityscope maintained; goalactive withlatermilestones/portsincomplete.

## Active selection — CP11 occupancy-aware lattice paths

Previous goal turn made progress: accepted Java0.10distribution, closing CP10. This turn
selected one small Java capability investigation undereconomicalbatchplan. Root readfull
tata/guagua reports anddecisive upstreamloops. Importantdifferentsemantics: tata global
occupieddestinations, unmarked/unemittedstarts, fourproposal rounds withreplacement and
no terminationafterfailedround; guagua unbounded revisiting pre-move output, unusedusedtable.
No equivalentmerge or publicsignature approved. Direction
 design/capabilities/cp11-lattice-direction.md; selectionscope in docs/development-batches.md.
Luna spring_native_checks owns max~2page cp11-lattice-evidence.md with exactcandidateIDs,
hashes,currentdispositions andmeasurements. No code/fixtures/render delegated. Root resolves
whether occupied-cell bookkeeping earns oneoperation and chooses semanticboundary. Terra
idle; Solpaused. Latestacceptedpackage remains0.10/13ops/10starters. No reruns ofaccepted
CP10 tests/images. Fullgoalactive; cheaperworker-ledapproach continues.

## Current handoff — CP10 closed; local Java0.10 accepted

This goal turn made progress: corrected and executed one registerednativeattempt,
reviewed alluniqueimages, accepted scopedworkflow, integratedcatalogattestation, ran
repositorytests andaccepted localarchive. Fullgoal remainsactive/incomplete.

Latestpackage .work/dist/cp10/java/procedurals-processing-0.10.0.zip
SHAf045387a0bc1912795993b08ee7401023731da3bc06d2cc290ba772d9ed08dab.
Review evidence/distribution/cp10-review.json; generatedbuilderrecordcp10-java.json.
13operations/10starters;11coreclasses (newTargetSprings2D). All9priorstarters and65prior
coreentries preserved;3newcoreentries. OnlyinheritedchangescoreJAR/library.properties/
generatedreference. No registryrelease. 140repositorytests andcatalogcheckpass.

Spring native/visual review evidence/reproductions/cp10-java2d/root-review.json accepted.
Raw .work/reproductions/cp10-spring-marks-root1 preserved:45captures,31unique viewed
inlabelledcontact sheets plus3fullsize, scriptedreplay/savenativechecks passed no stderr.
Probe corrections andresult-vs-reviewseparation made before solelaunch; no failedrenders.
Guide/install andREADME nowpoint0.10. Allworkerscompleted/idle, Solpaused.

NEXT underdocs/development-batches.md: currentbatchcomplete. Choose a small subsequent
Java breadthbatch (atmosttwo usefulcapabilities) before workerimplementation; no automatic
wholecorpusadjudication or newvalidationframework. Root makescapability/APIdecisions and
onefocusedreview; Luna/Terra ownboundedimplementation/docs/checks. Prioritize reuse of
currentoperations andexistingrunners; do not rerununchanged accepted evidence. Userquota
concern remainsstandingconstraint; do not claim cost/timeestimates from goalcounter.
Remaining broaderfamilies, ports anddownstream milestones retainfullscope.

## Current handoff — spring native and visual acceptance complete; packaging in flight

Previous goal turn delegated bounded integration under economical plan. This turn root
reviewed bothhandoffs, corrected result-vs-review artifact separation and bound the ready
plan, then ran exactlyone serializednativeattempt. Terminal result PASSED:
 evidence/reproductions/cp10-java2d/result.json; raw
 .work/reproductions/cp10-spring-marks-root1/attempt.json. No stderr. All1125scheduled
callbacks,57keys,45capturePNGs andcachedsavechecked; exactnative/replaypixels pass.
Root inspected all31uniqueimages in labelledcontact sheets and3selected fullsizeframes;
remaining14captures byteidentical. Review
 evidence/reproductions/cp10-java2d/root-review.json acceptedscoped JAVA2D; target-spring
catalogattestation added andgeneratedreference refreshed/checkpassed. No otherplatform,
sourcepixel or naturalframerateclaim. Preserve registeredrun; no rerenderneeded.

Luna spring_native_checks now owns finalguide/installwording and building local0.10.0
archive via tools/build_spring_marks_java.py. Root found/fixed stagedJAR input/artifact
binding distinction withworker; builder derives counts/preserves oldentries andgatesvisual
acceptance. Awaitactualarchive thenrootreviewzip preservation andrecorddistribution.
Terra complete/idle. No newcapabilitywork. Current acceptedreleasedpackage still0.9until
archiveaccepted; newcore/workflow individuallyaccepted. Userquota policy remainsactive.

## Active batch — worker-owned spring integration

Previous goal turn made progress: reviewed guide and concrete economical batchplan,
collected compiled probecheckpoint and inspected its exported schedule. This turn launched
two bounded implementation tasks under thatplan; no CP11 work, no render yet.
Terra spring_java_core owns probe corrections and tools/run_spring_marks_pde.py, reusing
existing serializedrunner. Root reviewed probe once and flagged wrong helpercodeorigin,
postdraw DIRTY check, missing Period event, missing postresponse ticks, primary/replaystyle
mismatch, floatcastcrosscoordinate order and open-shape handling. Worker resolves and
returns compiled probe, describedschedule and ready privateplan; root thenreviewscoverage
and launches registerednativeattempt. No repeatedwholefile review requested.
Luna spring_native_checks owns tools/build_spring_marks_java.py and
 docs/installing-spring-marks.md, adapting existing0.9builder. Actualbuild gates on future
accepted CP10visualreview; preserve prior9starters/coreentries. No README/catalog/evidence
changes delegated. Check actual agentstatus before continuing or overlapping theirfiles.

## Current execution checkpoint — bounded spring closure

Previous goal turn made progress: accepted native core, compiled/staged SpringMarks and
revised quota-conscious instructions. This continuation reviewed the artist guide and
corrected controlled comparison instructions (reset, select response, D, equal Period ticks).
The concrete worker-led plan is docs/development-batches.md. Current batch ends at accepted
spring workflow/localpackage; no CP11 research launched. Subsequent Java breadth batches
are limited to at mosttwo architect-selected capabilities, with one combined root review.

Terra completed tools/diagnostics/cp10/SpringMarksProbe.java, compile-only against
staged actual PDE/JAR at .work/build/cp10-spring-probe-terra-r2 (adds actual running tick30 save key). Root verified --describe
executes headlessly and parses as JSON; output schedule-root-read.json in thatbuild.
No Processing render launched. Probe runtime scheduling/primitive assertions still need
review and validation; compilation is not acceptance. Worker stopped at requestedcheckpoint.
Guide reviewed. Next bounded worker task: integrate probe with existing serializedrunner,
verify frozen schedule covers current acceptance, then one root-controlled nativeattempt.
Do not invent another instrumentation framework. Root reviews actual images and coverage;
Luna can prepare existing-style packaging after acceptance. All workers now handoff/idle.
No new tests/renders needed for these documentation-only changes. Overall goal remains
active; visual SpringMarks acceptance, nextpackage, latercapabilities and ports incomplete.

## Latest steering — cost-conscious checkpoint and worker-led development

Maintainer asks for honest overall completion estimate and a sustainable path after next
logical stop; reports roughly60% weekly quota consumed. No new capability research/CP11.
Execution policy updated in AGENTS.md and docs/agent-briefs.md. Preserve entire objective,
but route implementation/docs/routine checks to Luna/Terra, root to consequential architecture
and focused integration. No assertion-count-as-progress framing; no unrequested expansion.

Since older handoff: root accepted Java spring core in
 evidence/conformance/target-springs-java-root-review.json; native evidence and performance
published separately. Stronger late failure checks pass; deliberately broken early-commit
mutant rejected at .work/build/cp10-atomicity-mutant-root1. Actual PDE implemented, paused
DIRTY gating avoids repeated canvas copies. Official preprocessing/helper checks pass
.work/build/cp10-pde-root2. tools/prepare_spring_marks.py built a candidate preserving prior
core entries at .work/examples/cp10-candidate1; staged sketch/helper compile and pass headless
checks. No actual spring render or release yet. Latest accepted package remains0.9/12ops/9starters.
Luna completed docs/spring-marks.md; root review pending. Terra has bounded SpringMarksProbe
implementation in flight; instructed to avoid scope expansion, checkpoint if substantial,
and remain idle after handoff. Revalidate actual agent status on resume. Root should collect
that work, identify remaining visual-validation effort and establish a bounded economical
next batch before further autonomous implementation. Full milestone goal still active.

## Current handoff — CP10 core implemented; native review in progress

The preceding status-only user turn made no implementation progress. This continuation
verified catalog plus140repository tests and recorded frozen contract/44fixture root
acceptance in evidence/investigations/cp10-contract-review.json. Shared27success/17error
cases use an independent exact-rational binary64 oracle and10mutationtests.
Latest accepted package remainsJava0.9.0:12operations,10classes,123signatures,9starters.
CP10 is implemented in the working tree but not accepted or packaged; targets remain
unvalidated. Sol paused; root directly reviews architecture and code.

Terra task spring_java_core completed TargetSprings2D.java and fresh --release8 build
.work/build/cp10-core-terra-r2. Root read full firstdraft and requested linear arbitrary
List traversal rather than LinkedList quadratic indexing; Terra fixed it. Exact staged
arithmetic, complete static validation, owned buffers and atomic pointer swap reviewed.
Luna task spring_native_checks remains in flight on tools/run_target_springs_java.py and
tests/native/TargetSpringsNative.java. Root requested manifest-driven bindings (no duplicate
hash literals), no output overwrite, preserved failure results/logs, separate schema-only
wrapper counts. Check live agent status before treating this task as stopped.

Root registered design/capabilities/cp10-spring-marks-acceptance.md and implemented
packages/java/examples/SpringMarks/SpringComposition.java.49regular sites, explicit local
target impulse/return, owned core, coefficient changes by detached import,121sample trail
ring, original Delaunay indices mapped back to spring bodies. No PDE yet.
Headless tests/native/SpringCompositionNative.java compiled --release8 and passed25477
assertions over261states and full replay, chronological history through wrap, response
changes, reset, input-only disturbance and original-mesh mappings. Fresh output and bound
sources .work/build/cp10-composition-root1/{result,bindings}.json. No visual claim.

Root tests/native/TargetSpringsPerformance.java and tools/run_target_springs_performance.py
ran .work/performance/cp10-java-root1/result.json:0/1/49/512/4096/65536bodies, ALL warmed
packed paths zero allocated bytes. Mean49body step~0.535microseconds;65536~0.658ms on
recorded desktopJDK17. Setup caller inputs excluded; allocation is not retained heap;
no renderer/Android/universal promise. Raw stdout/stderr, commands and hashes retained.
Measurements await overall native core acceptance. Do not rerun without a new reason.

NEXT: collect/review/finalize Luna native harness and run independently to fresh output;
record root core review with source/fixture/harness/performance bindings if satisfactory.
Then implement actual SpringMarks PDE around helper, register exact event/render schedule,
run all required consecutive states, paused/style/save checks and inspect distinct images.
Package tenth starter/thirteenth operation only after those pass. Preserve prior9starters,
all accepted outputs and failed attempts. All later milestones and ports remain active;
no maintainer input needed.

## Previous handoff — CP10 parameter evidence complete; operation admitted for contract

Previous goal turn was progress: source-state investigation and root state-boundary
selection. This continuation completed the registered parameter experiment and
admitted a computation-level extraction. Full project goal remains active; no
blocker or maintainer input needed. No CP10 public contract/code/support yet.

Accepted parameter review:
evidence/parameter-experiments/cp10-spring-response/root-review.json.
All7registered attempts passed,42frames at0/1/10/30/60/120,31distinct images root
viewed. Every other image byte-identical to viewed initial. Full121states ×9sites
per case retained; exact native source-float recurrence checks at every update.
No stderr. Both controls retained for contract design; no recommended defaults or
continuous artistic ranges. Decision.md and results.json include per-frame pixel
metrics and temporal measurements. Preserve raw outputs; render budget consumed.

Raw terminal batch .work/parameter-experiments/cp10-spring-response/batch.json
PASSED. Build/registeredplan under .work/parameter-experiments/cp10-spring-response-build.
Tools: tools/diagnostics/cp10/SpringResponseProbe.java, spring_response.py,
analyze_response.py. Original MIT-noticed Point tab officially preprocessed with
one literal→probeSpring substitution; original retained under.work. Outer carrier
field added, decay explicitly overridden after construction. Fixed9sites, target
+100 impulse, return0.04, remote pointer, no topology/renderer source copying.
Registered-experiment.json preserves original brief bytes/hash before experiment.json
was advanced after all bound inputs were rechecked; this deliberate state update is
explained in root-review. No accepted computational input changed during execution.

First-site peak displacement/tick: baseline54.356/18; springhalf38.611/26;
springdouble72.162/12; strengthzero0; retentionzero27.853/31;
retention0.9 peak91.143/16 with5direction reversals; retention1 peak139.447/17
with6reversals and still oscillating at120. Fullretention velocity indicator clips
left at120 and traces overlap; boundary diagnostic, not encouraged layoutsetting.
Zero retention still moves: damping follows position advancement. Pixel fractions
small due sparse marks, not evidence of absent temporal effect. No universal
monotonicity, settling, stability or binary64 behavior inferred from sourcefloat.

Root admission design/capabilities/cp10-admission-review.md:
new motion.target-springs-2d operation candidate. Only araniaaas#1 moved from
provisional motion.spring-drift family, status research_required→reviewed_provisional,
keep unchanged; explicit component_extraction audit accounts for target-return/
pointer recipe policy, deferred source-host state, and separate drawing/topology.
1934candidate identities/source fields preserved; disposition totals unchanged
26keep/100merge/18reject/1790review_required. Beforeledger preserved under
.work/investigations/cp10-admission. Review evidence/investigations/cp10-admission-review.json.
Contract-cluster prerequisite passes;130unittests pass. Root owns integration.

NEXT: use operation-contract and deterministic-semantics skills to freeze portable
one-tick/state behavior, exact coefficient carriers/ownership, finite/error domains,
staticvalidation versus arithmeticfailure precedence, fixed-size buffers and detached
observations. Root selected mutable owned batch with scratch/atomic commit already;
no new history/time/recipe framework. Resolve how uniform versus per-site coefficient
inputs affect source variance and artist clarity before signatures, then shared
fixtures, Javaimplementation/performance and complete SpringMarks edits/transfer.
Both agents idle/completed; Sol paused. Latest release remains0.9 with12operations,
10coreclasses,123signatures,9starters. All later milestones and ports stay active.

## Previous handoff — CP10 spring-motion investigation active

Previous goal turn was progress: completed CP9 native workflow and Java0.9 package.
This turn selected the next artist capability investigation, corrected misleading
source-report semantics, executed source-state diagnostics and registered bounded
parameter research. No new public operation/contract or support claim yet. Full
milestone goal remains active; no blocker or maintainer input needed.

Root direction: design/capabilities/cp10-spring-marks-direction.md. Task: disturb
an arrangement's targets, let sites respond/settle, retain current state while
restyling, pause/single-step/replay; transfer motion to fixed initial triangle
indices. Root read complete araniaaas report and both pinned source tabs via git
show at69bdd8513e4482a5e6018e36887d4bc208660eb5. Sparse filesystem does not contain
those tabs; git objects do. candidate audit physics-evidence-audit.md includes
three stateful counter-neighbours, without conflating their different updates.

Critical correction: araniaaas initializes spawn/target/position equal and zero
velocity; it has NO autonomous drift. Pointer influence can move nearby points
even at origin. Main source triangulates only generation/click, intending fixed
connectivity deformation; imported-library point aliasing remains unverified.
Source's density2 warning and absent pointer trace limit historical frame claims.
No coefficient sweep in survey establishes public spring/damping ranges.

Root tools/diagnostics/cp10/source_motion_probe.py stages original Point text with
MIT notice under.work, officially preprocesses it, executes headlessly without
rendering. Accepted5cases ×600updates in
.work/investigations/cp10-source-motion2/result.json; public review
 evidence/investigations/cp10-source-motion.json.
Rest/remote pointer remained exact; explicit target/velocity impulses moved and
settled; origin pointer moved(100,100) but not(1000,1000). Sourcefloat only, no
portable operation claim. Preserve failedmotion1: directjavac rejected raw PDE
float literals; motion2 uses official preprocessing without editing Point body.

Planned evidence/parameter-experiments/cp10-spring-response/experiment.json:
one authored baseline plus6single-coefficient variants, max7render attempts,
ticks0/1/10/30/60/120, fixed9sites/target impulse. No render attempted. Spring
baseline0.025,retention0.7; variantstrength0/.0125/.05,retention0/.9/1.
These are investigation settings, NOT defaults/ranges. Root must implement/review
source-extracted diagnostic/hashes and exact inputs before serialized rendering.
No source web/historical pixels claim; allframes require visual/state checks.

palette_javascript completed cp10-state-boundary-options.md. Root read it and
selected mutable owned fixed-size batches in cp10-state-boundary-decision.md:
explicit stepping, detached requested snapshots, complete-batch scratch/commit
atomicity, no implicit time/history/renderer. Signature/carriers/error domains
remain contract work; allocation advantage is not yet benchmarked. Both agents
complete. Sol stays paused. Next: complete bounded parameter investigation, then
explicit admission/contract before Java code.
Latest accepted package remains Java0.9:12operations,10classes,123signatures,
9starters. All later project milestones and batch ports remain active.

## Previous handoff — CP9 complete; Java0.9.0 accepted

This continuation made concrete progress and completed the FacetMarks capability
slice: helper/PDE, candidate JAR, headless/staged compilation, full native and
visual acceptance, documentation and the next Java distribution. The preceding
user status turn only checked/reported counts. Full milestone goal remains active;
this is not completion of the whole project. No blocker or user input is needed.

Accepted distribution: evidence/distribution/cp9-review.json.
Archive .work/dist/cp9/java/procedurals-processing-0.9.0.zip
SHA cf12903f83ce7bccedc8e23a0f8e7d930ff0eccd54242d2268d2aa23c5c28f08.
55safeuniqueZIPmembers with passingCRC; prior8examples and adapter JAR byte
identical to0.8. All65inherited core JAR entries preserved;11new Delaunay class
payloads byte-identical to accepted native core conformance build. Core JAR SHA
676e395cad14a51305ee2969c2a02d3bb81e42f9cc434e7e804b14f4858b7a03.
Only inherited changed members: core JAR, library.properties8→9, generated
operation reference. New members: FacetMarks2tabs, guide, installguide, contract.
Builder tools/build_facet_marks_java.py, staged report cp9-java.json, rootreview
cp9-review.json. Preserve accepted outputs; no rebuild/rerender or overwrite.

Current Java delivery:12operations,10publiccoreclasses,123publicmethodsignatures
including overloads/accessors,9editable starters. Latest source and delivery now
align. README and installing-facet-marks.md point at0.9. Local archive only, not
registry publication or human usability certification. Newer ports deferred.

Accepted workflow: evidence/reproductions/cp9-java2d/root-review.json.
Native result/plan in the same directory; terminal attempt
.work/reproductions/cp9-java2d/attempt.json PASSED.18renderedstates/18keys,
all6resets exact complete mesh+grain and pixels, exact triangle/line/point/ellipse
arguments and native styles, mesh/grain object retention on style edits, cached
save identity and exact saved pixels. Root viewed all12distinct images. Grain is
intentionally pale, with subtle fine-cell palette changes; no dense shading or
source-pixel claim. Other targets explicitly unvalidated.

Root rejected finite-only draft probe and replaced it with exact checks; corrected
its expectations for fine/grain persistence across cell edits. Root-owned probe:
tools/diagnostics/cp9/FacetMarksProbe.java; clean compiled class directory
.work/build/cp9-probe-root1. Serialized executor tools/run_facet_marks_pde.py.
Candidate tools/prepare_facet_marks.py output .work/examples/cp9-candidate1:
FacetMarks/code/procedurals.jar plus two tabs; build/ contains only example/check
classes, core loads from JAR. Stable staging inputs/outputs in result.json.
Headless helper covers8configurations, prefix preservation, retained sampling.
Catalog native/technique support now validated-scoped; generated reference and
catalog checker pass.130repository unittests passed this continuation.

NEXT: choose next useful Java capability by reading docs/artist-capabilities.md,
docs/api-design.md and the rare-family evidence, with root owning entry points
and boundaries. Do not substitute bulk candidate throughput or easy primitives
for artist capability. CP9 complete means resume breadth, not porting all targets
before another operation. Candidate builder agent was interrupted after file
handoff for root integration; palette agent complete. Sol remains paused.
All remaining roadmap milestones stay active, including rare-family decisions,
additional operations/workflows, batch ports, recipes and later product surfaces.

## Previous handoff — CP9 Java core accepted; FacetMarks workflow next

The previous goal turn made progress (contract/fixture freeze and integration).
This turn completed and directly reviewed Java implementation, native conformance,
resource measurements, an output-preserving optimization and core attestation.
Full milestone goal remains active; no blocker or user input is needed.

Accepted core: packages/java/src/main/java/org/procedurals/topology/Delaunay2D.java
SHA a10123eda26fa6784f20231878847c7cb7d54dcf029bbbcc1c1d6c14de8fbadd.
Root review: evidence/conformance/delaunay-java-root-review.json.
Current attestation: catalog/validation/delaunay-2d.json, processing-java core
conformant only; native/technique and other targets explicitly unvalidated.
Generated operation reference refreshed and catalog checker passed.

IMPORTANT metadata correction after initial freeze: root found CP9 target labels
java/javascript/python/android differed from all other contracts. Corrected to
processing-java/p5js/py5/processing-android without changing any other catalog field,
operation version, implementation or36fixture case values. Explicit reviewed mapping
and before/after hashes: evidence/investigations/cp9-target-metadata-review.json.
Added canonical-target checker plus regression test. CURRENT authoritative hashes:
catalog/operations/delaunay-2d.json
 e73d947703e0b0f798c95a3d3d0274b0e597aabc0e43a74303c971a5b39febcf;
fixtures/operations/delaunay-2d.json
 2f2166e90dbab6345fda3148e65aae6079fcd0de96f6a9752ade3ed80c68a4d4.
Earlier contract/native/performance hashes are preserved historical evidence; the
metadata review explicitly establishes unchanged computational applicability.

Final conformance: evidence/conformance/delaunay-java-canonical-targets.json and
.work/build/cp9-java-canonical-targets.36cases (20success/16error),2624generated
assertions including complete exact deep toValues,126native assertions. Harness
checks original inner/outer mutation, export detachment, all Object/long access
forms, safeinteger boundaries and Into atomicity/sentinels.130repository tests
passed. Source bindings match before/after the native run.
Runner requires fresh --build-dir and --output; preserve earlier delaunay-java,
review1, filter1 reports/builds. No accepted artifact should be overwritten.

Root corrected two material implementation issues before acceptance: cumulative
int face IDs could overflow despite bounded live topology, so IDs are long with
linked live nodes (creation count <=5*N+2*maxWork fits signed64). Coordinate-hash
lookup could degrade quadratically for collisions; now sorted adjacent deduplication
assigns input indices directly. Removed per-visited-face sign arrays. Public method
docs cite motivating evidence and avoid artistic range/default claims.

Root registered design/operations/cp9-performance-plan.md and authored
 tools/diagnostics/cp9/DelaunayPerformance.java + run_performance.py.
.work/performance/cp9-first/result.json passed8workloads but showed heavy temporary
allocation (512sites566MB,2048sites8.98GB). Root independently proved a finite
outward-rounded orientation sign enclosure; candidate supplied independent review.
Decision: design/operations/cp9-orientation-filter-decision.md; review counterpart
cp9-orientation-filter-review.md. Math.nextDown/up Java8 official docs cited there.
Private OrientationFilterProbe.java compared111612triples to common-exponent exact
integers, inclall1344orderedfixturetriples:60172certified,51440exactfallback,no wrong
certified sign. Result .work/cp9-orientation-filter/review1/result.json. Earlier
private first report remains historical. Only orientation filter was integrated;
unknown always falls back to unchanged exact dyadics; incircle remains exact.

Accepted performance evidence: evidence/performance/cp9-java.json, finalattempt
.work/performance/cp9-filter1/result.json. All8checksums/work/counts/budgetstages
identical before/after. On this JDK:512sites median70.84ms→22.29ms and566MB→20.87MB
allocated;2048sites959.71ms→239.60ms and8.98GB→103.50MB allocated. Into traversal
allocated0bytes in measured loops. Tiny/collinear/mixed-scale medians slightly
regressed and are reported; these are observations, not universal timings.512MiB
heap/180s deadline held. No renderer/per-frame-regeneration guarantee.

NEXT root: implement and validate FacetMarks from
 design/capabilities/cp9-facet-marks-direction.md, using frozen retained Delaunay2D,
CyclicPalette, QuadrantPartition2D and TrianglePoints2D. Register exact native edit/
transfer acceptance before rendering; keep Processing renders serialized through
root executor. Required tasks: change supplied site set/seed/count; retain mesh for
fill/wire/palette changes; unique-edge drawing; alternate region-centre source;
triangle-grain transfer; reset/save. Then package Java0.9.0 with prior8starters
preserved. No CP9 Processing example or next distribution exists yet.

Current source has12accepted core operations (10coreclasses;Delaunay adds27public
method signatures); latest packaged Java0.8.0 still11ops/8starters. Sol paused.
candidate_design and palette_javascript completed/idle; root may delegate bounded
workflow/native work after specifying it. All other roadmap milestones remain.

## Previous handoff — CP9 contract frozen; Java implementation in flight

Root accepted topology.delaunay-2d for Java implementation in
`evidence/investigations/cp9-contract-review.json`. The canonical contract is
`catalog/operations/delaunay-2d.json` SHA
02c1eeccaafb05dbeb81144ebe0036d1bfb4ef381794ada1f8535125ac526882.
Shared `fixtures/operations/delaunay-2d.json` SHA
627c4ef5eb6d3d1054e5049f1f5eecb6dddffd790469a2f05e2547cc129870eb:
36 cases, 20 success and 16 errors. Superseded draft catalog/fixture files were
moved/promoted and removed; no duplicate handwritten schema remains.

This continuation made contract, checker, fixture and integration progress.
Root reviewed the full oracle/generator/checker, corrected schedule ordering,
precharge copying, dead-face retention, integral-floating acceptance and storage
accounting. Root hand-derived small totals and the lattice49 schedule in
`design/operations/cp9-fixture-policy.md`. Independent checker uses a lifted4x4
permutation determinant and gift-wrap hull, not construction predicates/hull.
It checks mappings, winding, all sites, incidence, supporting hull boundaries,
noncrossing/coverage, empty circles, cocircular ties and local budget consistency.
Required source bindings do not depend on ignored .work reports. Adversaries
include subnormal square incircle, near/exact circle distinction and extreme4site
incircle, not only easier triangle orientation tests.

Integration passed: catalog/generated reference; exact fixture regeneration;
independent36case geometry check;129repository unittests. After the final
reviewed-status downgrade guard,7focused tests and catalog check passed again.
Regenerate/check with python3 tools/diagnostics/cp9/generate_contract_fixture_draft.py
(default check; add --write to regenerate canonical vectors). The historical tool
name does not mean the canonical vectors remain draft. Root contract review and
implementation brief: design/operations/cp9-contract-review.md and
cp9-java-implementation-brief.md. Accepted contract/fixture bytes are now frozen.

candidate_design is assigned Java Delaunay2D core only (plus justified private helper),
per frozen catalog and implementation brief. palette_javascript is assigned the
independent native harness tests/native/Delaunay2DNative.java and
 tools/check_delaunay_java.py. Both have exact shared hashes; no contract edits,
renders, packaging or support attestations are delegated. Root owns integration,
performance workload/acceptance planning and eventual FacetMarks workflow.

Next root: inspect agent state and implementation progress, directly review core and
native evidence, prepare and run representative/stress native performance acceptance;
then implement/validate FacetMarks with retained fill/wire/palette, site edits,
region-centre transfer and triangle grain. No new operation is shipped yet:
latest accepted Java0.8.0 remains8starters/11implemented operations; canonical
catalog now has12contracts, with Delaunay explicitly not implemented on all targets.
Sol remains paused. Full milestone goal active, no user input or blocker.

## Previous handoff — CP9 contract review and fixture preparation

The preceding user-facing status turn was no progress toward the goal (read-only
API/release count verification). This continuation revalidated the worktree and
architecture eligibility, and resumed concrete contract/fixture work. No blocker.

Root reviewed the full private schedule oracle and catalog draft. Corrected oracle
budget charge ordering (before queue removal), pre-budget coordinate buffering,
dead-face retention, and integral-floating maxWork handling through candidate_design.
The corrected oracle is tools/diagnostics/cp9/contract_oracle.py; historical report
.work/cp9-contract-oracle/report.json is preserved. The corrected report is
.work/cp9-contract-oracle/report-review1/report.json. Its decision-doc binding is
historical because root subsequently clarified storage in the decision doc.
Work totals remain 49 for the nine-site lattice; exact and one-short stage witnesses
remain 0/9/19/29/35. These are private reference evidence, not Java support.

Root revised design/operations/cp9-delaunay-catalog-draft.json: explicit exact
incircle formula, full native access/carrier/error semantics, exact coordinate bits,
edgeFaces boundary schema, exclusions and verification obligations. Fixed storage
accounting to O(N+U+F+E): original-input mapping must include duplicates. Clarified
static validation without retained input-sized copies before the atomic N charge,
and reclamation of dead topology. Contract remains DRAFT outside canonical catalog.

Root wrote design/operations/cp9-fixture-policy.md with independent hand checks for
small work totals, exact lattice insertion/extraction ordering and required geometry,
error, binding and mutation checks. No rendering is needed for these decisions.

candidate_design is preparing proposed fixture JSON and its private generator;
palette_javascript is preparing tools/check_delaunay_fixtures.py and focused mutation
tests, coordinating the envelope. Root owns canonical promotion/check_catalog and
reference integration, and must review their results before contract freeze or Java
implementation delegation. Sol remains paused. Latest delivered Java remains
0.8.0, eight starters and eleven operations. Full goal remains active.

## Previous handoff — CP9 dependency admitted; contract preparation next

This turn made concrete prototype/tie evidence and authoritative ledger progress.
Root admitted topology.delaunay-2d via design/capabilities/cp9-admission-review.md.
Architecture eligibility command passed: uv run python tools/check_phase2_design.py
--contract-cluster topology.delaunay-2d. No public catalog contract/code/support yet.
All1934ordinary candidate records unchanged (26keep/100merge/18reject/1790review_required).
Admission evidence and before/afterledger hashes:
evidence/investigations/cp9-ledger-admission-review.json. datata#0 and lightcity#1
motivate independent retained topology; their legacy numerical/style/renderer
remainders are explicit and neither candidate was reassigned to the dependency.

Root wrote cp9-boundary-decisions.md: exact-coordinate duplicates collapse,
canonical x/y sorted vertices, both input→vertex and first-input-per-vertex maps,
positive oriented face triples rotated minimum-index-first then lexsorted,
unique lexsorted undirected edges with face incidence; small/all-collinear sets
retain sites/mappings but zero faces/edges. No epsilon/jitter/RNG/clipping/renderer.
Work budget must bound topology work, not just final face count. Exact schema,
validation precedence, input ceilings and budget/queue accounting are next contract
work; private64site/100000edge-examination guards are NOT library limits.

Root authored independent tools/diagnostics/cp9/check_cocircular_ties.py and ran
once to .work/cp9-ties/result.json. All18379convex triangulations for4/5/6/8/10/12
integer cocircular sites passed:80944improving flips strictly decrease sorted edge
vector, unique minimum-site fan terminal in everypolygon. Boundary doc includes
root's general convex-cell tie argument. This is not general numeric/performance
certification.

candidate_design completed tools/diagnostics/cp9/topology_prototype.py and
cp9-topology-prototype.md.21cases/3duplicate permutations passed with215flips,
max1053edge examinations at25sites. Root inspected construction and independent
checks and requested separate4x4Gaussian-elimination incircle and gift-wrap/support
line hull verification; those were implemented before the final recorded run.
Root read final findings/result. Source/result hashes bound in admission record.
Pure small integer/Fraction investigation only; no production speed/all-binary64
or renderer claim. The broad queue re-enqueue/fullmaprebuild is intentionally not
the intended production work strategy.

Next root: prepare contract decisions/catalog under operation-contract and
deterministic/performance skills; specify production incidence/queue/work-budget
semantics, independent fixtures, then delegate Java implementation after freeze.
CP8 remains latest delivered0.8.0:8starters/11ops; all accepted artifacts frozen.
Agents currently complete/idle; Sol paused. Full goal active; no user input needed.

## Previous handoff — CP9 point-set triangulation direction selected

CP8 remains the accepted local Java0.8.0 delivery, eight starters/eleven operations.
This continuation made evidence/architecture progress toward a NEW operation,
not just a status restatement. Full goal stays active; Sol reviews remain paused.

Root read triangulation-evidence-audit.md, complete datata/lightcity notes and
pinned calling code, then authored design/capabilities/cp9-facet-marks-direction.md.
Task: caller sites → retained triangular facets/unique edges, allowing independent
fill/wire/palette/grain and RegionMarks-centre transfer. Existing TrianglePoints2D
does not compute connectivity. No public signature/catalog/ledger admission yet.
Unresolved topology/numeric/work questions must resolve before contract/code.

candidate_design completed cp9-source-degeneracy-audit.md: three local tabs are
the same Jenett/Bourke-attributed float port, not independent implementations.
Root read the audit and independently checked x-only comparator and duplicated
sharedVertex condition in pinned datata/triangulator.pde (missing p1==p1 case).
Root also checked datata radius sampling depends on sampled size, so note's
uniform-disc characterization is approximate. Source epsilon/identity/order and
third-party provenance do not establish new portable semantics.

palette_javascript completed cp9-predicate-feasibility.md and private
tools/diagnostics/cp9/ExactPredicateProbe.java, .work/cp9-predicate/result.json.
Root read formulas/bounds/source/result: common-exponent integers and separate
dyadic arithmetic agree for ordinary/cancellation/subnormal/extreme/cocircular/
signed-zero witnesses. Ordinary double loses signs for some witnesses. Exploratory
timings have no warmup/repetitions and are NOT performance acceptance. Exact
binary64 predicate semantics are feasible; no public count bounds chosen.

Root consulted primary Shewchuk robust-predicate page and CGAL Delaunay docs
(linked in design), then wrote cp9-triangulation-strategy.md: strict convex-hull
corner fan, insert all remaining sites incl edge points, then exact Delaunay
flips with lexicographic cocircular-diagonal preference. Avoid finite supertriangle
construction and copying port. Tie termination/canonical result/work scaling need
independent checks before admission.

candidate_design is now implementing ONLY a private <=64site exact Python topology
prototype per that strategy, plus independent geometric invariant checks, under
tools/diagnostics/cp9 with outputs .work/cp9-topology and findings
design/capabilities/cp9-topology-prototype.md. No public library/catalog/ledger or
rendering work assigned. Root next inspects prototype/witnesses, resolves strategy,
then records reviewed admission and contract using existing skills/checker. Other
agent idle. Keep accepted CP8 and earlier artifacts frozen. No user input needed.

## Previous handoff — CP8 Java 0.8.0 delivered locally

DELIVERED: .work/dist/cp8/java/procedurals-processing-0.8.0.zip, SHA-256
b5efb5ec6dd0875e19bb9513eeb018d89a001f71addaba36b7348e28c5f0841d.
Eight editable starters, eleven core operations; core unchanged at nine classes,
96 public signatures / 63 distinct class-method names. CP8 adds a workflow, not
a new operation. Root acceptance evidence/distribution/cp8-review.json binds the
staged build report, accepted native/root visual evidence and prior CP7 acceptance.
Root independently checked all50ZIP members, CRC, unique safe paths, exact new
native-bound tabs/font/license/core, version metadata and preserved prior payloads.
No registry publication. Freeze CP8 builder/archive/guides/runtime code/evidence.

Next: root read design/capabilities/triangulation-evidence-audit.md (completed by
palette_javascript), inspect decisive reports/source, and choose the next reusable
operation/artist task. Six audited triangulation candidates distinguish point-set
triangulation from existing triangle sampling. No API/ledger admission yet.
Both build/evidence agents complete; Sol paused. Full goal remains active.

## Previous handoff — CP8 native accepted; packaging completing

LATEST: CP8 staged native run is terminal PASSED and root visually ACCEPTED all
nine distinct images. evidence/reproductions/cp8-java2d/{plan,result,root-review}.json
bind the exact run; .work/reproductions/cp8-java2d/attempt.json is terminal PASSED.
DO NOT RERENDER. 17 states/17keys, 113280 text calls + 7680 ellipses =120960 stamps,
120960 fills, empty runtime stderr, eight exact reset images, S image exact final
reset. Actual pre-advance anchors, fills, font/alignment, native JAVA2D consumed
colour, object retention, regeneration and font/code-source identity checked.
Root viewed baseline/short/sparse/letters/dots/colour/distance/field-scale/new-seed.
Sparse stamps reduce overlap but still overlap; no isolated-character promise.
Some paths cross canvas edges. Accepted technique-level scope, no source-pixel claim.

Root added staged-sketch support to tools/check_glyph_marks_pde.py and compiled
actual staged tabs/core/font in .work/build/cp8-pde-staged; fresh probe-only build
.work/build/cp8-probe-reviewed avoids stale helper duplicates. Source-bound root
executor tools/run_glyph_marks_pde.py copied exact staged font/license to isolated
output/data before launch. Freeze PDE/helpers/probe/executor/plan/results now.
Root caught two probe errors before launch: tautological fill check and checking
Graphics2D colour before its lazy application. Corrected source validates packed
ARGB and checks native colour AFTER text/ellipse. No failed CP8 render was needed.

docs/glyph-marks.md and docs/installing-glyph-marks.md ready for packaging.
candidate_design is writing/running tools/build_glyph_marks_java.py: NEW archive
.work/dist/cp8/java/procedurals-processing-0.8.0.zip and evidence/distribution/cp8-java.json,
preserving CP7 JARs/all previous example bytes while adding exact validated GlyphMarks
tabs/font/license, docs and explicit version metadata. Root must review tool/report/
archive before accepting delivery and updating README/roadmap/counts. Full122Python
unittests and catalogchecker just passed; repeat only for material subsequent changes.
palette_javascript is retrieving triangulation/Voronoi evidence only into
design/capabilities/triangulation-evidence-audit.md (no API decisions/renders).
Sol paused. Goal active; this turn made concrete native/visual progress.

CP7 remains delivered Java 0.7.0: 11 operations, 9 core classes, 7 starters.
Root verified the compiled JAR exposes 96 public method signatures / 63 distinct
class-method names, excluding constructors, exceptions, internals and examples.
The preceding user-status turn was a status response; this continuation makes
concrete architecture and implementation progress. The full goal remains active.

Root read the typography audit, numbers note and pinned source, current path API,
font audit, PFont signatures and local DejaVu license. Decision:
design/capabilities/cp8-glyph-marks.md selects a Java-only GlyphMarks workflow over
existing GradientPath2D and CyclicPalette. No new core operation or catalog change.
Source numbers stamps upright glyphs BEFORE movement, excludes final point, uses
a ramp divided by stamp count, and does not apply its seed in generate(). Our
independent field/RNG/font/canvas are declared technique-level differences. No
glyph-outline or general text-layout capability is claimed.

Implemented editable example tabs under packages/java/examples/GlyphMarks and PDE
packages/java-processing/examples/GlyphMarks/GlyphMarks.pde. 48 retained paths,
160 steps; integer-valued Java Random starts/sizes/symbol indices; independent
prefix/stride/glyph/dot/colour controls versus distance/field/seed regeneration.
Explicit TTF loader has no family-name fallback and checks glyph coverage.
Font candidate: audited DejaVuSans.ttf with license/hash recorded in
design/capabilities/cp8-font-environment-audit.md; root read license. No font binary
copied into Git. tools/prepare_glyph_marks.py staged the current tabs, CP7 core
extracted from its hash-verified final ZIP, font and complete license into
.work/examples/cp8-first/GlyphMarks; staging.json binds the exact bytes. This is
staged-unvalidated, not an installed library release.

tools/check_glyph_marks_pde.py passed official Processing 4.5.6 compilation and
headless helper/font checks at .work/build/cp8-pde-first/result.json. Compiler
reported standard deprecated-API notes; native check processes had no stderr.
Font check passed 37 assertions. Root found tautological prefix/stride tests in
the first helper harness and requested removal; palette_javascript completed the
revision with fixed metadata/replay/seed/access checks (16790 assertions). Do not
claim the first pure harness proved actual PDE stamp ordering or control behavior.
The revised helper and both checks passed official PDE compilation again in
.work/build/cp8-pde-reviewed/result.json; first compilation remains historical.

Root authored design/capabilities/cp8-native-acceptance.md BEFORE any CP8 render:
17 states, keys n0d0g0m0c0v0f0r0s, 120960 actual stamp calls, pre-advance anchors,
object retention, font identity, eight exact resets, save equality and nine-image
direct visual review. No CP8 rendering or installed validation has occurred.
candidate_design is now implementing ONLY tools/diagnostics/cp8/GlyphMarksProbe.java
against the actual preprocessed PDE, with no renders. Root next reviews it,
stages byte-bound font+license/example dependencies, writes and registers an
exclusive executable plan/executor, then runs and reviews the native comparison.
Keep all CP7 frozen delivery/evidence unchanged. Sol stays paused. No user input needed.

## Previous handoff — CP7 delivered; next capability evidence in flight

Java0.7.0 is delivered locally with11reusable operations and7editable starters:
.work/dist/cp7/final/procedurals-processing-0.7.0.zip. Root accepted final archive in
evidence/distribution/cp7-review.json; packaging proof evidence/distribution/cp7-java.json.
Finalization updates docs/catalog only and verifies every inherited non-document ZIP
payload byte-identical to the validated savefix archive. All7workflow guides and11catalog
entries included. Deep evidence links still may require checkout. README, roadmap and
installation/workflow guides now reflect7starters/11operations. Not registry-published.

Corrected run evidence/reproductions/cp7-p3d-savefix/result.json and its .work attempt are
terminal PASSED; DO NOT RERENDER. It ran13states/13keys,17392normal and52176vertex calls,
exact reset/trio-selection/save image checks. Only the registered7line software EGL/X11
diagnostic block remains; the save-thread warning is gone. Root verified all8distinct
corrected images pixel-identical to already directly viewed first-attempt images, and
accepted scoped visuals/lifecycle in cp7-p3d-savefix/root-review.json. First attempt remains
FAILED and preserved. New artifact_paths parameterization supports isolated revisions;
old executor/probe snapshots are preserved in .work/cp7-distribution/source-v1.

Native43cases/3553vector assertions/507native assertions remain accepted. Attestation
catalog/validation/radial-profile-surface.json claims Java core/native/technique scopes
only; otherports unvalidated. Generated reference refreshed. Full122Python unittests and
catalogchecker pass. Freeze final core, fixtures, validated PDE/helper, probe, executor,
finalizer, native reports, renderplans/results and delivery guides after acceptance;
change only for a concrete issue with renewed appropriate evidence.

Next: continue Java capability breadth, then batchports and downstream milestones in
roadmap order. candidate_design is investigating typography evidence only (up to6notes,
exact candidate/source identities, font/renderer dependencies, no signature/ledger/code
decisions) into design/capabilities/typography-evidence-audit.md. Root must read decisive
evidence and choose the next artist task. palette_javascript idle; Sol paused. Allmilestones
goal remains active and unbounded. This continuation completed CP7 delivery, not the
whole project; no user input is required.

## Previous handoff — CP7 installed attempt failed; save-thread fix rebuilding

First installed0.7.0 package and official seven-PDE compile passed; staging reports
.work/cp7-distribution/result.json and profile-marks-pde.json. Root read both build tools,
compiled/reviewed ProfileMarksProbe, corrected inferred draw counts to actual normal/vertex
callbacks, and fixed executor RGB equality (RGBA alpha-only getbbox could falsely pass).
Registered evidence/reproductions/cp7-p3d/plan.json and executed exactly once.
Attempt .work/reproductions/cp7-p3d-pde/attempt.json is terminal FAILED and MUST NOT rerun.
Result evidence/reproductions/cp7-p3d/result.json remains failed: extra OpenGL animation-
thread warning beyond the exact registered7line software warning block. Native probe
completed13states/13keys,17392normals/52176vertices and saved image matched finalreset.

Root inspected pinned PGraphicsOpenGL bytecode: saveImpl->loadPixels->beginDraw outside
GL thread emits this warning. Leading cause is saveFrame in posted S event. Corrected
public ProfileMarks.pde captures detached displayedFrame=get() in draw and saves that CPU
PImage in S handler. Geometry/core untouched. Review:
evidence/investigations/cp7-installed-save-thread-review.json. Root viewed8distinct images;
silhouettes/facets/open rim/palette/trio look as intended, but this does NOT pass lifecycle.
Scoped observations: evidence/investigations/cp7-installed-first-visual-observations.json.

candidate_design is archiving exact old builder/checker sources under .work/cp7-distribution/
source-v1, then adding explicit output/build paths and building corrected package separately
at .work/dist/cp7/java-savefix; reports savefix-result.json/savefix-pde.json under
.work/cp7-distribution; new PDE classes .work/build/profile-marks-pde-installed-savefix.
No renders delegated. Root next must archive old executor/probe if modifying, parameterize
new artifact paths, recompile probe against corrected installed PDE, register a NEW plan/
result/output for corrected run, review+validate before launch. Keep old failed artifacts.
Current tool run_profile_marks_pde.py still hardcodes first-build paths/default firstplan;
do not rerun it on old output. New guides exist but say validation pending; final package
docs/metadata need update after validation, preserving validated JAR/example bytes.
This continuation made concrete build/visual/debugging progress. Core remains accepted;
delivered count remains10operations/6starters. Sol paused; other agent idle.

## Previous handoff — CP7 Java core accepted; distribution tooling in flight

Root read the new Java RadialProfile3D core, requested documented public methods and
linear iterator traversal of LinkedList profiles, and reviewed the corrected arithmetic
and traversal. tools/run_radial_profile_java.py generates native vectors from frozen shared
fixtures, verifies freeze hashes and before/after source bindings. All 43 cases pass with
3553 vector assertions. Root read the native harness, added explicit per-component bit
replay and full detached toValues correspondence checks; all 507 native assertions pass.
Bounded generation exercised 6, 1024 and 96000 faces. Heap snapshot/calculated numeric
payload are explicitly not allocation profiling. Scoped acceptance:
evidence/conformance/radial-profile-surface-processing-java.json and
evidence/investigations/cp7-java-core-review.json. Core and native inputs now freeze for
distribution work unless a concrete defect requires correction and renewed verification.

Root drafted ProfileComposition.java and ProfileMarks.pde in the Java/core example and
Processing example folders. Three editable profiles, independent caps, 8/32 slices,
retained palette changes and three-form arrangement use public mesh access plus CyclicPalette.
Pure Java composition compiles; PDE has NOT yet been officially compiled or rendered.
candidate_design is preparing only new CP7 no-render distribution/PDE-check tools for
Java0.7.0 and all7starters, with staging evidence under .work/cp7-distribution. Root next
reviews them and registers the separate installed P3D attempt. palette_javascript idle;
Sol paused. No new delivered count yet: existing local0.6.0 still10operations/6starters.
This continuation made implementation and native-validation progress; all milestones active.

## Previous handoff — CP7 contract accepted; Java implementation in flight

Root integrated canonical catalog/operations/radial-profile-surface.json and
fixtures/operations/radial-profile-surface.json, with reviewed semantics and 43 generated
cases (24 successes, 19 errors). tools/build_profile_fixtures.py regenerates directly
from source modules and checks oracle/interval correspondence and cap/pole relations;
no .work output is an authority. tools/check_profile_fixtures.py is dispatched by the
shared catalog checker. Root read/fixed malformed-input continuation, count mismatch
work, error detail typing and capacity precedence. All 19 structural corruption tests,
2 profile unittest methods, 26 existing catalog tests, and catalog checker pass.
Generated operation reference refreshed through tool; now 11 reviewed specifications,
still only 10 delivered Java operations/6 starters. Contract review and frozen bindings:
design/operations/cp7-profile-contract-review.md and
evidence/investigations/cp7-contract-review.json.

palette_javascript is implementing ONLY new Java mesh/RadialProfile3D.java from the
frozen contract, plus optional private smoke harness. No catalog/fixture/shared class
edits authorized. Root next owns native conformance/ownership/performance harness and
review, then installed P3D workflow validation. candidate_design idle; Sol paused.
All CP6 delivery artifacts and accepted CP7 private rendering inputs remain unchanged.
This continuation is progress: canonical contract/fixtures/checker integrated and Java
implementation assigned. All milestones remain active, with native delivery still pending.

## Previous handoff — CP7 admitted; catalog draft next

Latest continuation made progress: root integrated numeric policy and explicit prospective
deferred-port bindings into .work/cp7-contract/radial-profile-surface.json; both JSON
schemas validate. Root expanded oracle to 43 cases (24 successes, 19 errors) for every
endpoint cap flag combination and added explicit expected error code/detail assertions
plus failure on unexpected outcomes. All 24 allowance calculations and 120 perturbation
runs pass. Root read/fixed validate_profile_outputs.py: allowance array lengths before
zip, nonnegative allowances, canonical observed zero, strict error-detail types, overflow
rejection. All 43 baseline comparisons and 22 corruption checks pass. New report is
.work/cp7-contract/validator-review.json. This is runtime-output comparison, not yet
shared fixture authority validation. Candidate agent is preparing the integration memo.
Next integrate the fixture envelope/check_catalog support, review/freeze, implement Java.
No new delivered operations; CP6 and accepted private CP7 renders remain untouched.

Root selected the numerical fixture policy in
design/operations/cp7-profile-fixture-policy.md. Exact topology/metadata/forced values
remain separate from per-component trig/normal allowances; same-runtime bit replay is
distinct from Python-to-Java comparison. Root read and strengthened the new
tools/diagnostics/cp7/check_profile_enclosures.py (reverse mixed endpoints, failure exit,
empty-case rejection). All 85 perturbation runs across 17 successful draft cases pass;
no native or universal trig claim. Count proof rerun passes all 69 symbolic cases.
Candidate agent cleaned staged profile maxItems, two-point pole wording, Java carriers
and count-proof references. Root inspected input/output schemas and parameters. Next:
integrate policy into staged catalog, define shared fixture validator and mutation checks,
then review/freeze contract before Java implementation. Both build agents are idle.
Previous status-only turn was no progress; this continuation adds policy and verification.

Latest contract progress: root read the staged catalog and count proof, reran69symbolic
count cases, and confirmed V<=F+1. Root read/corrected private profile_fixture_cases.py
(budget0must beINVALID_INPUT; integral numeric carriers accepted; converted/canonicalized
profile values used consistently). Its draft now has36cases:17successes/19expectederrors,
including subnormaldirectdivision, bothoneopenpole cases, exactcapacity, static-before-budget,
and all3actual dynamicstages. No unexpected outcomes; no canonical fixtures yet.

Root read profile_intervals.py and tightened exact rounded endpoint intervals, zero division
and algebraically axis-aligned normals. All17draft successes have finite per-component
position/normal allowances under the proposed2adjacent-reference-trig engineering envelope,
including uniformlarge/smallscale and subnormalcase. Staging artifacts are
.work/cp7-contract/fixture-cases.json, fixture-allowances.json and check-allowances.py.
These are not final fixture/native acceptance or a universal cross-runtime error bound.
Next integrate/review this tolerance policy with the catalog and shared fixture validator;
the staged catalog still has unresolved placeholders/carrier wording. No public code yet.

User requested current Java status. Root inspected installed0.6.0JAR via javap:8coreclasses,
74publicmethodsignatures including overloads/accessors,50class/method-name pairs,10reusable
operations and6editable starters. Excludes renderer/support and exception classes. NoCP7
count increase. Counts reflect actual locally delivered JAR, not the private worktree.

Root integrated reviewed capability dependency mesh.radial-profile-surface-3d into the
canonical Phase2ledger. The contract-cluster prerequisite check passes. Exactly1of1934
source records changed: prueba4#0 provisional merge reopened as reviewed_defer because
its longitudinal strips overlap. Totals now26keep/100merge/18reject/1790review_required.
Root corrected proposal note paths and provenance, verified sourcehashes, and completed
source-helper remainder accounting. See design/capabilities/cp7-ledger-admission-review.md
and evidence/investigations/cp7-ledger-admission-review.json. docs/api-design.md updated.
Catalog checker and45focused Phase2/catalog unittest tests pass. No implementation shipped.

Root read/reran private normal v2 investigation: independently scaling each edge and then
rescaling the cross avoids demonstrated cross/norm overflow and underflow. It still rejects
nonfinite edge subtraction, zero edges, and a zero rounded cross (including lost tiny
perpendicular components). Across all4496private mesh faces, maxcomponent change from
direct normals is6.245004513516506e-16. No pixel-equivalence claim. Accepted numeric
direction: evidence/investigations/cp7-normal-numeric-review.json. Preserve v1/v2 inputs.

Root wrote design/operations/cp7-profile-contract-decisions.md: requiredprofile/slices/
capStart/capEnd/maxFaces; owned positions/triangles/normals/faceKinds/bands/cells;
ordered outward topology and normal arithmetic; exact validation/capacity/dynamic stages;
native accessor/atomic buffer decisions; no artistic defaults/ranges. Proposed signed-array
representation max715827881 depends on checking V<=F+1 before freeze. Cross-target
trig/normal tolerances and distinguishing fixtures still need root decisions.

candidate_design is preparing only .work/cp7-contract/radial-profile-surface.json plus
open-items.md, a mechanical catalog draft from those decisions. No canonical catalog,
fixture or implementation edits authorized. Root must inspect draft and settle numeric
fixture policy before freeze/code. palette_javascript idle. Sol remains paused. CP7 private
visualattempt terminalpassed; no rerender or edits to frozen experiment/prototype inputs.

## Prior handoff — CP7 private comparison accepted; admission/contract next

Root accepted the7image profile comparison and selected the next operation boundary in
design/capabilities/cp7-profile-selection.md. The artist supplies increasing axial positions
and radii; generator owns indexed seam/cap/pole topology and face band/cell/kind metadata.
Include local flat unit face normals in the proposed retained result, removing crossproduct
and normalization code from ordinary artist rendering. No smooth shading/general closed
meridian claims. A public contract and admission are not yet frozen. CP7 is NOT shipped.

Root read and corrected ProfileChoices.java: normals now submitted inside one TRIANGLES
batch, per-object translation precedes rotation, complete experiment work is preflighted,
actual3mesh transfer and retained SHA256 hashes reported, actual context/frame/count output
recorded. Root ran compile/inspect/dump and independently reran the new Java dump checker:
all5distinct meshes match ordered topology/metadata exactly, max observed coordinate delta0.
Reviews: evidence/investigations/cp7-java-profile-review.json and geometry report beside it.

Root read/fixed run_profiles.py, reconciled actual native format and preregistered exact
known stderr policy, and froze evidence/parameter-experiments/cp7-profiles/experiment.json.
The sole registered attempt PASSED:7images,4496generatedfaces,8784drawnfaces/normals,
stable input/class bindings, actual ProcessingP3D on Mesa llvmpipe. Root viewed all7images:
legible cylinder, waist, pointed tip,8facet form, open rim, retained recolour and transformed
trio. See result.json and root-review.json in the experiment directory. The known7line
EGL/X11warning block appeared exactly; no hardware/clean-lifecycle claim. Original strict
P3Dprobe remains failed. .work/experiments/cp7-profiles/attempt.json is terminalpassed.
Do not rerender or modify bound prototype, executor, experiment inputs, dump/checker/reviews.

Next: admit the independently specified capability with explicit whole-helper remainder
accounting; supersede the incorrect prueba4 provisional contiguous-ring merge rationale.
Then define geometry/normals arithmetic, degeneracies, ownership/access, errors and fixtures
before Java core implementation. palette_javascript has a bounded private numeric task in
new normal_numeric_cases.py/cp7-mesh-numeric-cases.md and its investigation report; no public
signature/bounds/implementation or render authorized. candidate_design idle. Sol paused.

## Prior handoff — CP7 profile-mesh investigation; CP6 stays delivered

Root selected the private profile-mesh direction in
design/capabilities/cp7-profile-mesh-direction.md: supplied increasing axial positions and
radii, retained indexed triangles, seam/cap/pole connectivity and face band/cell identity.
No public signature, admission, normal policy or parameter recommendation is frozen.
Root read six exact upstream sources and notes; bindings and corrections are in
evidence/investigations/cp7-profile-source-review.json. Additional aros/Circo boundaries
are in design/capabilities/cp7-profile-neighbour-boundaries.md. Annular solids remain a
distinct backlog task; no whole family is rejected or claimed covered.

Root rejected the first diagnostic's fail-open mutation tests, then inspected the correction,
added missing in-range band/one-cap cases, and reran33fixtures/7mutation controls successfully.
Accepted moderate topology scope: evidence/investigations/cp7-profile-mesh-geometry-review.json.
No exhaustive finite-double or public implementation claim. Diagnostic/report are now frozen.

Root reviewed the P3D capability probe/runner, fixed timeout log capture, compiled the coherent
pinned five-JAR desktop runtime, froze cp7-p3d-plan.json and executed its sole attempt.
The terminal attempt FAILED the strict no-stderr policy: EGL DRI3 acceleration warnings and
JOGL3openX11display shutdown diagnostics. Preserve it; no retry. Native exited0, actual
PGraphics3D/PGL context was Mesa llvmpipe, and saved depth samples were correct. Root ran
the saved-image checker, viewed the PNG, and verified identical input bindings. See
evidence/investigations/cp7-p3d-root-review.json for scoped context/depth evidence and an
explicit future private warning policy. Do not retroactively pass the frozen probe or claim
hardware rendering/clean lifecycle. Files under cp7-p3d evidence and probe/runner are frozen.

palette_javascript completed tools/diagnostics/cp7/ProfileChoices.java and a no-render inspect
run under .work/cp7-profile-choices. Root has NOT yet reviewed that Java source/output. It
prepares7private cases (cylinder, waist, pointed, coarse, open, recolour, transformed trio).
The draft evidence/parameter-experiments/cp7-profiles/experiment.json is NOT ready to run:
review Java/numeric results, prepare executor, freeze hashes/counts and exact warning policy
first. No mesh visual attempt has run. Both worker tasks are complete; Sol remains paused.
Root is sole render executor. Next act on the private comparison, then choose/admit the
operation from actual artist/caller evidence; do not count CP7 as shipped.

## Prior handoff — CP6 delivered locally; profile/mesh investigation next

CP6 BranchMarks is accepted on Java/JAVA2D. The local0.6.0 archive at
.work/dist/cp6/java/procedurals-processing-0.6.0.zip contains six editable starters and
ten reusable operations. This is local delivery, not external publication. The endpoint
branch operation has accepted core/native/technique attestation in catalog/validation.
CP3–CP6 other-target ports remain deferred; Sol reviews stay paused.

Root reviewed core and native harness, corrected array growth and linked-list traversal,
and accepted 40sharedcases/9482vector assertions/94native assertions. Bounded workload
observations cover1,31,101,192 and20001nodes with exact repeat checksums; no actual heap
peak or forced allocation-failure claim. See evidence/conformance/branch-tree-java-review.json.

The local distribution passed installed-JAR six-node smoke and official compilation of all
six extracted examples. Root then completed the one registered installed PDE attempt:
17states/17keys,2520generatedsegments,3298drawnlines,2909terminalscans,1475dots, no stderr.
Root viewed12distinct images and independently verified5reset/restore images pixel-identical
to initial. Displayed S-key save matches pixels. See evidence/reproductions/cp6-java2d.
.work/reproductions/cp6-java2d-pde/attempt.json is terminal passed. Do not rerender.

Combined acceptance: evidence/distribution/cp6-review.json. CP6 core, native report/harness,
contract/fixtures, distribution inputs, example tabs, guides, probe/runner and registered
plan are frozen by their evidence bindings. Do not edit them without a new explicit revision.
README, roadmap and generated operation reference now report six workflows/ten operations.

candidate_design retrieves bounded profile/mesh evidence beginning with2017cilindros and
up to3 computational neighbours. It owns design/capabilities/profile-mesh-evidence-audit.md
only; no new contract/design admission/render is authorized. Root must read decisive
source and choose the artist entry point. Typography stays in the expansion backlog;
ports, recipes/MCP/web and full documentation milestones remain unfinished. Phase4 should
validate standalone archive documentation links as well as checkout documentation links.

## Prior CP6 checkpoint — Java core and starter implemented; native review in flight

Root read the full new BranchTree2D.java and fixed two performance defects before native
acceptance: growable arrays now jump to maximum capacity when doubling would overshoot
(avoids one-element copying near the cap), and rule/slot validation uses iterators rather
than indexed List access (avoids quadratic LinkedList traversal). Current core SHA-256:
25e11100c47d5bc1a25eae76d63ef91a0cdf90207971048005cc077141e57ed9.
Frozen catalog/fixtures remain unchanged. No public/native support claim yet.

Root authored BranchComposition.java and BranchMarks.pde plus two guides. The actual PDE
passes pinned Processing preprocessing/compilation with current source bindings at
.work/build/branch-marks-pde/report.json. A bounded Java composition check under
.work/cp6-composition passed all 64 control/seed constructions (16,104 generated segments),
including exact earlier geometry/attributes/ancestry under generation extension. Seed42:
single101→192 segments; forest7 roots,288→560. This is no-render example evidence.

palette_javascript is completing the native runner/harness after root rejected initial
incomplete checks (missing exact coordinate bits, a purported long-chain workload with only
two nodes, incomplete carrier/ownership coverage and formatting). It must run the real
40-case suite and all native obligations; source syntax alone is insufficient.

candidate_design prepared check_branch_marks_pde.py/build_branch_marks_java.py and now owns
the installed BranchMarks probe/runner preparation. Root reviewed packaging and tightened
native runner/harness bindings, shipped-guide bindings and a six-node installed smoke.
No CP6 archive exists yet; build requires accepted current native evidence. No render plan
is frozen and no CP6 public-workflow render has run. Root remains the sole render executor.
Sol is paused. Existing five delivered workflows/nine operations remain unchanged.

## Prior CP6 checkpoint — contract frozen; Java implementation in flight

Root froze catalog/operations/seeded-endpoint-branches.json and its 40 shared fixture cases
(24 successful trees, 16 static/dynamic failures). Exact input hashes and implementation
authorization are in design/operations/branch-tree-contract-review.md. Do not edit frozen
catalog/fixture/oracle inputs during implementation. The separate branch fixture validator
is integrated into check_catalog; catalog/reference check and all 120 repository tests pass.

Root read and reran both numerical and mutation diagnostics. Seven finite-input arithmetic
witnesses match the independent full BFS oracle. Six tested wrong schedules change public
output; terminal unused draws only change discarded state and require source review.
Per-case coordinate tolerances propagate an explicit reference trig margin; attributes,
topology and collapsed/axis cases remain exact. Reviews are under evidence/investigations.

candidate_design owns the new BranchTree2D.java class only. palette_javascript owns
tools/run_branch_tree_java.py and tests/native/BranchTreeNative.java, then actual native
evidence. Root must inspect returned code/results, then build and accept an installed
BranchMarks workflow with retained style and CP3 placement transfer. No CP6 implementation,
native support or delivery is claimed yet. Sol remains paused and other ports deferred.
Existing five delivered workflows/nine operations and CP3–CP5 artifacts remain frozen.

## Prior CP6 checkpoint — dependency admitted; concrete contract drafting

Root read and freshly reran BranchGrowthPrefix with the pinned JDK17; every emitted field
matches the saved report. Acceptance is evidence/investigations/cp6-growth-prefix-review.json.
The diagnostic generated 300 successful-profile nodes plus 10,000 nodes in the intentional
failure trial (10,300 total), with no render. Earlier geometry/ancestry prefixes and late-rule
isolation pass; six former terminals gain children. This is private ordering evidence, not
the public portable RNG implementation.

Root admitted topology.seeded-endpoint-branches-2d as a reviewed capability dependency;
the Phase 2 prerequisite check passes and all 1,934 candidate dispositions are unchanged.
design/operations/cp6-branch-contract-decisions.md selects the concrete root/rules/slots,
retained segment/heading/length/ancestry result, BFS draw schedule, numeric/error policy and
representation bound. The operation still requires reviewed catalog and shared fixtures.

candidate_design drafts the catalog under .work/cp6-contracts; palette_javascript gathers
bounded numerical adversaries and unreachable-stage reasoning. Root owns canonical integration
and fixtures. No public Java implementation or CP6 delivery is claimed. Sol stays paused.

## Prior CP6 checkpoint — private images accepted; breadth-first course correction

Root completed the one private CP6 render:8images,723unique generatedsegments/983drawn;
all source/class bindings unchanged, no stderr. Root viewed every image; result and review
are under evidence/parameter-experiments/cp6-branches. The attempt at
`.work/experiments/cp6-branches/attempt.json` is terminal passed. Do not rerender or edit its
bound source/direction/audits. Thin/binary branches, generation-dependent spread, retained
style and seven-root placement transfer are useful; no public operation is implemented.

Root identified a usability defect in source-like DFS shared randomness: changing depth
rearranges later siblings. New `design/capabilities/cp6-branching-selection.md` selects a
breadth-first append order for the candidate, so appended rules can preserve prior geometry,
parent indices and generation. Former leaves may gain children; no whole-output-prefix claim.

Active candidate_design task: new tools/diagnostics/cp6/BranchGrowthPrefix.java and its
no-render evidence report, proving replay/prefix/late-rule edits and explicit budgetfailure.
Root must inspect that result, choose concrete rule/result conventions, then perform ledger
admission and contract/fixtures before public Java implementation. Earlier Arboles/randomfans,
interior attachment and mutable brotes pools remain separate; no family-wide rejection.
Sol is paused. CP5 delivered artifacts and current9operations remain frozen and supported.

## Current handoff — CP5 delivered locally; branching next

CP5 GrainMarks is accepted on Java/JAVA2D. The local0.5.0 archive at
`.work/dist/cp5/java/procedurals-processing-0.5.0.zip` contains all five editable starters
and nine reusable operations. This is local delivery, not external publication. Both CP5
operations have accepted core/native/technique attestations in catalog/validation; other
ports remain unvalidated. Sol is paused, and Java capability breadth remains the priority.

Root reviewed the full core, native runner, packaging tools and installed probe. Corrected
zero-count oracle initialization, generated-unit metadata checks, native sentinel tests,
report validation in packaging and factory provenance. Core59cases/209vector assertions,
36native assertions passed; seeded and mapped workload observations are scoped explicitly.
`evidence/conformance/triangle-points-java-review.json` records direct source findings.

Local0.5.0 build and official compilation of all five extracted examples passed. The one
installed GrainMarks attempt passed15states/16keys with no stderr. Root viewed all15state
images, accepting grain/distribution/style/CP4transfer and displayed save. Native run:
`.work/reproductions/cp5-java2d-pde/attempt.json` terminal passed; do not rerender. Root visual
review is under evidence/reproductions/cp5-java2d; combined acceptance is
`evidence/distribution/cp5-review.json`. Docs: docs/grain-marks.md and installing-grain-marks.md.

Next architect branching from the already completed
`design/capabilities/branching-evidence-audit.md`: distinguish recursive endpoint children
from cuts into a mutable line pool. Read decisive source/notes before choosing the artist
entry point and contract. A new branching capability is not admitted yet. 3D/profile and
typography stay in the expansion backlog; ports and recipe/MCP/web milestones remain later.
Current bounded agent tasks are complete; no Sol work or render is in flight. Do not modify
frozen CP3/CP4/CP5 code/fixtures or delivery-bound inputs without an explicit new revision.
Older checkpoints below are historical and superseded by this handoff.

## Active CP5 contract work

Root admitted `sampling.seeded-triangle-points-2d` and
`sampling.triangle-coordinate-map-2d` as capability dependencies. Both Phase 2 prerequisite
checks pass; all 1,934 original candidate records retain their dispositions. Root corrected
the historical stipple rationale's false uniformity claim and marked a standalone one-point
public alias as superseded by the batch responsibilities.

`design/operations/cp5-triangle-contract-decisions.md` records root's selected draft policy:
all finite vertex triples accepted, including repeated/collinear collapse; no area epsilon
or determinant validation. Use nested square-root mapping with endpoint-aware scalar lerp,
a strictly opposite-sign branch, final endpoint-interval clamp and canonical +0. This is a
specified arithmetic design divergence, not source-bit compatibility. A bounded numeric
diagnostic already establishes useful endpoint/constant-coordinate/underflow adversaries;
a clamp supplement is in flight. No new sampler implementation is approved yet.

candidate_design prepares two proposed catalog records under `.work/cp5-contracts/` from
root's concrete field, carrier, stream and accessor decisions. palette_javascript owns the
bounded clamp diagnostic supplement. Root must inspect both, publish complete draft records,
prepare shared distinguishing fixtures and review before Java implementation. No CP5
rerender is required. Sol remains paused; other-platform ports remain deferred.

## Latest CP5 checkpoint — private images accepted; sampling boundary selected

The finalized no-render diagnostic is accepted in
`evidence/investigations/cp5-grain-distributions-review.json`. Root then reviewed and
corrected prototype containment and final report metadata. The single registered private
JAVA2D render passed all seven images, 150,720 marks and unchanged hashes, with no stderr.
Root inspected every image; decision and root-review are under
`evidence/parameter-experiments/cp5-grain/`. The first-vertex concentration is visually
clear, style/mark edits preserve points, and CP4 triangle transfer works but is pale.
No rerender is needed. Preserve prototype, executor, frozen plan and output hashes.

Root selected two responsibilities in `design/capabilities/cp5-sampling-boundary.md`: a
convenient seeded uniform triangle point batch and a separate explicit unit-coordinate
mapping batch sharing the same internal mapping/result kernel. This supports uniform
placement and source-motivated concentration without source-named presets or callback APIs.
Exact contracts, numeric policy, materialized-input cost and ledger admission remain next;
no new public implementation or delivered feature count yet. Both workers completed their
bounded tasks and are available. Sol remains paused; Java breadth remains the priority.
Earlier CP5 pending-experiment paragraphs below are historical and superseded here.

## Active work — CP5 grain investigation

Root selected grain on supplied regions as the next Java capability investigation and wrote
`design/capabilities/cp5-grain-walkthrough.md`. Root read puntis/puntis2/puntis3, Arboles,
brotes, cilindros, fieeee and textureGridText directly. The intended new capability retains
triangle point samples for independent density, appearance and mark edits, then
transfers to CP4 cells split into triangles. Public batch versus single-point boundaries,
count allocation and deterministic semantics remain unresolved; no new contract is admitted.

Both bounded evidence audits are complete: `grain-evidence-audit.md` and
`branching-evidence-audit.md` under design/capabilities. Root verified the active grain
source expressions: puntis uses first-vertex-biased sampling; puntis3 uses a biased second
coordinate and overwrites its brightness variate before sampling. The uniform helper is
unused in the active passes. Root corrected the walkthrough and requires distribution
comparison before API admission. The next private prototype/image plan must distinguish
these behaviors. Root has now reviewed the branching source too: brotes multiplies a
whole-list uniform index by a factor below one, rather than selecting only the last 20%;
Arboles stops after post-draw depth becomes negative. The audit records these corrections.

Root prepared `tools/diagnostics/cp5/run_grain.py` and the draft seven-image plan at
`evidence/parameter-experiments/cp5-grain/experiment.json`. It caps total emitted marks at
160,000, uses one serialized 180-second attempt, compares distribution before density/style,
and includes CP4 rectangle-to-triangle transfer. Plan is not frozen and no rendering is
approved or attempted. candidate_design is implementing private GrainChoice.java against
root's explicit CLI, numeric/profile and retained-data checks; no public API changes.

palette_javascript's first 500,000-sample-per-pattern diagnostic supports the analytically
distinct distributions. Root reviewed its source and requested second moments plus pre/post
source binding before final acceptance; the numerical diagnostic is still being finalized.
Its diagnostic xoshiro stream and upcoming private Java Random prototype are intentionally
different and make no source RNG/pixel replay claim. Next: review final numeric evidence,
compile and inspect prototype, freeze source-bound plan, run numeric preflight, then root
may authorize the one registered private render. No public sampler contract yet.
The roadmap now reflects CP4 delivery and CP5 investigation. Sol remains paused; ports stay
deferred. No major family has been rejected by this sequencing decision.

## Current checkpoint — CP4 RegionMarks Java delivered

Root completed direct CP4 implementation review and accepted the frozen Java core against
34 fixture cases, 685 vector assertions, five stream vectors, 27 native ownership/access
assertions and six bounded workloads through 20,000 replacements. Release-8 nested Builder
bytecode retains strictfp. Resource failure is source-inspected, not forcibly executed.

The local Java 0.4.0 distribution built successfully, including all four editable examples.
Its extracted-JAR consumer passed exact bounds/ID fixture checks and official Processing PDE
compilation. The single installed RegionMarks native attempt passed 11 draw states and 11
key events, with retained style geometry, reset replay, generation edits, authored-cell
transfer and cached save. Root inspected all three registered public-output images and
verified every source/image/artifact hash. No stderr and no rerender required.

Acceptance: `evidence/reproductions/cp4-java2d/root-review.json` and
`evidence/distribution/cp4-review.json`. Catalog attestation and generated reference are
published; `docs/installing-region-marks.md`, `docs/region-marks.md` and README expose the
workflow. Catalog validation and all 108 unit tests pass. Four workflows and seven reusable
operations are now locally delivered on Java. CP1/CP2 retain their earlier target scopes;
CP3/CP4 other-platform ports remain deferred. No public package release is claimed.

Next: select the next Java artist capability from the roadmap and decisive source evidence,
with reusable operations and complete workflows prioritized over additional ports or bulk
candidate adjudication. Root owns the boundary; Sol stays paused. Both implementation
workers are completed and available for bounded evidence or frozen-contract tasks. Earlier
handoff sections below are historical; this checkpoint supersedes their pending CP4 statuses.

## Survey status

Public snapshot revision: `b64fadf8cc484025f58a112b95630a7b0c420ea3`, captured
`2026-09-07T03:53:25.680105+00:00`.

- 901 unique target paths (`generative: true`, `status: ok` in the public index).
- 826 report paths: 800 analyzed notes and 26 stubs; exactly 75 target reports missing.
- No unexpected report paths in this snapshot. Worker histories are not completion counts.
- Missing reports are tracked for reconciliation, not a global Phase 2 blocker.

## Sprint update — Sol paused; CP3 installed Java native run accepted

Sol review assignments are paused by maintainer instruction. Root directly reviews this
Java-first sprint; the attestation validator now permits root acceptance while retaining
historical Sol records and rejecting unknown reviewers. Its focused suites passed.

The installed local CP3 Java 0.3.0 PlacementMarks package passed the actual Processing
PDE run: 14 states/events, retained style edits, reset replay, proposal-prefix preservation,
radial transfer and cached save. Root inspected all nine distinct planned images and
verified every recorded input/image hash unchanged. Acceptance is recorded separately in
`evidence/reproductions/cp3-java2d/root-review.json`; the generated execution report remains
unchanged. No rerender is needed. CP3 closure is complete: both new Java operation attestations, the generated reference,
and the local installation guide are published. Three workflows and six reusable
operations are locally delivered on Java; CP1/CP2 retain their earlier four-target scopes.
Proceed to CP4 Java capability investigation. The native execution brief is preserved
in its evidence directory; documentation-publication.json records the later status/link edit.
Other-platform CP3 ports remain deferred. Do not restart Sol review during this sprint.

Catalog publication and all 104 unit tests passed. Root wrote
`design/capabilities/cp4-region-walkthrough.md`: seeded equal-quadrant refinement,
retained cell-content substitution, and an explicit rectangular-grid transfer investigation.
The mosaic02 selection-direction prose is being checked against exact source ordering
before control recommendations. Active bounded workers: palette_javascript owns the
read-only numeric schedule investigation; candidate_design owns a private Java prototype
and five-image plan. Neither may render or admit public contracts. Root remains integration
and architecture owner.

CP4 numeric evidence now finds full-list selection more depth-diverse and area-concentrated
than first-half selection for all five tested seeds. Root reviewed the model and exact
source prelude; a no-render actual-PApplet comparison is in flight before acceptance.
The source audit now labels its opposite survey quotations as unresolved prose, and
the five-image walkthrough will test meaningful geometry/content edits directly.

## CP4 current handoff — visual investigation accepted; one dependency admitted

Root reviewed actual PApplet scheduler evidence: all 1,000 indices and ten depth histograms
match the independent numeric model. The survey's full-list uniformity description remains
unverified prose here; the native numeric direction is the opposite. Root then reviewed and
corrected the private prototype's fractional odd-list selection and negative tiny-panel
sizes. The registered five-image run passed once; root inspected every PNG and verified
source/image hashes. No CP4 investigation rerender is needed or authorized by its budget.

`evidence/parameter-experiments/cp4-regions/decision.md` and `root-review.json` accept
count/selection edits and retained content substitution. The full-list image has larger
anchors and tighter tiny clusters; 200 replacements is visibly finer than 100. Root admits
only `layout.seeded-quadrant-partition-2d`; the explicit grid transfer stays private because
it has not yet earned a second public operation. See
`design/capabilities/cp4-architecture-decision.md`. The ledger's dependency admission passed
`tools/check_phase2_design.py --contract-cluster layout.seeded-quadrant-partition-2d`.
No source candidates were falsely reassigned, and no major family was rejected.

The CP4 catalog draft now exists. Root reviewed it directly, removed unsolicited serialize/
config retention, corrected the flat-storage complexity from linear to quadratic worst-case
moves, specified full native accessor/error conventions, clarified that final leaves are not
a count-extension prefix, and proved creation IDs remain strictly increasing in live order.
Root wrote `design/operations/quadrant-partition-fixture-plan.md` with concrete subnormal,
one-ULP, overflow-safe and reassociation adversaries, plus the preparatory Java implementation
brief. The catalog remains draft; no public implementation has begun.

Active bounded tasks: palette_javascript owns the independent fixture generator and fixture
JSON; candidate_design owns partition-output checker validation and focused tests. Root must
review the combined fixtures/checker before freezing the contract and assigning Java code.
The old checker silently bypassed output checks for unknown fixture formats, so explicit
partition validation is required. Root reviewed the independent generator and its initial33
cases; final corrections cover neutral post-freeze metadata, asserted midpoint-adversary
bits, passive-container scope and honest resource-failure proof. Semantic review is recorded
in `design/operations/quadrant-partition-contract-review.md`; freeze remains pending
combined fixture/checker validation. Sol remains paused. The private JavaRandom stream is not
the public xoshiro stream, so actual public native validation remains needed.

## CP4 implementation kickoff

The region contract is now reviewed and frozen with34 shared cases. Root reviewed the
checker, caught and corrected a contradictory root-ID condition and an invalid requirement
for two midpoint values after an x-axis failure. Current catalog validation and all108 unit
tests pass. Exact frozen hashes are in the CP4 contract-review document. The generated
reference now includes the reviewed operation with all targets still unvalidated.

Active implementation: palette_javascript owns QuadrantPartition2D, its native suite and
`tools/run_quadrant_partition_java.py`, publishing `evidence/conformance/quadrant-partition-java.json`.
Root authored the editable RegionComposition.java and RegionMarks.pde plus docs/region-marks.md;
the helper composes normalized RegularGrid content with seeded or ordinary explicit cell bounds.
These example sources await compilation against the in-flight core. Their private predecessor
images do not establish current public-stream output or installed delivery.

candidate_design owns the actual PDE preprocessing/probe/executor and registered native plan.
Root specified11 states/events: base, Mgrid, Mreset, Cpalette, N200, Nreset, Gfull, Greset,
Rseed43, Mgrid, Xauthored; then cached Ssave with no extra draw. Exactly700 seeded replacements,
2 authored grid refinements; expected301/601/11 cell counts. Build/preflight only until root
accepts the core and reviews the full plan. Do not render automatically. Mutable artist-guide
prose is not an executable input; bind actual code, plan, runtime and conformance instead.
Core acceptance and renderer acceptance remain separate. Sol and ports remain paused.

## Current handoff — CP2 delivered; CP3 seven-image investigation accepted; two dependencies admitted

The CP2 PathMarks delivery slice within I2 is complete for the four recorded native
runtime scopes. Java, browser, py5 and Android have accepted source/native/visual
reviews and accepted local 0.2.0 artifact consumers. See
`evidence/distribution/cp2-review.json`, `docs/installing-path-marks.md` and
`docs/path-marks.md`; README now offers independent marks or integrated paths as the
artist entry points. I1 0.1.0 artifacts/reports remain unchanged. The Android original
attempt remains failed; its source-bound renderer-name correction and exact read-only
recovery are separately accepted. No additional CP2 render is needed.

Root/Sol accepted the generic operation-target attestation checker and all four authored
records under `catalog/validation/`. Their 48 blocks distinguish actual host core suites
from PathMarks native/technique scopes; Android explicitly does not claim the full suite
ran on ART. Historical contract target fields remain unchanged. Generated
`docs/reference/operations.md` now consumes the checked attestations. Catalog validation
passed and all 97 unit tests passed after publication.

CP3 source basis: root selected size-aware bounded placement for investigation; Sol challenged the
artist-facing seeded convenience versus explicit ordered-proposal filter. Root read the
pinned decisive source loops after worker retrieval. Sizes are diameters; caramelo/studio
permit tangency, candy's 0.48 factor permits overlap, and nested caramelo's 0.6 factor
creates size-relative clearance. Proposal domains and random-stream preludes differ.
Candidate `source_sha256` values bind notes, not these upstream PDE bytes; the source audit
records raw hashes and MIT provenance. Read `design/capabilities/cp3-spacing-investigation.md`,
`cp3-spacing-review.md` and `cp3-packing-source-audit.md` before preparing the contracts.
Raw retrieved sources remain ignored under `.work/investigations/cp3-source/repo/`.

Root has now written `design/capabilities/cp3-placement-walkthrough.md` and registered the
five-image private experiment in `evidence/parameter-experiments/cp3-placement/experiment.json`.
Sol approved that investigation, contingent on source/hash and independent numeric preflight.
The proposed boundary separates seeded proposal generation from an explicit ordered-circle
filter, sharing the collision kernel; geometry is retained across motif/palette edits.
These responsibilities are now admitted below; exact public signatures are not frozen.

The private Java prototype `tools/diagnostics/cp3/SpacingChoice.java` and the serialized
executor `run-spacing-choice.py` passed root/Sol review and independent numeric preflight.
Root rendered all five registered images once. All passed without stderr, and root/Sol
inspected each original PNG. `evidence/parameter-experiments/cp3-placement/result.json`
SHA `d5f729b829b44e62b5b104141520562c7ce442deb25a4953d991565e755b1b7e` records
complete rendering; `decision.md` and `design/capabilities/cp3-placement-visual-review.md`
record the findings. Accepted counts are 424 baseline, 353 separation, 613 smaller forms,
424 diamonds and 111 radial. Separation visibly opens crowded groups; smaller maximum
radius removes large anchors; both motif and proposal substitutions are useful. No public
operation contract, continuous range, default or source-pixel reproduction is approved.

The frozen Java SHA is `6456603fdc26daa438ad9f4a319ca02621b79d2391e7cfcf3bf8d010b16e644c`;
executor SHA `5e4d42ce88106365c0d73afce27b444f615a8d49c9499593e9707ef8a15c5eb8`.
Do not edit these or regenerate original reports while follow-up evidence binds them.
Python/JavaScript stream evidence and root independent Python accepted-topology checks
live under `evidence/investigations/cp3-*.json`. Model vertex hashes precede Java float
submission; reported backing-array bytes are primitive capacity, not total allocations.

The control supplement is also complete: root rendered minimum8 and attempts10,000 once
against the saved baseline, with no retry or baseline rerender. Both passed and root/Sol
inspected both images. `evidence/parameter-experiments/cp3-placement-controls/result.json`
SHA `c7f9ca93b4463912eadfd6c4f7f1682b036d207937ff29c4b697fb77d9b17d93` binds the
original evidence closure and exact temporary-copy substitutions. Minimum8 yields239
circles and visibly removes the finest filler;10,000 attempts yield517 circles, preserving
the original424-circle prefix and adding93 mostly small gap fillers. See that directory's
`decision.md` and `design/capabilities/cp3-controls-visual-review.md`. Supplement executor
SHA `78c740b5e858bebee01f7cd8d3d9a1ad72ea768d9ce35c508f9b360f8024fdd7`. All seven images and generated sources/classes remain
ignored. Both experiment budgets are consumed; no further render is needed for these checks.

Root's `design/capabilities/cp3-architecture-decision.md` selects the two responsibilities,
required controls without defaults/ranges, and checked all-or-error binary64 semantics.
Sol accepted the architecture after root clarified finite centre mapping and indexed
proposal-arithmetic errors, including first-proposal/zero-attempt behavior. The numeric
investigation `cp3-numeric-boundaries.md` records real underflow/overflow counterexamples;
positive threshold products rounding to zero and nonzero component/threshold squares
rounding to zero must fail rather than silently change the predicate. No arbitrary
coordinate envelope or normalized comparison algorithm was adopted.

The authored ledger now admits `sampling.seeded-circle-placement-2d` and
`sampling.ordered-circle-filter-2d` as independent capability dependencies. Both structural
contract-prerequisite checks pass, as does catalog validation. Original motivating records
caramelo#0, candy#0 and studio#0 retain their dispositions; each admission binds exact note,
candidate and upstream PDE hashes and accounts for source distributions/domains/streams.
Sol accepted the final ledger/remainder read after root corrected studio's radial-source
contribution and the filter's no-RNG remainder wording. Both admissions are ready.

CURRENT SPRINT: the maintainer requested Java-first capability/workflow expansion and
later batched ports, and paused Sol reviews during this buildout sprint. Updated AGENTS,
roadmap and agent briefs; this supersedes earlier four-target-per-slice and mandatory
external-review scheduling. CP1/CP2 deliveries remain intact. Deferred platform work is
still required later and cannot be represented as validated JavaScript/Python/Android.

CP3 contracts and fixtures are now frozen. Sol completed the final pre-sprint review with
no remaining semantic or fixture blockers. Root accepted that review, changed catalog
status only to reviewed, regenerated fixture bindings and published the generated catalog
reference. Full catalog validation passed. Exact authority hashes and assignments are in
`design/operations/circle-placement-implementation-brief.md`. The shared fixtures contain
37 filter and31 seeded cases,5 seed-state vectors and5 proposal-mapping vectors, including
explicit non-FMA/non-reassociation adversaries and a streaming failure-precedence case.
The last full unit suite passed102 tests; focused19 catalog tests also passed after the
last metadata guards. No native placement support or package delivery is claimed yet.

Java core is implemented and root-reviewed. Root corrected strictfp/reusable proposal
storage, zero-work stream handling and native test/performance scope issues; the final
`evidence/conformance/circle-placement-java.json` passes all68 shared cases, RNG/mapping
vectors, prefix/equivalence and native ownership/access checks. It is Java core evidence
only. Those core/test/runner sources are frozen during native integration.

IN PROGRESS: candidate_design is building the isolated Java0.3.0 distribution and
installed-JAR/PDE compile checks. Root authored
`packages/java/examples/PlacementMarks/PlacementComposition.java`, the editable Processing
PDE under `packages/java-processing/examples/PlacementMarks/`, and `docs/placement-marks.md`.
They now compile with the official Processing preprocessor; actual native rendering and
key/save validation remain pending.
palette_javascript now owns the Processing preprocessor/build/key-event/save harness and
its finite render plan. Root caught the erroneous second-R seed reset and an RGBA
difference comparison that could hide colour changes before any render. The worker is
correcting these and coordinating installed-JAR execution with the packaging worker. Root
alone executes native renders after inspecting the final plan.
No JavaScript/Python port is assigned; Sol has no active assignment.

NEXT: review and run the Java core conformance, compile and exercise the actual PDE,
inspect the native results and package a usable Java PlacementMarks delivery. Keep shared
fixtures/meaningful native checks; no external review handoff is a sprint gate. Root then
expands Java artist capabilities, with surface partitioning as the next investigation.
The worker's factual `design/capabilities/cp4-partition-source-audit.md` distinguishes
mosaic02 equal four-child splits/first-half scheduler from chinasseForms variable-grid
splits/uniform selection/min-edge skip. Root must read the decisive evidence and choose
the capability boundary before contracts; no CP4 operation is admitted or implemented.

Subdivision, typography, branching,3D and deliberate rare-family coverage remain I2 work.
I2, the deferred porting batch and X1/X2/X3 are incomplete. Nothing requires maintainer input.

## Historical checkpoint — initial Phase 2 work, 2026-09-07

The roadmap and initial Phase 2 work are implemented; Phase 2 itself is not complete.
Luna delivered the evidence inventory/reconciliation tool; Terra performed bounded
computational reviews; the integration owner reviewed palette lookup and corrected
name-based or overly broad grouping/rejection decisions.

- E1: reproducible inventory of all 1,934 candidates, 901 target identities, 826 notes,
  and 4,584 published variant files (including six absent from the normalized rows).
  Current inventory validation has no errors. Missing 75 reports is expected coverage.
- E2: development/release modes and reference-publication completeness checks implemented.
  Public text metadata identifies exactly the existing 980 benchmark case IDs. The old
  manifest remains development-only until regenerated with the external image checkout;
  it was not hand-edited or re-rendered.
- D1: 384 records assessed: 26 keep representatives, 101 merges, 18 design-scope rejections,
  239 assessed but unresolved/data-blocked; 1,550 unreviewed. Grid admission preserves
  circlesAlpha cell-count conversion and separates unresolved dados random square grids.
- D2/D3: regular-grid, gradient-noise-2d-01 and cyclic-palette contracts are reviewed and implemented.
  Noise has an explicit evidence-bound capability-dependency admission; its composite
  motivating candidate is not falsely merged. Cyclic palette has three audited linear members; 50 other family merges were reopened.
- I1: Java, JavaScript and Python grid cores pass 31 shared cases each plus native checks.
  Noise cores pass 68 scalar vectors, 8 query errors, 7 mixer and 5 corner vectors, plus
  ownership/error/serialization tests and matching 250,000-query checksums.
  Java builds `dist/procedurals-core-0.1.0.jar` (ignored). The actual JAVA2D CP1 sketch and edit/transfer checks now pass.
  Processing JAVA2D has scoped CP1 native evidence; p5.js, py5, Android and broader
  renderer/reproduction validation remain unfinished.
- Added `skills/generative-performance/SKILL.md` at count-sensitive implementation kickoff
  and `skills/catalog-surface-synchronization/SKILL.md` at the first generated catalog
  consumer. Both passed metadata validation. Recipe/prompt workflows remain deferred.
- Validation: 59 unit tests passed; both operation prerequisites and catalog checks pass.
  Native evidence: `evidence/conformance/regular-grid.json`, generated through
  `uv run python tools/run_grid_conformance.py --target all --output evidence/conformance/regular-grid.json`.
  All-record review remains intentionally incomplete. I2/X1/X2/X3 remain pending.

## Latest continuation — CP2 native accepted on all four targets; packaging underway

Root and Sol accepted Android CP2 through the immutable failed attempt plus read-only
recovery. The sole original failure was an exact renderer-name guard comparing the
concrete AndroidSurface subclass to its PGraphicsAndroid2D base. The app had completed
all seven compositions and save with counts 7/8 and 301ms quiet. Recovery verified the
same nonce/journals, current source and installed APK hashes, absent process before/after,
all seven frame PNG hashes, replay equality and published saved bytes equal to frame 7.
Root/Sol inspected marks, trace and long-marks and accepted scoped API33 emulator evidence
in `evidence/reproductions/cp2-android/review.json`. No new render ran; original result
and attempt remain failed. All four PathMarks native example scopes are now accepted.

New additive package 0.2.0 lanes preserve I1 0.1.0 artifacts and reports. Java, JavaScript
and Python builds/installed consumers passed under `.work/dist/cp2/`, with new
`evidence/distribution/cp2-*.json`. Sol accepted JS; Java's initial unaccepted build was
preserved and corrected to compare replay headings as well as points, then rebuilt.
Final Java/Python review and Android package build remain underway. No package checks
re-render accepted compositions. Operation contract versions remain 0.1.0.

Root authored `docs/path-marks.md`, `design/cp2-distribution-plan.md` and the next capability
investigation `design/capabilities/cp3-spacing-investigation.md`. CP3 selects size-aware
placement for deeper design; no RNG, packing signature or merge is approved. Radius versus
diameter and Poisson-like naming ambiguities in the reports require pinned source checks.
Subdivision and rare families remain retained investigations, not implied rejections.

Current catalog target statuses are historical contract-freeze values. Root/Sol agree that
current support needs checked operation-target validation attestations consumed by the
reference generator, rather than rewriting bound contracts or accumulating hash exceptions.
Schema/evidence investigation is assigned; implementation is pending. Finish CP2 package
review/installation docs and current-status publication, then CP3 design and the remaining
I2 capabilities. X1/X2/X3 remain incomplete; no user input blocks progress.

## Latest status — Android attempt terminal; export review accepted

CP1 remains accepted across all four targets with local distribution checks. CP2 portable
cores pass across Java, JavaScript and Python; desktop, p5.js and py5 public examples have
accepted root/Sol native and visual reviews. Android's registered attempt has now ended
with `unexpected PathMarks Android runtime/final counts`; its failed report and artifacts
are preserved at `evidence/reproductions/cp2-android/result.json`. Diagnosis is assigned to
the Android worker; do not count Android CP2 as accepted or repeat the attempt blindly.

Sol independently accepted the exact two-entrypoint additive export verifier and its 21
catalog tests. Root changed only the supplemental review status to accepted in
`evidence/reproductions/cp2-export-extension-review.json`; historical I1 reports remain
unchanged. Catalog validation passed after integration, and all 88 unit tests passed.

Next: resolve Android CP2 evidence, finish CP2 packaging and teaching, then expand selected
artist capabilities and make explicit rare-family decisions. Recipes/export, broader
helper documentation and MCP/web delivery remain future milestones. No user input blocks
progress; current implementation breadth is still intentionally narrow.

## Latest continuation — CP2 desktop, browser and py5 accepted

The revised desktop visible-stream attempt passed all7compositions/7postedkeys, exact
submitted counts, style identity, movement rebuild/prefix/feedback, marks replay and actual
S-save equality after measured quiet. Root and Sol inspected all3images and accepted the
scoped JAVA2D public capability in `evidence/reproductions/cp2-java2d/review.json`.
Both earlier failed attempts remain preserved; they were not reclassified.

The browser's one registered execution passed10actualcompositions, actual visible control
clicks, immutable model/path identity checks, reversible edits, raw/submitted counts,
current-canvas download and measured quiet. Root/Sol accepted all3visuals and native evidence
in `evidence/reproductions/cp2-p5js/review.json`.

Py5's one registered execution passed7actualstartercallback compositions, submitted counts,
identity/rebuild/prefix/feedback and saved-canvas equality after a nonblocking measured quiet
observation (setup returns before timer observes). Root fixed stale-output handling and
explicit repo-local JVMhome before launch. Root/Sol inspected all3visuals and accepted
`evidence/reproductions/cp2-py5/review.json`. None of these scopes claims upstream pixels,
physical devices/keyboards, isotropy or full I2 completion. Three-core pure evidence remains
current in `evidence/conformance/gradient-path.json`.

Android's isolated probe/APK is prepared using exact shared PathMarkComposition and the
actual immutable RenderedSnapshot.movement reference. No Android native attempt has run.
Root/Sol found3prelaunch harness fixes: measured nonblocking post-save quiet; bounded cleanup
before terminal persistence preserving primary errors; deadline-aware ADB/pulls. Worker is
implementing them with an execution/cleanup split inside1800s and stale-artifact guards.

The catalog's2I1 export-hash mismatches remain pending. Worker confirmed exact additive
entrypoint deltas against archived I1 artifacts and is implementing a narrowly reviewed
supplemental-source rule, preserving old runtime reports/hashes. Root owns the supplemental
review; require Sol approval before acceptance. Do not weaken other source checks or rerun
CP1 native suites. Android native approval/execution, supplemental catalog integration and
CP2 packaging/teaching completion are next; deliberate further capability/rare-family
expansion and downstream X1/X2/X3 remain incomplete. No user input blocks progress.

## Latest continuation — core acceptance; native example boundary corrections

`evidence/conformance/gradient-path.json` now records all three portable cores with current
source bindings, including Sol's final Java106 normal/9resource checks and scoped workload
measurements. Root recorded `design/operations/gradient-path-implementation-review.md`.
The actual Processing PDE passes official preprocessing/compilation, including a pure
binary64 default/distance-toggle regression. Android's isolated PathMarks APK compiled;
its staged composition is the shared namespaced `PathMarkComposition`, not copied logic.

Two registered desktop attempts are terminal failed and preserved. The initial attempt
caught Processing converting unsuffixed decimal literals to float; the PDE now explicitly
uses0.4d/0.8d. The second produced the three visual images but a later distance edit hit
the drawing profile's coordinate guard for far-offcanvas marks. Neither proves final
lifecycle/save success. Root inspected all3images and observed exact decoded RGB equality
with the corresponding accepted private images; see partial visual review in design.

Root/Sol accepted an example-only visibility correction: preserve raw paths/commands,
omit only segments with bbox wholly outside the640canvas padded1pixel, and preserve
encounter order. This piece's maxsegment24 makes kept coordinates safely fit the adapter
without altering its guard. Java `streamForCanvas` and Canvas/PDE submitted-count reporting
are implemented. Pure all7state proof verifies omitted bounds/order/rawcounts and normalizes
every submitted command; `evidence/conformance/path-marks-commands-java.json` passes.
The distinct `pde-visible-plan.json` and revised probe compile; Sol review pending before
its one7composition execution. Both earlier reports/outputs are retained.

JS and Python example/validation workers are integrating the same visibility boundary.
Browser plan accounts for10actualcompositions,3visualartifacts,1cachedsave; root approved an
immutable example-only observation function for actual UI identity checks. Sol identified
startup-deadline and cleanup-status issues; worker is correcting before any browser launch.
Py5 plan registers7compositions and is prepared without launching. Android renderer will
use shared Java visible stream and report raw/submitted counts. No native target acceptance
or export-binding refresh has yet been made. The two historical I1 export-hash mismatches
remain pending supplemental reviewed evidence. The goal is active; no user input blocks it.

## Latest continuation — three path cores pass; editable examples implemented

Root integrated the Java, JavaScript and Python path cores through
`tools/run_gradient_path_conformance.py`; all 52 shared cases pass on all three hosts.
The ignored aggregate report is `.work/conformance/gradient-path.json`. Python and JS
also pass native ownership/access/resource checks and report scoped workloads. Root and
cross-port review corrected source citations, explicit query-product validation and
measurement/provenance gaps. Sol's Java native harness is being finalized; its benchmark
checksum must not be a cancelling XOR of an even number of identical endpoints.

Root wrote `design/capabilities/cp2-public-example.md` before public rendering. Java's
public PathMarks model, Processing PDE and frame wrapper are implemented. Python's model
and py5 starter are implemented; the JavaScript browser starter is implemented. Native
public rendering and actual UI/save execution have not run; no target acceptance follows
from source-only starter checks. Android PathMarks remains to implement.

`tools/check_path_marks_commands.py` generates
`evidence/conformance/path-marks-commands-java.json`: the public composition exactly
matches accepted private movement, geometry, colour and command counts for trace/marks/
long-marks. Pure checks prove exact count-prefix, changed distance feedback and recolour
geometry independence. No accepted private render or CP1 native suite was repeated.

Current catalog validation intentionally reports two stale native implementation bindings:
`packages/javascript/src/index.js` and `packages/python/procedurals/__init__.py` now export
the new operation, while the accepted I1 reports bind their earlier bytes. Preserve those
historical reports. Resolve via independently reviewed supplemental source/native evidence
when validating the new examples; do not silently update old runtime hashes or loosen the
validator. Existing I1 packaged artifacts were not rebuilt. Last full repository suite was
83 passing tests before these export additions; do not describe current catalog as green.

Next: finish Java native/resource/performance integration and public-core review; verify
all example composition streams, then declare finite native public render/edit budgets and
execute across Processing/p5/py5/Android. The complete I2 and downstream milestones remain
incomplete. This continuation made progress; no maintainer input is required.

## Latest continuation — gradient path contract approved; ports underway

Root accepted Sol's final `path.gradient-trace-2d` contract and fixture review.
`catalog/operations/gradient-path.json` is reviewed; the generated shared fixture has
32 short/error cases and 20 sparse long cases with approved named-case tolerances.
`design/operations/gradient-path-contract-review.md` records the resolved challenges.
Catalog generation and the operation prerequisite check pass; all 83 repository unit
tests pass. This is contract/tool validation, not public path conformance.

The final Android standalone ART diagnostic completed all 20 matrix cases with all six
recorded fields bit-identical to Java. Its copied scope sentence is corrected and current
runner/runtime/DEX hashes are bound. Android Processing path rendering remains unmeasured.

Root added `packages/java/src/main/java/org/procedurals/paths/GradientPath2D.java` and
compiled it with Java 8 bytecode compatibility in isolated `.work/build/gradient-path-java`.
Sol approved the Java implementation for conformance integration. The isolated runner
`tools/run_gradient_path_conformance.py` passes all 52 shared cases, exact replay/prefix
and positive-zero checks. Its ignored report is `.work/conformance/gradient-path-java-vectors.json`;
this does not yet cover native ownership/resource/performance acceptance.
Python and JavaScript port workers are active against
the frozen contract, including native fixture runners. No public implementation or target
support has yet been accepted. Existing I1 distribution artifacts were not rebuilt.

Next: integrate native port conformance, address Sol findings, measure representative
workloads, then implement/edit/validate the actual path-and-marks examples across the four
targets. Preserve the documented gradient-field horizontal locking limitation. I2 and
all downstream recipe/export/helper/MCP/web milestones remain incomplete; no user input
blocks progress.

## Latest continuation — I1 accepted; I2 capability design active

Root and Sol accepted the scoped first four-target slice and local distribution milestone.
See `design/i1-distribution-decision.md` and `evidence/distribution/i1-review.json`.
All five generated distribution reports pass; source/input and artifact hashes are current.
Processing's extracted starter compiles and matches the four accepted CP1 command cases;
the browser starter installs its local npm artifact; the extracted Python starter imports
its bundled wheel with real py5; the extracted Android project builds using its packaged
core/adapter JARs and external pinned runtime. Required notices survive packaging.
`docs/installing.md` provides all four starting routes. All 75 repository tests pass.
No accepted native renderer suite was repeated for packaging. These are local artifact
consumer checks plus existing scoped native evidence, not registry publication, broad device
certification or a human usability study.

I2 starts with CP2 integrated paths. Root is personally reviewing ciserp and neighbouring
reports, defining the useful retained movement/mark boundary, and assigning bounded evidence
retrieval. Sol remains the independent architecture reviewer. No maintainer input blocks
progress. Root's proposal is `design/capabilities/cp2-integrated-paths.md`; bounded six-neighbour
retrieval is complete in `.work/reviews/cp2-neighbours.md`. Root independently checked
ciserp, limo002, mantel and natalata, finding different mark attachment/closure and
composite remainder semantics. Root resolved Sol's challenge in
`design/capabilities/cp2-architecture-decision.md`: one retained packed path, gradient-only
initial carrier, eager step count as work authorization, binary64 state and per-fixture
cross-target tolerances. No public generic sampler or second streaming-generation API.
The reproducible 20-case nonrender diagnostic is `tools/diagnostics/cp2/run.py`, with
`evidence/investigations/cp2-numerics.json`: Java/JS feedback differences stay below4.43e-12
in tested16k-step cases; Android and arbitrary-descriptor bounds remain unmeasured.
Root drafted `design/operations/gradient-path-proposal.md`; no catalog admission yet.
The four-image private carrier/mark-reuse experiment is complete at
`evidence/parameter-experiments/cp2-path-choice/result.json`; all four attempts rendered
successfully and the budget is consumed/terminal. Root and Sol viewed every image and
accepted the initial gradient carrier in `decision.md`. Trace/marks/long-marks retain the
same movement; longer marks change coverage; finer scale gives tighter curls but long
horizontal runs. Preserve that limitation, canvas exit and convergence rather than
claiming isotropy, simplex equivalence or public parameter ranges. The nonrender alignment
diagnostic is reproducible through `tools/diagnostics/cp2/inspect-alignment.py`.

Root added the reviewed independent dependency `path.gradient-trace-2d` to the ledger,
with exact ciserp/mantel/natalata/limo002 evidence bindings and complete remainders; no
candidate was reassigned or bulk-adjudicated. `design/operations/gradient-path-admission.md`
records the decision. Its contract prerequisite check passes. Public catalog and fixture
work are next, including indexed dynamic errors, layout-safe count, detached ownership,
actual second-query feedback goldens, and cross-target numerical tolerances. No public
tracer implementation exists yet. I1 native/distribution evidence remains untouched. I2 and X1/X2/X3 remain incomplete.

## Previous continuation — Android accepted; distribution underway

The preceding goal turn made progress: the production Android example built, root fixed
an observer cursor bug, and Sol accepted the example boundary. This continuation completed
the actual editable UI validation and guarded Android catalog integration.

The initial UI execution passed all eight registered compositions and actual edit taps.
Frames1–6 match accepted Android CP1 pixels and command hashes; combined frames7/8 preserve
independent geometry/colour settings. Save publishes byte-identical cached frame8 with no
extra composition/frame. Root inspected the screen and combined images and recorded
`design/android-example-decision.md`. Native executor80410 is terminal passed and the app
is force-stopped. The initial editable allowance is consumed; no corrective run is needed.

Sol independently accepted the complete scoped Android slice. The authored native review
binds core/adapter/example sources, pinned runtime and all five complementary native parts,
including the preserved failed lifecycle history. `catalog/drawing/fresh-raster-2d.json`
now marks Android `native_adapter_implemented` / `validated-scoped`, retaining conceptual
ANDROID2D with native JAVA2D token and concrete PGraphicsAndroid2D class. This is the pinned
API33 emulator scope, not full Android/device/corpus certification. The other three scoped
target claims remain accepted. Catalog regeneration and six pure drawing/value/state
reports pass; all75 repository unit tests pass, including Android evidence/implementation
omission regressions. No accepted native suites were repeated for metadata.

I1 distribution remains unfinished. Root wrote `design/i1-distribution.md`; the worker
implemented `tools/build_java_artifacts.py` and root corrected its metadata placement,
repository URL, standalone JAR license and artifact-source verification. Its isolated
JAR-only consumer passes grid/noise/palette known values. Current ignored outputs:
`.work/dist/java/procedurals-core-0.1.0.jar`, Processing library ZIP and `build-result.json`.
This proves artifact creation and core consumption, not native IDE installation. The tool
uses a configurable standard JDK and no renderer/conformance execution. Java native starter
artifact consumption, npm/wheel distribution, and configurable Android sample/dependency
setup are next. Do not equate source-checkout demos with installed-package usability.

Next: finish those I1 installation paths in the written distribution brief before I2
integrated-path/rare-family expansion, then recipes/export/MCP/web in roadmap order. Keep
Sol as independent reviewer and root as architect. No maintainer input or global blocker.
Keep the existing emulator alive for later justified work; ADB5038/emulator-5580 is reachable.

## Previous continuation — Android lifecycle v2 and CP1 passed

Editable-example update: Sol accepted the production Activity, renderer and gallery
writer boundary. The ordinary Gradle example builds successfully, including root's
attachment-order and current-value accessibility refinements. The observation subclass
is implemented; root corrected a cursor-position bug before any native execution.
Sol is reviewing that fixture, and the implementation worker is writing
`tools/run_android_field_marks_ui.py` for actual controls and cached PNG export.
The editable native run allowance remains unused. Nothing requires maintainer input;
the remaining work is implementation, independent review and scoped validation.

The prior goal turn made progress by finding the native fragment redraw bug and compiling
the reviewed Android2DFragment correction. Root wired the correct lifecycle app, registered
`design/android-activity-lifecycle-v2.md`, and strengthened the fixture to account for the
native startup draw and four observed quiet dispatches after each restoration. Input
only updates plain atomic state and calls redraw; all frame observations stay on the
animation thread. Sol accepted the revised source and protocol before execution.

The first v2 execution passed all19markers: actual4pauses/3resumes, 3touches, 4ordinary
pre/draw callbacks (startup+edits),26specials, and5released exactbitmaps. Every idle interval
kept frameCount/pre/draw unchanged; each edit added exactly one ordinary frame. Both
consume/pause orders, actualfinish/onDestroy/dispose, emptyownership and zerodiagnostics
passed. Root decision `design/android-lifecycle-v2-decision.md`. Earlier plain-fragment
failures remain preserved. Pixel/failure drawing/host sources are unchanged and not rerun.

The first Android CP1 execution also passed. All four model/geometry/colour/count hashes
match accepted JAVA2D exactly; all4opaque640²images show the intended edits. Root viewed
each image and accepted `design/android-cp1-decision.md`. The template, runner and native
app are implemented; images remain ignored. Evidence is
`evidence/reproductions/cp1-android/result.json`. No tolerance or corrective run was needed.

Standalone Android adapter compilation now includes six pinned AndroidX binary artifacts
needed by the fragment, with original artifact/extracted-jar hashes; compilation passes.
A worker briefly edited the wrong bootstrap MainActivity; root restored its exact accepted
hash8cb812c28df7278e16ae894f3f9b4bf872f6b3464d71e807e4f694d5332b761d
from preserved staging and personally wired the lifecycle app. Accepted bootstrap remains
unchanged. No native execution used the mistaken file.

Next: implement and validate the editable Android field-marks example, then obtain Sol's
complete scoped review and integrate guarded catalog support. Root is deciding useful
native controls/save behavior while Sol challenges scheduling/ownership implications.
CP1 drawing must retain the model across length/palette/mark edits; save must export the
current image. Do not claim Android complete before this work. I1 distribution and later
capability/recipe/MCP/web milestones remain active.

Native lifecycle-v2 executor70813 and CP1executor62754 are terminal successful and stopped
their apps. Build18294 and standalonecompile passed. Reuse existing emulator session46420/
PID729680, ADB5038 serialemulator-5580; no native suite is running. No maintainer input needed.

## Previous continuation — Android lifecycle exposed fragment redraw failure

Sol is the independent reviewer. Root implemented and built the actual lifecycle helper,
Activity/cover/finish-receiver app, and `tools/run_android_lifecycle.py`. Sol accepted
preflight. The initial run passed active pause cleanup but stopped on an API-33 dumpsys
field-name mismatch. Root preserved it and corrected the runner to require both actual
resumed activity and focused window. The corrective run restored the same instance and
received one real UI-thread touch, but never invoked ordinary pre/draw.

Root found the cause in the pinned native source: PFragment.canDraw requires isLooping,
so noLoop+redraw never reaches PApplet.handleDraw's own redraw guard. This is an actual
integration bug, not a user-input or missing-report blocker. Read
`design/android-redraw-integration-finding.md`. Root ended the stalled corrective attempt
with the existing explicit finish receiver; diagnostic final failures are preserved.
Evidence: `evidence/conformance/android-adapter-lifecycle-{initial,corrective}.json`.
Both original lifecycle allowances are consumed; a reviewed scheduling fix needs a
new explicit registration, not another unchanged rerun. Android support stays unvalidated.

Next: Sol accepted root's internal Android2DFragment integration and root implemented
it. It lets PApplet apply noLoop/redraw itself, with a brief monitor acquisition to
observe synchronized redraw requests. The actual APK build compiles the new carrier
(build57971 passed), but the app does not use it yet and it has not run. Wire the carrier
into the app, explicitly register a revised protocol with idle/redraw checks, then build
and execute that revised lifecycle protocol. The idle test must observe several
handleDraw dispatches without pre/draw/frameCount advancement, then exactly one ordinary
frame after input. Existing drawing/host sources
are unchanged; accepted pixel/failure parts must not be repeated for metadata.

The CP1 template `tests/native/AndroidFieldMarks.java.in` is prepared and independently
reviewed: exact accepted Java model/command hashes, lease-owned PNG saving, post-consume
recycle/detachment, and idempotent release. Its runner and native execution remain next.
Editable Android example and final catalog support review remain pending.

All lifecycle executors are terminal: initial46606, corrective39782; build17193 passed.
The app was explicitly finished for diagnostics; no suite is running. Preserve/reuse
emulator session46420/PID729680 at ADB5038/serialemulator-5580. A SystemUI ANR dialog was
closed before corrective cold launch; the fullscreen help was dismissed while input was
gated. Main input reached the app once as required. No user approval is needed to progress.

## Previous continuation — Android pixels and injected failures passed

Previous goal turn made progress through adapter implementation/review/compilation.
Root reviewed AndroidFramePixels and implemented a native Android suite app plus
`tools/run_android_adapter.py`. The first actual pixel run passed all four registered
groups, including six sizes through2048², bounds/clipping, alpha/winding/caps/style and
parent isolation. Minimum-width coverage was0, permitted by the existing no-visibility
guarantee; no threshold changed. Root decision: `design/android-pixel-decision.md`.

The bounded worker wrote AndroidFrameFailures; root requested stronger static
precedence, different misleading error codes, density/parent rejection without repair,
idempotent cleanup counts and coordinator rollback. Root reviewed the final harness,
then its first native run passed all19groups. Evidence:
`evidence/conformance/android-adapter-{pixels,failures}.json`. Adapter source is identical
across both. Decision: `design/android-failure-decision.md`. Neither passing part needs
a correction or metadata rerender.

Next: actual activity lifecycle. Sol is producing
`design/android-activity-lifecycle-validation.md`, using a CoverActivity and BACK to
pause/resume the same Probe instance, callbacks observed after host callbacks, and
explicit phase/nonce signals. Root will implement orchestration and the lifecycle
harness, then CP1 and editable example. Activity transitions cannot be certified by
the injected-failure suite. Catalog Android support remains unvalidated.

Emulator session46420/PID729680 remains reachable at ADB5038/serialemulator-5580.
Pixel executor93385 and failure executor4939 are terminal successful; each stopped its
test app afterward. No adapter execution is still running. Reuse the existing emulator.
Whitespace and actual APK builds pass; broader target and later milestones stay active.

## Previous continuation — Android adapter implemented and compiled

Previous goal turn made progress: actual Android bootstrap passed. Root resolved the
boundary and wrote `design/android-adapter-integration-decision.md`, AndroidFrameHost
and AndroidSurface. The bounded worker implemented Android2DFrame; root reviewed and
corrected partial ownership capture, public return type and transactional end transfer.
Sol reviewed the integrated sources and finds no remaining ownership/concurrency
blocker before native validation.

The host closes admission before pause/destroy cleanup, tracks outstanding surfaces,
and reopens only at ordinary-frame pre after resume restoration. Guarded consumption
prevents lifecycle recycling during synchronous display; reentrant consume/release is
rejected. End retains its surface through registry insertion, stores the captured epoch,
and rolls back a failed state transfer. Released output retains only an identity token,
not a hidden parent/host reference. Android inputs must mutate plain state/redraw;
native drawing belongs on the animation thread.

`tools/check_android_adapter.py` compiles all portable Java and Android adapter sources
against actual SDK33/core artifacts; evidence is `android-adapter-compile.json`.
The bounded worker also wrote `tests/native/AndroidFramePixels.java` (compile-only).
Root must review that harness before executing it. The full native suite is now
registered in `design/android-adapter-validation.md`; no adapter part has run yet.
Next build/stage the native test app, execute pixels, then injected failures and
actual activity lifecycle, CP1 and editable example in order. Catalog remains unvalidated.

The existing emulator remains booted/reachable: session46420, PID729680,
ADB5038/serialemulator-5580. Re-poll and reuse it; do not rerun the accepted bootstrap.
No new render process is active. Whitespace and pinned adapter compilation pass;
native semantics and all later milestones still require their declared evidence.

## Previous continuation — Android prerequisites and native bootstrap passed

The previous goal turn made progress by completing scoped py5 support. Root has now
installed the isolated Android SDK/emulator/image and pinned Processing Android4.6.0
release+source. `evidence/conformance/android-environment.json` records hashes and
package revisions. The bootstrap Android APK builds with release-template AGP7.1.0,
Gradle7.4.2, SDK33 and Java17. Debug-key and renderer-token build failures were
diagnosed, corrected and preserved. Native ANDROID2D uses this release's JAVA2D token.

Software emulation completed boot and the actual Processing bootstrap passed:
`evidence/conformance/android-bootstrap-runtime.json` records successful install/launch,
API33, actual `processing.a2d.PGraphicsAndroid2D` and 32×24 setup dimensions. A premature
install failed during partial package-manager initialization; the checked-in runner
requires full boot and its subsequent actual run passed. Bootstrap app was then
force-stopped; keep the emulator warm. Android adapter acceptance remains pending.

LIVE HANDLE: emulator exec session **46420**, PID **729680**, ADB port **5038**,
serial **emulator-5580**, AVD `procedurals-api33`. It booted successfully and executed
the app. Preserve and re-poll this process on resume;
do not start another emulator while this one lives. Log:
`.work/downloads/android/emulator.log`. Manual install session90125 is terminal failed;
SDK/build/download sessions and runtime session44304 are terminal; app-stop session28327
is terminal successful. The bootstrap runner's successful execution is consumed;
do not rerun it for metadata. Reuse the emulator for registered Android adapter work.

Next: resolve Sol's `design/android-adapter-boundary.md`, implement and validate
Android native drawing against registered pixels/lifecycle/CP1. Root verified that
registered resume callbacks precede primary renderer restoration. Proposed resolution:
mark resume pending there, request redraw for noLoop sketches, then accept new frames
at animation-thread pre after beginDraw restoration. Sol is checking this ordering.
Python tool syntax
and whitespace checks pass; Android support remains unvalidated. All later milestones
remain active; no maintainer input is needed at this point.

## Previous continuation — scoped py5 native support integrated

The preceding goal turn made progress (adapter repair plus passed native renders).
This continuation completes the py5 native scope: 15 actual-resource lifecycle groups
pass, including supplied density/parent rejection without repair, atomic validation,
phase errors, cleanup and live-output ownership. A separately registered interruption
probe passes exact KeyboardInterrupt propagation with released backing. Sol accepts
the corrected adapter in `design/py5-adapter-review.md`.

Root added the editable `packages/python/examples/field_marks/sketch.py` entry point.
The actual setup and programmatic L/P/B/S handlers pass four displayed CP1 hashes,
retained-model/revision assertions and saved PNG equality. This is native programmatic
validation, not physical keyboard or human usability evidence. Getting-started docs
include the runnable example.

Catalog py5 now records `native_adapter_implemented` / `validated-scoped`, guarded by
`evidence/conformance/py5-native-review.json` and the source/runtime/evidence checker.
All six shared drawing validator/state reports were refreshed after metadata changes;
all pass. All 72 repository unit tests and whitespace checks pass. No passing native
suite was rerun for metadata. No process remains live.

Next milestone dependency: actual Android native support, still unvalidated. Read-only
inventory found no Android toolchain; `design/android-native-prerequisites.md` records
what must be installed and official references. Host is x86_64 with ample disk. The
KVM device exists but opening it returns PermissionError; investigate a supported
software emulator route before treating this as an external blocker. Missing reports
remain coverage gaps, not a global gate. I1 across all four hosts, I2 and later
capability/distribution/recipe/MCP/web milestones remain incomplete.

## Previous continuation — py5 pixels and artist example validated

Sol remains the independent reviewer; root owns architecture and integration. There is
no maintainer-input or missing-report blocker. The initial py5 pixel suite failed all
four groups because JPype resolved `raw.image` to a drawing method, also breaking
cleanup. A registered non-drawing diagnostic retained the exception chain. Root now
accesses the public Java image field explicitly, adds Sol's static method/constant
preflight and fresh-backing guard, and preserves full test tracebacks.

The registered corrective pixel suite passes all four groups. The virtual display
uses AWT uiScale=2 with actual parent density/backing assertions; all six output sizes
are density one. Initial failure evidence is preserved; both pixel allowances are
consumed. The initial four-image CP1 run also passes with exact Java model/geometry/
colour hashes. Root inspected every image and recorded `design/py5-cp1-decision.md`.
Native reports: `evidence/conformance/py5-adapter-{pixels,cp1}.json`.

The bounded worker is implementing the registered failure/lifecycle harness; Sol is
reviewing the corrected boundary. Next review and execute that harness, resolve any
defects, then integrate scoped native evidence. No py5 support claim is made yet.
Python CP1 pure values and whitespace checks pass. Android, distribution and later
capability milestones remain unfinished. No render process is running.

## Previous continuation — py5 adapter draft implemented

Root inspected installed py5 graphics/base/pixel-mixin interfaces and implemented
internal `packages/python/procedurals/_py5_frame.py`. Python FrameState owns normalized
values/lifecycle; the adapter uses actual Py5Graphics wrapper calls for drawing, with
limited `_instance` access for read-only-density override, backing readiness and cleanup.
It clears Java image/context/pixels plus optional py5 numpy/direct-buffer references.
Malformed acquisition and cleanup failures preserve primary phase failures. No public
package export or renderer dependency was added to the pure core imports.

The module compiles, Python CP1 value checks still pass and catalog/whitespace checks
pass. Sol has the concrete draft for review alongside its pending py5 boundary writeup.
No py5 adapter render has occurred. Next resolve that review, register the actual py5
profile/failure/CP1 suite and execute it in the installed isolated environment before
any native support claim. Other milestones, Android and distribution remain unfinished.

## Previous continuation — browser example validated; Python composition ported

The actual-page UI check found a high-DPI main-canvas issue: p5 createCanvas replaces
the renderer configured by an earlier pixelDensity call. Root moved pixelDensity(1)
after creation. A registered corrective run passed all four exact CP1 image hashes,
one visible canvas/revision per edit, no errors and actual Save PNG decoded equality.
Evidence: `evidence/conformance/p5js-ui.json`; initial failure preserved. Both UI budgets
are consumed. `design/p5js-ui-decision.md` accepts this native development example.
Users can run `node tools/serve_field_marks.mjs`; getting-started docs reflect validation.

Root added Python's example-owned `examples/field_marks/mark_field.py` using native
Python grid/noise/palette operations. `tools/check_python_field_marks.py` passed exact
Java model/converted geometry/colour hashes for all four 25,600-mark cases without
rendering (`evidence/conformance/cp1-python-values.json`). This prepares py5 composition;
it does not establish py5 native support. Sol's py5 boundary investigation remains in
progress. Next implement that actual adapter and registered native suite, then Android.
No live execution process; no user blocker. I1 and later milestones remain active.

## Previous continuation — p5 support integrated and editable page built

Sol accepted scoped p5.js Canvas2D support in `design/p5js-adapter-review.md`. Root
integrated `p5js-native-review.json` and native catalog validation for pixel, 18-case
lifecycle, live-transfer supplement and four CP1 outputs, preserving the reviewed
exception-only historical pixel delta. Only processing-java and p5js are native-validated;
py5/Android remain unvalidated. All six pure reports were refreshed after metadata changes.
All 70 unit tests pass, including p5 source drift and omitted-transfer evidence regressions.

Root built `packages/javascript/examples/field-marks/index.html` and `sketch.js` with
length/palette/shape controls and Save PNG, plus `tools/serve_field_marks.mjs` for pinned
local serving. Documentation now gives that entry path and stops suggesting exhausted
historical validation runs as a normal getting-started command. Page syntax passes;
actual UI validation is pending (do not claim it passed yet).

`design/p5js-ui-validation.md` registers four actual-page renders and PNG-download
validation before execution. The JS agent owns `tests/native/check-field-marks-ui.mjs`;
inspect its delivery and run it once next. Sol investigates the installed py5 wrapper
boundary in parallel (`design/py5-adapter-boundary.md` expected), without rendering.
No live native process; no user blocker. Full I1/installability and later milestones remain.

## Previous continuation — browser CP1 and error-path repairs passed

Root repaired native FrameError phase leakage found by Sol; all host exceptions now
resolve through their actual pending phase, while reentry remains INVALID_STATE. The
corrective lifecycle suite passed all 18 cases, including six misleading native codes.
Original 12-case evidence is preserved; diagnosis: `design/p5js-error-phase-repair.md`.
Both lifecycle allowances are now consumed. Do not repeat passing pixel/lifecycle suites
for freshness. Pixel evidence predates only exception-path changes, documented explicitly.

Root implemented browser CP1 and executed its initial four images. All four match Java
model, converted geometry and colour hashes for 25,600 marks. Root inspected outputs and
accepted `design/p5js-cp1-decision.md`; `evidence/conformance/p5js-adapter-cp1.json` records
native results and image hashes. CP1 initial budget consumed, no repair needed.

Sol noticed the old transfer test released output before testing misuse. A separately
registered single-surface supplement now proves end/abort misuse preserves a still-live
canvas, followed by explicit idempotent release. It passed; registration and evidence:
`design/p5js-transfer-supplement.md`, `evidence/conformance/p5js-adapter-transfer.json`.
Sol has all evidence for final scoped p5 acceptance. Next integrate that decision into
catalog support validation, deliver the native editable browser example, then py5/Android.
No blocker requires user input; no native render process remains live.

## Previous continuation — p5 native probes passed

Root implemented the real browser runner (`tools/run_p5_adapter.mjs`) and pixel module;
the bounded JS agent implemented 12 lifecycle/fault cases. Sol found silent loss during
stroke/fill could commit a batch; root added post-draw loss detection with the original
slot index, and the new native regression passes.

All four pixel groups and all 12 lifecycle cases passed under p5 2.3.2 / Chromium
153.0.8010.12 with deviceScaleFactor 2 and owned density-1 buffers. Reports live at
`evidence/conformance/p5js-adapter-{pixels,failures}.json`. The initial pixel attempt
failed before p5 construction due missing UTF-8 headers; initial evidence is preserved
and `design/p5js-pixel-startup-repair.md` records the corrective harness repair. Both
initial and corrective pixel allowances are consumed; initial lifecycle passed. The
minimum-width browser probe covered zero pixels, consistent with the explicit lack of
a visibility promise; JAVA2D observed 49 for its corresponding probe.

Root added example-owned JS `examples/field-marks/mark-field.js`; pure Node checks match
historical Java model/converted geometry/colour hashes for all four CP1 edits (25,600
marks). Actual browser CP1 images remain next, with their four-image budget unused.
Sol's final p5 adapter review remains in progress. Keep p5 native catalog unvalidated
until CP1 and final acceptance/status integration; py5/Android/installability still remain.

## Previous continuation — scoped JAVA2D catalog support integrated

Sol accepted the full registered JAVA2D/CP1 evidence on Processing 4.5.6, Temurin
17.0.20.1, Linux/xvfb. Only processing-java is now `native_adapter_implemented` and
`validated-scoped`. `tools/drawing_native_evidence.py` checks reviewed evidence hashes,
current implementation hashes, stable profile semantics, historical tested-profile
bindings and exact required test groups; unknown target claims fail closed. Acceptance
record: `evidence/conformance/java2d-native-review.json`. Rendering was not repeated.

All six pure validator/state reports were refreshed after catalog metadata changes.
All 68 unit tests pass, including new regressions for implementation/evidence/semantics
drift. Direct drawing/catalog commands and whitespace checks pass.

Root registered `design/p5js-adapter-validation.md` before any browser adapter render.
The JS agent delivered internal `p5-frame.js`; root requested corrections for cleanup
accessor failures, native FrameError paths leaving pending state, and loss detection in
empty/noop batches. Next integrate those corrections, obtain Sol's boundary review and
implement/run the real-browser pixel/lifecycle/CP1 suite. The pinned browser is installed
and launch-tested; no p5 adapter render budget has been consumed.

## Previous continuation — JAVA2D native suite passed

Root executed the registered initial native suite as two independently reserved serial
parts. All four pixel groups and all 11 lifecycle/injected-failure cases passed on
current adapter sources. Reports: `evidence/conformance/java2d-adapter-pixels.json` and
`java2d-adapter-failures.json`. The registered initial suite is now consumed; no repeat
needed. The four CP1 adapter images also passed and were visually accepted earlier.
See `design/java2d-adapter-native-review.md` for the combined scope and cleanup-only
historical source delta. Sol is independently checking final coverage. Native catalog
status integration remains next; these results do not establish other hosts or all I1.

The JavaScript agent is implementing internal `p5-frame.js` against the frozen profile.
Root corrected its prerequisite recommendation: post-allocation readiness failures are
RESOURCE_FAILURE, never static UNSUPPORTED_CAPABILITY. Exact npm versions p5 2.3.2 and
Playwright 1.63.0 were verified and installed under ignored `.work/environments/p5js`.
Chromium 153.0.8010.12 (Playwright revision 1243) is installed under
`.work/toolchains/playwright` and a launch/version/close check passed. No p5 rendering
or profile support is claimed. All provisioning processes completed; no live handle.

## Previous continuation — JAVA2D adapter implementation started

Further integration: Sol found retained pixel storage after `endDraw`; root corrected
both success and failure cleanup to detach g2/image/pixels before releasing resources.
Current CP1 harness compiles. Historical successful images were not rerun; their decision
records the cleanup-only delta and requires current native ownership tests. Sol is
implementing those tests with the factory seam. In parallel, root prepared isolated
py5 0.10.11a0/Python 3.13.15 and verified import under local JDK17/xvfb (no rendering).
Its bundled core JAR differs from desktop 4.5.6, so parity requires independent evidence;
see `design/py5-adapter-prerequisites.md`. The JS agent investigates browser prerequisites.

Latest result: the initial four CP1 adapter images ran successfully. All four match
historical CP1 model/geometry/colour hashes; the base decoded raster matches the earlier
actual PDE result. Root inspected base, length, palette and bar outputs and accepted
scoped edit-transfer evidence in `evidence/reproductions/cp1-java2d-adapter/decision.md`.
The four initial CP1 adapter images are consumed; do not rerun them without a documented
failure/repair and the registered corrective allowance. Native profile support remains
unvalidated. `Java2DFrameNative.java` now compiles and covers registered groups 1–4;
root requested and integrated missing ULP/y-boundary/quad/subpixel checks. The new
`tools/run_java2d_adapter_probes.py` compiles and serially executes both harnesses with
source-bound reports and exclusive initial-suite reservation. It has not run yet:
Sol is still implementing group 5 in `tests/native/Java2DFrameFailures.java`. Next inspect
that delivery, compile the full suite and execute the initial native probes.

Continuation: CP1's actual adapter-route harness and `tools/run_java2d_field_marks.py`
now compile current sources without rendering by default. `--render` reserves the four
registered images exclusively, binds inputs/runtime, compares retained model and geometry/
colour hashes to historical CP1 evidence, and checks visible edits. No images consumed yet.
Sol verified Processing's lazy backing allocation and transition order, then required
explicit completed-surface cleanup and a native fault seam. Root added idempotent
`releaseCompleted` and a package-private factory constructor; production still creates
an exact fresh JAVA2D instance. Native pixel groups 1–4 are assigned to the existing
bounded implementation agent; Sol owns `tests/native/Java2DFrameFailures.java` for group 5.
Next integrate/compile these harnesses, review the complete suite and execute it plus CP1.
All support claims remain unchanged; compile and whitespace checks pass.

Root added the internal `Java2DFrame` in the separate `packages/java-processing` source
root. It compiles against pinned Processing 4.5.6 on JDK 17; the portable core remains
renderer-free. It owns a fresh density-1 surface, verifies backing allocation/readiness,
normalizes complete batches before drawing, and transfers the surface only on successful
end. Native failures use the reviewed phase/index errors and release owned resources.

`design/java2d-adapter-validation.md` registers the full native probe and four CP1 edit
suite before runs, including acceptance predicates and initial/corrective budgets. No
native adapter run has occurred. Sol has the concrete draft for review; implement the
native harness, resolve review findings and then execute the registered suite next.
Adapter code is internal and provisional; catalog native statuses remain unvalidated.
Compilation and whitespace checks pass. This is implementation progress, not completion
of I1 or any four-host claim. No external/user blocker exists.

## Previous continuation — production frame state reviewed

Java, JavaScript and Python now implement the internal frame lifecycle against the
reviewed drawing profile. All three pass the 21 shared scenarios and direct token,
immutability, ownership, exception, reentrancy and count-boundary regressions.

- Root implemented Python and replaced an inadequate Java draft; the bounded JS port
  was integrated with the same contract. Sol independently reviewed the corrections
  and found no remaining state-machine blocker for actual JAVA2D integration.
- Full batches are snapshotted and validated before native work. Counts commit only
  after success; no-op slots preserve absolute error indices. Stale/foreign tokens,
  reentrant calls and validation exceptions cannot revive an aborted frame.
- Prepared values are detached and immutable. Abort/completion clear the retained
  environment. Surface acquisition, release and transfer remain adapter responsibilities.
- Source-bound reports are `evidence/conformance/drawing-state-{java,javascript,python}.json`.
  All three validator reports were also refreshed. These establish pure semantics with
  simulated adapter events; all actual native drawing-profile statuses remain unvalidated.
- Integrated verification: all 65 unit tests and whitespace checks pass.
- Next implement the Processing JAVA2D adapter and preregister its native profile suite,
  then validate other hosts and the artist editing path. Existing CP1 render budgets
  remain exhausted; a new adapter requires its own declared acceptance and run budget.
  No user response, survey completion or approval is required for this next work.

## Previous continuation — Java drawing validation and state integration

The previous goal turn implemented Python/JS validation. This turn adds Java's internal
`org.procedurals.internal.DrawingValues` and a generated native conformance harness.

- Java compiles at release 8 with no renderer/AWT dependency. Exact BigInteger lattice
  determinants, binary32 conversion, alpha and detached outputs pass the same 31
  normalized, 15 topology and six conversion cases as Python/JS. Native invalid-input
  and ownership checks also pass. Sol found no numeric/topology blocker.
- Root integrated review corrections: only documented passive standard Java numeric
  classes (including BigInteger for arbitrary integers), rejection before custom
  conversion code, and explicit recomputed channel/alpha ownership assertions.
- `run_drawing_conformance.py --target java` now compiles current sources and generates
  fixture calls without a JSON runtime dependency. Java/Python/JS evidence was refreshed
  after catalog carrier/status metadata changes. All native backend statuses stay
  unvalidated; pure validators do not establish Android or Processing integration.
- Root accepted Sol's internal lifecycle split in `design/drawing-state-integration.md`:
  portable state owns immutable environment/count/pending identity, adapter owns the
  surface lease; full-batch validation precedes drawing and count commits only on success.
- Next implement production frame state and its internal token/ownership tests against
  the 21 model scenarios, then actual backend adapters and registered CP1/profile runs.
  Catalog/whitespace checks pass. Full milestone scope remains active, with no user blocker.

## Previous continuation — Python and JavaScript drawing validators

The previous goal turn closed the drawing contract. This turn implements its pure
command/environment validator in Python and JavaScript, with no public package exports
or renderer objects. Java and production frame lifecycle remain next.

- Root implemented `packages/python/procedurals/_drawing.py`; the JS port is
  `packages/javascript/src/internal/drawing.js`. Both return detached normalized
  values and use exact integer topology rather than the Fraction fixture oracle.
- Both pass 31 normalized vectors, 15 direct canonical/converted topology cases,
  six conversion vectors and native ownership/invalid-input checks. Root corrected
  the initial JS harness so profile rejection could not masquerade as exact-predicate
  coverage. Sol reviewed Python and independently compared 20,000 commands to the oracle.
- Integrated Sol's final direct-conversion and environment-detachment tests. Future
  frame state must own a private validated environment; these internal functions are
  not public arbitrary-object/accessor APIs.
- `tools/run_drawing_conformance.py` produces source/fixture-bound Python and JS
  evidence under `evidence/conformance/`. All native profile statuses remain unvalidated;
  p5.js/py5 implementation status is explicitly pure-validator-only.
- Exploratory Python timings cover 1, 4096 and 25,600 segment/quad calls with repeated
  checksums. They are streaming pure timings, not peak-memory or renderer claims.
- Both conformance runs, catalog checks and 12 catalog tests pass. Next implement Java
  validation and production frame state, then adapters and actual four-host CP1 checks.
  Full milestone scope remains active; no user dependency blocks further work.

## Previous continuation — drawing contract frozen for implementation

The previous goal turn progressed the draft catalog/checker. This turn closes the
numeric and lifecycle fixture review and marks drawing.fresh-raster-2d v0.1.0 reviewed.

- `build_drawing_normalization_fixtures.py` generates 31 exact normalized goldens:
  f32 coordinate/width bits, RGB bytes, f64 alpha ratios, wide/tall bounds, maximum
  width, signed zero and conversion overflow. Sol independently confirmed outputs.
- `check_drawing_lifecycle_model.py` executes 21 authored scenarios with explicit
  state/error/index and acquire/release/transfer/native-attempt assertions. Root closed
  Sol's active-environment, method/state coverage and fixture-identity requests, including
  a non-square environment regression. These are simulated events, not native evidence.
- Catalog source hashes protect normalized fixtures from stale inputs. Generation/drift
  checks, lifecycle scenarios, catalog checks, 12 catalog tests and whitespace pass.
- Root accepted the reviewed contract after integrating all final review conditions.
  No renderer support is certified and no public generative operation was added.
- Next implement the portable command validator/state machine against the shared goldens,
  then native adapters and registered four-host profile/CP1 checks. The full milestone
  goal remains active; this closes a D3 prerequisite rather than completing I1.

## Previous continuation — drawing catalog and schema validation

The previous goal turn progressed the profile policy and fixed stale-JAR compilation.
This turn creates `catalog/drawing/fresh-raster-2d.json` as a draft infrastructure
contract, plus schema and proposed semantic fixtures. It does not add a generative
operation or change candidate memberships.

- Encoded exact topology/conversion, machine-readable relative bounds, per-record
  validation order, batch/frame counts, explicit alpha mapping, surface lifecycle and
  stable error/index behavior. Named backends use existing target IDs; all unvalidated.
- Sol approved the architecture/core semantics after root integrated error precedence,
  surface acquisition, alpha translation and Android identity corrections. Complete
  fixture closure is still required; draft status is intentional. Review record:
  `design/drawing-contract-review.md`.
- Added drawing catalog checks to the main checker: source hashes, schemas, internal
  limit/schema consistency, fixture identity and prevention of unsupported native claims.
  Eleven schema cases and all 12 drawing/existing catalog unit tests pass; catalog and
  whitespace checks pass. Fifteen semantic cases are proposed, not native conformance.
- Next add normalized f32 outputs/alpha ratios and non-square geometry goldens, then
  lifecycle fixtures for precedence, batch/count limits, no-op indices, terminal states
  and cleanup/failure. Review/freeze the contract, implement portable validation/state
  machine, then four native adapters and CP1 tests. No user dependency exists.

## Previous continuation — renderer profile policy and fresh PDE builds

The previous goal turn made progress with reviewed exact geometry evidence. This turn
resolves the profile admission policy with Sol and fixes a concrete build-integrity gap.

- `design/drawing-profile-policy.md` selects density 1, surfaces 1..2048 per axis,
  canvas-relative overscan and converted widths 1/256..max(width,height). These are
  chosen v0 engineering limits, not artistic ranges or universal renderer guarantees.
  Policy can precede validation; every profile target remains unvalidated until native
  boundary probes and CP1 edits pass. Larger-profile expansion remains in project scope.
- `check_field_marks_pde.py` always compiles current sources into a private JAR and
  records source/compiler/binary hashes. The lifecycle runner verifies and consumes that
  exact artifact. It no longer depends on a potentially stale dist JAR or edited stage.
- Official preprocessing, generated PDE compilation, source/artifact hash verification
  and lifecycle-harness compilation passed without rendering. Sol reviewed the corrected
  chain. The new pde-build record is compile-only; the old pde-result retains its original
  embedded build/render evidence. JAR hashes identify builds, not reproducible ZIP bytes.
- Catalog/reference and whitespace checks passed. No public core semantics changed.
- Next encode complete catalog drawing values/profile/error rules and shared fixtures,
  then implement portable validation and actual four-host adapters. No user dependency
  blocks this work; I1 and the full milestone goal remain active.

## Previous continuation — exact drawing geometry investigation

The previous goal turn made progress by resolving the drawing responsibility boundary.
This turn adds `tools/build_drawing_geometry_fixtures.py` and its generated investigation
vectors: 15 quad cases, six exact binary32 rounding cases, and a 3,024-quad independent
edge half-plane cross-check. Generation, drift checking and whitespace checks pass.

- Exact rational determinants expose a valid thin parallelogram that naive binary64
  arithmetic misclassifies as collinear. Topology therefore needs exact signs, not epsilon.
- Sol confirmed the four-turn predicate and requested an independent rounding oracle,
  distinct-but-collinear converted vertices, and binary64 underflow coverage. Integrated
  all three; host conversion is now only a cross-check of rational ties-to-even rounding.
- Sol's final review approved the corrected numeric investigation, including the rounding
  algorithm; root also checked 9,616 signed exponent/mantissa conversion probes. The
  authored case count is 15. This approval is for investigation, not an adapter contract.
- Added `design/drawing-numeric-investigation.md`. Official Canvas2D and Java BasicStroke
  documentation substantiate their incompatible zero-width behavior, supporting explicit
  rejection. They do not substantiate a universal maximum renderer domain.
- Added preflight-only capability rejection and single-fill quad semantics to the boundary.
  No native adapter or raster claim follows from these pre-contract vectors.
- Next investigate pinned target raster domains, settle shared profile support policy and
  exact error precedence, then freeze catalog drawing contracts/fixtures and implement
  four-host adapters. A Terra investigation spawn hit the agent thread limit; root completed
  the primary-source width check directly. No user dependency or global blocker exists.

## Previous continuation — shared drawing boundary reviewed

The previous goal turn made progress by completing and correcting the actual Processing
example checkpoint. This turn advances D3: root reread pelines/ciserp and the working
helper, wrote `design/drawing-boundary.md`, and obtained Sol's independent review.

- Accepted design: endpoint segments and filled convex quads, explicit colour/opacity,
  ordered bounded batches, and exclusive ownership of a fresh frame surface. CP2 path
  integration, joined polylines and dots remain separate capabilities.
- Integrated Sol's corrections: canonical versus conversion degeneracy, absolute command
  indices, aborted-frame semantics, validation-only batch atomicity, concrete resource
  ownership, and stroke/fill transitions between command kinds.
- Before schema/implementation, investigate one safe renderer coordinate/width domain
  and specify exact convexity predicates and error precedence. Finite float32 alone is
  insufficient. This is team work, not a user dependency; no new support is claimed.
- Corrected CP1's old separate-field walkthrough narrative to match the actual shared-field
  example. Architecture links, ledger structural validation and whitespace checks passed.
- Next: freeze catalog drawing values/capability contracts with distinguishing fixtures,
  then refactor and validate adapters across all four hosts. I1 and the full milestone
  goal remain active; no renders or operation implementations changed this turn.

## Previous continuation — runnable Processing field-marks example

The previous goal turn completed the palette core and was progress. This continuation
implements and validates the first actual artist-facing Processing sketch. The full
milestone goal remains active: this completes a scoped JAVA2D example, not I1's four
hosts, portable drawing contracts, I2 expansion or X1–X3 delivery.

- `packages/java/examples/FieldMarks/FieldMarks.pde` exposes seed, maximum length,
  palette and a bar-mark switch. `MarkField.java` retains five named attribute arrays
  and separates creation, painting and the small `drawMark` substitution method.
  These are example-owned code, not additional public operations.
- `tools/run_field_marks.py --prepare-only` builds/stages the sketch and JAR under
  `.work/examples/FieldMarks/`, preserving edited sketch tabs. The default command
  executes the registered checks, or verifies an unchanged cached result without
  more rendering. Start with `docs/getting-started.md`.
- Eight JAVA2D helper renders ran: four initial variants plus four preregistered
  corrective repeats after Sol found missing finite-value rejection and incomplete
  style-state checks. Artwork settings/tolerance were unchanged; images are identical.
  One model of 25,600 records stays unchanged across length/palette/bar edits. Actual
  drawing calls prove the declared invariants and full changed-style/matrix restoration.
- Root inspected all four final images; Sol independently inspected their identical
  first versions and approved the native example slice. Evidence and observations:
  `evidence/reproductions/cp1-java2d/plan.json`, `result.json`, `decision.md`.
- The official Processing 4.5.6 distribution was downloaded and SHA-256 verified under
  `.work/toolchains/`. Its production preprocessor compiled the actual PDE through
  `tools/check_field_marks_pde.py`; Maven lacked the referenced utils artifact, so the
  checker uses the shipped SDK jars from that pinned distribution.
- A separate one-frame PDE lifecycle check runs inherited settings/setup/draw and the
  actual S-key handler, then exits. `tools/run_field_marks_pde.py` passed; root inspected
  the saved image and verified all RGBA pixels equal the helper base. See pde-plan.json,
  pde-build.json and pde-result.json in the same evidence directory. This is not a human
  keyboard/usability test or another renderer/host claim.
- Catalog native status now identifies the scoped CP1 JAVA2D evidence for all three
  operations; other targets remain unvalidated. Core contracts and source remain
  semantically unchanged. Build artifacts are development JARs, not release manifests.
- Next freeze the shared drawing values/adapter boundary needed by I1, then port and
  validate the retained example in actual p5.js, py5 and Android hosts. Keep the complete
  milestone scope; no user approval or incomplete-survey gate blocks further work.
- Sol independently accepted the actual PDE lifecycle and pixel comparison. A future
  build-hardening item is to rebuild or bind the existing dist JAR to current sources
  in `check_field_marks_pde.py` before its next use after core edits. The present run
  used the companion fresh build and records its binary hash; no repeat render is needed.
- Final checks passed: 59 unit tests, all three native conformance suites across Java,
  JavaScript and Python, catalog/reference consistency, and whitespace validation.

## Previous continuation — palette core implemented

The previous goal turn made progress by recording the reviewed palette direction.
This continuation admitted `color.cyclic-palette` with three audited members,
froze its numeric contract after Sol independently matched 115 samples and 24
index vectors, and implemented Java, JavaScript and Python cores. The 50 remaining
provisional family merges were reopened with history, not rejected or described as
newly audited. Counts above reflect that correction.

- `catalog/operations/cyclic-palette.json` is the authority: opaque encoded-sRGB8
  RGB24 values, cycles, explicit wrapping/quantization, no artistic defaults/ranges.
- `tools/build_palette_fixtures.py` uses an independent Fraction oracle. Native
  ports pass 115 sample vectors, 11 constructor errors, 8 query errors and ownership/
  nonfinite/serialization checks. Intermediate index vectors are separately reviewed
  oracle evidence, not claimed native coverage.
- `uv run python tools/run_palette_conformance.py --target all` builds all Java
  core classes and checks native ports. Every target's 250,000-query checksum is
  1947414708739, independently recomputed using the rational oracle.
- Root reviewed all ports and removed Python's temporary intermediate tuple from
  the inner loop. Sol approved the final implementations after a schema correction: finite
  binary64 bounds and oversized-integer error fixtures now agree with the native
  conversion rule. Python additionally checks near-limit integer normalization.
  Actual host, drawing adapter and reproduction support is unvalidated.
- Generated conformance evidence for all three operations is current under
  `evidence/conformance/`. All source, contract and fixture hashes were verified.
  Catalog checks and all 59 unit tests pass. Combined JAR builds remain local
  development artifacts, not release manifests.
- Next replace private colour arithmetic in the CP1 example with the public sampler;
  retain instances and run length-independence, palette/geometry independence and
  alternate-mark transfer. Then complete host/target validation in roadmap order.
  No external approval or incomplete-survey gate blocks this work.

## Earlier continuation — palette boundary review started

Sol is the independent reviewer, as requested by the maintainer. Root has read
`pelines#1`, `Cuadricula#1`, `mountain4#2`, `zozo#1` and `paraisooscuro#5` and written
`design/operations/cp1-palette-proposal.md`. The proposal separates the first
linear cyclic sampler from power-eased variants and preserves colour cycles in
retained mark instances. Sol's bounded review agrees that the family cannot be
admitted whole. Root accepts cycles as the proposed public coordinate, avoiding
repeated palette-length arithmetic in examples. No new palette contract or member
equivalence is approved. Next audit the selected linear members and explicitly
account for eased variants, then specify portable colour and numeric semantics.

There is no global blocker or outstanding maintainer approval. The incomplete
survey does not block this work. External baseline images constrain later corpus
reproduction claims, not native implementation or new example inspection.

## Previous continuation — noise implementation completed

The preceding goal turn was progress (reviewed noise design, four inspected candidate
renders, and Processing runtime setup). This continuation completed the dependency admission,
exact numeric contract, three portable cores and independent Sol implementation review.
The full milestone goal remains active; the complete CP1 package and remaining targets are
not claimed complete.

- `catalog/operations/gradient-noise-2d-01.json` is authoritative. A Fraction-based oracle
  generates fixtures; Sol independently matched their scalar/hash values before code.
- `tools/check_phase2_design.py` and `tools/check_catalog.py` now validate capability
  dependencies without fake candidate reassignment, and validate scalar-query fixtures.
  Missing remainder, forged/stale motivators and invalid admission kinds fail tests.
- Native implementations and checks: `uv run python tools/run_noise_conformance.py --target all`.
  Generated evidence: `evidence/conformance/gradient-noise-2d-01.json`. Host/renderer
  validation is separate; the first Java candidate-design integration probe matches all
  RGBA pixels and was directly inspected. See `evidence/reproductions/gradient-noise-java2d/`.
- Shared native benchmark checksum: 123399.9596239042 for seed42 and 250,000 scalar queries
  at (i*.001,i*.002). This is a correctness/performance observation, not a speed guarantee.
- Grid JAR build now includes all core classes, so running its checker does not remove
  the new noise operation. Native conformance reports identify the artifact from each run;
  later builds may change ZIP timestamps. They are validation records, not release manifests.
- `docs/core-development.md` includes verified noise usage. `THIRD_PARTY_NOTICES.md` records
  algorithm attribution. Palette, public drawing commands/adapters and CP1 edits remain next.

## Earlier continuation — noise design and runtime prerequisites

Previous goal turn was progress: three native grid cores, independent Sol corrections and
verified conformance. This continuation also changes authoritative state; the full goal
remains active and no global blocker is present.

- Sol completed the noise design review after a transient capacity retry. Root accepted
  `field.gradient-noise-2d-01`: ordered hash, exact-safe lattice corners, explicit periodicity,
  raw-to-[0,1] mapping and seed-only fields with scalar native queries. Contract not frozen.
- Root rejected a symmetric lattice-hash combiner because diagonal inputs reduced its
  intermediate state to 16 bits. Ordered mixing is proposed; artist-visible range and
  single-octave sufficiency were resolved through Sol review and four inspected candidate
  JAVA2D renders. Root selected one octave for the introduction; see
  `evidence/parameter-experiments/cp1-noise-choice/decision.md`. No public range is approved.
- Root reopened `scicirgold#1` after reading its two-stage/three-coordinate noise dependency
  and conflicting prose. Current counts above include this correction and preserved history.
- Installed pinned Processing 4.5.6 core under ignored `.work/toolchains/` and ran actual
  JAVA2D pixel/save checks. Reproduce with `uv run python tools/check_processing_runtime.py`.
  This is runtime availability, not package adapter, P2D or Android validation.
- Integrated Sol's grid build cleanup follow-up; all three native cores still pass and
  `evidence/conformance/regular-grid.json` was regenerated. The earlier 53-unit-test result
  remains the last full unit-suite result. Four private experimental compositions ran;
  public-API artist edit/transfer and target reproduction acceptance remain unfinished.

## Current reviewer assignment

The maintainer selected Sol (`gpt-5.6-sol`, high reasoning) as architecture reviewer.
The earlier Astra review is historical; new reviews use Sol. Root remains architect.

Root completed `design/capabilities/cp1-field-marks.md`, a concrete usage walkthrough and
public/private capability decision, and integrated Sol's five requested corrections.
Public direction: regular placement, a named pure scalar-noise source and cyclic palette
sampling; simple attribute arithmetic and multiattribute sampling remain example-private.
CP1 emits renderer-neutral segment commands from inspectable values. CP2 uses scalar fields
with explicit angle mapping, distinct feedback integration, and its own signed-noise semantics.
Regular-grid and gradient-noise contracts are frozen; cyclic palette remains pending.

`evidence/parameter-decisions/cp1-field-marks.json` records five verified substitutions,
source/result hashes, pitch/length coupling, alpha correction and RNG confounds. Root also
read circlesAlpha/paraisooscuro grid evidence: inclusive cell-count and n-point conventions
must be distinguished. No user input is needed. Verified Temurin 17 is installed under ignored
`.work/toolchains/jdk-17.0.20.1+1`; Java 8 bytecode compilation and native execution pass.
Sol completed the independent implementation review. Root fixed Java lossy numeric
coercion, JavaScript output-slot drift and native serialization/zero-check gaps; Sol verified
the final evidence hashes and found no remaining material portable-core blockers.
See `design/operations/regular-grid-review.md` and the runnable `docs/core-development.md`.

## Current approach revision — capability and clarity, 2026-09-07

The maintainer explicitly prioritized capability and clarity over completeness, with root
as main architect. `docs/artist-capabilities.md` is the current product/design direction.

- Root personally owns artist entry points, capability selection, public boundaries,
  alternatives, complete example walkthroughs and contract approval. Candidate counts and
  the earlier 30–80 estimate are not delivery goals.
- Consulted a gpt-6-astra/high architecture reviewer against actual reports. Root accepted
  the independent recommendation to prioritize an editable grid/noise mark field (CP1),
  with integrated flow/path treatment (CP2) as the shared-boundary counterexample. Triangle
  sampling is now an optional technical experiment, not the first artist milestone.
- Wrote concrete entry paths and capability admission questions: task enabled, algorithmic
  work removed, meaningful edits, reusable output, transfer, cost and evidence. Preserve
  useful compound conveniences; native examples and readable controls are early deliverables.
- Luna/Terra now have bounded fact/retrieval and frozen-contract roles; a stronger reviewer
  challenges consequential architecture. Root checks decisive evidence and makes decisions.
- A scoped package no longer requires all-candidate adjudication or full-corpus reproduction.
  Declare scope and acceptance before runs; all four target claims still need evidence.
  Existing benchmark release mode remains strict full-corpus certification. No benchmark
  implementation or manifest has been weakened or relabelled in this approach revision.
- Direct reading and independent review found a numeric inconsistency in pelines alpha
  prose versus its quoted expression. Its visual report remains evidence, but the stated
  bound cannot become an API bound without verification. textureGridText lacks parameter
  experiments; no visual control defaults/ranges are approved from that report.
- The earlier approach-revision checkpoint changed planning/instructions only. No new operation contracts, code, renders
  or usability trials were completed. The earlier 49 passing tests remain the last code
  validation. This turn's documentation links, ledger consistency, skill metadata and
  whitespace checks passed; no new runtime behavior required a test-suite rerun.

## Latest decision audit — 2026-09-07

- Audited all 35 existing rejections and risky flow/walk/subdivision merges with Terra/Luna
  investigations and integration-owner verification of exact candidate IDs and parent prose.
  Thirty decisions reopened (one keep, twelve merges, seventeen rejections); previous values
  are preserved in ledger `audit_history`. This is correction, not new assessment coverage.
- Corrected independent strokes versus integrated paths, finite 2D traces versus persistent
  3D agents, two-/four-/variable-grid subdivision, and orthogonal/hex/self-avoiding walks.
- All 18 remaining rejections exclude additional bundled public wrappers and now have
  explicit recipe/adapter/deferred-component destinations. Reopened components include
  tick/ruler geometry, articulated figures, line fans, checkerboard and warped fan disks.
  A scene label or font dependency cannot reject portable geometry/placement.
- Rewrote `docs/api-design.md`: investigations are not function counts; operations, mark
  construction, adapters and recipes have separate responsibilities. Added grid/noise, flow,
  scattered-form, branching, 3D and typography composition acceptance cases. The triangle
  micro-slice alone cannot establish a useful architecture for the full package.
- Added per-cluster architecture prerequisites and member/component audits. The checker now
  requires audit accounting for rejections and provides `--contract-cluster ID`; its pending
  triangle architecture intentionally fails that gate. At that audit checkpoint no contract existed; regular-grid is now admitted.
- Wrote `docs/audits/phase2-architecture-review.md` and the complete 35-record rejection
  reconciliation. Updated agent acceptance briefs and operation-contract prerequisites.
- Prepared triangle parameter evidence (21 verified published variant records) and a
  stochastic semantics investigation. They remain pre-contract; no canonical RNG or public
  defaults/ranges are frozen. Density/colour/RNG order and loop rounding need explicit
  contracts. No renderer was run. Java 11 runtime and Node/Python are available locally;
  no Java compiler, Processing or Android build runtime was found during preparation.
- Ignored `.work/reviews/` proposals and vector scratch are not authorities. Some agent
  proposals named wrong ordinals or oversimplified algorithms; use the root-integrated
  audit and ledger. Do not reapply earlier scratch correction scripts.

## Resume commands

```sh
mkdir -p .work/tmp
uv run python tools/phase2_inventory.py
uv run python tools/check_phase2_design.py
TMPDIR="$PWD/.work/tmp" uv run python -m unittest discover -s tests -v
```

A normal ledger check proves structural/evidence consistency, not completed adjudication
or contract approval. `--require-reviewed` separately enforces all-record disposition.
`--contract-cluster <id>` checks one operation’s recorded architecture/member prerequisites;
it does not require unrelated candidates to be complete or replace semantic review.
Before a new snapshot, preserve the old inventory under ignored `.work/`; after publication,
use `--previous` and reconcile affected decisions rather than overwriting the ledger.
See `docs/phase2-evidence-review.md` for the exact workflow and findings.

## Decisions

- Reference implementation: Processing 4 native Java library distributed as a JAR. Required ports: p5.js, py5, and Processing for Android/Android Mode. Java is not the behavioral specification. Rationale: `docs/target-form.md`; portability contract: `docs/portability.md`.
- PDE files remain the example/template format, not the reusable implementation format. Portable algorithms use JSON-compatible values and renderer-neutral geometry/command streams; host types remain in thin adapters.
- Phase 1 storage: normalized SQLite with atomic full-database replacement. This prevents stale rows and duplicate accumulation as notes arrive.
- Ingestion uses only Python's standard library. Its YAML-subset parser handles the survey schema, recovers known malformed notes, preserves raw frontmatter, and emits provenance-linked diagnostics rather than silently discarding a sketch.
- Controlled-vocabulary normalization is explicit in the `normalizations` table. Unknown values become null or are dropped from normalized join tables while the raw frontmatter remains available.
- Phase 2 decisions may use the current snapshot. Record source revision and hashes; revisit affected decisions when reports arrive. Evidence gaps block only dependent decisions.
- MCP server and companion web app are required delivery targets. Natural-language planning must produce a validated, portable sketch recipe from one operation catalog shared by language adapters, MCP schemas, documentation, UI controls, and exporters. Details: `docs/mcp-web.md`.
- The exact operation catalog, recipe schema, MCP tools, and prompt-suite cases remain Phase 2 decisions because they depend on reviewed computation-level clustering.
- Implementation workflow is now codified as gated skills: approved operation contract; deterministic semantics where applicable; portable core plus four claimed target adapters; explicit capability boundaries; motivating corpus reproduction. They require reviewed decisions and complete contracts; they do not require 901 reports.

## Completed artifacts

- `docs/roadmap.md` and `docs/agent-briefs.md`: detailed Phase 2–4 dependencies, deliverables,
  acceptance gates, current-snapshot policy, and bounded agent assignments.
- `tools/phase2_inventory.py` and `analysis/phase2/`: complete dossiers, source hashes,
  reliability/placement diagnostics, count reconciliation, and incremental evidence deltas.
- `tools/check_phase2_design.py`, `design/phase2/cluster-decisions.json`, and generated
  triage: authored decisions protected from triage refresh, source/provenance validation,
  stale evidence and orphan-merge checks, and separate all-record review acceptance.
- `docs/api-design.md`, `docs/phase2-evidence-review.md`, and
  `design/phase2/parameter-questions.md`: provisional composition design, actual reviewed
  evidence/exclusions, and specific unresolved parameter/semantic decisions.
- `tools/benchmark_evidence.py`: public metadata fingerprints and exact expected-frame
  reconciliation shared by manifest publication and release evaluation.

- `tools/sync_survey.py` and `survey/`: idempotent, allowlisted publication of reports,
  render-result metadata, methodology, and upstream provenance. Machine-local paths are
  replaced; multi-gigabyte images, logs, builds, environments, and copied assets are excluded.
- `docs/target-form.md`: Processing 4 native JAR reference decision and Phase 0
  feasibility result. The observable behavior remains language-neutral.
- `tools/ingest.py`: discovers every `survey/out/**/notes.md`, normalizes it, adds
  baseline and variant facts, validates relational constraints, runs
  `PRAGMA integrity_check`, and atomically replaces `data/corpus.sqlite`.
- `data/corpus.sqlite`: 826 sketches, 3,560 parameter records, 1,934 reusable-candidate
  records, 4,578 variant records, and provenance views for parameters and candidates.
- `tools/report.py`: generates technique frequency/co-occurrence/association tables,
  candidate-name distribution, parameter sensitivity, objective variant-diff summaries,
  applied normalizations, and diagnostics.
- `reports/corpus.md`: Phase 1 corpus-shape report for the public snapshot.
- `reports/parameter-sensitivity.csv`: all 3,560 parameter records with defaults, tried
  values, measured score, effect, provenance, signal band, and evidence warnings.
- `tools/build_benchmarks.py` and `benchmarks/corpus.json`: corpus-wide manifest for
  externally stored baseline frames, with explicit p5.js, py5, Android, and Java targets.
  Current snapshot: 980 required cases across 800 sketches; 26 stubs are excluded.
- `tools/benchmark.py`: objective cross-renderer metrics, profile gates, missing-case
  failures, coverage, per-technique/renderer breakdowns, JSON output, and concise Markdown.
- `tests/test_ingest.py`: parser recovery, vocabulary normalization, atomic rerun,
  provenance, and database-integrity contracts.
- `tests/test_benchmark.py`: exact metrics, divergent-image failure, dimension mismatch,
  missing-case coverage failure, all-frame discovery, target registration, and stub exclusion.
- `docs/architecture.md`: high-level system/data/runtime/MCP diagrams, repository map,
  verification model, and contribution workflows.
- `docs/mcp-web.md`: MCP/server, portable recipe, companion p5.js preview, four-target
  export, safety, and objective prompt-benchmark requirements.
- `skills/`: gated workflows for parameter evidence, operation contracts, deterministic
  semantics, portable implementation, capability boundaries, and corpus reproduction.

Rebuild the public snapshot and derived data:

```sh
# Maintainers with sibling source checkouts only
uv run python tools/sync_survey.py

# Works from any normal clone
uv run python tools/ingest.py
uv run python tools/report.py
uv run python -m unittest discover -s tests -v

# Requires the external full survey output containing baseline PNGs
uv run python tools/build_benchmarks.py --survey-root ../genart-survey
uv run python tools/benchmark.py \
  --reference-root /path/to/genart-survey \
  --candidate-root /path/to/rendered-cases \
  --target p5js
```

## Evidence read

The initial reading covered the survey brief, notes schema, render methodology, and 17
reports spanning 2014–2020. Subsequent record-level reviews and their parent evidence are
recorded in the authored ledger and `docs/phase2-evidence-review.md`. The
set includes JAVA2D/P2D/P3D, static and animated sketches, deterministic and
non-deterministic output, shader work, typography, recursion, subdivision, noise
displacement, flow fields, Delaunay geometry, physics, and two blank-baseline stubs.

Representative paths:

- `survey/out/2014/Generativos/Arboles/notes.md`
- `survey/out/2014/Generativos/circulos2/notes.md`
- `survey/out/2014/Generativos/circulosFormas/notes.md`
- `survey/out/2014/Generativos/Helvetica/helve1/notes.md`
- `survey/out/2015/Generativos/cityPink3d/notes.md`
- `survey/out/2015/Generativos/dataBall/notes.md`
- `survey/out/2015/Generativos/triangulitos/notes.md`
- `survey/out/2016/Generativos/noiseGrids/notes.md`
- `survey/out/2016/Generativos/circlesquads/notes.md`
- `survey/out/2018/Generativos/ailan/notes.md`
- `survey/out/2018/Generativos/araniaaas/notes.md`
- `survey/out/2018/Generativos/arbolito4/notes.md`
- `survey/out/2018/Generativos/mapFly/notes.md`
- `survey/out/2019/generativos/flowwers/notes.md`
- `survey/out/2020/generative/01_04/fieldop/notes.md`
- `survey/out/2020/generative/01_04/fractal001/notes.md`
- `survey/out/2020/generative/05_08/scicirgold/notes.md`

## Data-quality findings to preserve

- 26 reports are blank/unrenderable stubs.
- One empty parameter map remains in the dataset with an `empty_parameter` warning.
- The current ingestion emits 54 warnings and no errors; malformed records remain linked
  to their source report.
- Parameter values mix scalars, lists, expressions, and quoted ranges, so defaults and
  tried values are JSON rather than coerced numeric columns.
- The snapshot records 148 explicit normalization events, including vocabulary mappings,
  invalid change scores, and structurally malformed parameter/candidate rows.
- Shader visual evidence rendered under Xvfb must be treated as suspect. This snapshot
  contains no such baseline among the analyzed reports.

## Next

1. Grid, noise and cyclic palette cores and the actual Processing JAVA2D field-marks
   example are implemented and independently reviewed. Freeze shared drawing values and
   adapter responsibilities from the working example and CP2 counterexample. Preserve
   the explicit host-noise divergence and scoped validation claims.

2. Review CP2's position-feedback integration alongside CP1. Decide reusable field/value
   boundaries from both uses, including heading/progress, state order and work/memory cost.
   Obtain a stronger-model challenge before freezing consequential shared semantics.
3. Resolve only the ledger memberships and neighbouring evidence needed for these decisions;
   unrelated unreviewed records remain visible. Record capability brief and alternatives,
   pass operation prerequisites, then write reviewed contracts and distinguishing fixtures.
4. Port the validated Processing example and complete actual p5.js, py5 and Android host
   validation for the claimed slice. Extend the teaching path alongside code.
   Add deferred workflow skills at their actual lifecycle points. No JSON executor is needed
   to establish a useful native example.
5. Select the next capability by the new artistic work it enables; keep spacing, subdivision,
   typography, branching and 3D investigations visible without making them an initial quota.
   Define scoped reproduction acceptance before runs; never confuse it with full-corpus
   certification. Reconcile affected decisions as new survey evidence arrives.

Current integration note: unrelated packages/javascript/src/index.js export edit was observed
during this batch and is preserved unstaged; it is not part of this Java prototype review.
