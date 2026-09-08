# Complete composition drafts

These documents are schema-valid architecture walkthroughs, not accepted executable recipes.
Their top-level status remains `draft`. No evaluator, export or native result is supplied.

`field-marks.draft.json` translates the accepted FieldMarks spatial attributes and raw
MarkCommands output, including palette, maximum-length and segment/quad choices. It builds
all grid positions before sampling their attributes; the original interleaves grid access
and sampling. Both operations are immutable and independent, so no RNG stream is shared,
but exact command comparison is still required before claiming equivalent output.
Geometry and styling are separate retain/frame stages. No cache invalidation is implemented.

`path-marks.draft.json` translates PathMarkComposition's raw stream: 24 ordered starts,
retained paths, exact remainder-based palette phase, every-step traces or every-fourth-step
perpendicular marks. Root factored repeated endpoint/trigonometric expressions into local
bindings and preserved lazy branches. It deliberately omits the example's fixed-canvas
culling; no general clipping capability is implied. Native acceptance must resolve drawing
profile limits and assess that omission, after full unculled command comparison.

Root inspected the original project-owned Java compositions and ran schema plus lexical
reference/shadow checks on both drafts. Those checks establish neither runtime types,
resource accounting nor numerical equivalence. Native sine/cosine and basic arithmetic
order remain material to the required Java comparison and later target fixtures.

The tagged JSON is verbose interchange data. The artist entry point remains the editable
starters; future recipe controls and planning may construct this representation. Do not
present hand-authoring these trees as a tested twenty-minute introduction.

Next: freeze type/error/resource accounting and catalog-owned execution bindings; create
the required recipe execution skill before accepting persisted recipes; implement one
validator/evaluator and compare both complete command streams and meaningful edits.
All later operations, assets, animation, four-target exports and MCP/web remain unfinished.
