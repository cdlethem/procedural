# Live output transfer supplement

Sol's final review found that the existing completed-output case released the canvas
before checking later adapter misuse. That proves idempotent cleanup but cannot prove
misuse preserves a still-live transferred output. Adapter code appears correct; add a
specific native proof instead of repeating the complete passing suite.

Register one additional 32×24 background surface, once, before execution. Complete a
frame, assert its live backing dimensions and zero removal calls, invoke both end and
abort on the completed adapter, and assert INVALID_STATE plus unchanged live dimensions,
pixels and zero removals. Only then release twice, asserting backing size zero and one
removal. This supplements the 18 existing lifecycle cases; no CP1 or pixel repeats.
