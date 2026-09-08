# Android starters with snapshot restoration

The six Android starters share a correction that restores the acknowledged artwork when
returning to the app. Returning to a sketch does not regenerate its geometry, advance its
random stream, or change the PNG saved by **Save PNG**.

Build the patch packages in a prepared checkout with the pinned toolchains and historical
core JARs available:

```sh
python3 tools/build_android_restoration_starters.py --build --output .work/dist/android-restoration-local
```

The output directory must be new. It contains Android adapter **0.3.0** and these ZIPs:

| Starter | Patch version | Retained core version |
| --- | --- | --- |
| FieldMarks | 0.1.1 | 0.1.0 |
| PathMarks | 0.2.1 | 0.2.0 |
| PlacementMarks | 0.3.1 | 0.3.0 |
| RegionMarks | 0.4.1 | 0.4.0 |
| GrainMarks | 0.5.1 | 0.5.0 |
| BranchMarks | 0.6.1 | 0.6.0 |

Extract your chosen ZIP and follow its README to supply Processing Android Mode, configure
the SDK, build, and install. `USAGE.md` describes the controls and the motivating survey
work. The ZIPs contain source, core/adapter JARs, and notices; the Processing runtime and
Android SDK remain external. The existing application IDs are preserved. As with any
Android update, use the same signing key to replace an installed build.

The restoration uses the retained PNG only when presenting a replacement surface. Normal
edits retain each starter's existing behavior. The [native review](../evidence/conformance/android-snapshot-restoration-root-review.json)
covers actual API33 HOME/resume, exact viewport pixels before the next edit, the existing
editing workflows, and cached MediaStore saving. It does not establish physical-device,
other-renderer, resize, or arbitrary corrupt-cache behavior.

The [package review](../evidence/distribution/android-restoration-review.json) records the
reviewed local adapter and six starter archives, including compilation after extraction.
These are local build artifacts; no registry release is claimed.
