# I1 distribution work boundary

Root implementation brief. Native CP1 evidence establishes drawing behavior; it does not
establish installation. The remaining I1 deliverable is a package an artist can consume
without the survey database, test harnesses, or the maintainer's ignored toolchains.
This brief defines packaging work, not another public operation or renderer contract.

## Artifacts and consumer path

- Java: build the portable core JAR directly with the standard JDK, independently of
  conformance execution. Supply a Processing library ZIP with the JAR, library metadata,
  notices and editable FieldMarks tabs. Keep desktop Processing adapter classes out of
  the portable core used by Android. If distributing that adapter, use a separate JAR
  with an explicit Processing dependency.
- JavaScript: produce a local-installable npm tarball containing the existing public
  exports and internal implementation files. `private: true` prevents registry publishing;
  it does not prevent local packing or installation and is not itself a delivery blocker.
  Supply a browser starter with its dependencies and a documented static-server command.
  Its implementation imports must resolve from the installed/copied artifact layout.
- Python: produce a wheel containing `procedurals` and its internal implementation,
  with an explicit optional py5 dependency for the native example. Supply the editable
  sample separately. The installed sample must import the installed wheel and write to
  a user-controlled project/output directory, without injecting checkout paths.
- Android: distribute the portable core and Android adapter separately from Processing's
  Android core and AndroidX dependencies. Supply a tracked sample project and reproducible
  dependency acquisition instructions with versions, checksums and notices. SDK, JDK,
  Processing core and signing inputs must be configurable; the maintainer's `.work` paths
  may be convenience defaults, never the only build route. A debug key can be generated
  for the local sample; no maintainer key is required or distributed.

The existing native adapters may remain internal implementation used by the versioned
starter. Packaging does not promote those internal names into a stable public API. An
artist should begin at the editable composition and its three public operations, with
the mark construction and sample configuration clearly visible.

Each editable starter resolves public operations from the installed artifact. Its internal
adapter is either loaded from that exact-version artifact or copied byte-for-byte from
the installed artifact into versioned starter-owned implementation files. A relative
checkout import or editing files inside node_modules is not the artist's entry point.
Registered staging transformations may change imports, dependency wiring and output paths;
record them and preserve the composition's code/AST. A newly authored equivalent starter,
such as Java's command-route example, must instead prove its command outputs against the
accepted composition cases. Do not describe that as an import-only transformation.

Current routes: Java packages the core and separate desktop-adapter JARs with a command
starter; JavaScript maps the public package import to its installed module and copies three
internal drawing files from the installed tarball; Python imports its installed wheel and
redirects output locally; Android's sample must contain only example Java sources and
consume both package JARs plus declared external runtime dependencies.

## Verification and boundaries

Build artifacts into ignored `dist/` using tracked, documented commands. Include the
project's license and applicable dependency/provenance notices. Do not bundle survey
data, generated reports, test fixtures, emulators, caches, or SDKs. Do not publish to any
registry as part of local artifact preparation.

Use a clean consumer directory and isolated language environments. Compile/import the
three public operations from each produced artifact, evaluate independently known shared
fixture values, and verify the loaded implementation comes from that artifact. Build
the native starters against those artifacts and their declared dependencies. Resolve
installation-specific failures at the packaging boundary; preserve previously accepted
native source and behavior evidence rather than repeating native suites for metadata.
Any source or behavior change must have its own justified verification scope.

Record artifact hashes, included-file manifests, dependency versions, commands and smoke
results. A successful source-checkout demo, `npm pack`, wheel build, or JAR creation alone
does not prove installed consumption. I1 remains incomplete until all four artifact and
native-example consumer paths have evidence; subsequent I2 expansion follows that gate.
Final consumer reports must pass with no pending starter-load checks. These installation
checks complement the scoped native evidence; they do not establish a human usability study.
