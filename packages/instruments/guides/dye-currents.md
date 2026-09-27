# Dye currents

Build local pigment from one droplet or several independently seeded, rotated elliptical deposits. Each deposit has **compact support**: cells outside its shape start with exactly zero dye, so an otherwise empty region stays transparent until transport carries material into it. The fixed 64×64 simulation grid keeps numerical edits practical; Footprint X/Y and width/height transform the resulting field onto the canvas without moving a single source in simulation coordinates.

| Control | Canvas effect |
| --- | --- |
| Dye sources, Source X/Y, Source spread, Source size, Source aspect, Source angle | Set the number, location, scattering radius, radii and tilt of independent dye deposits. Increasing the count preserves earlier seeded deposit geometry. |
| Stripe source, Stripe spacing, Stripe angle | Modulate dye inside each deposit before transport, giving the flow patterned material to fold; spacing and angle do not move the sources. |
| Drift direction, Drift, Periodic waves | Set uniform initial transport and seeded-phase cross-currents. Zero drift and waves let the vortices do all the moving. |
| Vortices, Vortex X/Y, Vortex spread, Vortex radius, Vortex polarity, Injection | Locate local rotational forces and set their reach; signed injection reverses spin. Alternating polarity makes opposed neighboring swirls. The vortex seed is independent of the deposit count. |
| Frames, Viscosity, Projection | Advance the dye under synchronous old-velocity transport, explicit diffusion (valid rate at most 0.25), and optional pressure projection. Zero frames reveals the initial deposits. |
| Pigment, Contours, First contour, Contour spacing, Contour weight | Independently show blended dye pixels and five measured isolines per pigment. Zero contour weight means no lines, even when Contours is enabled. |
| Footprint X/Y, Footprint width/height | Place and stretch the periodic grid on the canvas independently of simulation source and force coordinates; no paper, border or caption is drawn. |

Try **one still droplet** with Dye sources 1, Source spread 0, Vortices 0, Drift 0, Periodic waves 0 and Frames 0; move Source X/Y within the grid for a small supporting accent. For **advected stripes**, set Stripe source on, Stripe spacing 3, Dye sources 2, Vortices 1, Injection 0.3 and Frames 30; then rotate Stripe angle without moving either deposit. For **opposed swirls**, set Dye sources 5, Source spread 17, Vortices 2, Vortex spread 12, Vortex polarity alternating, Injection 0.35, Frames 45 and Projection on. Vary the seed to find a different arrangement without altering pigment or contours.

The domain is **periodic**: dye and velocity crossing one simulation edge reappear on the opposite edge. After transport, real material can therefore reach the footprint border; no decorative opacity mask is applied. To keep an isolated fragment, use a smaller initial spread or fewer frames, rather than treating Footprint width as a cropping control. The adapter composes the existing `advect-periodic-scalar-2d`, `diffuse-periodic-scalar-2d`, `project-periodic-velocity-2d` and `marching-squares-2d` operations; no new solver or boundary rule is introduced.
