# Move dye and textures through projected flow

Root admission, 17 September 2026: independently specified p5-only periodic advection,
diffusion and velocity projection. This is the F computation slice of the full external
expansion. The framebuffer lifecycle is a separate host adapter.

The artist can inject dye, change flow viscosity, and replace dye with a print texture
without rewriting transport or pressure iteration. Existing waves, curl and path tracing
do not remove those algorithms. Three operations expose reusable scalar arrays and MAC
velocity arrays; they compose instead of introducing a fluid-engine object. Ordinary
injection, palette choice, display and logical-step scheduling stay in the example.

Motivation is the bound September corpus record `onformative-zephyr-9de832c`, whose
[artist page](https://onformative.com/work/zephyr) describes fluid dynamics as a source for
installation geometry. The manifest SHA256 is
`c25caa8edf07e11bf1f97cc5a1d70dd65a915620992bc0b3d3746c80ae59d209`.
That description does not specify this solver. [Bridson and Müller-Fischer's course notes](https://www.cs.ubc.ca/~rbridson/fluidsimulation/fluids_notes.pdf)
provide the numerical reference; implementation is independently written. No source artwork
is newly demonstrated or counted plausible merely from these components.

`projectPeriodicVelocity2D` returns corrected velocity, pressure potential and before/after
divergence. Its weighted Jacobi iteration is bounded and exposes residuals; finite iteration
does not imply incompressibility. `advectPeriodicScalar2D` performs a first-order explicit
backward characteristic trace and bilinear reconstruction with explicit sample offsets.
Both velocity components must read the same prior velocity state. `diffusePeriodicScalar2D`
returns a five-point convex stencil with retention; its stable endpoint can preserve an
alternating checkerboard. These are design choices, not measured artistic ranges.

The domain is periodic, unit-cell, two-dimensional and has no obstacles. MAC face offsets
and adjoint divergence/gradient are fixed by contracts. Scalar transport is dissipative and
not generally mass conserving. Diffusion has mass accounting under retention1. No free
surface, 3D, pigment physics, fabrication, GPU arithmetic or general boundary support follows.

Distinguishing fixtures include exact checkerboard pressure cancellation, constant flow,
periodic whole/half-cell shifts, staggered sampling, impulse diffusion, zero-step identity,
invalid carriers, overflow and budgets. A native dye study must show early/later states,
projection bypass and residual reduction, structural and style edits, reset/reload/save.
Withhold a generated print texture for substitution after the core works; compare transport
without changing the solver. Measure study/stress work and report dissipation honestly.
Root owns final native and installed-package acceptance; contracts are not support claims.
