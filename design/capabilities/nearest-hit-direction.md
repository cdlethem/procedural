# Nearest-hit strokes — root boundary decision

Investigation after Java0.34; not an admitted operation or completed source recreation.
Root read plasma007's pinned source lines90–150 and249–275 and its checked-in note;
Terra independently audited those same boundaries. Pinned provenance is recorded in
vector-clipping-source-review.json. No upstream implementation is copied into the study.

## Capability worth investigating

Stop a directed finite stroke at the first contact with supplied obstacle segments, retaining
which obstacle it met and the progress along the original stroke. This would support line
webs, endpoint decoration and connecting generated marks to a boundary without rewriting
intersection arithmetic. It differs from SegmentClip2D, which keeps all interior intervals
of a stroke against a simple polygon.

Prefer separating supplied queries from supplied obstacles. The public kernel should not
silently generate rays, drop misses, extend lines by the canvas diagonal or prescribe two
passes. Root regards those choices as the source composition's orchestration. Do not add a
large collection of source-specific mode flags to reproduce one example. Whether an ordered
batch convenience earns its cost remains to demonstrate with actual drawing code.

## Decisive evidence

The note's candidate describes nearest intersections with any other line; actual source
only tests later list entries. First pass drops misses. Second pass extends each surviving
query beyond its first endpoint by a diagonal, then tests later first-pass survivors. The
source's strict x/y extent check rejects axis-aligned intersections accidentally; parallel
and collinear pairs return null. Those are not reusable numerical semantics to inherit.

The independently authored tools/diagnostics/clipping/nearest_hit_study.py verifies exact
rational witnesses. Two diagonal crossing lines both hit under an all-other query but only
the first survives a later-only/drop-miss pass. This distinction does not rely on the source
axis-alignment bug. Unsorted obstacles, tied hits, far-endpoint contact and origin contact
also distinguish the decisions a reusable query must make.

Measured four-to-eight-ray changes support visible web-density control in plasma007. They
do not establish intersection epsilon, endpoint policy, numeric limits or general count
ranges. The source-specific fan/palette/disc choices remain outside the query computation.

## Resolve next, before contract or production implementation

1. Origin contact: ignoring t=0 helps shared-origin rays, but collinear overlap beginning at
   the origin then has no least strictly positive contact. Do not invent an epsilon or call
   skipping overlaps exact nearest-contact behavior. Compare explicit contact-at-origin,
   overlap classification and strict proper-crossing semantics before choosing the name.
2. Zero-length query/obstacle treatment and endpoint ownership must match that choice.
   Return misses explicitly; drawing or discarding them is a composition choice.
3. Select exact predicate/output rounding and representation-collapse behavior by reusing
   the accepted clipper's rational strategy where appropriate. Avoid exposing private
   arithmetic classes or copying an entire second implementation without a reuse review.
4. Retain query and obstacle ordinals and deterministic equal-hit tie breaking. Decide
   finite work/output bounds before delegating a public implementation.
5. One private native drawing must show a ray-web edit and a different obstacle-based use,
   such as connectors to supplied partition edges. That second use is root's design proposal,
   not additional corpus evidence. Review clarity and repeated glue before admission.

This is the next bounded capability investigation. It does not replace the five completion
requirements or declare ray-web source coverage. Java0.34 remains the accepted baseline;
public-method documentation and final requirement reconciliation also remain open.

## Closed-contact study decision

Root reviewed evidence/parameter-experiments/nearest-contact/root-review.json:13exact
witnesses and two native views of precomputed data. Choose inclusive first contact on a
closed directed query: report origin contact, endpoint contact and collinear overlap onset.
A point query touching an obstacle reports t=0; misses stay explicit. Stable lowest supplied
obstacle ordinal resolves equal first-contact progress. Same-origin ray groups are excluded
by the composition when appropriate, not by an invisible epsilon or hidden filter.

The private views demonstrate separate ray-web and connector uses with visible edits. This
justifies proceeding to a contract, not accepting production Java code. Output rounding,
representation collapse, finite work limits and efficient retained obstacle reuse remain
to freeze. Earlier strict-positive study is preserved as a rejected boundary alternative.
