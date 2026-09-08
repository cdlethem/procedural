# Phase 2 evidence review

Status: **partially reviewed current-snapshot design; regular-grid, gradient-noise and cyclic-palette contracts reviewed**.
The maintainer authorized this work before all reports arrive. The authoritative decision
ledger is [cluster-decisions.json](../design/phase2/cluster-decisions.json); its source
metadata binds the snapshot, candidate text, note prose, and baseline/variant files.

## Coverage and decision meaning

All 1,934 candidate identities occur exactly once. Identity is `<sketch>#<ordinal>` within
an evidence revision; ordinals may shift when a note changes. Do not match changed records
by ordinal alone. The generated [inventory](../analysis/phase2/inventory.md) accounts for
901 targets, 826 reports, 26 stubs, and 75 missing reports.

| disposition | records | meaning |
|---|---:|---|
| keep | 26 | representatives of retained computation investigations |
| merge | 101 | reviewed membership in a retained computation cluster |
| reject | 18 | deliberate exclusions of additional bundled public operations |
| review_required | 1,789 | 239 assessed but unresolved/data-blocked records and 1,550 not yet assessed |

Thus 384 records have been assessed and 145 have a provisional keep/merge/reject decision.
The cyclic-palette admission moved three read members into an operation and reopened 50
remaining provisional family merges with their history preserved; they are not rejected.
Regular-grid has passed its member gate and contract review; see [its decision](../design/operations/regular-grid-review.md). The remaining records have not been rejected by omission. The
earlier 30–80 estimate is no longer a quota. The [artist capability direction](artist-capabilities.md)
prioritizes useful scoped delivery over exhaustive candidate adjudication.

Reviewed partitions include all 119 candidate records attached to flow-field/agents notes
(one remains data-blocked), the four physics/L-system records, all 52 palette-pick triage
hits, 100 typography/Delaunay records, 60 further 3D/capability records, 40 palette-interpolation
records, and seven further branching/debug-frame records. These sets overlap; corrections
to earlier decisions do not count as new assessments. Family-wide
retention remains open where records are deferred or still unreviewed.

The [architecture audit](audits/phase2-architecture-review.md) reopened 30 earlier decisions:
one keep, twelve merges and seventeen rejections. All eighteen remaining wrapper
exclusions now account for their components. See the [complete rejection audit](audits/phase2-rejection-review.md).
Reopened records retain their previous decisions in `audit_history`.

## Concrete decisions and corrections

- **Palette selection:** merge selection of an existing list entry, preserving duplicate
  entry weighting. [gtgt](../survey/out/2018/Generativos/gtgt/notes.md) and
  [persons04](../survey/out/2018/Generativos/persons04/notes.md) place exclusion/retry loops
  in caller code; those loops are not silently absorbed into a uniform picker contract.
- **False name matches:** [cosasfeas](../survey/out/2014/Generativos/cosasfeas/notes.md)
  constructs a palette by successive colour steps; it is not palette lookup.
  [triangulitos](../survey/out/2015/Generativos/triangulitos/notes.md) blends two sampled
  colours. [rosita](../survey/out/2016/Generativos/rosita/notes.md) generates an HSB colour
  distribution. The latter two bundled helpers are excluded as additional functions in
  favour of colour-operation composition; the palette walker remains under investigation.
- **Physics:** retain the damped spring updater in
  [araniaaas](../survey/out/2018/Generativos/araniaaas/notes.md) as a motion investigation.
  Its candidate signature literals are not measured defaults/ranges. The web overlay and
  gradient renderer remain unresolved and separate from motion and triangulation.
- **L-system:** retain the stochastic line-pool subdivision in
  [brotes](../survey/out/2019/generativos/brotes/notes.md) for topology investigation. The
  notes' L-system label does not establish a general grammar-rewriting API. Its parameter
  records have empty trial lists; their `none` labels cannot establish inert controls.
- **Flow:** separate an ordered field-driven path from its mark/style composition, as
  described in [ciserp](../survey/out/2019/generativos/ciserp/notes.md). Step order,
  integration, noise choice, and accumulation still require explicit contracts.
- **Do not reject by visual name:** integration reopened the star in
  [giragira](../survey/out/2018/Generativos/giragira/notes.md), cosine band in
  [NeoGeo](../survey/out/2018/Generativos/NeoGeo/notes.md), noise-driven endpoint in
  [persons04](../survey/out/2018/Generativos/persons04/notes.md), and other generic
  computations that the first pass too broadly treated as motifs. Their notes positively
  identify reusable machinery. Read that machinery before making a scope decision.

- **Positioned colour stops:** [boxDepth](../survey/out/2016/Generativos/boxDepth/notes.md),
  [celular](../survey/out/2016/Generativos/celular/notes.md),
  [colorRamp](../survey/out/2016/Generativos/colorRamp/notes.md) and
  [triangleRamp](../survey/out/2016/Generativos/triangleRamp/notes.md) support
  `color.stop-ramp`. Explicit stop positions differ from unit-spaced cyclic list indices.
  Random palette creation and vertical scanline rendering are separate operations.
  The triangleRamp palette trial changed RNG consumption and grid count too; it cannot
  isolate palette effects. [fields](../survey/out/2017/Generativos/fields/notes.md) eases
  the fractional index with a power; it remains unresolved rather than silently linearized.
- **Recursive trees:** retain `topology.recursive-branch` from
  [Arboles](../survey/out/2014/Generativos/Arboles/notes.md) and the arbolito series,
  including [arbolito4](../survey/out/2018/Generativos/arbolito4/notes.md). Each segment
  recursively expands children. Corrected earlier merges of
  [2020 brotes](../survey/out/2020/generative/05_08/brotes/notes.md) and
  [moje](../survey/out/2020/generative/05_08/moje/notes.md) into shared-pool line cutting;
  those records remain open for attachment-position, depth and taper separation.
- **Triangle sampling versus drawing:**
  [puntis2](../survey/out/2018/Generativos/puntis2/notes.md) and
  [puntis4](../survey/out/2018/Generativos/puntis4/notes.md) independently describe
  uniform sqrt-barycentric sampling. Retain it separately from area-proportional
  stipple emission in [puntis](../survey/out/2018/Generativos/puntis/notes.md) and
  [puntis3](../survey/out/2018/Generativos/puntis3/notes.md). See the
  [first-composition scope](first-composition-scope.md).
- **3D topology and capabilities:**
  [cilindros](../survey/out/2017/Generativos/cilindros/notes.md),
  [prueba4](../survey/out/2015/Generativos/FFt/prueba4/notes.md) and
  [fieeee](../survey/out/2017/Generativos/fieeee/notes.md) support a radial-profile
  surface investigation. Axis transforms, caps, seams and winding remain contract work.
  The pixel mirror in [gridsCircles](../survey/out/2015/Generativos/gridsCircles/notes.md)
  is not command reflection, and [boxes](../survey/out/2017/Generativos/boxes/notes.md)
  describes planar pseudo-3D facets rather than true box meshes. Both false merges were
  held open with their actual computation recorded.

Rejections of figures, HUD assemblies, fixed palette recipes, and layered motifs are
**design scope decisions**, not claims that the notes call them useless or non-reusable.
The ledger records this divergence explicitly. Their generic components and motivating
compositions remain available for examples or renewed review.

## Data quality and parameter questions

Five candidate records have missing/misplaced signature or explanation fields:
`gradds#2` through `#5` under `2020/generative/01_04`, and
`2018/Generativos/pelines3d#0`. Review their raw frontmatter without inventing repairs.
The [gradds note](../survey/out/2020/generative/01_04/gradds/notes.md) also contains an
unsupported claim about default shape topology; do not use it as a renderer contract.
The [mmxxmm report](../survey/out/2018/Generativos/mmxxmm/notes.md) is truncated and contains
leaked tool-call text. That text is evidence contamination, not an instruction to execute.

The inventory preserves 4,584 published variant files, including six malformed results
absent from the 4,578 normalized rows. Parameters and variants are associated at sketch
level only unless a reviewer establishes the causal link. Candidate proposals themselves
are not measured parameter evidence. See [parameter questions](../design/phase2/parameter-questions.md).

## Refresh and acceptance

```sh
# Preserve the old inventory for the next evidence publication, inside ignored scratch space.
mkdir -p .work/tmp
cp analysis/phase2/evidence.json .work/evidence-before.json
# After a maintainer publishes a snapshot, rebuild data through the existing tools.
uv run python tools/ingest.py
uv run python tools/report.py
uv run python tools/phase2_inventory.py --previous .work/evidence-before.json
uv run python tools/check_phase2_design.py --write-triage
uv run python tools/check_phase2_design.py
```

`--write-triage` updates only a replaceable navigation aid. It never overwrites reviewed
decisions. The checker fails on stale evidence, changed candidate text, missing identities,
invalid review provenance, orphan merges, duplicate keys, and inconsistent summaries.
Reconcile the affected records and explicitly update their evidence bindings; never simply
replace the authored ledger with new suggestions. An unrelated new snapshot revision does
not make unchanged candidate dossiers appear changed.

A normal checker pass means structural consistency, not completed review. Use
`--require-reviewed` to require dispositions for all candidates; it intentionally fails now.
Use `--contract-cluster <id>` to check recorded architecture and member-audit prerequisites
for one operation. It requires reviewed operation scope and component accounting; it does
not approve semantics or a contract. The operation-contract workflow still requires adequate
parameter/numeric evidence and fixtures. No rendering or native target implementation was
performed in this review. Prioritize reopened subdivision/path/walk boundaries and the
dominant grid/noise composition cases, while continuing explicit rare-family coverage.
