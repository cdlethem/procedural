# Private binary partition investigation

Not part of the shipped Java library. Specification:
`design/capabilities/cp17-prototype-spec.md`; results:
`evidence/parameter-experiments/cp17-binary-partition/decision.md`.
Implementation is independently specified; source provenance is in the direction document.

From the repository root, compile and run focused checks with the established JDK:

```sh
.work/toolchains/jdk-17.0.20.1+1/bin/javac --release 8 -d .work/cp17-prototype-check packages/java/src/main/java/org/procedurals/layout/QuadrantPartition2D.java tools/diagnostics/binarypartition/BinaryPartitionProbe.java tools/diagnostics/binarypartition/BinaryPartitionCheck.java
.work/toolchains/jdk-17.0.20.1+1/bin/java -cp .work/cp17-prototype-check org.procedurals.layout.BinaryPartitionCheck
```

For rendering, put copies of PanelStudy.pde and BinaryPartitionProbe.java together in a
fresh ignored directory. The helper compiles the adjacent Java tab against the accepted
JAR; the private class can access the established package-private stream in that JAR.

```sh
python3 tools/render_java.py .work/cp17-study-input/PanelStudy.pde --library .work/cp16-consumer-root2/extract/procedurals/library/procedurals.jar --seed 42 --param policy=0 --param decoration=0 --sweep attempts=20,80,240 --output .work/FRESH-cp17-count
```

For the other two runs, use all three `--param` inputs: attempts=80, policy=1,
decoration=0; then attempts=80, policy=0, decoration=1. Choose fresh output paths.
The helper acquires the shared machine render lease itself; do not wrap it in another lease.
The native study is JAVA2D only and does not establish P2D source reproduction or ports.
