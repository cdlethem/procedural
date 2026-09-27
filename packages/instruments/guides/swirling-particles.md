# Swirling particles

Release paths from an editable source region into a seeded scalar curl field. The portable curl operation turns a sampled scalar potential into velocity vectors, and RK4 follows those vectors to draw each trail. The drawing leaves the rest of the canvas untouched, so a small source can make a supporting wisp over another layer.

| Control | What to explore |
| --- | --- |
| Field frequency, anisotropy | Change the size and aspect of eddies. Together they must leave at least four grid samples per shortest wavelength. |
| Noise mix, Seed | Blend ordered waves with portable seeded gradient noise. Seed changes the field's realization *and* start positions, without depending on color, weight, or particle count. |
| Source placement, center, extent | Release starts through a square area, around a narrow ring, or from a line. Center and extent place a local accent or distribute paths across the frame. Line direction rotates the line. |
| Particles, trail steps, advection step | Choose how many paths, how long they continue, and how far RK4 advances each step. The count and step combination shares a tracing work budget; a longer trail can use fewer particles. |
| Stroke weight, Palette | Change the visible marks without regenerating the field or starts. |

Try a ring of 20 particles at a small source extent for a delicate curl, then an area of 110 particles with longer trails and stronger noise mix for interwoven flow. Off-frame centers can send only a few strands across the canvas. Zero advection leaves no visible trail; it does not scatter new particles.
