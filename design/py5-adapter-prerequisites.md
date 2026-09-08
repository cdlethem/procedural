# py5 runtime prerequisites

Root investigation, 2026-09-07; preparation only, no native drawing support claim.

An isolated environment exists at ignored `.work/environments/py5`, created using
`uv venv` and `uv pip install --python .work/environments/py5/bin/python py5`.
Resolution installed py5 0.10.11a0, JPype1 1.7.1 and Python 3.13.15. This is a
prerelease py5 dependency; record and review the exact runtime before claiming support.
The package's ordinary Python dependency metadata was not changed.

Importing py5 with the repository JDK 17.0.20.1 under xvfb succeeded. No sketch or
surface was rendered. A subsequent attempt to read `PApplet.VERSION` failed because
that field is absent; do not use it as a runtime-identity probe.
The installed `py5/jars/core.jar` has SHA-256
`2cd02df8ace61c45af5eddef74dc74608b87a50155e83f20c7b1e28642ddbc85`;
its manifest contains no Processing version. This differs from the pinned desktop
Processing 4.5.6 JAR, so desktop runtime evidence must not be silently reused.

The official [installation guide](https://py5coding.org/content/install.html) requires
Python 3.10+ and a non-headless Java 17+ JVM. The official
[create_graphics reference](https://py5coding.org/reference/sketch_create_graphics.html)
describes offscreen Py5Graphics and renderer compatibility. These establish prerequisites,
not adapter parity. Use the installed runtime's actual methods and bundled JAR hashes
when implementing/testing the adapter.

Next identify bundled Processing bytecode and py5 wrapper lifecycle, choose the explicit
fresh JAVA2D acquisition/release path, and connect the existing Python validator/state.
Do not certify Python solely through the already-tested Java adapter: actual Python
carrier conversion, Py5Graphics calls, native cleanup and CP1 edits need their own tests.
