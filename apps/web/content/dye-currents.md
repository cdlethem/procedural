# Dye currents

Three dye channels travel through an authored periodic flow. Each replay step transports velocity components, applies explicit forcing and diffusion, projects the staggered velocity grid, then carries dye through the resulting field.

| Control | Canvas effect |
| --- | --- |
| Frames | Replays 0 to 120 explicit steps from the same initial grid. |
| Injection | Changes the external vortex forcing. |
| Viscosity | Changes explicit velocity diffusion. |
| Projection | Enables or bypasses the bounded pressure solve. |
| Stripe source | Replaces soft initial dye disks with patterned disks. |
| Contours | Shows measured dye isolines over the same scalar state. |

The adapter composes `advect-periodic-scalar-2d`, `diffuse-periodic-scalar-2d`, and `project-periodic-velocity-2d` through the editable study's `stepFluid`, then queries `marching-squares-2d` for optional isolines. It caches the numerical replay separately from palette and contour visibility. The grid is 96×96 with authored forcing.
