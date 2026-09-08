# Native error phase repair

Sol's post-run review found that the p5 adapter rethrew any native `FrameError` without
resolving the pending phase plan. A host method throwing `INVALID_COMMAND` with an
arbitrary index could therefore escape acquisition/drawing/end with the wrong code.
The first twelve lifecycle tests passed but did not distinguish such misleading codes.

Root removed those bypasses. Native catches now always invoke the matching phase
resolver. Pending native failures receive RESOURCE_FAILURE or RENDER_FAILURE and the
correct index; reentrant state failures remain INVALID_STATE because their frame is
already aborted. Context-loss probing and phase resolution are separated so a resolver's
own error is not caught and resolved twice.

Add misleading-code regressions for allocation, readiness, initialization, draw,
pre-batch context probing and end. Consume the preregistered corrective lifecycle part
once after these tests are added. Preserve the original passed result as evidence of
its narrower coverage. Pixel execution does not need repeating: only exception paths
changed, and silent-loss behavior remains tested in the expanded lifecycle suite.
