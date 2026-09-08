# Android PathMarks starter

This API-29+ example adapts the shared, namespaced `PathMarkComposition` source from `packages/java/examples/PathMarks/PathMarkComposition.java`. It does not duplicate feedback integration: the Android renderer only consumes that composition’s bounded command batches through `Android2DFrame` on the Processing animation thread.

The raw composition is retained unchanged. Before the fixed 640px drawing frame, the
example drops only segments whose complete bounding box misses the canvas padded by one
pixel (`[-1,641]²`); it neither clips nor changes paths. Build/native evidence records raw
and submitted command counts separately.

The UI exposes mode, mark length, palette, count, distance, and cached PNG save. Mode/length/palette retain the current 24 public paths. Count (2,000/2,001) and distance (0.4/0.8) rebuild them. Save writes the PNG bytes captured from the currently displayed completed frame through the accepted API-29 MediaStore route.

Prepare an isolated project without launching an emulator or rendering:

```sh
uv run python tools/build_android_path_marks.py
```

Add `--build` only to compile the staged debug APK. It never installs or launches it. The tool stages the exact shared `PathMarkComposition.java`, the Android example sources, `GalleryWriter.java`, portable Java core sources, and Android adapter sources. The Processing Android core and SDK locations remain pinned task-local prerequisites.

The fixed 640-square, density-1 canvas, palette, 24 paths, style, and controls are composition choices. They do not establish general Android support, a public parameter range, or source-pixel reproduction.
