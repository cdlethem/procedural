# Complex escape-time and distance estimate

Root admits one p5-first operation for the second I-family slice: a bounded complex
escape-time computation that iterates `z -> z^2 + c` over a sampled world, records the
per-pixel escape count, and returns a per-pixel derivative distance estimate. This is the
second of the six distinct I-family proposals in the external expansion (flames, complex
dynamics, venation, DLA, multiscale Turing, maps); the others remain individual proposals
and are not admitted by this decision. The September 2026 external-art manifest records
are bound by id below; this is a new capability, not a Processing-corpus reassignment.

Artists choose a mapping (Mandelbrot: `c` is the sampled point, `z_0 = 0`; Julia: `z_0`
is the sampled point, `c` is a fixed constant), a sampled world grid and an iteration
budget, and retain the escape count and distance estimate so the image can be colored by
iteration or by proximity without resimulating. The mechanism is the escape-time fractal
and its derivative distance estimate as described by Inigo Quilez's distance-to-fractals
work (corpus `quilez-191ebfe225dc`, `quilez-0c713507f163`) and the GenerateMe/McCabe
Mandelbrot and Julia studies (`graphic-v2-c230df849733`, `graphic-v2-79df362c3257`,
`graphic-v2-a2efac831982`). The retained escape count and distance field are reusable
independently of any particular fractal: the same computation colors by iteration count,
feeds a distance-based filter or ray-march, or drives angle portraits (plan row 182).

The operation is a pure function of its input; it streams each pixel's orbit and returns
two detached buffers. The iteration, the escape test, the derivative recurrence and the
distance estimate are frozen in the contract. The derivative recurrence differs by
mapping: Julia accumulates the pure product `2*z_k` (the derivative of the orbit with
respect to `z_0`); Mandelbrot accumulates `2*z_k` plus one at each step (the derivative
with respect to `c`, since `c` enters explicitly every iteration). A pixel that does not
escape within the budget is interior: it carries the full iteration count and a distance
of zero. No learned preference, no original fractal parameters, and no visually measured
range are inferred from the source images. High-zoom precision and filtering are separate
limits (plan row 35); this slice is the bounded first slice.
