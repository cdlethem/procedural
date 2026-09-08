# Install CutBranchMarks on Processing Java

The local bundle path is
`.work/dist/line-pool/java/procedurals-processing-0.15.0.zip`.
Extract its `procedurals` directory into your Processing sketchbook’s `libraries`
directory, restart Processing, and open CutBranchMarks from the library examples.
Desktop Processing 4 with P2D/OpenGL is required. The bundle contains 15 operations
and 15 starters; other platforms remain deferred for this operation.

From this checkout, stage and compile the reviewed core and example into a fresh directory:

```sh
python3 tools/prepare_cut_branch_marks.py --output .work/examples/my-cut-branch-build
```

Open `CutBranchMarks/CutBranchMarks.pde` inside that directory in desktop Processing 4.
The staged `code/procedurals.jar` supplies the core. P2D/OpenGL is required.

The bundle preserves all 14 previous starters. It is a local distribution,
not a registry publication.

Use C for colour, A for first-cut angle, W for work, T for the initial stroke, R for seed,
0 to reset, and S to save the displayed canvas. See [the guide](cut-branch-marks.md).
