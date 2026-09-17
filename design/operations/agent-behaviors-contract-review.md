# Agent behavior contract review

Root reviewed and froze contact history, integrated grid sensing and graph-supplied flock
steering before implementation, after Sol's independent review of the Terra drafts.
Contact history accepts saved missing counts beyond a newly shortened linger; it drops stale
entries before increment. Stable IDs survive reorder; reused IDs retain their identity.
The sensor owns probe geometry and bilinear field sampling so callers do not duplicate them.
Origin is first-cell center, turns increase from +x toward +y, signed gain controls inversion,
and modulo handles negative subnormals and rounded upper seams. Flock terms use separate
specified degrees and canonical traversal; zero weights do not skip arithmetic overflow.

Root completed the nested JSON schemas. Exact shared fixtures are separate from toleranced
trigonometric analytical tests; both precede implementation. Sol corrected the negative-gain
oracle to a quarter-turn response so opposite signs no longer normalize to the same heading.
Root accepts the stated boundaries and authored laws; no external artist algorithm or target
support is accepted by this design review. Native and installed-package evidence follow.
