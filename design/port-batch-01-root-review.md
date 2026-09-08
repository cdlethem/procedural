# Placement ports: root review in progress

Scope: worker commits 99110da5,688670b8,e04c165e, reviewed from the separate
`.work/porting/checkout`. This is a partial review, not merge approval or a shared
support attestation. Android work is still uncommitted in that checkout.

## Evidence and native results

Root verified every input hash in the p5.js and py5 PlacementMarks evidence,
including all seven py5 environment entries resolved through the recorded environment.
All ten PNG hashes for each target match the retained artifacts. Root inspected
baseline, diamond and radial images on each target. Both show the same seeded
placement arrangement and motif substitution; radial transfer is visibly a different
proposal composition. Browser and JAVA2D edge rasterization differ. No cross-host
pixel identity or original-sketch recreation is claimed.

The native reports exercise controls, retained identity on style edits, rebuilds on
placement edits, extended accepted prefix, radial transfer and cached save. This
review relies on those source-bound runs; it does not claim a new native execution.

## Core review decisions

Luna inspected Python RNG, validation, checked predicate arithmetic and accessors;
root reviewed the reported concerns against the frozen ordered-circle contract.
Active numeric conversion hooks are outside the passive interchange contract, so
accepting numeric subclasses is not by itself a demonstrated contract violation.
Do not expand the contract merely to satisfy a speculative hostile-input test.

Python uses array('I') for retained proposal indices. Its native width is four bytes
on this machine and accommodates the declared maximum index. Before extending the
runtime support claim, check that width or choose a carrier with the required range.
This is not a failure of the tested runtime. Container ownership and accessor review
must remain tied to the core conformance report, not inferred from rendered images.

## Remaining integration work

- Finish root review of the example/harness behavior and core conformance source hashes.
- Review Android's completed patch and representative native results when available.
- Integrate reviewed port commits while preserving the existing root JavaScript export edit.
- Refresh only support records whose complete prerequisites have been reviewed; workers
  must not write root acceptance records. Keep the Java recipe prototype status separate.

## Reviewed native evidence identities

- `evidence/conformance/p5js-placement-marks.json`: `70284ed473e74409a3d115f4ffefd31ec92e0ae2af117279f2a75bb6bb8e4818`
- `evidence/conformance/py5-placement-marks.json`: `c100f0aa2d4b71ac9b4ae41072238d52174b1be1b156574b31edbe0290d7b008`
