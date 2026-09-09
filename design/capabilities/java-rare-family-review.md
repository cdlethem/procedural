# Java rare-family disposition review

Root architectural review against Java0.31.1, pushed commit
2b3f3fa304328c434028a90913212feacad0ff5b. This is a bounded evidence review for
completion requirement 2, not completion acceptance or a corpus-wide absence claim.

## Branching and grammar rewriting

Artist entry points are BranchMarks for endpoint growth and CutBranchMarks for revising
a pool of strokes. Keep these separate: attachment and mutation are different algorithms.

Root read `survey/out/2018/Generativos/arbolito4/notes.md` in full. Candidate #0 calls
its recursive helper an L-system, but the walkthrough specifies direct recursive
segments, shared shrinking length, and three probabilistic child opportunities. It does
not describe an alphabet, production rules, string rewriting, or a turtle interpreter.
The accepted `seeded-endpoint-branches.json` contract explicitly includes this candidate
and independently specifies generation rules with ordered child slots. Its breadth-first
stream and scale sampling deliberately differ from the source's recursion and nested
random shrink distribution. The family capability is supported; exact recreation of
arbolito4 is not established by that fact.

Root also read `survey/out/2019/generativos/brotes/notes.md` in full. Candidate #0 and
the walkthrough describe selection and cutting of an existing line pool, with different
first/repeated cut behavior. Calling this a stochastic L-system in the report does not
establish symbolic rewriting. LinePool2D/CutBranchMarks is the appropriate entry point;
its accepted contract, rather than the report's proposed signature, defines its scope.

Decision: retain the two implemented growth algorithms. Do not add a general grammar
engine to satisfy the l-system tag. Symbolic rewriting remains explicitly unsupported;
reconsider when a concrete artwork requires production rules or interpretation that the
existing retained geometry cannot express. This is an architectural exclusion from this
Java surface, not a finding that the entire corpus lacks such an artwork.

Search provenance: root searched checked-in notes for `l-system`, `lindenmayer`,
`grammar rewriting`, `rewrite rules`, and `production rules`; these two reports were
the returned files. Vocabulary search can miss differently described algorithms.

## Typography

Root read the algorithm walkthroughs in `survey/out/2018/Generativos/numbers/notes.md`
and `survey/out/2016/Generativos/textureGridText/notes.md`. The former draws digits along
noise-driven paths; the latter repeats glyphs in a grid with cardinal-direction echoes.
Both reports record missing original fonts and fallback rendering. Their defining glyph
placement behavior does not require extracting glyph contours or shaping complex text.

Decision: GlyphMarks remains the artist entry point for font-backed repeated marks;
layout/path values and ordinary native text drawing remain independently replaceable.
Do not claim that GlyphMarks recreates the complete textureGridText paper filter or the
original fonts. Font outline extraction, kerning/layout engines, and complex shaping
remain unsupported extensions, not hidden responsibilities of the placement operation.
A concrete outline-based artwork would require its own capability/asset boundary review.

A tighter checked-in-note search for glyph/font outlines, textToPoints, Geomerative,
RFont, kerning, and text shaping returned no matches. This is bounded lexical evidence,
not proof that every sketch or the missing reports lack those capabilities.

## Voronoi, intersections, and remaining geometry

Luna screened nearest-site terminology and read six notes; root independently read
`survey/out/2018/Generativos/plasma007/notes.md` and
`survey/out/2017/Generativos/fields/notes.md` in full. The worker's other summaries are
leads, not new root-accepted reproduction evidence.

plasma007 candidate #2 specifies nearest-intersection trimming of a supplied line set.
Its walkthrough describes two passes, including re-extension between passes. That is a
ray-web construction, not a nearest-site partition. The measured four-to-eight-ray edit
changes web density, but does not establish intersection tolerance, endpoint inclusion,
pass ordering, or a useful numeric range for a trim operation. Those need source review.

fields candidate #0 describes displacement of each grid corner by the same scalar noise
value in both coordinates, followed by quad decoration. It does not change grid topology
into nearest-site cells. Existing grid and noise values can express the displacement;
a new Voronoi operation would not remove the actual burden of this composition. A native
composition would still be needed before counting this original as practical/recreated.

Decision: do not admit nearest-site Voronoi polygons from this evidence. Keep them explicitly
unsupported. Do not infer their absence across the entire source corpus. Continue exposing
Delaunay triangles by their own name and keep disc projection's narrower claim.

Concrete new lead: investigate reusable segment intersection/clipping before declaring the
geometry surface finished. Trimming a ray web and clipping hatch strokes inside a polygon
could remove nontrivial algorithmic work and complement the user's partition composition
request. Existing raster masks only control visibility; they cannot return clipped vector
segments for further drawing or transformation. This is an investigation, not API admission:
read source intersection arithmetic and a second motivating note, decide endpoint/collinear
and ordering semantics, and assess a complete editable example before freezing a contract.
Do not make a universal polygon callback or geometry engine just to satisfy this lead.

Mesh profile and annular topology already have separate accepted entry points. Arbitrary
solid modeling remains outside their contracts. Final user-journey and performance-summary
reconciliation remain open under the unchanged five completion requirements.
