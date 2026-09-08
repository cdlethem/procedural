# Browser harness startup repair

The initial pixel-suite attempt failed before constructing p5 or an adapter surface.
The loopback server omitted UTF-8 in its content types and the page omitted a charset.
Chromium decoded Unicode regular-expression ranges in p5's bundle incorrectly, causing
a syntax error; `window.p5` was consequently unavailable. This is a harness transport
failure, not evidence of an adapter or p5 rendering failure. Preserve the initial result.

Repair: serve JavaScript and HTML explicitly as UTF-8 and declare the page charset.
Consume the already-registered corrective pixel-suite attempt after syntax checks.
No assertions, geometry, expected pixels, adapter behavior or dependency versions change.
