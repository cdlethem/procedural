---
name: generative-performance
description: Implement or optimize count-, resolution-, mesh- or frame-sensitive generative operations while preserving their specified output and bounded execution.
---

# Generative performance

Read the operation contract and motivating workload before changing allocation or execution.
For the initial regular grid, the sequence is compact and point access is O(1); CP1 traversal
is roughly a quarter-million points. Do not materialize positions, instances and commands
as three object lists merely because the usage walkthrough draws three stages.

- Separate setup, one-step/index access, full traversal and optional retained output costs.
  State asymptotic work and memory. Keep inner loops free of preventable allocation, copying,
  parsing and reflection; offer reusable binary64 storage where that preserves ownership.
- Bound work by explicit finite input or a caller execution budget. A large valid descriptor
  does not authorize iterating/materializing all of it. Count overflow must fail before work.
  Keep representational limits distinct from measured resource limits and artistic ranges.
- Benchmark tiny, motivating-range and stress inputs in actual native runtimes. Record runtime,
  input, warmup, repetitions, elapsed time, retained memory or allocation evidence, and output
  checksum. Do not extrapolate a desktop result to Android or a pure core to a renderer.
- Compare outputs with shared fixtures before and after optimization. Never change traversal,
  random consumption, numeric rounding, topology, zero/error behavior or aliasing to gain speed.
  A fused arithmetic operation may violate a multiply-then-add contract.
- Use bounded batches/streaming when appropriate; specify retained state, cancellation points,
  replay and ordering. No speculative executor or concurrency framework is needed for an
  indexed pure operation. Serialize Processing renders through the existing owner.
- Publish measurements as observations, not universal runtime guarantees. A regression threshold
  needs repeatable evidence on its actual runtime; record unresolved target/memory evidence.

Performance acceptance supplements semantic, native and reproduction validation. It cannot
turn a skipped workload, mock adapter or changed output into a successful optimization.
