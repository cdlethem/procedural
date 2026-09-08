# Android pixel profile result

The first registered Android pixel execution passed all four groups on API33 with
the pinned Processing Android core and software emulator. Evidence:
`evidence/conformance/android-adapter-pixels.json`. No corrective execution is needed.

Six logical/physical/bitmap sizes through 2048² have exact opaque RGB backgrounds.
Converted bounds, clipping, winding, single-fill seam, round caps, style transitions
and parent isolation pass. Alpha128 overlap channels are [255,64,0,128] in forward
order and [255,128,0,64] in reverse order. Android's fresh output density is one.

The 1/256-width probe covers zero pixels. This is within the preregistered contract's
absence of a minimum-width visibility guarantee; no threshold was changed. It is
different from the observed desktop JAVA2D coverage and must not be described as
cross-host raster identity.

Root accepts this pixel-profile evidence only. Injected failures, actual activity
lifecycle, CP1/example and independent final review remain required before scoped
Android support can be claimed. Keep the existing emulator and do not rerun this
passing part for metadata freshness.
