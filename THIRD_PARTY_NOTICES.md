# Third-party algorithm provenance

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
