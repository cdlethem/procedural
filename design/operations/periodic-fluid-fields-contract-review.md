# Periodic field contract review

Root froze the three linked contracts before implementation on 17 September 2026.
The independent architecture reviewer was `neighbor_design_challenge` (Astra), reviewing
root's numerical draft. MAC divergence/gradient signs, staggering and weighted-Jacobi
pressure update were checked independently. Root resolved the following findings:

- A negative subnormal remainder can round to the extent after adding the extent. Wrap
  explicitly maps that result to zero before indexing. Positive remainders avoid addition.
- Advection is an explicit backward characteristic trace, not implicit backward Euler.
- The stable diffusion endpoint .25 can retain an alternating checkerboard; no strict
  smoothing/convergence claim is made there.
- Errors refer to grid validation/work/arithmetic; copied pair-force descriptions were removed.
- dt0 validates all inputs and preflights work, then returns an exact detached scalar copy.

Root authored analytical fixtures before code, including an exact two-cell pressure example,
periodic translations and impulse stencils. Additional independent residual and sampling
checks supplement these vectors. Stable weights, resource budgets and per-call retention
are authored mathematical choices. No recommended visual ranges or target acceptance is
established by this review. Other targets and original-artwork reproductions remain unvalidated.
