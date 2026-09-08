# CP6 branching neighbours: bounded retrieval

Status: retrieval only. This note records nearby checked-in candidates for the
endpoint-tree investigation; it makes no operation, signature, merge, or rejection
decision.

## Method and boundary

I read the existing [branching evidence audit](branching-evidence-audit.md), queried
the checked-in `data/corpus.sqlite` query layer and authored candidate ledger, and read the complete source
notes for the four selected neighbours. The search for `l-system`, `lindenmayer`, or
`turtle` in all checked-in `notes.md` files found only the already-known
`2018/Generativos/arbolito4` and `2019/generativos/brotes`; it found no additional
symbolic-rewriting or turtle-traversal implementation. In particular, a note calling
a recursive routine an “L-system” does not establish a grammar interpreter.

The comparison baseline is deliberately the already-known group documented in the
audit: `2014/Generativos/Arboles` (recursive endpoint expansion),
`2018/Generativos/arbolito4` (independent child slots),
`2019/generativos/brotes` (mutable line-pool subdivision), and
`2020/generative/05_08/brotes` (recursive children attached along a parent).

## Selected close neighbours

| Candidate identity | Checked-in note SHA-256 | Ledger evidence SHA-256 and current ledger state | Why it is a distinct neighbour |
|---|---|---|---|
| `2014/Generativos/cositocoson#0` — `randomWeb(origin, depth, maxBranch) -> void` | `0e96bcb4cb25ba89e6d7e32b704f7ec417d9bd553902e6c26e29c7cf0f0031d8` | `aa632abf3fabef72687d9b7e4726e505a7c929228c8a5ad0bdde8cbc4e3edc30`; `topology.recursive-branch`, `review_required` / `reviewed_defer` | Random remaining-depth decrement and child-count policy differ from fixed-level endpoint expansion. |
| `2018/Generativos/arbolito3#1` — `recursiveBranch(x, y, angle, len, colorIdx, depth, shrink, errAng, branchProb)` | `bc278131e84561f22c5f3eb479b9ff458df97f1a9259a1ff800f62d17d9f9958` | `ad37ff004fefcc57f5e7a7a5cd9884b16715dca1a26c72c6cfd60b0f881662d4`; `topology.recursive-branch`, `merge` / `reviewed_provisional` | Per-child probability, state carried down branches, and a terminal mark distinguish traversal and attribute needs from a bare segment list. |
| `2020/generative/05_08/moje#0` — `ramab(x, y, w, h, angle, depth, ampAng)` | `5809092db6565dcd21a22f11d3943d17ab3befb35af948922fdf603b3f4f8a72` | `bef0ee340b8de101a455153215ada3752b77405dbd2cebfeb921885233db18a1`; `topology.recursive-branch`, `review_required` / `reviewed_defer` | The branch is a tapered quad with joints, so a line endpoint traversal alone does not express its branch cross-section or mark sequence. |
| `2020/generative/05_08/shatree#0` — `rama(x, y, w, h, angle, depth) -> void` | `99eb5c144f2a359fed33445dcdd07ff7c08903e5e5875891f606e2fc6d587748` | `4d794fcc388209b5b966daf2e7dc7d1434fa8f0189c3e26ba71105b6d48194bf`; no cluster / `review_required` / `unreviewed` | Its children originate at a lerped, angle-jittered point and terminal nodes place image clusters, combining interior attachment with renderer-owned foliage. |

### `2014/Generativos/cositocoson#0`: collapsing random web

The artist task is a small, dense nest-like line web amid independent ring and cross
stamps. `recursion()` emits one randomly oriented, randomly sized edge, then decreases
the remaining depth by either one or two and selects a child count from a fraction of
that remaining depth. The result is initially expansive and then collapses as remaining
depth falls. Each edge is drawn twice with a one-pixel offset; that relief treatment is
an ordered mark decision, not evidence about topology.

There are no parameter experiments for this candidate. The note names depth,
edge-length range, and branch-count range as possible general parameters, but these are
source observations rather than measured useful controls. The meaningful open issue for
an endpoint-tree investigation is whether a variable decrement and a child count derived
from current remaining depth belong to its traversal semantics. The existing audit
already calls for comparing exactly those policies.

### `2018/Generativos/arbolito3#1`: probabilistic binary spray with carried state

This is a field of many upward sprays. At each nonterminal node the routine emits a
line, shrinks it, then independently admits up to two angular children with probability
0.8. Each admitted child receives a drifting colour index; a terminal node emits a small
tip ellipse. Thus its artist-facing result depends on traversal, conditional random draw
order, and attributes passed through the branch, even though its underlying topology is
still endpoint child expansion.

The note measures several relevant composition controls: reducing recursion depth from
14 to 8 had a large change (shorter, coarser strokes); increasing angle error from 0.09
to 0.3 had a moderate change; count and colour-field detail alter the forest around the
individual tree. Branch probability itself was not varied in this particular note. Its
ledger entry is already a provisional merge, so this is corroborating retrieval rather
than a request to reopen that state.

### `2020/generative/05_08/moje#0`: recursive tapered branch marks

Within each rotated shard, `rama`/`ramab` computes a new endpoint, emits a tapering quad
from the parent point to that endpoint, marks both joints with black dots, and recursively
spawns one to four angular children while shrinking width and length. Colour is indexed
by recursion depth. This is geometry recursion coupled to a concrete ordered mark
sequence; it is not the mutable line-pool process in 2019 `brotes`.

The available experiments alter the surrounding shard and speck layers, not branch
depth, split count, taper, or angle spread. They therefore support the importance of the
composition but give no measured sensitivity evidence for a branch parameter. The ledger
explicitly records that topology and taper geometry must be reconciled separately.

### `2020/generative/05_08/shatree#0`: interior-attached tapered tree with leaf assets

This P3D composition has one central tree. A recursive call emits a tapered textured
quad, chooses two or three children, and attaches them at a lerped point with angle
jitter; a terminal call places three brush images around its node. This supplies a second
checked-in occurrence of interior attachment, while the terminal foliage requires image
resources and renderer state rather than only emitted topology.

The tree-depth change from 7 to 10 was subtle (5.5% changed pixels), and the child-count
change from 2..4 to 3..6 was subtle (10.8%). Increasing leaf size had no visible change
in the recorded experiment. Those measurements limit what can be claimed about useful
controls; the large dot-fog loop and other background controls are separate from the
tree computation.

## Existing toolkit coverage

The current core classes cover colour sampling, gradient noise, grids, ordered gradient
paths, circle placement, quadrant partition, and triangle sampling. The drawing adapters
consume already-normalized commands. None implements recursive endpoint expansion,
symbolic grammar rewriting, turtle state/traversal, a mutable branch pool, probabilistic
child scheduling, taper geometry, or asset-bearing terminal marks. `GradientPath2D` is a
single ordered field-driven path, so it does not discharge the branch-topology burden.

This is a scope observation, not a request to add any of those facilities. The two direct
term hits noted above also mean the present corpus evidence does not independently require
a symbolic-grammar or turtle capability beyond the existing known candidates.

## Remaining factual ambiguities

- The notes establish recursive calls and broad parameter roles, but not a portable RNG
  draw schedule, child visitation order, numeric convention, or output ownership model.
- `moje` and `shatree` mix topology with renderer-specific taper, texture, joint, and
  foliage work. The notes do not establish where a future topology/mark boundary should
  lie.
- No selected neighbour contributes measured branch-only evidence for every candidate
  parameter. The recorded measurements above should not be converted into defaults or
  encouraged ranges.
