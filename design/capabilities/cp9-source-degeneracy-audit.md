# CP9 triangulator source-degeneracy audit

**Purpose:** read the pinned local triangulator tabs behind the three decisive
triangulation candidates. This is source provenance and degeneracy evidence only. It
does not admit an operation, select an independent algorithm, define a public signature,
or establish target support.

The prior [triangulation evidence audit](triangulation-evidence-audit.md) establishes
that point set → Delaunay faces is a recurring computational burden. This audit narrows
the question to behavior that cannot responsibly be inherited from the sketch tabs.

## Corpus identity and source revision

| Candidate | Note SHA-256 | Pinned source and SHA-256 | Immediate use |
| --- | --- | --- | --- |
| `2017/Generativos/triangularGradient#2` | `a98eaf0e7d134069c543f85c5cb5caf2f22bb0b14246f6d305704b6c9db29dd2` | `2017/Generativos/triangularGradient/Triangulatorr.pde` — `bc82fb5625ea6a557b8da954fbba678bb8248e4b8c63b36163b36eda2f164369`; caller `triangularGradient.pde` — `adaf1beb0dd283282432d3e9f09d7b4a3751fd90b15c7fea051c3ae71179e419` | Derives a circumcentre and annulus for every returned face. |
| `2018/Generativos/datata#0` | `1bdd530a6dad3d7b0c85b721bc97c036ad112585100cbede1b1095066807da13` | `2018/Generativos/datata/triangulator.pde` — `fc5bcff9b0b55c1f096ff689d5b068e1c0f507c5de9391dc73938d91b5055386`; caller `datata.pde` — `f6b306af447cee7aa530a25d325fc76b2acd56f2b9f16761bd4d01ec97c88661` | Fills only faces whose first stored vertex is within the sampled disc. |
| `2018/Generativos/naifSelva#0` | `60d5752f1e72daa0efd925ad033d61ff6b83ceab4d929a5ce8c47d8da2ab38d2` | `2018/Generativos/naifSelva/Triangulator.pde` — `4fe3abf23459e67a57294aa20bc8abcd879874bd04ec01d05e6debbde24e7b61`; caller `naifSelva.pde` — `0d35c2618574cc254bb35a2cc52ccad1e76a32a04215246befd54940b2203787` | Recomputes after every added random or mouse point, then immediately renders shaded star shards. |

All source was read with `git show` from local checkout
`.work/investigations/cp3-source/repo` at
`69bdd8513e4482a5e6018e36887d4bc208660eb5`. The upstream `LICENSE` at that revision is
MIT, SHA-256 `98abe149fa5183cb8edbcaac0a4bc3a7d01218f63e4fee5d779c05ecbb119dc4`.
The tabs themselves say they are a “custom refactoring” of Florian Jenett's Triangulate
library (lines 2–5) and attribute Paul Bourke's `triangulate.c` (lines 136–140). They do
not contain a separate license text or versioned dependency record for either antecedent.
That attribution is provenance, not a license conclusion for copied implementation.

`datata` differs from `triangularGradient` only by an unused local variable and trailing
newline. `naifSelva` is the same algorithm with formatting changes. Therefore the three
sources provide repeated use of one local port, not three independent implementations.

## What the port actually does

Each tab exposes two mutable forms: an `ArrayList<PVector>` plus caller-supplied
`ArrayList<Triangle>` overload, and a `PVector[]` overload returning a new
`ArrayList<Triangle>` (for example, `Triangulatorr.pde:178–268` and `:270–365`). The
array form is what all three sketch callers use: `triangularGradient.pde:47–48`,
`datata.pde:47–48`, and `naifSelva.pde:78–82`.

The common mechanism is an incremental supertriangle construction:

1. Sort the *caller’s* array only by `x` (`Triangulatorr.pde:146–153, 276–281`).
2. Derive a supertriangle from the floating-point bounding box (`:283–316`).
3. For each sorted point, remove every face whose circumcircle test returns true,
   cancel only opposite-oriented edges that have the same `PVector` identities, and
   append a face for every surviving boundary edge (`:324–358`).
4. Remove faces sharing an object identity with a supertriangle vertex (`:361–362`).

The comments call returned faces clockwise (`:178–183`), but the source does not check
or normalize orientation. Nor does it expose original site indices: `Triangle` stores
three mutable `PVector` references (`:109–128`).

## Degeneracy and order observations

| Condition | Source behavior observed | Why this is not an inheritable contract |
| --- | --- | --- |
| Duplicate coordinate values | No duplicate-coordinate test or canonicalization exists. Edge cancellation requires opposite endpoint **object identity** (`==`, `:252–257` / `:347–352`), not equal coordinates. Two separately allocated equal `PVector`s therefore take a different path from repeated use of one `PVector` object. | A coordinate API cannot expose Java reference identity. It needs an explicit duplicate-site policy and fixtures, including coincident-but-distinct input records. |
| Equal `x` | The comparator returns zero whenever `x` is equal and never compares `y` (`:146–153`). The incremental insertion order is therefore supplied order within an equal-`x` group as mediated by the Java collection sort used by this implementation, rather than a geometric total order. | No source-level secondary key, input-index rule, or face-order statement makes that an intentional tie policy. A future result must state its own site-index/order rule. |
| Collinear or near-horizontal triples | `circumCircle` returns false only when both consecutive `y` differences are below Processing `EPSILON` (`:25–29`). It otherwise computes slope divisions (`:31–52`). There is no input validation, collinear classification, or documented empty-result rule. | Exact collinearity, near-collinearity, and float-scale behavior are left to incidental control flow. The caller notes contain no tested degeneracy case. |
| Cocircular sites | The in-circle predicate uses `drsqr <= rsqr` (`:54–64`): a point exactly on the circle is treated as inside and removes the old face. Completion uses a separate strict `circle.x + circle.z < point.x` shortcut (`:240–243` / `:335–338`) without tolerance. | This is one float32 arithmetic and insertion-order tie break, not evidence that a public Delaunay result should use inclusive containment, this exact arithmetic, or this face diagonal. |
| Supertriangle and extreme values | Bounds, midpoint, and twice-maximum span are calculated in `float` with no finite/overflow check (`:283–315`). The code indexes `vertices[0]` before validating a count. | Empty input, non-finite coordinates, overflowed bounds, and too-small sets have no documented error or result behavior. |
| Face order and representation | Faces are appended while traversing a mutable list backwards, then boundary edges in their accumulated order (`:330–358`). Output face vertices retain aliases to the input `PVector`s; later caller mutation changes what a returned triangle denotes. | The sketch consumes faces immediately. It has no retained-result, ownership, detachment, index, or stable enumeration requirement. |

The supertriangle cleanup also relies on identity comparison in `sharedVertex`
(`Triangulatorr.pde:171–175, 361–362`). Its first clause repeats `t1.p1 == t2.p2`
and does not test `t1.p1 == t2.p1`; this reinforces that the port should be evidence of
artist use, not an implementation whose degenerate output can be adopted unexamined.

## Call-site consequences

The three sketches do not test any of those conditions:

- `triangularGradient` creates fresh randomly located sites (`triangularGradient.pde:40–48`) and
  uses the output only for circumcircle-derived rings (`:52–63`). Its measured `cc` and
  margin changes alter the point cloud and ring composition, not duplicate, collinear, or
  cocircular behavior.
- `datata` creates fresh random disc sites (`datata.pde:34–48`) and filters a returned
  face using only `t.p1` (`:50–64`), so a face-order or vertex-order change can alter
  rendering even for the same geometric triangulation. The note's size/density experiments
  confound topology with point count; they establish no edge-boundary or degeneracy rule.
- `naifSelva` passes an ever-growing fresh array to the mutating array overload after each
  point (`naifSelva.pde:78–94`). The reported first-frame cost is evidence against that
  schedule as a reusable batch interface, while neither its random scatter nor mouse path
  creates an intentional duplicate/cocircular test.

## Boundary for a future independent operation

The evidence supports preserving the *problem*—planar sites to triangular faces—while
requiring an independent specification for at least:

- finite input and minimum-site behavior;
- duplicate, collinear, cocircular, and equal-coordinate ordering rules;
- result orientation, face enumeration, and site-index mapping;
- ownership, detachment, and input-mutation behavior;
- numeric predicate/arithmetic policy and failure behavior; and
- whether the result is only Delaunay faces or additionally contains clipping, Voronoi
  construction, rendering, styling, or point generation.

No source here justifies inheriting a `PVector`-based mutable API, the local sort mutation,
the inclusive circumcircle comparison, an `EPSILON` threshold, or the library tab's
implementation. An independent implementation must preserve the upstream MIT notice and
the embedded Jenett/Bourke provenance if it copies material; a clean-room specification and
new fixtures are required before any portability or reproduction claim.
