# I2 port batch 01: circle placement and ordered filtering

Root begins the previously deferred port batch after accepted Java0.15. CP12 remains
explicitly unsupported/deferred; see capabilities/cp12-post-java15-decision.md. No new Java
operation is needed for this batch. The full roadmap, including all deferred targets,
recipes/exporters and MCP/web, remains intact.

First bounded deliverable: JavaScript ports of sampling.seeded-circle-placement-2d and
sampling.ordered-circle-filter-2d, then the PlacementMarks p5 workflow. These two operations
share one result and one ordered acceptance kernel. Their contracts already specify JS
names, passive carriers, accessor transport, RNG and binary64 error order. No transcendental
math is required inside this core, making this a useful first port before the later exact
line-pool elementary-math requirement.

Terra implements both operations together against the frozen catalogs and existing fixtures,
with first-pass debugging and focused host access/ownership checks. Own the new JavaScript
module and its fixture/native runner only. Root owns index exports, capability review,
native workflow acceptance, attestations and package integration. No contract or fixture
changes without root review. Do not copy Java error behavior in place of reading the contract.

Stop core work when every existing shared case is consumed directly and exact outputs/errors
match, passive carrier and atomic output behavior pass, and code is ready for root review.
Then adapt the existing p5 browser/event/render harness for the actual PlacementMarks controls;
no new framework and no mock-only target claim. Serialize native renders under root ownership.
Only after native/visual acceptance add the target attestation and package delivery. Follow
with Python and Android slices against the same frozen semantics; do not represent this first
JavaScript slice as completing the entire I2 port batch.
