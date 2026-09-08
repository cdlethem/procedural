# CP6 branch-tree contract and fixture review

Root accepts the language-neutral endpoint-branch contract and shared fixtures for
Java-first implementation during the maintainer-paused Sol sprint. This is not native,
performance, renderer, reproduction or distribution acceptance; CP6 is not delivered.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `catalog/operations/seeded-endpoint-branches.json` | `38984f84dfcf5837386e0d830c8bf1f5554b04adcc6e36187c8a497899681881` |
| `fixtures/operations/seeded-endpoint-branches.json` | `5368de8f8e268ac2f376a45f08d97e690a3192708b4d42a2b6d393894f88a13c` |
| `tools/generate_branch_tree_fixtures.py` | `10d97521fa1763ac8fce853df34c021459307619802515c64a63901d71219b92` |

Do not change these inputs underneath an implementation assignment. New semantic evidence
requires an explicit revision and renewed review. The catalog is the only schema authority;
cp6-branch-contract-decisions.md records the earlier drafting rationale.

## Root findings

Root inspected the schemas, complete behavior, parameter evidence, private source/visual
reviews, numerical diagnostic, fixture oracle, mutation evaluator and structural validator.
The capability dependency passes the Phase 2 prerequisite checker without changing any
original candidate disposition. Forty shared cases cover 24 successful trees and 16 static
or dynamic failures; the separate native-only requirements are obligations, not passed tests.

The retained BFS ordering supports appended generations without rearranging earlier geometry
when existing rules remain equal and both calls succeed. Child counts and terminal membership
can change. A total-depth-normalized rule expression changes earlier rules and cannot claim
this preservation. Geometry and nominal length/heading remain useful through collapse.

The private stream specifies shared scale, ordered independent gates and conditional turns.
Six tested bad traversal/consumption schedules change public output; terminal unused draws
only change discarded state and must be checked in source. Mutation control agrees with every
successful fixture. These are targeted distinguishing tests, not exhaustive mutant coverage.

Root translated and cross-checked all seven independent arithmetic witnesses, including
failed gates skipping hypothetical overflow and capacity winning before child arithmetic.
Root and child endpoint failures are distinct from statically invalid unused rules. Finite
length times bounded finite sine/cosine cannot overflow; no artificial delta-stage fixture
is claimed. Other arithmetic stages have concrete finite-input witnesses.

Basic attributes, topology, RNG words and zero-heading/collapsed geometry compare exactly.
Nontrivial trig cases carry individual coordinate allowances from a two-adjacent-value
reference trig margin and outward-rounded propagation through parent endpoints. This is an
explicit fixture engineering margin, not a universal host-trig accuracy guarantee. Java must
pass it natively; deferred ports must supply their own native evidence under the same fixtures.

Source values and measured depth/spread changes establish motivation and impact, not defaults
or encouraged ranges. Shared sibling length follows the source; uniform interval sampling,
private RNG and BFS are deliberate design divergences. Arboles node-gated random fans,
mutable line-pool brotes, interior attachment and symbolic grammar remain outside this kernel.

## Implementation and delivery obligations

Implement BranchTree2D in growable packed primitive storage, preserving all static validation,
error precedence, draw order, zero normalization and ownership/access rules. No per-node
objects or recursion in the expansion loop. Validate every native-only fixture obligation,
including wrong carriers, nonfinite values, detached ownership and atomic writes. Observe
small, representative branching and long-chain workloads; report retained payload separately
from actual heap measurements and spare capacity. The maximum representable capacity is not
an allocation or latency guarantee.

Do not edit frozen CP3–CP5 classes or introduce shared RNG refactors. Use Java first, leaving
other targets explicitly unvalidated. Then construct an editable installed BranchMarks example
with generation extension, spread, style/terminal reuse and CP3 placement transfer. Root must
review its native execution and rendered states before adding a delivered-workflow claim.

Evidence: evidence/investigations/cp6-growth-prefix-review.json,
cp6-numeric-cases-review.json and cp6-fixture-mutations-review.json; private visual review is
under evidence/parameter-experiments/cp6-branches. Structural checker success is distinct from
native conformance and visual reproduction.
