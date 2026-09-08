# CP4 region investigation decision

Root inspected all five original 640×640 PNGs after the single registered attempt passed.
The private Java source, plan and executor are frozen; do not rerender this experiment.
`result.json` contains the exact source/class hashes, numeric preflight and image hashes.

The baseline has both large square panels and clusters of progressively smaller cells.
Increasing replacements from 100 to 200 removes several large panels and makes the upper
half visibly finer: 301 versus 601 retained leaves. Full-list selection at 100 replacements
instead leaves a particularly large bottom-right panel beside very fine clusters on the
left and near the top. This is a useful change in scale hierarchy, not a size-sorting rule.
The native source-scheduler diagnostic independently confirms wider depth disparities with
full-list selection for its five source-seeded cases. The original source images have not
been inspected here; their report's contrary prose is not promoted to a public claim.

The content-grid image preserves the baseline's exact geometry hash and replaces its
single central dot with nine smaller dots. Large panels become fields of marks, while
small panels read more as texture. The explicit 2×3 refinement plan produces eleven
rectangular panels with the same dot-grid treatment. It demonstrates that content can
consume a simple list of cells independently of their generation.

| edit against baseline | normalized RGB mean difference | changed pixel fraction |
| --- | ---: | ---: |
| 200 replacements | 0.0877802064 | 0.335004883 |
| full-list selection | 0.233928178 | 0.835280762 |
| content grid | 0.0386348135 | 0.139375 |

These metrics establish change; the observations above establish its relevance to this
walkthrough. They do not establish defaults or a continuous encouraged range. The explicit
transfer changes both the layout method and content relative to baseline and receives no
single-parameter difference claim.

Admit a seeded equal-quadrant leaf generator for contract preparation. It removes live-list
selection, replacement bookkeeping, stream ownership and stable cell identity from the
artist's sketch. Keep the explicit grid refinement private for now: this eleven-panel test
uses two direct calls and does not yet demonstrate a broader editing or constraint workflow
that justifies another public operation. The content function will accept ordinary bounds,
so the library generator is replaceable without requiring a second catalog entry.

This is root's direct capability review during the Sol pause. It is not acceptance of a
public implementation, source-pixel reproduction, or a human installation study. All native
render subprocesses had empty stderr. The Python executor emitted a Pillow `getdata`
deprecation warning during comparison; image reading and all comparisons completed.
