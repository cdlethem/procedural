# Review the generated artwork

Open [the local gallery](../.work/visual-review/index.html) in a browser, or open
[the contact sheet](../.work/visual-review/overview.png) for a quick overview.

The gallery groups actual Java renders by capability. Search for a technique, filter by
review stage, and click an image to open the full-size original. Baselines and meaningful
edits sit together. Private studies and early experiments are labelled separately from
accepted workflows and structural recreations; their review records define the scope.

The initial collection contains122 distinct images in26 groups, spanning the existing Java
workflows, four original-sketch recreations and the current polygon-placement study. This
is a curated review collection, not an inventory of every diagnostic frame or a feature count.

Images remain in their original ignored render folders. `.work/visual-review/images/`
contains descriptive links, not copies. Nothing is moved or removed, and rendered images
are not committed. On a checkout without the local renders, missing images are explicitly
listed; the builder does not silently substitute another run.

For maintainers, refresh with:

```sh
python3 tools/build_visual_review.py
```

Curation lives in [visual-review.json](visual-review.json). Add new visual milestones with
an accurate category, description, evidence path and image hashes. The builder validates
local files, flags changed or unavailable images, collapses identical files within a group,
and rebuilds the page and contact sheet using the existing helper. It needs the project's
Python/Pillow environment. The gallery is a review aid, not an acceptance attestation.
