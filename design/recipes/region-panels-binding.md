# Region panels recipe binding

Status: prototype composition using the accepted `layout.seeded-quadrant-partition-2d`
operation; not a new public operation or an original-sketch recreation.

`QuadrantPartition2D.generate(input)` constructs the retained immutable partition and
`toValues()` exposes bounds, leaf identities and replacement count through the existing
catalog schemas. Painting remains explicit recipe composition: fractional insets and cyclic
palette queries produce convex quads. The default48 replacements and inset0.08 are example
choices, not measured artistic recommendations.

## Resource and error semantics

For n replacements, leaf count is L=1+3n. Initial backing capacity is min(L,16); positive
replacement counts temporarily require L+1 slots because the core appends four children
before deleting the selected parent. Reproduce the existing doubling/minimum16 growth schedule
until that peak fits. Sum5*capacity+5 units per backing allocation generation, then reserve
5L+21 more for final trimming and fixed state. Check the peak array capacity before calling
the core. All arithmetic is in long; the catalog maximum n=178956970 keeps these expressions
below signed-long limits.

Reserve1+10n+5*(4n+3n(n-1)/2)+2*reservedUnits work units. This conservatively covers ordered
shifts, selection and backing allocation/copies; it is not a physical memory or elapsed-time
measurement. Materialized values cost6L+4 units and6L+5 work units, with length-L arrays and
length4 bounds. Native INVALID_RECTANGLE and PARTITION_ARITHMETIC_INVALID remain distinct;
the latter retains replacementIndex and stage. The one-entry Session uses existing
conservative retained reservations and invalidation behavior.

## Validation and native preview criteria

Compare all commands with `tests/native/RegionRecipeComposition.java`, which constructs the
accepted core directly. Cases: default, inset0.22, alternate palette, seed43,64 replacements,
and0 replacements (one root panel). Style edits reuse geometry; seed/count edits rebuild.
Check temporary capacity rejection, work/value rejection before a native call, invalid root
rectangle and an unrepresentable first midpoint.

After command comparisons pass, render standalone default and inset0.22/alternate-palette
exports under the shared machine lock. Root inspects145 panels arranged in the same retained
partition, with visibly larger gaps and changed colors in the edit. This is a technique-level
transfer with command equality as the geometry oracle; there is no corpus pixel baseline.
