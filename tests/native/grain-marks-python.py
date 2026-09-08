#!/usr/bin/env python3
"""Compare six actual Java/Python GrainMarks compositions by raw binary64 bits."""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
PYTHON_MODEL = ROOT / "packages/python/examples/grain_marks/grain_marks.py"
PYTHON_TRIANGLE = ROOT / "packages/python/procedurals/triangle_points.py"
PYTHON_QUADRANT = ROOT / "packages/python/procedurals/quadrant_partition.py"
JAVA_MODEL = ROOT / "packages/java/examples/GrainMarks/GrainComposition.java"
JAVA_TRIANGLE = ROOT / "packages/java/src/main/java/org/procedurals/sampling/TrianglePoints2D.java"
JAVA_QUADRANT = ROOT / "packages/java/src/main/java/org/procedurals/layout/QuadrantPartition2D.java"
sys.path[:0] = [str(ROOT / "packages/python/examples/grain_marks"), str(ROOT / "packages/python")]
from grain_marks import create_grain_composition  # noqa: E402

CASES = ((42, .1, 0, False), (43, .2, 0, False), (42, .1, 1, False),
         (42, .1, 2, False), (42, .1, 0, True), (43, .1, 2, True))

PROBE = """import org.procedurals.examples.grainmarks.GrainComposition;
import org.procedurals.sampling.TrianglePoints2D;
public class GrainParity {
 static void emit(double v){System.out.println(Long.toUnsignedString(Double.doubleToRawLongBits(v),16));}
 public static void main(String[] args){
  GrainComposition[] cases={GrainComposition.create(42,.1,0,false),GrainComposition.create(43,.2,0,false),
   GrainComposition.create(42,.1,1,false),GrainComposition.create(42,.1,2,false),
   GrainComposition.create(42,.1,0,true),GrainComposition.create(43,.1,2,true)};
  double[] p=new double[2];
  for(GrainComposition c:cases){
   System.out.println(c.size());System.out.println(c.totalPoints());
   for(int r=0;r<c.size();r++){TrianglePoints2D points=c.regionAt(r);System.out.println(points.size());
    for(int i=0;i<points.size();i++){points.pointInto(i,p,0);emit(p[0]);emit(p[1]);}
   }
  }
 }
}"""


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def bits(value: float) -> str:
    return struct.pack(">d", value).hex().lstrip("0") or "0"


def hashes(files):
    return {str(path.relative_to(ROOT)): digest(path) for path in files}


def python_lines():
    lines, counts = [], []
    for seed, density, distribution, cells in CASES:
        composition = create_grain_composition(seed, density, distribution, cells)
        lines.extend((str(composition.size), str(composition.total_points)))
        counts.append(composition.size)
        for region_index in range(composition.size):
            region = composition.region_at(region_index)
            lines.append(str(region.size))
            point = [0.0, 0.0]
            for point_index in range(region.size):
                if region.point_into(point_index, point) is not None:
                    raise AssertionError("triangle point_into return")
                lines.extend((bits(point[0]), bits(point[1])))
    return lines, counts


def check_local_behavior():
    for value in ((-1, .1, 0, False), (42, -1, 0, False), (42, .1, 3, False), (42, .1, 0, 0)):
        try:
            create_grain_composition(*value)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid example configuration accepted")
    try:
        create_grain_composition(42, 2.0, 0, False)
    except ValueError as error:
        if str(error) != "example exceeds 160000-point work budget":
            raise
    else:
        raise AssertionError("160000-point budget accepted overflow")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output, java_home = args.output.resolve(), args.java_home.resolve()
    if not output.is_relative_to((ROOT / ".work").resolve()) or output.exists():
        raise ValueError("output must be a fresh directory under .work")
    javac, java = java_home / "bin/javac", java_home / "bin/java"
    if not javac.is_file() or not java.is_file():
        raise FileNotFoundError("JDK executables missing")
    files = [Path(__file__).resolve(), PYTHON_MODEL, PYTHON_TRIANGLE, PYTHON_QUADRANT,
             JAVA_MODEL, JAVA_TRIANGLE, JAVA_QUADRANT, java_home / "release", java_home / "lib/modules"]
    before = hashes(files)
    output.mkdir(parents=True)
    probe = output / "GrainParity.java"
    probe.write_text(PROBE, encoding="utf-8")
    try:
        subprocess.run([javac, "--release", "8", "-d", output, JAVA_MODEL, JAVA_TRIANGLE,
                        JAVA_QUADRANT, probe], cwd=ROOT, check=True, capture_output=True, text=True, timeout=60)
        expected = subprocess.run([java, "-cp", output, "GrainParity"], cwd=ROOT, check=True,
                                  capture_output=True, text=True, timeout=60).stdout.splitlines()
        actual, triangle_counts = python_lines()
        if actual != expected:
            raise AssertionError("Java/Python composition differs")
        if triangle_counts != [1, 1, 1, 1, 26, 26]:
            raise AssertionError("unexpected single/cell region transfer")
        check_local_behavior()
        after = hashes(files)
        if before != after:
            raise RuntimeError("sources changed during parity check")
        report = {
            "status": "passed",
            "scope": "Six actual Java/Python GrainMarks composition comparisons; no native render or acceptance claim.",
            "comparison": "region/point counts and every point in raw binary64, including Java Random caller substitutions",
            "cases": [{"seed": seed, "density": density, "distribution": distribution, "cells": cells}
                      for seed, density, distribution, cells in CASES],
            "triangle_counts": triangle_counts,
            "input_sha256_before": before, "input_sha256_after": after,
            "toolchain": {"python_executable": str(Path(sys.executable).resolve()),
                          "python_executable_sha256": digest(Path(sys.executable).resolve()),
                          "python_version": sys.version,
                          "java_home": str(java_home), "java_release_sha256": digest(java_home / "release"),
                          "java_modules_sha256": digest(java_home / "lib/modules")},
            "local_behavior": ["configuration validation", "160000-point preflight budget", "quadrant transfer"],
        }
        (output / "result.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"status": "passed", "triangle_counts": triangle_counts,
                          "output": str(output.relative_to(ROOT))}))
    except Exception:
        # Preserve the fresh diagnostic directory, matching the established JavaScript runner.
        raise


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
