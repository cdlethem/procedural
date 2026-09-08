#!/usr/bin/env python3
"""Package the accepted CP8 GlyphMarks starter without rebuilding CP7 JARs or rendering."""
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".work/dist/cp7/final/procedurals-processing-0.7.0.zip"
OUTPUT = ROOT / ".work/dist/cp8/java"
ARCHIVE = OUTPUT / "procedurals-processing-0.8.0.zip"
REPORT = ROOT / "evidence/distribution/cp8-java.json"
STAGED = ROOT / ".work/examples/cp8-first/GlyphMarks"
RESULT = ROOT / "evidence/reproductions/cp8-java2d/result.json"
REVIEW = ROOT / "evidence/reproductions/cp8-java2d/root-review.json"
VERSION_MEMBER = "procedurals/library.properties"
FONT_NOTICE_MEMBER = "procedurals/GlyphMarks-FONT-LICENSE.txt"


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def rel(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT))


def required_documents() -> dict[str, Path]:
    names = (
        "getting-started.md", "path-marks.md", "placement-marks.md", "region-marks.md",
        "grain-marks.md", "branch-marks.md", "profile-marks.md", "glyph-marks.md",
        "installing-profile-marks.md", "installing-glyph-marks.md", "reference/operations.md",
    )
    result: dict[str, Path] = {}
    for name in names:
        source = ROOT / "docs" / name
        if not source.is_file():
            raise RuntimeError("required CP8 package document missing: " + str(source))
        result["procedurals/docs/" + name] = source
    return result


def staged_members() -> dict[str, Path]:
    source = {
        "procedurals/examples/GlyphMarks/GlyphMarks.pde": STAGED / "GlyphMarks.pde",
        "procedurals/examples/GlyphMarks/GlyphComposition.java": STAGED / "GlyphComposition.java",
        "procedurals/examples/GlyphMarks/GlyphFont.java": STAGED / "GlyphFont.java",
        "procedurals/examples/GlyphMarks/data/GlyphMarks.ttf": STAGED / "data/GlyphMarks.ttf",
        "procedurals/examples/GlyphMarks/data/FONT-LICENSE.txt": STAGED / "data/FONT-LICENSE.txt",
        FONT_NOTICE_MEMBER: STAGED / "data/FONT-LICENSE.txt",
    }
    for value in source.values():
        if not value.is_file():
            raise RuntimeError("accepted staged GlyphMarks input missing: " + str(value))
    return source


def properties(original: bytes) -> bytes:
    text = original.decode("utf-8")
    old = "version=7\nprettyVersion=0.7.0\n"
    new = "version=8\nprettyVersion=0.8.0\n"
    if old not in text:
        raise RuntimeError("unexpected inherited library.properties version")
    return text.replace(old, new, 1).encode("utf-8")


def check_accepted_inputs(stage: dict[str, Path]) -> dict[str, object]:
    if not SOURCE.is_file():
        raise RuntimeError("accepted CP7 final archive missing: " + str(SOURCE))
    if not RESULT.is_file() or not REVIEW.is_file():
        raise RuntimeError("accepted CP8 native result/root review missing")
    result = json.loads(RESULT.read_text())
    review = json.loads(REVIEW.read_text())
    if result.get("status") != "passed" or review.get("status") != "accepted":
        raise RuntimeError("CP8 native result/root review is not accepted")
    if review.get("owner") != "root" or review.get("reviewer") != "root":
        raise RuntimeError("CP8 root review has unexpected ownership")
    if review.get("evidence_sha256", {}).get("evidence/reproductions/cp8-java2d/result.json") != sha(RESULT):
        raise RuntimeError("CP8 root review does not bind the current native result")
    before = result.get("input_sha256")
    if not isinstance(before, dict) or before != result.get("input_sha256_after"):
        raise RuntimeError("CP8 native result input bindings are incomplete")
    expected = {
        STAGED / "GlyphMarks.pde": ROOT / "packages/java-processing/examples/GlyphMarks/GlyphMarks.pde",
        STAGED / "GlyphComposition.java": ROOT / "packages/java/examples/GlyphMarks/GlyphComposition.java",
        STAGED / "GlyphFont.java": ROOT / "packages/java/examples/GlyphMarks/GlyphFont.java",
    }
    for staged, canonical in expected.items():
        if staged.read_bytes() != canonical.read_bytes():
            raise RuntimeError("staged accepted tab differs from canonical tab: " + staged.name)
        staged_key = rel(staged)
        canonical_key = rel(canonical)
        if before.get(staged_key) != sha(staged) or before.get(canonical_key) != sha(canonical):
            raise RuntimeError("native result is stale for accepted tab: " + staged.name)
        if review.get("implementation_sha256", {}).get(canonical_key) != sha(canonical):
            raise RuntimeError("root review is stale for accepted tab: " + canonical.name)
    for member, source in stage.items():
        if member.endswith("GlyphMarks.ttf"):
            expected_hash = "b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c"
        elif member.endswith("FONT-LICENSE.txt") or member == FONT_NOTICE_MEMBER:
            expected_hash = "63d3ba759d12804c5b31a9d5940d855c1820d1f5999e6b0872eb1c7ff045fbc9"
        else:
            continue
        if sha(source) != expected_hash:
            raise RuntimeError("staged accepted font/notice hash mismatch: " + str(source))
    return {"native_result": result, "root_review": review}


def write_archive(documents: dict[str, Path], additions: dict[str, Path], evidence: dict[str, object]) -> dict[str, object]:
    if OUTPUT.exists() or ARCHIVE.exists() or REPORT.exists():
        raise RuntimeError("CP8 output/archive/evidence exists; refusing overwrite")
    OUTPUT.mkdir(parents=True)
    with zipfile.ZipFile(SOURCE) as old:
        original = {info.filename: old.read(info) for info in old.infolist() if not info.is_dir()}
        old_infos = {info.filename: info for info in old.infolist() if not info.is_dir()}
        required_old = {"procedurals/examples/" + name + "/" for name in (
            "FieldMarks", "PathMarks", "PlacementMarks", "RegionMarks", "GrainMarks", "BranchMarks", "ProfileMarks")}
        if any(not any(name.startswith(prefix) for name in original) for prefix in required_old):
            raise RuntimeError("accepted CP7 archive is missing a prior starter")
        if VERSION_MEMBER not in original:
            raise RuntimeError("accepted CP7 archive is missing library.properties")
        replacements: dict[str, bytes] = {name: path.read_bytes() for name, path in documents.items() if name in original}
        replacements[VERSION_MEMBER] = properties(original[VERSION_MEMBER])
        with zipfile.ZipFile(ARCHIVE, "x", zipfile.ZIP_DEFLATED) as new:
            for name, payload in original.items():
                value = replacements.get(name, payload)
                info = old_infos[name]
                member = zipfile.ZipInfo(name)
                member.date_time = info.date_time
                member.compress_type = zipfile.ZIP_DEFLATED
                member.external_attr = info.external_attr
                new.writestr(member, value)
            for name, source in {**{name: path for name, path in documents.items() if name not in original}, **additions}.items():
                if name in original:
                    raise RuntimeError("new CP8 member unexpectedly replaces inherited member: " + name)
                new.writestr(name, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)
    with zipfile.ZipFile(ARCHIVE) as new:
        current = {info.filename: new.read(info) for info in new.infolist() if not info.is_dir()}
    allowed_changed = set(replacements)
    for name, payload in original.items():
        if name not in allowed_changed and current.get(name) != payload:
            raise RuntimeError("inherited non-document archive payload changed: " + name)
    for name, source in documents.items():
        if current.get(name) != source.read_bytes():
            raise RuntimeError("packaged documentation differs from current source: " + name)
    for name, source in additions.items():
        if current.get(name) != source.read_bytes():
            raise RuntimeError("packaged GlyphMarks payload differs from staged source: " + name)
    if current.get(VERSION_MEMBER) != replacements[VERSION_MEMBER]:
        raise RuntimeError("CP8 library.properties version update failed")
    inherited_non_document = [name for name in original if name not in documents and name != VERSION_MEMBER]
    return {
        "archive_members": len(current),
        "preserved_inherited_non_document_members": len(inherited_non_document),
        "previous_starters": 7,
        "starters": 8,
        "operations": 11,
        "added_members": {name: {"source": rel(source), "sha256": sha(source)} for name, source in additions.items()},
        "replaced_members": {
            VERSION_MEMBER: {"kind": "version_metadata", "sha256": hashlib.sha256(replacements[VERSION_MEMBER]).hexdigest()},
            **{name: {"kind": "documentation", "source": rel(source), "sha256": sha(source)} for name, source in documents.items() if name in original},
        },
    }


def build() -> None:
    documents = required_documents()
    additions = staged_members()
    evidence = check_accepted_inputs(additions)
    layout = write_archive(documents, additions, evidence)
    report = {
        "status": "staged",
        "build_status": "passed",
        "review_status": "pending_root_acceptance",
        "scope": "Staged local Java 0.8.0 archive assembled from the accepted CP7 final package plus accepted GlyphMarks tabs and explicit DejaVu font asset. It preserves prior executable payload bytes and does not rebuild, render, or claim a new native run or non-Java target.",
        "source_archive": {"path": rel(SOURCE), "sha256": sha(SOURCE)},
        "archive": {"path": rel(ARCHIVE), "sha256": sha(ARCHIVE)},
        "cp8_native_result": {"path": rel(RESULT), "sha256": sha(RESULT), "status": evidence["native_result"]["status"]},
        "cp8_root_review": {"path": rel(REVIEW), "sha256": sha(REVIEW), "status": evidence["root_review"]["status"]},
        "layout": layout,
        "library_properties": {"version": 8, "pretty_version": "0.8.0"},
        "documents": {name: {"source": rel(path), "sha256": sha(path)} for name, path in documents.items()},
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "staged", "build_status": "passed", "archive": rel(ARCHIVE), "report": rel(REPORT)}))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", help="write the CP8 archive and staged evidence")
    args = parser.parse_args()
    if not args.build:
        print(json.dumps({"status": "prepared", "scope": "no archive or evidence written; use --build after documentation is ready", "source_archive": rel(SOURCE), "output": rel(ARCHIVE)}))
        return
    build()


if __name__ == "__main__":
    main()
