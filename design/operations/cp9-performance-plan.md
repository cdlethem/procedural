# CP9 Java workload acceptance plan

Root registers this plan before the first production triangulator benchmark.
The frozen operation contract defines correctness and work accounting. This plan
measures the cost of using it; it does not change maxWork or introduce an artistic
point-count recommendation.

Run on the pinned JDK 17 under a bounded desktop heap. Record Java/VM/OS identity,
the input-generation source, core/probe source hashes and JVM options. The runner
must refuse an existing output directory and preserve timeout/failure output.
There is no Processing render or GPU work in this measurement.

## Workloads

All inputs are constructed before generation timing. Java Random here is an
explicit, private benchmark input source, not part of the portable triangulator.

| Input | Purpose | Warmups | Measured repetitions |
| --- | --- | ---: | ---: |
| Nine-site lattice | Hand-checked work49 and small-call overhead | 3 | 5 |
| 128 seeded rectangle sites | Moderate sketch setup | 3 | 5 |
| 512 seeded rectangle sites | Several-hundred-site motivating scale | 3 | 5 |
| 20 by 20 lattice | Structured ties and many on-edge insertions | 3 | 5 |
| 512 records repeating 16 sites | N-sized mappings with small U | 3 | 5 |
| 512 collinear sites | Lower-dimensional fast exit with retained maps | 3 | 5 |
| 32 mixed-scale sites | Exact predicates with very wide binary64 exponents | 2 | 3 |
| 2048 seeded rectangle sites | Declared stress workload | 2 | 3 |

The rectangle inputs use seed42 and independent construction per workload; these
are engineering samples, not surveyed baseline point sets. The source evidence for
several-hundred-site triangulation is reviewed in cp9-facet-marks-direction.md and
cp9-source-degeneracy-audit.md. The stress size and repetition counts are root's
measurement choices. Do not describe them as established useful artistic ranges.

Every call gets maxWork=50000000. This budget is a benchmark guard, not a public
default or suggested sketch setting. After a successful reference call, a separate
one-short call must fail with its exact final used count and no mesh. The empty
input and static errors are already shared conformance vectors, not throughput work.

## Measurements and acceptance

Measure eager generation separately from retained traversal and detached toValues
export. Report individual times and median; do not hide outliers. Measure current
thread allocated bytes through the pinned JDK's ThreadMXBean where supported, and
explicitly report unavailable measurement instead of making a memory claim. Also
report the primitive retained payload size derived from actual N/U/F/E counts;
that size excludes object/array headers and is not a measured total heap footprint.

Hash all coordinates, topology, maps and work through public getters/Into using
exact bits. Every repetition must reproduce the reference checksum. Traversal
reuses primitive buffers and compares its checksum to ordinary retained access;
the timed loop performs no export or fresh At-carrier allocation. Test export
separately. Shared fixture/native acceptance remains mandatory before performance
acceptance; repeatability alone does not prove correct triangulation.

Root reviews full output before accepting. Unexpected quadratic container copying,
mutation-history retention, data-dependent allocation growth beyond the declared
algorithm, work mismatch, budget failure on the registered ordinary inputs, or
failure to finish the bounded run requires investigation. Publish observations,
not a universal latency guarantee. If interactive example setup is too slow at its
chosen size, optimize while preserving output and then rerun the same workloads;
do not quietly reduce the example's capability or replace the algorithm to pass.

The initial run uses -Xmx512m and a 180-second external deadline. A timeout is a
preserved failed measurement, not permission to relabel a smaller test as the
registered stress result. Increasing a diagnostic deadline later requires an
explicitly recorded reason and a separate attempt directory.
