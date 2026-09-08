#!/usr/bin/env python3
"""Build the additive CP2 Processing 0.2.0 library and check its extracted consumer."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import zipfile

from build_java_artifacts import ROOT, copy, digest, java_home, relative, write, zip_entries
from check_field_marks_pde import NAMES
from check_processing_runtime import CORE_SHA256

VERSION = "0.2.0"
OUTPUT = ROOT / ".work/dist/cp2/java"
EVIDENCE = ROOT / "evidence/distribution/cp2-java.json"


def run(command, *, cwd, env=None):
    return subprocess.run(list(map(str, command)), cwd=cwd, env=env, check=True,
                          capture_output=True, text=True, timeout=120)


def literal(value):
    if isinstance(value, dict):
        return "map(" + ",".join(json.dumps(k) + "," + literal(v) for k, v in value.items()) + ")"
    if isinstance(value, list):
        return "Arrays.<Object>asList(" + ",".join(map(literal, value)) + ")"
    return repr(value) + ("d" if isinstance(value, float) else "L")


def consumer_source(case):
    checks = []
    for i, point in enumerate(case["output"]["positions"]):
        for axis, value in enumerate(point):
            checks.append(f'near(path.pointAt({i})[{axis}],{literal(value)},{literal(case["comparison"]["positions_abs"])});')
    for i, value in enumerate(case["output"]["headings"]):
        checks.append(f'near(path.headingAt({i}),{literal(value)},{literal(case["comparison"]["headings_abs"])});')
    return '''import java.io.File;
import java.util.*;
import org.procedurals.paths.GradientPath2D;
public final class InstalledPathSmoke {
  static Map<String,Object> map(Object... pairs) {
    Map<String,Object> m=new LinkedHashMap<String,Object>();
    for(int i=0;i<pairs.length;i+=2)m.put((String)pairs[i],pairs[i+1]); return m;
  }
  static void near(double actual,double expected,double tolerance) {
    if(!Double.isFinite(actual)||Math.abs(actual-expected)>tolerance)throw new AssertionError("fixture mismatch");
  }
  public static void main(String[] args)throws Exception {
    String actual=GradientPath2D.class.getProtectionDomain().getCodeSource().getLocation().toString();
    if(!actual.equals(new File(args[0]).getCanonicalFile().toURI().toURL().toString()))
      throw new AssertionError("core did not resolve to extracted JAR");
    GradientPath2D path=GradientPath2D.trace(__INPUT__);
    __CHECKS__
    GradientPath2D replay=GradientPath2D.trace(path.serialize());
    if(replay.steps()!=path.steps())throw new AssertionError("replay count");
    for(int i=0;i<=path.steps();i++)if(!Arrays.equals(path.pointAt(i),replay.pointAt(i)))throw new AssertionError("replay");
    for(int i=0;i<path.steps();i++)if(Double.doubleToLongBits(path.headingAt(i))!=Double.doubleToLongBits(replay.headingAt(i)))throw new AssertionError("replay heading");
    System.out.println("code_source="+actual);
  }
}
'''.replace("__INPUT__", literal(case["input"])).replace("__CHECKS__", "\n    ".join(checks))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home")
    parser.add_argument("--processing-core", type=Path,
                        default=ROOT / ".work/toolchains/processing-4.5.6/core-4.5.6.jar")
    args = parser.parse_args()
    if OUTPUT.exists() or EVIDENCE.exists():
        raise RuntimeError("CP2 Java output already exists; preserve and review it before another build")
    home = java_home(args.java_home)
    runtime = args.processing_core.resolve()
    if digest(runtime) != CORE_SHA256:
        raise RuntimeError("expected pinned Processing 4.5.6 runtime")
    preprocessor = [ROOT / ".work/toolchains/processing-4.5.6/preprocessor" / name for name in NAMES]
    core_sources = sorted((ROOT / "packages/java/src/main/java").rglob("*.java"))
    adapter_sources = sorted((ROOT / "packages/java-processing/src/main/java").rglob("*.java"))
    tabs = [ROOT / "packages/java-processing/examples/PathMarks" / name
            for name in ("PathMarks.pde", "PathMarksCanvas.java")]
    tabs.append(ROOT / "packages/java/examples/PathMarks/PathMarkComposition.java")
    notices = [ROOT / name for name in ("LICENSE", "THIRD_PARTY_NOTICES.md")]
    fixture = ROOT / "fixtures/operations/gradient-path.json"
    review_path = ROOT / "evidence/reproductions/cp2-java2d/review.json"
    review = json.loads(review_path.read_text())
    if (review.get("status"), review.get("owner"), review.get("reviewer")) != ("accepted", "root", "Sol"):
        raise RuntimeError("native scope not accepted")
    for name, sha in (review["implementation_sha256"] | review["evidence_sha256"]).items():
        if digest(ROOT / name) != sha:
            raise RuntimeError("native review binding changed: " + name)
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    probe = ROOT / "tests/native/PathMarksPdeConfiguration.java"
    inputs = [*core_sources, *adapter_sources, *tabs, *notices, fixture, review_path,
              bridge, probe, runtime, *preprocessor, Path(__file__).resolve(),
              ROOT / "tools/build_java_artifacts.py", ROOT / "design/cp2-distribution-plan.md"]
    hashes = {relative(p): digest(p) for p in inputs}
    build = OUTPUT / "build"
    classes = build / "classes"
    classes.mkdir(parents=True)
    core = OUTPUT / f"procedurals-core-{VERSION}.jar"
    adapter = OUTPUT / f"procedurals-processing-adapter-{VERSION}.jar"
    run([home / "bin/javac", "--release", "8", "-d", classes, *core_sources], cwd=build)
    for notice in notices:
        copy(notice, classes / "META-INF" / notice.name)
    run([home / "bin/jar", "cf", core, "-C", classes, "."], cwd=build)
    adapter_classes = build / "adapter-classes"
    adapter_classes.mkdir()
    run([home / "bin/javac", "--release", "8", "-cp", os.pathsep.join(map(str, (core, runtime))),
         "-d", adapter_classes, *adapter_sources], cwd=build)
    for notice in notices:
        copy(notice, adapter_classes / "META-INF" / notice.name)
    run([home / "bin/jar", "cf", adapter, "-C", adapter_classes, "."], cwd=build)
    library = build / "procedurals"
    copy(core, library / "library/procedurals.jar")
    copy(adapter, library / "library/procedurals-processing-adapter.jar")
    for tab in tabs:
        copy(tab, library / "examples/PathMarks" / tab.name)
    for notice in notices:
        copy(notice, library / notice.name)
    write(library / "library.properties", """name=Procedurals
category=Utilities
sentence=Portable generative-art operations with editable examples.
paragraph=Regular grid, gradient noise, cyclic palette and retained gradient paths.
url=https://github.com/cdlethem/procedural
version=2
prettyVersion=0.2.0
minRevision=0
maxRevision=
authors=Colin Lethem
maintainer=Colin Lethem
""")
    write(library / "examples/PathMarks/README.md", """# PathMarks

Install the procedurals folder in your Processing sketchbook's libraries directory.
Open examples/PathMarks/PathMarks.pde in Processing 4.5.6 (JAVA2D).
Copy the sketch before editing. M switches traces/marks; L changes mark length;
C changes palette; N changes step count; D changes distance; S saves the canvas.
Edit PathMarkComposition.create for starting positions and field mapping; edit
PathMarkComposition.mark for the mark. Style edits retain movement; count/distance
edits rebuild it. Constants describe this piece, not recommended library ranges.
This piece uses a gradient field, with possible horizontal runs and canvas exits.
It is a new composition motivated by ciserp, mantel, natalata and limo002.
See the package repository's docs/path-marks.md for provenance and validation scope.
""")
    archive_path = OUTPUT / f"procedurals-processing-{VERSION}.zip"
    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(library.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(build))
    consumer = OUTPUT / "consumer"
    with zipfile.ZipFile(archive_path) as archive:
        archive.extractall(consumer)
    extracted = consumer / "procedurals"
    extracted_core = extracted / "library/procedurals.jar"
    extracted_adapter = extracted / "library/procedurals-processing-adapter.jar"
    example = extracted / "examples/PathMarks"
    cp = os.pathsep.join(map(str, (extracted_core, extracted_adapter, runtime)))
    consumer_classes = consumer / "classes"
    consumer_classes.mkdir()
    case = next(c for c in json.loads(fixture.read_text())["cases"] if c["id"] == "evolving-field")
    smoke = consumer / "InstalledPathSmoke.java"
    write(smoke, consumer_source(case))
    run([home / "bin/javac", "--release", "8", "-cp", extracted_core,
         "-d", consumer_classes, smoke], cwd=consumer)
    result = run([home / "bin/java", "-cp", str(consumer_classes) + os.pathsep + cp,
                  "InstalledPathSmoke", extracted_core], cwd=consumer)
    pre_cp = os.pathsep.join(map(str, (runtime, *preprocessor)))
    run([home / "bin/javac", "-cp", pre_cp, "-d", consumer_classes, bridge], cwd=consumer)
    environment = os.environ.copy()
    for key in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"):
        environment.pop(key, None)
    (consumer / "home").mkdir()
    generated = consumer / "PathMarks.java"
    run([home / "bin/java", f'-Duser.home={consumer / "home"}', "-cp",
         str(consumer_classes) + os.pathsep + pre_cp, "PreprocessSketch",
         example / "PathMarks.pde", generated, "PathMarks"], cwd=consumer, env=environment)
    run([home / "bin/javac", "--release", "17", "-cp", cp, "-d", consumer_classes,
         *sorted(example.glob("*.java")), generated, probe], cwd=consumer)
    run([home / "bin/java", "-cp", str(consumer_classes) + os.pathsep + cp,
         "PathMarksPdeConfiguration"], cwd=consumer)
    if hashes != {relative(p): digest(p) for p in inputs}:
        raise RuntimeError("distribution inputs changed during build")
    report = {"status": "passed", "package_version": VERSION,
              "scope": "Local Processing installation and extracted JAR/PathMarks consumer only; no new native rendering",
              "input_sha256": hashes,
              "artifacts": {name: {"path": relative(path), "sha256": digest(path), "entries": zip_entries(path)}
                            for name, path in (("core", core), ("adapter", adapter), ("starter", archive_path))},
              "consumer": {"fixture": case["id"], "fixture_output_passed": True, "serialization_replay_passed": True,
                           "artifact_origin": result.stdout.strip(), "official_pde_compilation_passed": True,
                           "binary64_distance_edits_passed": True},
              "starter_transformations": [],
              "metadata": "Authored package metadata 0.2.0; operation contract version remains 0.1.0",
              "runtime": run([home / "bin/java", "-version"], cwd=consumer).stderr.strip()}
    write(EVIDENCE, json.dumps(report, indent=2) + "\n")
    write(OUTPUT / "result.json", json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "evidence": relative(EVIDENCE), "starter": relative(archive_path)}))


if __name__ == "__main__":
    main()
