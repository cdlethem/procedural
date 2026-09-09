# A3: explicit asset staging for the Java render helper

Root behavior brief for tools/render_java.py. Tooling extension, not an operation or new
renderer claim. Existing JAVA2D, source/JAR/runtime binding, frame/sweep limits, timeout,
shared lease and fresh-output semantics remain unchanged.

Add optional --assets DIRECTORY. No implicit copy of adjacent data/. Without this option,
retain the existing rejection for a sketch with adjacent data/. With the option, stage
exactly that supplied directory as data/ under EACH fresh variant sketch directory, so
Processing loadImage/createFont relative asset paths resolve identically and one variant
cannot mutate another's inputs. Assets may be supplied from an extracted accepted bundle.

Inventory regular files recursively with relative POSIX paths in sorted order. Reject
symlinks (including root), special files, missing/non-directory root, traversal outside the
root and ambiguous paths. Empty directories need not be copied; an empty root is allowed.
Set explicit tool resource caps: 4096 regular files, 256MiB total bytes; these are execution
budgets, not library artistic ranges. Reject before output creation if inventory is invalid
or exceeds budget. Never open external paths named by metadata inside an asset file.

Bind inventory path, size and SHA256 in report assets before execution, and compare source
inventory after the batch, including additions/removals. Verify staged files match prior
hashes before launching each variant. Check staged inventory after each run too: mutation
makes the variant/batch failed rather than silently accepting altered inputs. Image output
lives outside data/ and is not part of this inventory. Copy bytes, preserve relative paths,
not symlinks; do not modify originals. A concurrent input change fails honestly and retains
failed output. No sandbox guarantee against arbitrary trusted sketch code is claimed.

Keep binary assets in ignored fixtures assembled during tests; use small generated PNGs.
Native proof: a minimal supplied-image sketch reads data/nested/pattern.png, draws it and
uses an explicit accepted operation. Compare known pixels in actual JAVA2D; include two
variants to prove separate copies. Missing-file, symlink, cap and inventory-change checks
are focused Python tests; avoid adding a general filesystem framework. Font inclusion uses
the same copy mechanism but font rendering is not certified by an image-only test.

Owner: root may implement directly; assign to Terra only after current A1 files return.
Files: tools/render_java.py, existing render helper tests, one native asset example,
docs/rendering-java.md. Do not modify renderer selection or frame-export behavior in this
batch. No distribution rebuild required merely for this repository helper change; batch
it with the next accepted integration checkpoint and refresh docs/evidence then.
