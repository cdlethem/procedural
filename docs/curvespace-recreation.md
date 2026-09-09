# Recreate a luminous, folded grid

The repository's [Curvespace example](../examples/recreations/Curvespace/Curvespace.pde)
recreates the structure of `2018/Generativos/curvespace` using two existing operations:
RegularGrid places the faint dots; RadialPull2D deforms densely sampled horizontal and
vertical lines. Influence circles, palette choices and additive drawing remain ordinary
Processing code. There is no sketch-specific deformation algorithm in the example.

Use the [Java0.22 library](building-java-from-source.md) and open the Curvespace PDE with
its adjacent CurvespaceComposition.java tab. This repository example is separate from the
22 starters in the accepted source-bundle archive. Its native validation can be repeated
from this checkout with the pinned toolchain and an extracted accepted library:

```sh
python3 tools/run_curvespace_java.py \
  --library /path/to/procedurals/library/procedurals.jar \
  --output-dir .work/my-curvespace-check --native
```

C shifts the palette while keeping geometry. R advances the explicit seed and rebuilds
the grid and influences. 0 restores seed42 and the original palette. S saves the displayed
frame as curvespace.png. The example uses P2D, a960-square canvas, density1 and ADD blending;
it requires the Processing OpenGL runtime. Generated PNGs and toolchains stay outside Git.

In the composition tab, edit the influence descriptors or their scalar generation to
change where the grid folds. Radius controls reach; power changes the pull profile. Keep
the line sampling separate from the field: coarse samples can bridge a center discontinuity
and change the visible crossings. The dot grid deliberately remains undeformed.

Root reviewed the complete native composition and its edit/reset/save sequence in
[the recreation review](../evidence/reproductions/curvespace/root-review.json). This is a
structural recreation, not source-seed or pixel replay. Explicit Java randomness, the
package's binary64 field semantics, exact-center policy and density differ from the source.
See the [source walkthrough](../design/capabilities/curvespace-recreation-walkthrough.md).
