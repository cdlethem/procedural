# py5 acquisition failure diagnosis

The initial registered pixel suite failed all four groups before drawing with
RESOURCE_FAILURE. Its group reporter omitted chained causes. Preserve that report;
do not spend the corrective pixel execution to discover the missing diagnostic.

Authorize one isolated, non-drawing diagnostic on the actual sketch thread: create
one 1×1 JAVA2D buffer, inspect wrapper, parent, lazy backing and density, and invoke
the adapter once to retain its full exception chain. No image is saved or accepted
as reproduction evidence. Record stdout/stderr under evidence/conformance.

The initial public density-two request was rejected by the virtual display. Resolve
the test environment before corrective validation; do not count density-one execution
as evidence of density-two isolation.
