# Android CP1 result decision

Root accepts the scoped four-edit composition result in
`evidence/reproductions/cp1-android/result.json` and has inspected all four actual PNGs.
This is the initial registered Android CP1 execution, using the pinned core/SDK/emulator
and Android2DFragment. It is not upstream pixel reproduction or cross-renderer identity.

All four cases match the accepted JAVA2D model, binary32 command geometry, colour and
command-count hashes exactly. Each retains the same 25,600-record model with no omitted
zero-length commands. No trig tolerance or alternative acceptance was needed. Each output
is opaque, nonempty and 640×640; each exact bitmap is recycled and its surface detached
after saving within the completed-output consumer.

The base visibly retains the independently oriented grid of short marks and coherent
field variation. The length edit extends those marks along the same headings, increasing
overlap. The palette edit preserves the base geometry while changing the colour treatment.
The bar edit replaces line marks with visibly broader quadrilaterals while retaining the
field structure. Changed pixels relative to base are 340,244 for length, 309,708 for palette,
and 407,761 for bars. These are observed edit outcomes, not recommended parameter ranges.

The generated report's pending-root-inspection field reflects the runner's automated
scope; this authored decision records the subsequent completed visual inspection. The
images remain ignored under `.work/reproductions/cp1-android/`. Do not repeat the passing
run for metadata. Editable Android controls and save-current-image behavior remain a
separate required validation before a scoped target support claim.
