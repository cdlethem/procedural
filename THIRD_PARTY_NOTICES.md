# Third-party algorithm provenance

## fdlibm 5.3

`packages/javascript/src/internal/fdlibm-pow.js` is a direct JavaScript
translation of netlib fdlibm 5.3 [`e_pow.c`](https://www.netlib.org/fdlibm/e_pow.c),
revision 1.5 (2004-04-22), SHA-256
`763b86baa63eb3518b43f7f3e44e5ed10992b62650f4a45c3a2ea6015e6d5122`.
It retains that file's Sun permission notice in the source header.

The existing JavaScript trigonometric helper (`src/fdlibm-trig.js`) and hypot helper
(`src/internal/fdlibm-hypot.js`) under `packages/javascript/` retain their full netlib
Sun notices. The power helper also translates the scaling routine from
[`s_scalbn.c`](https://www.netlib.org/fdlibm/s_scalbn.c), whose 1993 Sun notice is
preserved beside that routine. These sources remain under their original permissive
terms; the project MIT license does not replace their notices.

The `lowbias32` integer mixer used by the gradient-noise design and private experiment
comes from [Hash Function Prospector](https://github.com/skeeto/hash-prospector), published
under the [Unlicense](https://github.com/skeeto/hash-prospector/blob/master/UNLICENSE).
Its constants and ordered unsigned arithmetic are retained explicitly. The project's
coordinate-combination rule, field interface and gradient ordering are separate choices.

Gradient interpolation and quintic fading are informed by Ken Perlin's
[Improved Noise reference](https://mrl.cs.nyu.edu/~perlin/noise/). The project does not copy
that reference implementation or its permutation table and does not claim its output sequence.

Processing runtime dependencies retain their upstream LGPL licensing. Downloaded JARs
remain in ignored development directories; this file does not relicense those dependencies.
Survey sketch provenance and upstream MIT notices remain under `survey/`.

Generated Java API documentation includes the standard JDK Javadoc support files. Their
original notices, including the Javadoc licensing terms and bundled jQuery/jQuery UI notices,
are preserved under `reference/legal/` in source-built distributions. These generated assets
remain outside Git and retain their own licenses; the project license does not replace them.
