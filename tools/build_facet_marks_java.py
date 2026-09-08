#!/usr/bin/env python3
"""Stage local Java 0.9.0 from the accepted CP8 archive plus accepted FacetMarks inputs.

Without --build this command only reports its proposed inputs.  It never compiles or
renders: the new core JAR is the exact JAR used by the accepted FacetMarks run.
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
SOURCE_ARCHIVE = ROOT / ".work/dist/cp8/java/procedurals-processing-0.8.0.zip"
SOURCE_REVIEW = ROOT / "evidence/distribution/cp8-review.json"
OUTPUT = ROOT / ".work/dist/cp9/java"
ARCHIVE = OUTPUT / "procedurals-processing-0.9.0.zip"
REPORT = ROOT / "evidence/distribution/cp9-java.json"
CANDIDATE = ROOT / ".work/examples/cp9-candidate1/FacetMarks"
NATIVE_RESULT = ROOT / "evidence/reproductions/cp9-java2d/result.json"
NATIVE_REVIEW = ROOT / "evidence/reproductions/cp9-java2d/root-review.json"
CORE_MEMBER = "procedurals/library/procedurals.jar"
PROPERTIES_MEMBER = "procedurals/library.properties"
CORE_SOURCE = ROOT / "packages/java/src/main/java/org/procedurals/topology/Delaunay2D.java"
HELPER_SOURCE = ROOT / "packages/java/examples/FacetMarks/FacetComposition.java"
PDE_SOURCE = ROOT / "packages/java-processing/examples/FacetMarks/FacetMarks.pde"
CORE_CANDIDATE = CANDIDATE / "code/procedurals.jar"
HELPER_CANDIDATE = CANDIDATE / "FacetComposition.java"
PDE_CANDIDATE = CANDIDATE / "FacetMarks.pde"

DOCUMENTS = (
    "getting-started.md", "path-marks.md", "placement-marks.md", "region-marks.md",
    "grain-marks.md", "branch-marks.md", "profile-marks.md", "glyph-marks.md",
    "facet-marks.md", "installing-profile-marks.md", "installing-glyph-marks.md",
    "installing-facet-marks.md", "reference/operations.md",
)
PREVIOUS_STARTERS = (
    "FieldMarks", "PathMarks", "PlacementMarks", "RegionMarks", "GrainMarks",
    "BranchMarks", "ProfileMarks", "GlyphMarks",
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
    if not name or value.is_absolute() or ".." in value.parts or not name.startswith("procedurals/"):
        raise RuntimeError("unsafe package member: " + name)


def zip_payloads(path: Path) -> tuple[dict[str, bytes], dict[str, zipfile.ZipInfo]]:
    with zipfile.ZipFile(path) as archive:
        names = [item.filename for item in archive.infolist() if not item.is_dir()]
        if len(names) != len(set(names)):
            raise RuntimeError("duplicate file member in archive: " + str(path))
        for name in names:
            safe_member(name)
        return ({name: archive.read(name) for name in names},
                {item.filename: item for item in archive.infolist() if not item.is_dir()})


def documents() -> dict[str, Path]:
    output: dict[str, Path] = {}
    for name in DOCUMENTS:
        source = ROOT / "docs" / name
        if not source.is_file():
            raise RuntimeError("required CP9 document missing: " + str(source))
        output["procedurals/docs/" + name] = source
    return output


def source_catalogs(old: dict[str, bytes]) -> dict[str, Path]:
    output: dict[str, Path] = {}
    for member in old:
        prefix = "procedurals/catalog/operations/"
        if member.startswith(prefix) and member.endswith(".json"):
            source = ROOT / "catalog/operations" / member[len(prefix):]
            if not source.is_file():
                raise RuntimeError("inherited catalog source missing: " + str(source))
            output[member] = source
    delaunay = ROOT / "catalog/operations/delaunay-2d.json"
    if not delaunay.is_file():
        raise RuntimeError("CP9 Delaunay catalog missing: " + str(delaunay))
    output["procedurals/catalog/operations/delaunay-2d.json"] = delaunay
    return output


def expected_properties(original: bytes) -> bytes:
    old = "version=8\nprettyVersion=0.8.0\n"
    new = "version=9\nprettyVersion=0.9.0\n"
    text = original.decode("utf-8")
    if old not in text:
        raise RuntimeError("accepted CP8 library.properties does not have version 8")
    return text.replace(old, new, 1).encode("utf-8")


def require_accepted_evidence() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    for path in (SOURCE_ARCHIVE, SOURCE_REVIEW, NATIVE_RESULT, NATIVE_REVIEW,
                 CORE_SOURCE, HELPER_SOURCE, PDE_SOURCE, CORE_CANDIDATE,
                 HELPER_CANDIDATE, PDE_CANDIDATE):
        if not path.is_file():
            raise RuntimeError("required CP9 distribution input missing: " + str(path))
    cp8 = json.loads(SOURCE_REVIEW.read_text())
    if cp8.get("status") != "accepted" or cp8.get("owner") != "root" or cp8.get("reviewer") != "root":
        raise RuntimeError("accepted CP8 package review is required")
    if cp8.get("final_archive", {}).get("sha256") != digest(SOURCE_ARCHIVE):
        raise RuntimeError("CP8 review does not bind source archive bytes")

    result = json.loads(NATIVE_RESULT.read_text())
    review = json.loads(NATIVE_REVIEW.read_text())
    if result.get("status") != "passed" or review.get("status") != "accepted":
        raise RuntimeError("accepted CP9 native result and root review are required")
    if review.get("owner") != "root" or review.get("reviewer") != "root":
        raise RuntimeError("CP9 root review ownership is unexpected")
    if review.get("evidence_sha256", {}).get(relative(NATIVE_RESULT)) != digest(NATIVE_RESULT):
        raise RuntimeError("CP9 root review does not bind current native result")
    before = result.get("input_sha256")
    if not isinstance(before, dict) or before != result.get("input_sha256_after"):
        raise RuntimeError("CP9 native result source bindings are incomplete")

    expected = ((CORE_SOURCE, None), (HELPER_SOURCE, HELPER_CANDIDATE),
                (PDE_SOURCE, PDE_CANDIDATE), (CORE_CANDIDATE, None))
    for canonical, staged in expected:
        if staged is not None and canonical.read_bytes() != staged.read_bytes():
            raise RuntimeError("accepted staged tab differs from canonical source: " + canonical.name)
        if before.get(relative(canonical)) != digest(canonical):
            raise RuntimeError("native result is stale for: " + relative(canonical))
    if before.get(relative(CORE_CANDIDATE)) != digest(CORE_CANDIDATE):
        raise RuntimeError("native result is stale for candidate core JAR")
    for canonical in (CORE_SOURCE, HELPER_SOURCE, PDE_SOURCE):
        if review.get("implementation_sha256", {}).get(relative(canonical)) != digest(canonical):
            raise RuntimeError("root review is stale for: " + relative(canonical))
    return cp8, result, review


def replacement_jar(old_jar: bytes) -> dict[str, Any]:
    """Compare file payloads in memory so staging contains only the deliverable."""
    with zipfile.ZipFile(io.BytesIO(old_jar)) as old_archive, zipfile.ZipFile(CORE_CANDIDATE) as new_archive:
        for archive in (old_archive, new_archive):
            names = archive.namelist()
            if len(names) != len(set(names)) or archive.testzip() is not None:
                raise RuntimeError("Duplicate or corrupt JAR member")
            if any(Path(n).is_absolute() or ".." in Path(n).parts or "\\" in n for n in names):
                raise RuntimeError("Unsafe JAR member")
        old = {item.filename: old_archive.read(item) for item in old_archive.infolist() if not item.is_dir()}
        new = {item.filename: new_archive.read(item) for item in new_archive.infolist() if not item.is_dir()}
    if set(old) - set(new):
        raise RuntimeError("candidate core JAR omits inherited member(s)")
    changed = [name for name, payload in old.items() if new.get(name) != payload]
    if changed:
        raise RuntimeError("candidate core JAR changes inherited member(s): " + ", ".join(changed[:3]))
    added = sorted(set(new) - set(old))
    if not added or any(not ((name == "org/procedurals/topology/Delaunay2D.class" or name.startswith("org/procedurals/topology/Delaunay2D$")) and name.endswith(".class")) for name in added):
        raise RuntimeError("candidate core JAR contains additions beyond Delaunay2D classes")
    if "org/procedurals/topology/Delaunay2D.class" not in added:
        raise RuntimeError("candidate core JAR lacks Delaunay2D.class")
    return {"prior_sha256": hashlib.sha256(old_jar).hexdigest(), "candidate_sha256": digest(CORE_CANDIDATE),
            "added_members": {name: hashlib.sha256(new[name]).hexdigest() for name in added},
            "preserved_prior_members": len(old)}


def write_archive(old: dict[str, bytes], infos: dict[str, zipfile.ZipInfo], docs: dict[str, Path],
                  catalogs: dict[str, Path], jar: dict[str, Any]) -> dict[str, Any]:
    if OUTPUT.exists() or ARCHIVE.exists() or REPORT.exists():
        raise RuntimeError("CP9 output/archive/evidence exists; refusing overwrite")
    if CORE_MEMBER not in old or PROPERTIES_MEMBER not in old:
        raise RuntimeError("accepted CP8 archive misses its core JAR or properties")
    for starter in PREVIOUS_STARTERS:
        if not any(name.startswith("procedurals/examples/" + starter + "/") for name in old):
            raise RuntimeError("accepted CP8 archive misses starter: " + starter)
    OUTPUT.mkdir(parents=True)
    jar_check = replacement_jar(old[CORE_MEMBER])
    if jar_check != jar:
        raise AssertionError("candidate core verification changed during archive assembly")

    additions = {
        "procedurals/examples/FacetMarks/FacetMarks.pde": PDE_CANDIDATE,
        "procedurals/examples/FacetMarks/FacetComposition.java": HELPER_CANDIDATE,
        "procedurals/catalog/operations/delaunay-2d.json": ROOT / "catalog/operations/delaunay-2d.json",
    }
    replacements: dict[str, bytes] = {CORE_MEMBER: CORE_CANDIDATE.read_bytes(), PROPERTIES_MEMBER: expected_properties(old[PROPERTIES_MEMBER])}
    replacements.update({member: path.read_bytes() for member, path in docs.items() if member in old})
    replacements.update({member: path.read_bytes() for member, path in catalogs.items() if member in old})
    for member in additions:
        if member in old:
            raise RuntimeError("new CP9 archive member already exists: " + member)
    with zipfile.ZipFile(ARCHIVE, "x", zipfile.ZIP_DEFLATED) as archive:
        for name, payload in old.items():
            info = infos[name]
            item = zipfile.ZipInfo(name)
            item.date_time = info.date_time
            item.external_attr = info.external_attr
            item.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(item, replacements.get(name, payload))
        for member, source in {**{name: path for name, path in docs.items() if name not in old},
                               **{name: path for name, path in catalogs.items() if name not in old}, **additions}.items():
            safe_member(member)
            archive.writestr(member, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)

    current, _ = zip_payloads(ARCHIVE)
    with zipfile.ZipFile(ARCHIVE) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("archive CRC check failed")
    allowed = set(replacements) | set(additions)
    for name, payload in old.items():
        if name not in allowed and current.get(name) != payload:
            raise RuntimeError("inherited archive payload changed: " + name)
    for member, source in docs.items():
        if current.get(member) != source.read_bytes(): raise RuntimeError("document payload mismatch: " + member)
    for member, source in catalogs.items():
        if current.get(member) != source.read_bytes(): raise RuntimeError("catalog payload mismatch: " + member)
    for member, source in additions.items():
        if current.get(member) != source.read_bytes(): raise RuntimeError("FacetMarks payload mismatch: " + member)
    if current.get(CORE_MEMBER) != CORE_CANDIDATE.read_bytes(): raise RuntimeError("candidate core JAR mismatch")
    if current.get(PROPERTIES_MEMBER) != replacements[PROPERTIES_MEMBER]: raise RuntimeError("version metadata mismatch")
    if len([name for name in current if name.startswith("procedurals/catalog/operations/")]) != 12:
        raise RuntimeError("CP9 archive does not contain twelve operation catalog records")
    return {
        "archive_members": len(current), "previous_starters": 8, "starters": 9, "operations": 12,
        "core_jar": jar,
        "added_members": {name: {"source": relative(path), "sha256": digest(path)} for name, path in additions.items()},
        "replaced_members": {PROPERTIES_MEMBER: {"kind": "version_metadata", "sha256": hashlib.sha256(replacements[PROPERTIES_MEMBER]).hexdigest()},
                              **{name: {"kind": "documentation", "source": relative(path), "sha256": digest(path)} for name, path in docs.items() if name in old},
                              **{name: {"kind": "catalog", "source": relative(path), "sha256": digest(path)} for name, path in catalogs.items() if name in old}},
        "preserved_inherited_payloads": len(old) - len(set(replacements)),
    }


def build() -> None:
    cp8, result, review = require_accepted_evidence()
    old, infos = zip_payloads(SOURCE_ARCHIVE)
    docs = documents()
    catalogs = source_catalogs(old)
    inputs = [Path(__file__).resolve(), SOURCE_ARCHIVE, SOURCE_REVIEW, NATIVE_RESULT,
              NATIVE_REVIEW, CORE_SOURCE, HELPER_SOURCE, PDE_SOURCE, CORE_CANDIDATE,
              HELPER_CANDIDATE, PDE_CANDIDATE, *docs.values(), *catalogs.values()]
    before = {relative(path): digest(path) for path in inputs}
    jar = replacement_jar(old[CORE_MEMBER])
    layout = write_archive(old, infos, docs, catalogs, jar)
    after = {relative(path): digest(path) for path in inputs}
    if after != before:
        raise RuntimeError("Inputs changed during packaging; preserve the unaccepted archive")
    report = {
        "input_sha256": before, "input_sha256_after": after,
        "status": "staged", "build_status": "passed", "review_status": "pending_root_acceptance",
        "scope": "Staged local Java 0.9.0 archive from accepted CP8 package plus accepted FacetMarks native inputs. It preserves inherited example payloads and adapter JAR bytes; no new renderer, target-port, registry, or full-corpus claim.",
        "source_archive": {"path": relative(SOURCE_ARCHIVE), "sha256": digest(SOURCE_ARCHIVE)},
        "archive": {"path": relative(ARCHIVE), "sha256": digest(ARCHIVE)},
        "accepted_cp8_review": {"path": relative(SOURCE_REVIEW), "sha256": digest(SOURCE_REVIEW), "status": cp8["status"]},
        "cp9_native_result": {"path": relative(NATIVE_RESULT), "sha256": digest(NATIVE_RESULT), "status": result["status"]},
        "cp9_root_review": {"path": relative(NATIVE_REVIEW), "sha256": digest(NATIVE_REVIEW), "status": review["status"]},
        "layout": layout, "library_properties": {"version": 9, "pretty_version": "0.9.0"},
        "documents": {member: {"source": relative(source), "sha256": digest(source)} for member, source in docs.items()},
        "catalogs": {member: {"source": relative(source), "sha256": digest(source)} for member, source in catalogs.items()},
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": "staged", "archive": relative(ARCHIVE), "report": relative(REPORT)}, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", help="write the fresh CP9 archive and staged evidence")
    args = parser.parse_args()
    if not args.build:
        print(json.dumps({"status": "prepared", "scope": "no archive/evidence written; use --build only after root review", "source_archive": relative(SOURCE_ARCHIVE), "output": relative(ARCHIVE)}, sort_keys=True))
        return
    build()


if __name__ == "__main__":
    main()
