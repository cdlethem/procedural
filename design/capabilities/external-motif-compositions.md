# Complete motif compositions — root decision

Status: approved example boundary before implementation, 2026-09-17. Delivery A of
[the external-art plan](../../docs/external-art-p5-expansion-plan.md).

Make three original p5 compositions: a botanical ornament poster, an asymmetric geometric
panel, and an orbital brush drawing. Existing package placement, field/path and palette
operations remove the algorithmic work. The artist supplies original motifs and ordinary
p5 transforms, clipping, layers and marks. No public operation or SVG loader is admitted.

Keep layout/trajectory records separate from drawing so marks can be replaced without
recomputing arrangement. Each study must visibly compose foreground/background, scale
hierarchy and negative space rather than display isolated primitives. Include occupancy or
density, scale hierarchy/crop, motif substitution and palette edits. Style-only edits must
preserve the retained geometry. Example settings are authored configurations, not inferred
recommended ranges. Use the shipped default palettes, with copied colors for edits.

Inputs and reusable output: explicit deterministic configuration to retained placement/path
records; then original local motif geometry and styles to Canvas2D drawing. Asset loading,
layout choices, labels and DOM controls stay in the examples. Alternatives are ordinary
p5 shapes and existing package operations; neither warrants a new style-generator API.

Motivation: Joshua Davis's motif compositions (https://joshuadavis.com/) and REAS geometric
compositions (https://index.reas.com/), as indexed and visually reviewed in
[evidence](../../evidence/external-art/2026-09/root-review.json). Source IDs/images are to be
selected explicitly in the study handoff. No artist-owned motifs/code are copied. Exact
artist algorithms are not inferred from appearance. These are original compositions,
not accepted recreations, and add no demonstrated-original coverage.

Acceptance: three distinct full compositions; structural and appearance edits; unchanged
retained geometry after motif/palette substitution; contrasting marks on the same output;
actual p5 2.3.2 browser render, reset/reload/save and deterministic replay. Root inspects
native baseline and decisive variants. Package installation must retain runnable examples.
No web gallery integration, target parity, deployment or general asset framework in this
batch. Future asset handling requires a separate demonstrated need.
