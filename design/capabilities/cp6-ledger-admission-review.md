# CP6 proposed capability-dependency admission

Status: **root admitted the dependency after diagnostic acceptance**. The canonical
ledger now contains a reviewed capability dependency, and its prerequisite check passes.
Root reran the diagnostic and compared all emitted report fields; see
[cp6-growth-prefix-review.json](../../evidence/investigations/cp6-growth-prefix-review.json).
All 1,934 candidate records remain unchanged. Concrete drafting decisions are in
[cp6-branch-contract-decisions.md](../operations/cp6-branch-contract-decisions.md).
Catalog and fixture review are still required before implementation.

The following records the original proposal before root integration. It was not itself
a canonical ledger edit,
a reviewed operation contract, a public signature, or an implementation authorization.
The proposed patch is isolated in
[`.work/cp6-ledger/admission-proposal.json`](../../.work/cp6-ledger/admission-proposal.json).

## Proposed addition and its narrow scope

The proposal adds one `capability_dependency` record:
`topology.seeded-endpoint-branches-2d`. It describes a retained endpoint-branch
computation with explicit root pose/length, seed, ordered generation rules, ordered
probability/relative-angle slots, shared per-parent child-length scale, bounded work,
and a breadth-first append order. Its output description is retained endpoint geometry
with ancestry, generation, and actual child counts.

This is deliberately narrower than either source helper. It does not add an “arbolito”
mode, a generic L-system or turtle interpreter, callbacks, root placement, noise sizing,
colour, palette, tapered rendering, terminal decoration, mutable growth, interior
attachment, or source-compatibility mode. The selection document chose breadth-first
expansion and a private independent RNG because the private source-like depth-first
comparison rearranged later geometry when generation count changed. That is a design
choice to test with a prefix diagnostic, not a claim of source replay.

## Bound evidence and candidate accounting

The proposal binds the current canonical ledger SHA-256:

```
e76f17365b2f05ac6de06881abc4c20583e9d436fb6c0b1a68e3f1e6d1ea7ac5
```

It binds the root selection, branch audit, accepted private review, and private result
by path and SHA-256. Its two motivating records remain individually asserted as follows:

| Candidate | Current disposition/status/cluster | Note/source SHA-256 | Ledger evidence SHA-256 |
| --- | --- | --- | --- |
| `2018/Generativos/arbolito3#1` | `merge` / `reviewed_provisional` / `topology.recursive-branch` | `bc278131e84561f22c5f3eb479b9ff458df97f1a9259a1ff800f62d17d9f9958` | `ad37ff004fefcc57f5e7a7a5cd9884b16715dca1a26c72c6cfd60b0f881662d4` |
| `2018/Generativos/arbolito4#0` | `merge` / `reviewed_provisional` / `topology.recursive-branch` | `d9fed9e20763c254e5ae4954995ab721684fdd98222f392dbe895479d1f6c899` | `228843be3bf1625bd2220c801911d0f6d974d2f1d9676e28446b5c14f219be3d` |

The patch contains no record updates, so all 1,934 existing candidate records retain
their canonical dispositions. In particular, the broader
`topology.recursive-branch` cluster remains an unresolved policy family; this proposal
neither merges it nor rewrites any of its existing decisions.

The candidate-specific remainder accounting keeps source-specific work outside the
proposed dependency:

- `arbolito3`: forest placement, noise sizing, palette/colour drift, styles, terminal
  ellipses, and global Processing random/noise plus depth-first draw scheduling.
- `arbolito4`: its 120-root/noise setup, palette and black-stroke override, width and tip
  rendering, global stream prelude, source DFS sibling/subtree order, source shrink and
  colour draw laws.

The proposal also explicitly does **not** represent `Arboles`' whole-node gate,
random-count fan, or its source-specific fan law. It does not represent the mutable
line-pool state machine in 2019 `brotes`, nor the interior-attached recursive children in
2020 `brotes`. Those candidates and their record-level states remain separately accounted
in [branching-evidence-audit.md](branching-evidence-audit.md).

## Required decision before integration

The private review accepts an investigation and selects a direction; it does not freeze
contract semantics. Before a canonical ledger integration or contract work, root must
accept the independent breadth-first prefix diagnostic. That diagnostic must prove the
stated geometry/ancestry/generation preservation for appended rules while keeping clear
that prior leaves may gain children and that a whole result, terminal status, and child
count need not be a prefix.

A later contract would still need to decide the input carriers, exact generation rule and
slot semantics, private seed expansion and random consumption, numeric/trigonometric
behavior, finite and collapsed geometry, explicit limits/failures, owned-result access,
and target evidence. No ranges or defaults are proposed here.
