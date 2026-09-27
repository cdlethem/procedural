# Flame Clouds

A population of contractive affine transformations drives `fractalFlameAccumulate2D` into a fixed 216 × 216 bilinear density grid. Each map center has optional **linear**, **sin**, and **abs** component-wise variations with independent relative selection weights. The native point process advances a separate seeded sampling RNG each iteration. The seed also rotates the orderly arrangement and changes seeded map disorder. There is no shortcut formula for this density and no attempt to resume separate kernel calls: accumulation is one bounded synchronous run, cached while you change ink.

| Control | What it changes |
| --- | --- |
| Map arrangement / count | An evenly spaced ring, partial arc, or line of actual transformation translations; count changes the map population. |
| Contraction / rotation spread | Scale (<1) and angular variation of the affine matrices; all three selected powers remain contractive. |
| Translation spread / aspect / bias X/Y | Separation, shape, and displacement of the transformation translations in world coordinates, not output-canvas transforms. |
| Map disorder | Seeded independent perturbation of translations and rotation; zero restores regular spacing but the seed still sets the arrangement phase. |
| Linear / sine / absolute variation | Relative *selection weights*. A zero weight removes that power at every map center; all three zero is invalid. |
| Point iterations | Actual native accumulation steps, not sample thinning. |
| World center X/Y, width, aspect | Sampling-window position, horizontal span and ratio of horizontal to vertical span. The world window crops the attractor without moving the rendered output. |
| Output X/Y, width, height | Place and scale the local transparent density marks without resampling. |
| Density exposure / threshold / palette | Tone, low-density cutoff and ink; these reuse the identical cached native density. Bins with raw density zero always have zero alpha, even if threshold is zero. |

The native kernel has no resumable running-point input. The instrument runs one synchronous call, at most 280,000 iterations; a joint instrument budget of `iterations × (1 + map count / 12) + 216² ≤ 500,000` prevents the largest count and iteration combinations. Slider iteration range is 60,000–220,000, exact-entry 10,000–280,000. Map count is 3–9 on its slider, 2–12 by exact entry; fixed grid resolution preserves practical responsiveness. Dropped points are native out-of-window/nonfinite accounting, **not silently redistributed**.

Try **luminous ring**: ring, six maps, contraction .56, rotation spread 100°, translation spread 1.85, disorder .24, linear 1 / sine .42 / absolute .2, world center (0, .15), width 9.8, exposure 8. For **folded wings**: arc, seven maps, contraction .42, rotation spread 165°, translation aspect 2, translation spread 1.3, disorder .08, linear .25 / sine 1.7 / absolute .65, world center (0, 0), width 5.4. For **off-center smoke**: line, four maps, contraction .69, rotation spread 30°, spread 2, bias (.35, -.5), disorder .5, linear 1.2 / sine .1 / absolute 1.1; sample a world window centered at (.35, -.5) with width 5.5, then place the output at X 230 and Y 370, 320 × 560. Change palette, exposure or threshold last to compare the same exact density.
