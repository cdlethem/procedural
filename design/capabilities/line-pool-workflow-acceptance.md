# CutBranchMarks: frozen Java workflow acceptance

Root owns helper/PDE, core integration review and native acceptance. Terra owns frozen
LinePool2D implementation and focused pure diagnostics. Use corpus-reproduction workflow;
no additional public API. Operation contract topology.seeded-line-pool-2d0.1.0 is authoritative.

Artist starts with one stroke and grows fine branches by repeatedly cutting and revisiting
it. CutBranchMarks at960P2D density1 exposes A (first-cut angle1.4/.7), W (attempts90000/9000),
C (colour, retain geometry), T (alternate initial stroke, same seed), R (seed),0(reset),S(save).
Default stroke(480,850)->(480,200); alternate(180,760)->(760,240) checks orientation and
position transfer. These are measured/proposed example presets, not operation defaults.
Retain the final pool. Drawing uses final segments, simple line colour and optional terminal
endpoint dots; no hidden cut/branch logic in the example. Public generation uses minCutLength4,
maxSegments180001, explicit uint32 seed; source-scale termination retained.

Pure acceptance: every frozen fixture, typed errors, invalid host data, detached outputs
and atomic failed access. Source prototype geometry is not a public fixture because RNG,
precision and reproducible math differ. Capture source/core hashes before native runs.

Native editing sequence: baseline,C/reset,A/reset,W/reset,T/reset,R/reset,then cached save.
All style edits retain identity; structural edits produce new results and visible change.
Reset/export decoded pixels equal baseline. Root inspects all distinct images and confirms
fine branching persists under portable semantics; angles change spread, work changes detail,
alternate stroke and seed remain useful. No animation/time stepping is claimed.

Separate full workload: thirty independent pools at90000attempts each on1920P2D density1.
Use source-like initial endpoints sampled uniformly within +/-65% of width/height around
center, explicit private scene RNG seed42, separate per-pool operation seed(seed+i)mod2^32.
Colour/tip decisions use separate deterministic scene streams. Keep true workload; no count
reduction or silent truncation. Record build/render wall time, actual retained segments,
cut/skip counts, payload estimate and actual runtime heap observation. Serialize under the
existing lock with180s timeout and512MiB heap; failures are evidence, not permission to lower
workload. One frame for this static case. Root checks dense multi-pool branching and no
missing layer before scoped technique-level acceptance. Whole source-pixel or RNG equivalence
is explicitly excluded; do not add a whole-brotes coverage count just from this workload.

After semantic/native/visual acceptance, package with all14 prior starters preserved and
15 implemented operations,15 starters. New package count is contingent on actual acceptance,
not this plan. Other ports remain deferred with exact elementary-math requirements.
