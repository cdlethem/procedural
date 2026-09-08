# Editable browser example validation

Register four actual-page renders once, before execution: initial base, length32,
neon palette and bar. This validates the new page/setup/event/display path rather than
repeating the adapter harness. Set all three controls before dispatching one change
event per edit so only four compositions render. Use the pinned p5/Chromium runtime,
deviceScaleFactor 2 and repository-local server.

Require exactly one visible display canvas, no browser errors, completed status and
revision progression. Compare each canvas's decoded RGBA hash to its corresponding
accepted browser CP1 output. Verify Save PNG generates an actual downloadable image
whose decoded pixels match the current canvas. Record source/runtime bindings, results
and failures; put downloads/images under ignored `.work/reproductions/p5js-ui`.

The four UI renders are a separate application-lifecycle allowance; existing pixel,
lifecycle and CP1 budgets remain consumed as recorded. Any failed UI assertion requires
a diagnosis and explicit corrective allowance before retrying. Do not call an unexecuted
page installable or tested based only on the earlier command-route harness.
