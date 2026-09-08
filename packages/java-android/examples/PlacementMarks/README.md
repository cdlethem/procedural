# Android PlacementMarks starter

This API-29+ example adapts the shared, namespaced `PlacementComposition` source
from `packages/java/examples/PlacementMarks/PlacementComposition.java`. It does not
duplicate placement or filtering: the Android renderer consumes the retained
`CirclePlacements2D` result through `Android2DFrame` on the Processing animation
thread.

The button route mirrors the accepted Java PDE keymap:

|Button|PDE key|Effect|
| --- | --- | --- |
|Seed|R|next seed `42 → 43 → …` (mod 2³²), seeded source only|
|Budget|N|proposal budget `5000 ↔ 10000`, seeded source only|
|Source|X|seeded ↔ authored 5×32 radial proposals|
|Separation|G|separation scale `1.0 ↔ 1.2`, both sources|
|Min|I|minimum radius `4 ↔ 8`, seeded source only|
|Max|O|maximum radius `64 ↔ 32`, seeded source only|
|Motif|M|rings (64 vertices) ↔ diamonds (4 vertices); retains the placement|
|Palette|C|base ↔ alternate; retains the placement|
|Save PNG|S|saves the currently displayed cached frame through the accepted API-29 MediaStore route|

Seed, budget, minimum, and maximum are ignored while the radial source is active:
the tap performs no rebuild, no redraw, and changes no revision, exactly as the
Java PDE ignores those keys. Motif and palette edits retain the exact
`PlacementComposition` object; every effective geometry edit rebuilds it.

Platform difference from the host JVM PDE: the Android2D command vocabulary has no
closed stroked outline command, so rings and diamonds are submitted as sequences of
round-capped `segment2` commands (the accepted PathMarks polyline convention).
Junctions render as overlapping round caps instead of one closed path with rounded
joins. This example makes no cross-host pixel-identity claim.

Prepare an isolated project without launching an emulator or rendering:

```sh
uv run python tools/build_android_placement_marks.py
```

Add `--build` only to compile the staged debug APK. It never installs or launches
it. The tool stages the exact shared `PlacementComposition.java`, the Android
example sources, `GalleryWriter.java`, portable Java core sources, and Android
adapter sources. The Processing Android core and SDK locations remain pinned
task-local prerequisites.

The fixed 640-square, density-1 canvas, palette, motif vertex counts, and controls
are composition choices. They do not establish general Android support, a public
parameter range, or source-pixel reproduction.
