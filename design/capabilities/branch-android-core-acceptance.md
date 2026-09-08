# Endpoint-branch Android core acceptance

Run the unchanged Java BranchTree2D on API33 ART using existing vector generation and
native carrier/access functions. No drawing or package claim. Require all40 shared cases,
five stream vectors already included in BranchTreeVectors, exact topology/attributes and
fixed per-case trig coordinate bounds. Host Math on ART must meet those bounds; never
broaden them after running. Require extracted native carrier/nonfinite/negativezero/
access/ownership/capacity checks plus an explicit513-node one-slot chain.

Reuse source-bound Java8 compilation and D8 preparation, preserving desktop preflight.
The native-only extraction excludes benchmark workloads; no performance claim follows.
Expected preflight counts:40 cases in BranchTreeVectors,81 assertions and513 chain nodes
in BranchTreeAndroidAccess. These are completeness guards, not a feature/work estimate.

One existing API33 emulator session under the machine shared500-second lock, boot bounded
at180 seconds and runner210 seconds plus cleanup to240 seconds. Verify source/toolchain/
generated class/source/dex hashes before and after execution, exact device dex hash and
both main outputs. Delete only the pushed temporary dex, then stop the session emulator.
Preserve each output and failed attempt. Reject a tampered preparation before device access.
No native BranchMarks drawing, export or distribution support is accepted by this run.
