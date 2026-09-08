#!/usr/bin/env python3
"""Stage a Java 0.11.0 archive after CP11 Processing acceptance.

Without ``--build`` this command only reports the pending gate.  It never creates
an archive or edits evidence.  Building is intentionally blocked until the actual
LatticeMarks JAVA2D review is accepted by root.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ARCHIVE = ROOT / ".work/dist/cp10/java/procedurals-processing-0.10.0.zip"
SOURCE_REVIEW = ROOT / "evidence/distribution/cp10-review.json"
CP11_STAGE = ROOT / ".work/examples/cp11-candidate2"
CP11_STAGE_RESULT = CP11_STAGE / "result.json"
CP11_CORE_REVIEW = ROOT / "evidence/conformance/occupied-lattice-java-root-review.json"
CP11_RENDER_RESULT = ROOT / "evidence/reproductions/cp11-java2d/result.json"
CP11_RENDER_REVIEW = ROOT / "evidence/reproductions/cp11-java2d/root-review.json"
OUTPUT_DEFAULT = ROOT / ".work/dist/cp11/java"
ARCHIVE_NAME = "procedurals-processing-0.11.0.zip"
CORE_MEMBER = "procedurals/library/procedurals.jar"
PROPERTIES_MEMBER = "procedurals/library.properties"
CORE_SOURCE = ROOT / "packages/java/src/main/java/org/procedurals/paths/OccupiedLatticePaths2D.java"
HELPER_SOURCE = ROOT / "packages/java/examples/LatticeMarks/LatticeComposition.java"
PDE_SOURCE = ROOT / "packages/java-processing/examples/LatticeMarks/LatticeMarks.pde"
CATALOG_SOURCE = ROOT / "catalog/operations/occupied-lattice-paths-2d.json"
GUIDE_SOURCE = ROOT / "docs/lattice-marks.md"
INSTALL_SOURCE = ROOT / "docs/installing-lattice-marks.md"

DOCUMENTS = (
    "getting-started.md", "path-marks.md", "placement-marks.md", "region-marks.md",
    "grain-marks.md", "branch-marks.md", "profile-marks.md", "glyph-marks.md",
    "facet-marks.md", "spring-marks.md", "lattice-marks.md", "installing-profile-marks.md",
    "installing-glyph-marks.md", "installing-facet-marks.md", "installing-spring-marks.md", "installing-lattice-marks.md",
    "reference/operations.md",
)
PREVIOUS_STARTERS = (
    "FieldMarks", "PathMarks", "PlacementMarks", "RegionMarks", "GrainMarks",
    "BranchMarks", "ProfileMarks", "GlyphMarks", "FacetMarks", "SpringMarks",
)


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def relative(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT))


def safe_member(name: str) -> None:
    value = Path(name)
    if not name or value.is_absolute() or ".." in value.parts or "\\" in name or not name.startswith("procedurals/"):
        raise RuntimeError("unsafe package member: " + name)


def zip_payloads(path: Path) -> tuple[dict[str, bytes], dict[str, zipfile.ZipInfo]]:
    with zipfile.ZipFile(path) as archive:
        entries = [item for item in archive.infolist() if not item.is_dir()]
        names = [item.filename for item in entries]
        if len(names) != len(set(names)):
            raise RuntimeError("duplicate archive member: " + str(path))
        for name in names:
            safe_member(name)
        return ({name: archive.read(name) for name in names}, {item.filename: item for item in entries})


def require_file(path: Path) -> None:
    if not path.is_file():
        raise RuntimeError("required CP11 input missing: " + str(path))


def require_bindings() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    for path in (SOURCE_ARCHIVE, SOURCE_REVIEW, CP11_STAGE_RESULT, CP11_CORE_REVIEW,
                 CP11_RENDER_RESULT, CP11_RENDER_REVIEW, CORE_SOURCE, HELPER_SOURCE,
                 PDE_SOURCE, CATALOG_SOURCE, GUIDE_SOURCE, INSTALL_SOURCE,
                 CP11_STAGE / "LatticeMarks/code/procedurals.jar",
                 CP11_STAGE / "LatticeMarks/LatticeComposition.java",
                 CP11_STAGE / "LatticeMarks/LatticeMarks.pde"):
        require_file(path)

    cp10 = json.loads(SOURCE_REVIEW.read_text())
    if cp10.get("status") != "accepted" or cp10.get("owner") != "root" or cp10.get("reviewer") != "root":
        raise RuntimeError("accepted CP10 distribution review is required")
    if cp10.get("final_archive", {}).get("sha256") != digest(SOURCE_ARCHIVE):
        raise RuntimeError("CP10 distribution review does not bind its archive")

    stage = json.loads(CP11_STAGE_RESULT.read_text())
    if stage.get("status") != "passed" or stage.get("scope", "").find("no native render") < 0:
        raise RuntimeError("CP11 staged candidate must be the recorded no-render candidate")
    before = stage.get("inputs_before")
    after = stage.get("inputs_after")
    if not isinstance(before, dict) or before != after:
        raise RuntimeError("CP11 staged candidate input bindings are incomplete")
    stage_paths = {
        HELPER_SOURCE: "packages/java/examples/LatticeMarks/LatticeComposition.java",
        PDE_SOURCE: "packages/java-processing/examples/LatticeMarks/LatticeMarks.pde",
        CORE_SOURCE: "packages/java/src/main/java/org/procedurals/paths/OccupiedLatticePaths2D.java",
    }
    for path, name in stage_paths.items():
        if before.get(name) != digest(path):
            raise RuntimeError("CP11 staged candidate binding is stale: " + name)
    for path, name in ((HELPER_SOURCE, "LatticeComposition.java"), (PDE_SOURCE, "LatticeMarks.pde")):
        staged = CP11_STAGE / "LatticeMarks" / name
        if staged.read_bytes() != path.read_bytes():
            raise RuntimeError("staged LatticeMarks source differs from canonical source: " + name)
    jar_name = ".work/examples/cp11-candidate2/LatticeMarks/code/procedurals.jar"
    if stage.get("artifacts_sha256", {}).get(jar_name) != digest(CP11_STAGE / "LatticeMarks/code/procedurals.jar"):
        raise RuntimeError("CP11 staged candidate JAR binding is stale")

    core = json.loads(CP11_CORE_REVIEW.read_text())
    if core.get("status") != "accepted" or core.get("reviewer") != "root":
        raise RuntimeError("accepted CP11 Java core review is required")
    if core.get("core_sha256") != digest(CORE_SOURCE):
        raise RuntimeError("CP11 Java core source changed after accepted review")

    render = json.loads(CP11_RENDER_RESULT.read_text())
    review = json.loads(CP11_RENDER_REVIEW.read_text())
    if render.get("status") != "passed":
        raise RuntimeError("CP11 JAVA2D result is not passed")
    if review.get("status") != "accepted" or review.get("owner") != "root" or review.get("reviewer") != "root":
        raise RuntimeError("accepted CP11 JAVA2D root review is required")
    if review.get("result_sha256") != digest(CP11_RENDER_RESULT):
        raise RuntimeError("CP11 JAVA2D root review does not bind its result")
    render_bindings = render.get("input_sha256")
    if not isinstance(render_bindings, dict):
        raise RuntimeError("CP11 JAVA2D result lacks source bindings")
    for name, expected in {**before, **stage.get("artifacts_sha256", {})}.items():
        if render_bindings.get(name) != expected:
            raise RuntimeError("CP11 JAVA2D result does not bind stable staged input: " + name)
    for path in (HELPER_SOURCE, PDE_SOURCE):
        key = relative(path)
        if review.get("input_sha256", {}).get(key) != digest(path):
            raise RuntimeError("CP11 JAVA2D review does not bind current source: " + key)
    return cp10, stage, core, review


def replacement_jar(old_jar: bytes, candidate_path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(io.BytesIO(old_jar)) as old_archive, zipfile.ZipFile(candidate_path) as candidate_archive:
        old_entries = [item for item in old_archive.infolist() if not item.is_dir()]
        candidate_entries = [item for item in candidate_archive.infolist() if not item.is_dir()]
        old_names = [item.filename for item in old_entries]
        candidate_names = [item.filename for item in candidate_entries]
        if len(old_names) != len(set(old_names)) or len(candidate_names) != len(set(candidate_names)):
            raise RuntimeError("duplicate core JAR member")
        old = {item.filename: old_archive.read(item) for item in old_entries}
        candidate = {item.filename: candidate_archive.read(item) for item in candidate_entries}
        for archive in (old_archive, candidate_archive):
            if archive.testzip() is not None:
                raise RuntimeError("core JAR CRC check failed")
    missing = sorted(set(old) - set(candidate))
    changed = sorted(name for name in old if candidate.get(name) != old[name])
    if missing or changed:
        raise RuntimeError("candidate core JAR does not preserve prior entries: " + ", ".join((missing + changed)[:3]))
    added = sorted(set(candidate) - set(old))
    if not added or any(not (name.startswith("org/procedurals/paths/OccupiedLatticePaths2D") and name.endswith(".class")) for name in added):
        raise RuntimeError("candidate core JAR contains additions beyond OccupiedLatticePaths2D classes")
    if "org/procedurals/paths/OccupiedLatticePaths2D.class" not in added:
        raise RuntimeError("candidate core JAR lacks OccupiedLatticePaths2D.class")
    return {
        "prior_sha256": hashlib.sha256(old_jar).hexdigest(),
        "candidate_sha256": digest(candidate_path),
        "added_members": {name: hashlib.sha256(candidate[name]).hexdigest() for name in added},
        "preserved_prior_members": len(old),
    }


def documents() -> dict[str, Path]:
    result: dict[str, Path] = {}
    for name in DOCUMENTS:
        source = ROOT / "docs" / name
        require_file(source)
        result["procedurals/docs/" + name] = source
    return result


def source_catalogs(old: dict[str, bytes]) -> dict[str, Path]:
    result: dict[str, Path] = {}
    prefix = "procedurals/catalog/operations/"
    for member in old:
        if member.startswith(prefix) and member.endswith(".json"):
            source = ROOT / "catalog/operations" / member[len(prefix):]
            require_file(source)
            result[member] = source
    result["procedurals/catalog/operations/occupied-lattice-paths-2d.json"] = CATALOG_SOURCE
    return result


def properties(payload: bytes) -> bytes:
    text = payload.decode("utf-8")
    if "version=10\nprettyVersion=0.10.0\n" not in text:
        raise RuntimeError("source library.properties is not 0.10.0")
    return text.replace("version=10\nprettyVersion=0.10.0\n", "version=11\nprettyVersion=0.11.0\n", 1).encode("utf-8")


def write_archive(old: dict[str, bytes], infos: dict[str, zipfile.ZipInfo], docs: dict[str, Path],
                  catalogs: dict[str, Path], candidate_jar: Path, jar_check: dict[str, Any], output: Path) -> dict[str, Any]:
    archive_path = output / ARCHIVE_NAME
    if output.exists() or archive_path.exists():
        raise RuntimeError("CP11 output/archive exists; refusing overwrite")
    if CORE_MEMBER not in old or PROPERTIES_MEMBER not in old:
        raise RuntimeError("CP10 archive misses core JAR or library properties")
    for starter in PREVIOUS_STARTERS:
        if not any(name.startswith("procedurals/examples/" + starter + "/") for name in old):
            raise RuntimeError("CP10 archive misses prior starter: " + starter)
    additions = {
        "procedurals/examples/LatticeMarks/LatticeComposition.java": HELPER_SOURCE,
        "procedurals/examples/LatticeMarks/LatticeMarks.pde": PDE_SOURCE,
        "procedurals/catalog/operations/occupied-lattice-paths-2d.json": CATALOG_SOURCE,
    }
    if any(name in old for name in additions):
        raise RuntimeError("CP11 archive member already exists")
    replacements = {
        CORE_MEMBER: candidate_jar.read_bytes(),
        PROPERTIES_MEMBER: properties(old[PROPERTIES_MEMBER]),
    }
    replacements.update({member: path.read_bytes() for member, path in docs.items() if member in old})
    replacements.update({member: path.read_bytes() for member, path in catalogs.items() if member in old})
    output.mkdir(parents=True)
    with zipfile.ZipFile(archive_path, "x", zipfile.ZIP_DEFLATED) as archive:
        for name, payload in old.items():
            info = infos[name]
            item = zipfile.ZipInfo(name)
            item.date_time = info.date_time
            item.external_attr = info.external_attr
            item.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(item, replacements.get(name, payload))
        for member, source in {**{name: path for name, path in docs.items() if name not in old},
                               **{name: path for name, path in catalogs.items() if name not in old},
                               **additions}.items():
            safe_member(member)
            archive.writestr(member, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)

    current, _ = zip_payloads(archive_path)
    if current.get(CORE_MEMBER) != candidate_jar.read_bytes() or current.get(PROPERTIES_MEMBER) != replacements[PROPERTIES_MEMBER]:
        raise RuntimeError("CP11 replacement payload mismatch")
    allowed = set(replacements) | set(additions)
    for name, payload in old.items():
        if name not in allowed and current.get(name) != payload:
            raise RuntimeError("inherited archive payload changed: " + name)
    for member, source in {**docs, **catalogs, **additions}.items():
        if current.get(member) != source.read_bytes():
            raise RuntimeError("archive member mismatch: " + member)
    previous_starter_count = sum(any(name.startswith("procedurals/examples/" + starter + "/") for name in old) for starter in PREVIOUS_STARTERS)
    previous_operation_count = sum(name.startswith("procedurals/catalog/operations/") and name.endswith(".json") for name in old)
    starter_count = sum(any(name.startswith("procedurals/examples/" + starter + "/") for name in current) for starter in PREVIOUS_STARTERS + ("LatticeMarks",))
    operation_count = sum(name.startswith("procedurals/catalog/operations/") and name.endswith(".json") for name in current)
    if starter_count != previous_starter_count + 1 or operation_count != previous_operation_count + 1:
        raise RuntimeError("CP11 archive layout has unexpected starters/operations")
    return {
        "archive_path": relative(archive_path),
        "archive_sha256": digest(archive_path),
        "archive_members": len(current),
        "previous_starters": previous_starter_count,
        "starters": starter_count,
        "previous_operations": previous_operation_count,
        "operations": operation_count,
        "core_jar": jar_check,
        "added_members": {name: {"source": relative(path), "sha256": digest(path)} for name, path in additions.items()},
        "preserved_inherited_payloads": len(old) - len(set(replacements)),
    }


def build(output: Path) -> None:
    cp10, stage, core, render = require_bindings()
    old, infos = zip_payloads(SOURCE_ARCHIVE)
    candidate = CP11_STAGE / "LatticeMarks/code/procedurals.jar"
    jar_check = replacement_jar(old[CORE_MEMBER], candidate)
    docs = documents()
    catalogs = source_catalogs(old)
    inputs = [Path(__file__).resolve(), SOURCE_ARCHIVE, SOURCE_REVIEW, CP11_STAGE_RESULT,
              CP11_CORE_REVIEW, CP11_RENDER_RESULT, CP11_RENDER_REVIEW, CORE_SOURCE,
              HELPER_SOURCE, PDE_SOURCE, CATALOG_SOURCE, GUIDE_SOURCE, INSTALL_SOURCE,
              candidate, CP11_STAGE / "LatticeMarks/LatticeComposition.java",
              CP11_STAGE / "LatticeMarks/LatticeMarks.pde", *docs.values(), *catalogs.values()]
    before = {relative(path): digest(path) for path in inputs}
    layout = write_archive(old, infos, docs, catalogs, candidate, jar_check, output)
    after = {relative(path): digest(path) for path in inputs}
    if before != after:
        raise RuntimeError("CP11 inputs changed during packaging")
    report = {
        "status": "staged",
        "review_status": "pending_root_distribution_review",
        "scope": "Local Java 0.11.0 archive with eleven starters and fourteen operations; CP11 JAVA2D workflow evidence is bound, but registry publication and other targets are not claimed.",
        "input_sha256": before,
        "input_sha256_after": after,
        "accepted_cp10_review": {"path": relative(SOURCE_REVIEW), "sha256": digest(SOURCE_REVIEW), "status": cp10["status"]},
        "accepted_cp11_core_review": {"path": relative(CP11_CORE_REVIEW), "sha256": digest(CP11_CORE_REVIEW), "status": core["status"]},
        "accepted_cp11_java2d_review": {"path": relative(CP11_RENDER_REVIEW), "sha256": digest(CP11_RENDER_REVIEW), "status": render["status"]},
        "layout": layout,
        "library_properties": {"version": 11, "pretty_version": "0.11.0"},
        "documents": {member: {"source": relative(source), "sha256": digest(source)} for member, source in docs.items()},
        "catalogs": {member: {"source": relative(source), "sha256": digest(source)} for member, source in catalogs.items()},
    }
    (output / "result.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": "staged", "archive": layout["archive_path"], "report": relative(output / "result.json")}, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", help="write the fresh archive after accepted CP11 JAVA2D review")
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT)
    args = parser.parse_args()
    output = args.output.resolve()
    if output != ROOT / ".work" and ROOT / ".work" not in output.parents:
        raise RuntimeError("output must be inside repository .work: " + str(output))
    if output.exists():
        raise RuntimeError("refusing existing CP11 output directory: " + str(output))
    if not args.build:
        print(json.dumps({"status": "prepared", "review_gate": "pending evidence/reproductions/cp11-java2d/root-review.json", "output": relative(output / ARCHIVE_NAME)}, sort_keys=True))
        return
    build(output)


if __name__ == "__main__":
    main()
