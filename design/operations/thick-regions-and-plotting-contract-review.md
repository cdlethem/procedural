# Thick region and plotting contract review

Root froze the five contracts before implementation after Terra proposals and Sol's independent
geometry review. Review corrected underestimated bevel output counts (use4N+4), omitted
exclusion and repeated-query work, ambiguous witness targets, miter fallback and SVG byte rules.

The decisive geometry correction is inner-corner trimming: beveling both sides of a corner
creates an inner loop. Inner intersections must lie on both finite adjoining side sections;
otherwise the candidate rejects. Only outer corners use the selected bevel/miter rule.
Clearance selects witnesses and compares thresholds with exact squared rational distances.
A rounded closest-point display norm is not advertised as correctly rounded exact distance.

Root additionally corrected the parallel-rectangle golden tie to edge0/edge0 (earliest
endpoint pair), fixed both side arrays to forward traversal, and kept query witnesses indexed
by supplied ring/edge order. Constructed visible rings alone canonicalize winding/start.
Supplemental analytical cases remain independent tests alongside complete exact JSON goldens.
No implementation result, target support or original artist recreation is accepted here.

Root implementation clarification (17 September): hatching constructs checked binary64 source endpoints from the projected tangent extrema, then clips that finite source with exact dyadic/rational predicates. It does not substitute an ideal infinite line.
