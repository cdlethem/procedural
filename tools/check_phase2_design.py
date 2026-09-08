#!/usr/bin/env python3
"""Build triage and validate the authored provisional Phase 2 candidate ledger.

The rule output is triage, not adjudication.  It helps a reviewer find near computations,
but it must never overwrite an authored decision ledger.  Every unreviewed record remains
explicitly ``review_required``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "data" / "corpus.sqlite"
LEDGER = ROOT / "design" / "phase2" / "cluster-decisions.json"
TRIAGE = ROOT / "design" / "phase2" / "candidate-triage.json"

ALLOWED_RECORD_STATUSES = frozenset({
    "unreviewed",
    "reviewed_provisional",
    "reviewed_defer",
    "reviewed_data_gap",
    "blocked_data_quality",
    "research_required",
    "needs_note_reading",
})
AUDIT_SCOPES = frozenset({"whole_computation", "component_extraction"})
AUDIT_REMAINDER_DISPOSITIONS = frozenset({"recipe", "adapter", "deferred", "out_of_scope"})
CAPABILITY_DEPENDENCY_ADMISSION = "capability_dependency"


@dataclass(frozen=True)
class Rule:
    """An automated triage hypothesis, never an adjudicated computation family.

    ``aliases`` are only candidate handles.  ``evidence`` must also occur in the
    signature or candidate note, which prevents a similarly named sketch motif from
    entering the operation merely because it shares a token.
    """

    cluster: str
    decision: str
    status: str
    aliases: frozenset[str]
    evidence: tuple[str, ...]
    reasoning: str


# These are intentionally conservative.  The proposed operation names and the reason
# each is a search hypothesis are preserved in the generated triage. Rules cover
# candidates whose own signature/note supplies the indicated semantic evidence; all
# other rows remain visible in the review queue.
RULES = (
    Rule("color.palette-pick", "keep", "proposed", frozenset({"rcol", "palettepick", "palettepickcolor", "randompalette", "randompalettecolor", "pickcolor", "randomcolor"}), ("palette", "color"), "uniform selection from a supplied colour sequence"),
    Rule("color.palette-sample", "keep", "proposed", frozenset({"paletteLerp", "lerpPalette", "getColor", "colorRamp", "rampColor", "paletteLerpColor", "lerpPaletteColor", "paletteColor", "paletteLerp", "lerpColorRamp", "paletteIndexLerp", "noiseLerpColor", "noisePaletteColor"}), ("lerp", "palette"), "continuous interpolation through palette stops or neighbours"),
    Rule("field.fbm", "keep", "proposed", frozenset({"fbm", "fbm2", "ridgedMF", "noiseRidge"}), ("octave",), "multi-octave or ridged scalar-noise accumulation"),
    Rule("field.displace", "keep", "proposed", frozenset({"noiseDisplace", "noiseWarp", "noiseDisplacement", "displaceFbm", "fieldDisplace", "flowDisplace", "attractorWarp", "repulsionDisplace"}), ("displace",), "point or image coordinates displaced by a sampled field"),
    Rule("field.angle", "keep", "proposed", frozenset({"flowFieldAngle", "noiseAngleField", "noiseVectorField", "doubleNoiseAngle"}), ("field", "angle"), "a vector heading derived from a scalar or vector noise field"),
    Rule("layout.rect-subdivide", "keep", "proposed", frozenset({"subdivideRects", "splitRects", "subdivideRect", "rectSubdivision", "recursiveRectSubdivide", "mondrianSubdivide", "guillotineSplit", "randomBisectRects", "randomRectSplit", "randomRectSubdivide", "randomRectSubdivision", "rectPartition"}), ("rect", "split"), "iterative or recursive axis-aligned rectangle partitioning"),
    Rule("layout.quad-subdivide", "keep", "proposed", frozenset({"quadSubdivide", "quadtreeSplit", "quadtreeSubdivide", "subdivideQuad", "splitQuad", "randomQuadSubdivision", "randomQuadSubdivide", "subdivideQuadTree", "quadRecursion"}), ("quad", "split"), "subdivision preserving a four-corner quadrilateral domain"),
    Rule("layout.grid-points", "keep", "proposed", frozenset({"dotGrid", "gridDots", "gridPoints", "gridScatter", "pointLattice", "latticePointCloud", "concentricDotGrid"}), ("grid", "dot"), "regular lattice positions with a caller-selected mark"),
    Rule("layout.grid-transform", "keep", "proposed", frozenset({"snapToGrid", "gridSnap", "gridAlign", "gridJitterPlace", "jitterGrid", "offsetGrid", "mirrorGrid"}), ("grid",), "coordinate snapping, alternating offsets, jitter, or symmetry over a lattice"),
    Rule("sampling.poisson-disk", "keep", "proposed", frozenset({"poissonScatter", "poissonPoints", "poissonPack", "poissonDisks", "poissonDiskCircles", "poissonPackedPoints", "poissonPack3D", "minDistScatter", "scatterWithMinDist", "minDistPack", "rejectSamplePoints"}), ("poisson",), "minimum-distance point sampling or packing"),
    Rule("sampling.circle-pack", "keep", "proposed", frozenset({"packCircles", "circlePack", "circlePacking", "packedCircles", "packDiscs", "noisePackedCircles", "noiseCirclePack", "rejectionCirclePacking"}), ("pack", "circle"), "non-overlapping circle/disc placement"),
    Rule("geometry.annular-sector", "keep", "proposed", frozenset({"arc2", "arcRing", "arcSector", "annularSector", "annulusSector", "arcBand", "arcBands", "arcWedge", "polarArcBand", "gradientAnnulus", "gradientRing", "ringBand"}), ("annul", "ring", "arc"), "tessellated annular sector or ring with radial styling"),
    Rule("geometry.regular-polygon", "keep", "proposed", frozenset({"regularPolygon", "randomPolygon", "poly"}), ("polygon", "sides"), "vertices of a regular polygon from centre, radius, angle, and side count"),
    Rule("geometry.closed-spline", "keep", "proposed", frozenset({"closedSpline", "Spline"}), ("spline", "point"), "closed Catmull-Rom-like curve evaluated from control points"),
    Rule("geometry.circle-intersection", "keep", "proposed", frozenset({"circleIntersections"}), ("intersection", "circle"), "closed-form pairwise circle intersections"),
    Rule("geometry.delaunay", "keep", "proposed", frozenset({"delaunay", "delaunayMesh", "triangulate", "delaunayTriangulate", "delaunayOverCenters"}), ("triang",), "Delaunay triangulation of supplied planar sites"),
    Rule("path.random-walk", "keep", "proposed", frozenset({"randomWalk", "noiseWalk", "noiseWalker", "noiseWalkTrail", "noiseWalkerTrail", "gridWalk", "latticeWalker", "manhattanWalks", "randomWalkGrid"}), ("walk", "path"), "ordered position sequence advanced by a stochastic step rule"),
    Rule("path.flow-trace", "keep", "proposed", frozenset({"flowFieldStrokes", "flowFieldLines", "flowFieldLine", "flowLines", "flowTrail", "flowFieldRibbons", "noiseFlowPath", "noiseFlowLines", "noiseFlowTrail", "maskedFlowField"}), ("flow", "field"), "successive points advected through a vector/angle field"),
    Rule("mark.hatch-segment", "keep", "proposed", frozenset({"gridDiag", "hatchRect", "hatchTriangle", "hatchField", "crossHatch", "diagonalHatch", "dashHatch", "lineHatch"}), ("hatch",), "parallel clipped line marks over supplied geometry"),
    Rule("mark.gradient-quad", "keep", "proposed", frozenset({"gradientQuad", "gradientTriangle", "perVertexAlphaFill", "alphaTriad"}), ("gradient", "vertex"), "polygon command with per-vertex colours or alpha"),
    Rule("mark.stipple", "keep", "proposed", frozenset({"stipple", "stippleFill", "stippleDisk", "stippleTriangle", "noiseStipple", "noiseStippleField", "scatterDots", "dotField"}), ("stipple", "dot"), "mark distribution used to fill a supplied region"),
    Rule("post.pixel-grain", "keep", "research_required", frozenset({"pixelGrain", "paperGrain", "grainOverlay", "grainPass", "pixelJitter"}), ("pixel", "grain"), "per-pixel random brightness/colour perturbation; target capability and cost remain open"),
    Rule("post.image-warp", "keep", "research_required", frozenset({"noiseWarp", "noiseWarpImageSampler", "getSmooth"}), ("pixel", "image", "bilinear"), "pixel/image sampling and warp; needs adapter and edge-policy review"),
    Rule("post.blur", "keep", "research_required", frozenset({"radialBlur", "directionalBlur", "gaussianBlurPost", "progressiveBlur", "postBlurVignette"}), ("blur",), "post-process blur; needs capability-specific contract"),
    Rule("mesh.box-grid", "keep", "research_required", frozenset({"boxGrid", "noiseBoxGrid", "isoBoxGrid", "extrudeGrid"}), ("box", "grid"), "grid-derived 3D boxes or extrusions"),
    Rule("mesh.revolve", "keep", "research_required", frozenset({"annulusMesh", "coneMesh", "cylinderMesh", "latheSphere"}), ("mesh", "quad", "ring"), "mesh emitted from circular rings or a lathed profile"),
    Rule("mesh.point-cloud", "keep", "research_required", frozenset({"pointCloudOnSphere", "pointCloudVolume", "pointSphere", "noiseVoxelField", "pointBall"}), ("point",), "3D point-cloud generation; coordinate convention and performance require a contract"),
    Rule("typography.glyph-trail", "keep", "research_required", frozenset({"textTrail", "advectGlyphs"}), ("glyph", "text", "trail"), "repeated glyph placement along an ordered path"),
    Rule("symmetry.reflect", "keep", "proposed", frozenset({"mirrorGrid", "mirrorHalf"}), ("mirror",), "reflecting a supplied draw-command set over an axis or grid"),
)


def normalized(value: str | None) -> str:
    return (value or "").casefold()


def source_digest(rows: Iterable[sqlite3.Row]) -> str:
    digest = hashlib.sha256()
    for row in rows:
        digest.update(row["sketch"].encode())
        digest.update(b"\0")
        digest.update(str(row["ordinal"]).encode())
        digest.update(b"\0")
        digest.update(row["raw_json"].encode())
        digest.update(b"\0")
        digest.update(row["source_sha256"].encode())
        digest.update(b"\n")
    return digest.hexdigest()


def classify(row: sqlite3.Row) -> dict[str, str]:
    name = normalized(row["name"])
    signature = normalized(row["signature"])
    note = normalized(row["note"])
    evidence_text = f"{signature} {note}"
    if not row["signature"] or not row["note"]:
        return {
            "cluster_id": "review.malformed-candidate",
            "disposition": "review_required",
            "status": "blocked_data_quality",
            "reason": "candidate lacks a usable signature or explanation",
        }
    for rule in RULES:
        if name in {alias.casefold() for alias in rule.aliases} and any(token in evidence_text for token in rule.evidence):
            return {
                "cluster_id": rule.cluster,
                "disposition": rule.decision,
                "status": rule.status,
                "reason": rule.reasoning,
            }
    return {
        "cluster_id": "review.unresolved-computation",
        "disposition": "review_required",
        "status": "needs_note_reading",
        "reason": "no reviewed computation match met both handle and signature/note evidence",
    }


def modularisation_context(notes_path: str, name: str, survey_root: Path | None = None) -> dict[str, str | None]:
    """Expose the relevant authored modularisation prose for every ledger row.

    This does not convert a prose keyword into a disposition.  It makes the parent
    judgement available alongside every candidate and tells a later reviewer whether
    the candidate was actually named in that section.
    """
    text = ((survey_root or ROOT / "survey") / notes_path).read_text(errors="replace")
    marker = "## Modularisation notes"
    section = text.split(marker, 1)[1] if marker in text else ""
    folded = section.casefold()
    position = folded.find(name.casefold()) if name else -1
    if position >= 0:
        start = max(0, position - 240)
        end = min(len(section), position + len(name) + 360)
        excerpt = " ".join(section[start:end].split())
        relation = "named_in_modularisation_notes"
    else:
        excerpt = " ".join(section[:500].split())
        relation = "not_named_in_modularisation_notes"
    if not section:
        judgement = "missing_section"
    elif re.search(r"one[- ]off art decisions?|sketch[- ]specific", folded):
        judgement = "contains_one_off_guidance"
    elif "generic" in folded or "reusable" in folded or "library" in folded:
        judgement = "contains_generic_guidance"
    else:
        judgement = "no_explicit_generic_or_one_off_guidance"
    return {"relation": relation, "section_judgement": judgement, "excerpt": excerpt or None}


def build_ledger(database: Path = DATABASE, survey_root: Path | None = None) -> dict:
    survey_root = survey_root or ROOT / "survey"
    connection = sqlite3.connect(f"{database.resolve().as_uri()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    rows = list(connection.execute(
        """select cp.sketch, cp.notes_path, cp.ordinal, cp.name, cp.signature, cp.note,
                  cp.raw_json, s.source_sha256
             from candidate_provenance cp
             join sketches s on s.sketch = cp.sketch
             order by cp.sketch, cp.ordinal"""
    ))
    note_rows = list(connection.execute("SELECT sketch, notes_path, source_sha256 FROM sketches ORDER BY sketch"))
    connection.close()
    actual_paths = {path.relative_to(survey_root).as_posix()
                    for path in (survey_root / "out").rglob("notes.md")}
    if actual_paths != {row["notes_path"] for row in note_rows}:
        raise ValueError("database note identities differ from public snapshot; run ingestion before review")
    snapshot_path = survey_root / "snapshot.json"
    snapshot = json.loads(snapshot_path.read_text())
    evidence_files = {"snapshot.json": hashlib.sha256(snapshot_path.read_bytes()).hexdigest()}
    index_path = survey_root / "out" / "index.jsonl"
    if index_path.is_file():
        evidence_files["out/index.jsonl"] = hashlib.sha256(index_path.read_bytes()).hexdigest()
    sketch_evidence = {}
    for row in note_rows:
        if row["notes_path"] != f"out/{row['sketch']}/notes.md":
            raise ValueError(f"{row['sketch']}: inconsistent database note path")
        path = survey_root / row["notes_path"]
        actual_hash = hashlib.sha256(path.read_text(errors="replace").encode()).hexdigest()
        if actual_hash != row["source_sha256"]:
            raise ValueError(f"{row['sketch']}: stale database note hash; run ingestion before review")
        dependencies = {row["notes_path"]: actual_hash}
        result_paths = [path.parent / "baseline" / "result.json"]
        result_paths.extend(sorted((path.parent / "variants").glob("*/result.json")))
        for result_path in result_paths:
            if result_path.is_file():
                dependencies[result_path.relative_to(survey_root).as_posix()] = hashlib.sha256(result_path.read_bytes()).hexdigest()
        evidence_files.update(dependencies)
        sketch_evidence[row["sketch"]] = hashlib.sha256(json.dumps(dependencies, sort_keys=True).encode()).hexdigest()
    records = {}
    for row in rows:
        key = f"{row['sketch']}#{row['ordinal']}"
        triage = classify(row)
        records[key] = {
            "sketch": row["sketch"],
            "notes_path": row["notes_path"],
            "ordinal": row["ordinal"],
            "source_sha256": row["source_sha256"],
            "evidence_sha256": sketch_evidence[row["sketch"]],
            "candidate": {"name": row["name"], "signature": row["signature"], "note": row["note"]},
            "modularisation_context": modularisation_context(row["notes_path"], row["name"], survey_root),
            "disposition": "review_required",
            "status": "blocked_data_quality" if triage["status"] == "blocked_data_quality" else "unreviewed",
            "reason": ("Candidate is malformed and cannot be adjudicated until the source frontmatter is repaired."
                       if triage["status"] == "blocked_data_quality"
                       else "No computation-level adjudication has been recorded."),
            "triage": triage,
        }
    counts = Counter(record["disposition"] for record in records.values())
    status_counts = Counter(record["status"] for record in records.values())
    return {
        "format": "procedurals.phase2.candidate-ledger.v1",
        "status": "provisional_current_snapshot_unadjudicated",
        "source": {
            "database": "data/corpus.sqlite",
            "candidate_identity": "<sketch>#<ordinal>",
            "record_count": len(rows),
            "record_digest_sha256": source_digest(rows),
            "snapshot_path": "survey/snapshot.json",
            "survey_revision": snapshot.get("survey_revision"),
            "snapshot_sha256": evidence_files["snapshot.json"],
            "evidence_sha256": hashlib.sha256(json.dumps(evidence_files, sort_keys=True).encode()).hexdigest(),
        },
        "method": {
            "triage_rule_type": "manually authored reading aids; aliases plus signature/note evidence",
            "not_a_final_adjudication": True,
            "unresolved_policy": "Triage never decides a row. A reviewer must read the computation and parent evidence before recording keep, merge, or reject with a cited reason.",
        },
        "summary": {"dispositions": dict(sorted(counts.items())), "statuses": dict(sorted(status_counts.items()))},
        "clusters": [
            {"id": rule.cluster, "triage_suggestion": rule.decision, "status": rule.status,
             "reason": rule.reasoning, "aliases": sorted(rule.aliases), "required_evidence_any": list(rule.evidence)}
            for rule in RULES
        ] + [
            {"id": "review.malformed-candidate", "triage_suggestion": "review_required", "status": "blocked_data_quality", "reason": "Missing candidate explanation or signature."},
            {"id": "review.unresolved-computation", "triage_suggestion": "review_required", "status": "needs_note_reading", "reason": "Requires computation-level reading and parent Modularisation notes review."},
        ],
        "records": records,
    }


def _nonempty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _validate_decision_audit(key: str, record: dict, errors: list[str]) -> None:
    """Validate an optional whole-computation/component-extraction audit.

    Audits are intentionally optional during the incremental review.  Once present,
    however, their fields are strict so a partial extraction cannot masquerade as a
    complete operation decision.
    """
    if "decision_audit" not in record:
        return
    audit = record.get("decision_audit")
    if not isinstance(audit, dict):
        errors.append(f"{key}: decision_audit must be an object")
        return
    if audit.get("status") != "verified":
        errors.append(f"{key}: decision_audit status must be 'verified'")
    if audit.get("scope") not in AUDIT_SCOPES:
        errors.append(f"{key}: decision_audit scope is invalid")
    if not _nonempty_string(audit.get("computation")):
        errors.append(f"{key}: decision_audit requires a computation")
    remainder = audit.get("remainder")
    if not isinstance(remainder, list):
        errors.append(f"{key}: decision_audit remainder must be a list")
        return
    if audit.get("scope") == "component_extraction" and not remainder:
        errors.append(f"{key}: component_extraction audit requires remainder accounting")
    for ordinal, item in enumerate(remainder):
        prefix = f"{key}: decision_audit remainder[{ordinal}]"
        if not isinstance(item, dict):
            errors.append(f"{prefix} must be an object")
            continue
        if not _nonempty_string(item.get("component")):
            errors.append(f"{prefix} requires a component")
        if item.get("disposition") not in AUDIT_REMAINDER_DISPOSITIONS:
            errors.append(f"{prefix} has invalid disposition")
        if not _nonempty_string(item.get("reason")):
            errors.append(f"{prefix} requires a reason")


def _validate_reviewed_architecture(cluster_id: str, cluster: dict, errors: list[str]) -> None:
    """Check the reviewed operation boundary required before a contract is written."""
    architecture = cluster.get("architecture")
    if not isinstance(architecture, dict):
        errors.append(f"{cluster_id}: contract requires architecture")
        return
    if architecture.get("level") != "operation_candidate":
        errors.append(f"{cluster_id}: architecture level must be operation_candidate")
    if architecture.get("status") != "reviewed":
        errors.append(f"{cluster_id}: architecture status must be reviewed")
    for field in ("inputs", "outputs", "invariants"):
        if not _nonempty_string(architecture.get(field)):
            errors.append(f"{cluster_id}: architecture {field} must be a nonempty string")
    if architecture.get("open_questions") != []:
        errors.append(f"{cluster_id}: architecture open_questions must be []")


def _is_repo_relative_path(value: object) -> bool:
    if not _nonempty_string(value):
        return False
    path = Path(value)
    return not path.is_absolute() and ".." not in path.parts


def _validate_dependency_remainder(prefix: str, remainder: object, errors: list[str]) -> None:
    if not isinstance(remainder, list):
        errors.append(f"{prefix}: remainder must be a list")
        return
    if not remainder:
        errors.append(f"{prefix}: requires remainder accounting")
    for ordinal, item in enumerate(remainder):
        item_prefix = f"{prefix}: remainder[{ordinal}]"
        if not isinstance(item, dict):
            errors.append(f"{item_prefix} must be an object")
            continue
        if not _nonempty_string(item.get("component")):
            errors.append(f"{item_prefix} requires a component")
        if item.get("disposition") not in AUDIT_REMAINDER_DISPOSITIONS:
            errors.append(f"{item_prefix} has invalid disposition")
        if not _nonempty_string(item.get("reason")):
            errors.append(f"{item_prefix} requires a reason")


def _validate_capability_dependency_admission(cluster: dict, expected_records: dict,
                                              ledger_records: dict, errors: list[str]) -> None:
    """Validate an independently specified operation dependency without admitting a candidate.

    A dependency may be justified by composite source computations, but those source
    candidates stay adjudicated in their own clusters.  Its admission therefore carries
    the complete evidence binding and accounts for the unreused remainder explicitly.
    """
    cluster_id = cluster.get("id", "<unnamed cluster>")
    _validate_reviewed_architecture(cluster_id, cluster, errors)
    admission = cluster.get("dependency_admission")
    if not isinstance(admission, dict):
        errors.append(f"{cluster_id}: capability dependency requires dependency_admission")
        return
    if admission.get("status") != "reviewed":
        errors.append(f"{cluster_id}: dependency_admission status must be reviewed")
    if admission.get("owner") != "root":
        errors.append(f"{cluster_id}: dependency_admission owner must be root")
    if not _nonempty_string(admission.get("reviewer")):
        errors.append(f"{cluster_id}: dependency_admission requires a reviewer")
    if not _is_repo_relative_path(admission.get("decision")):
        errors.append(f"{cluster_id}: dependency_admission decision must be a nonempty repository-relative path")
    if not _nonempty_string(admission.get("rationale")):
        errors.append(f"{cluster_id}: dependency_admission requires a rationale")
    motivating = admission.get("motivating_candidates")
    if not isinstance(motivating, list) or not motivating:
        errors.append(f"{cluster_id}: dependency_admission requires motivating_candidates")
        return
    candidate_ids = set()
    for ordinal, item in enumerate(motivating):
        prefix = f"{cluster_id}: dependency_admission motivating_candidates[{ordinal}]"
        if not isinstance(item, dict):
            errors.append(f"{prefix} must be an object")
            continue
        candidate_id = item.get("candidate_id")
        if not _nonempty_string(candidate_id):
            errors.append(f"{prefix} requires a candidate_id")
        else:
            if candidate_id in candidate_ids:
                errors.append(f"{prefix}: duplicate motivating candidate {candidate_id}")
            else:
                candidate_ids.add(candidate_id)
        expected = expected_records.get(candidate_id) if _nonempty_string(candidate_id) else None
        if expected is None:
            errors.append(f"{prefix}: unknown motivating candidate {candidate_id!r}")
        else:
            for field in ("source_sha256", "evidence_sha256"):
                if item.get(field) != expected.get(field):
                    errors.append(f"{prefix}: {field} differs from source evidence")
        if not _nonempty_string(item.get("dependency")):
            errors.append(f"{prefix} requires a dependency description")
        _validate_dependency_remainder(prefix, item.get("remainder"), errors)
    for key, record in ledger_records.items():
        if record.get("cluster_id") == cluster_id:
            errors.append(f"{key}: capability dependency cannot assign ordinary candidate members")


def _validate_contract_cluster(ledger: dict, cluster_id: str, errors: list[str]) -> None:
    clusters = ledger.get("clusters", [])
    cluster = next((item for item in clusters if item.get("id") == cluster_id), None)
    if cluster is None:
        errors.append(f"contract cluster {cluster_id!r} is unknown")
        return
    admission_kind = cluster.get("admission_kind")
    if admission_kind == CAPABILITY_DEPENDENCY_ADMISSION:
        # validate() has already checked the admission and architecture.  This path
        # deliberately has no kept representative or candidate-member audit: it is
        # an independently specified dependency, not a candidate cluster.
        return
    if admission_kind is not None:
        errors.append(f"{cluster_id}: unknown admission kind {admission_kind!r}")
        return
    _validate_reviewed_architecture(cluster_id, cluster, errors)

    members = [
        (key, record) for key, record in ledger.get("records", {}).items()
        if record.get("cluster_id") == cluster_id
        and record.get("disposition") in {"keep", "merge"}
    ]
    if not any(record.get("disposition") == "keep" for _, record in members):
        errors.append(f"{cluster_id}: contract requires a kept representative")
    for key, record in members:
        audit = record.get("decision_audit")
        if not isinstance(audit, dict):
            errors.append(f"{key}: contract member requires decision_audit")
            continue
        # validate() checks the audit fields for every record, independently of this gate.
    for key, record in ledger.get("records", {}).items():
        if record.get("cluster_id") == cluster_id and record.get("disposition") == "review_required":
            errors.append(f"{key}: unresolved member of contract cluster; adjudicate or explicitly rescope it")


def validate(ledger: dict, database: Path = DATABASE, survey_root: Path | None = None,
             *, require_reviewed: bool = False, contract_cluster: str | None = None) -> list[str]:
    try:
        expected = build_ledger(database, survey_root)
    except (ValueError, OSError, sqlite3.Error) as error:
        return [str(error)]
    errors = []
    if ledger.get("format") != expected["format"]:
        errors.append("ledger format is not supported")
    source = ledger.get("source", {})
    if source.get("record_count") != expected["source"]["record_count"]:
        errors.append("candidate record count differs from the current database")
    for field in ("record_digest_sha256", "survey_revision", "snapshot_sha256", "evidence_sha256"):
        if source.get(field) != expected["source"][field]:
            errors.append(f"{field} differs; reconcile changed evidence without overwriting reviewed decisions")
    actual_keys = set(ledger.get("records", {}))
    expected_keys = set(expected["records"])
    if actual_keys != expected_keys:
        errors.append(f"record identity mismatch: missing={len(expected_keys - actual_keys)}, extra={len(actual_keys - expected_keys)}")
    clusters = ledger.get("clusters", [])
    cluster_ids = {cluster["id"] for cluster in clusters}
    if len(cluster_ids) != len(clusters):
        errors.append("duplicate cluster identities")
    for cluster in clusters:
        admission_kind = cluster.get("admission_kind")
        if admission_kind is None:
            continue
        if admission_kind != CAPABILITY_DEPENDENCY_ADMISSION:
            errors.append(f"{cluster.get('id', '<unnamed cluster>')}: unknown admission kind {admission_kind!r}")
            continue
        _validate_capability_dependency_admission(
            cluster, expected["records"], ledger.get("records", {}), errors)
    kept_clusters = {record.get("cluster_id") for record in ledger.get("records", {}).values()
                     if record.get("disposition") == "keep"}
    for key, record in ledger.get("records", {}).items():
        _validate_decision_audit(key, record, errors)
        triage_cluster = record.get("triage", {}).get("cluster_id")
        if triage_cluster not in cluster_ids:
            errors.append(f"{key}: unknown triage cluster {triage_cluster!r}")
        if record.get("disposition") not in {"keep", "merge", "reject", "review_required"}:
            errors.append(f"{key}: invalid disposition {record.get('disposition')!r}")
        status = record.get("status")
        if status not in ALLOWED_RECORD_STATUSES:
            errors.append(f"{key}: invalid review status {status!r}")
        if key in expected["records"]:
            for field in ("sketch", "notes_path", "ordinal", "source_sha256", "evidence_sha256", "candidate"):
                if record.get(field) != expected["records"][key][field]:
                    errors.append(f"{key}: {field} differs from source evidence")
        decision = record.get("disposition")
        if decision == "reject" and not isinstance(record.get("decision_audit"), dict):
            errors.append(f"{key}: rejection requires decision_audit and explicit component scope")
        original_data_quality = (
            status == "blocked_data_quality"
            and decision == "review_required"
            and not record.get("review_basis")
            and expected["records"].get(key, {}).get("status") == "blocked_data_quality"
        )
        if status != "unreviewed":
            if not _nonempty_string(record.get("reason")):
                errors.append(f"{key}: reviewed status requires a reason")
            if not original_data_quality:
                basis = record.get("review_basis", "")
                basis_path = basis.split("#", 1)[0].removeprefix("survey/") if isinstance(basis, str) else None
                if basis_path != record.get("notes_path"):
                    errors.append(f"{key}: reviewed status requires parent-note provenance")
        if decision != "review_required":
            if record.get("cluster_id") not in cluster_ids:
                errors.append(f"{key}: unknown decision cluster")
            if not record.get("reason", "").strip():
                errors.append(f"{key}: reviewed decision requires a reason")
            basis = record.get("review_basis", "")
            basis_path = basis.split("#", 1)[0].removeprefix("survey/") if isinstance(basis, str) else None
            if basis_path != record.get("notes_path"):
                errors.append(f"{key}: reviewed decision requires parent-note provenance")
            if record.get("status") in {"unreviewed", "blocked_data_quality", None}:
                errors.append(f"{key}: final disposition conflicts with review status")
            if decision == "merge" and record.get("cluster_id") not in kept_clusters:
                errors.append(f"{key}: merge has no kept representative")
        elif require_reviewed:
            errors.append(f"{key}: unresolved computation decision")
    if contract_cluster is not None:
        _validate_contract_cluster(ledger, contract_cluster, errors)
    summary = {
        "dispositions": dict(sorted(Counter(r.get("disposition") for r in ledger.get("records", {}).values()).items())),
        "statuses": dict(sorted(Counter(r.get("status") for r in ledger.get("records", {}).values()).items())),
    }
    if ledger.get("summary") != summary:
        errors.append("summary counts differ from actual decisions")
    return errors


def load_ledger(path: Path) -> dict:
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key {key!r}")
            result[key] = value
        return result
    return json.loads(path.read_text(), object_pairs_hook=unique_object)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-triage", action="store_true", help="write the replaceable current-snapshot triage artifact")
    parser.add_argument("--bootstrap-ledger", action="store_true", help="create a ledger only when one does not yet exist")
    parser.add_argument("--ledger", type=Path, default=LEDGER)
    parser.add_argument("--require-reviewed", action="store_true", help="fail until every candidate has a final disposition")
    parser.add_argument("--contract-cluster", metavar="ID",
                        help="apply the stricter reviewed operation-candidate contract gate to one cluster")
    args = parser.parse_args()
    if args.write_triage:
        TRIAGE.parent.mkdir(parents=True, exist_ok=True)
        TRIAGE.write_text(json.dumps(build_ledger(), indent=2, ensure_ascii=False) + "\n")
    if args.bootstrap_ledger:
        if args.ledger.exists():
            print(f"refusing to overwrite authored ledger: {args.ledger}", file=sys.stderr)
            return 2
        args.ledger.parent.mkdir(parents=True, exist_ok=True)
        args.ledger.write_text(json.dumps(build_ledger(), indent=2, ensure_ascii=False) + "\n")
    if not args.ledger.is_file():
        print(f"ledger not found: {args.ledger}", file=sys.stderr)
        return 2
    try:
        ledger = load_ledger(args.ledger)
        errors = validate(ledger, require_reviewed=args.require_reviewed,
                          contract_cluster=args.contract_cluster)
    except (ValueError, OSError, sqlite3.Error) as error:
        print(f"Phase 2 ledger is invalid: {error}", file=sys.stderr)
        return 1
    if errors:
        print("Phase 2 ledger is invalid:", file=sys.stderr)
        print("\n".join(f"- {error}" for error in errors), file=sys.stderr)
        return 1
    print(f"Phase 2 ledger structurally valid (not contract approval): {ledger['source']['record_count']} records; {ledger['summary']['dispositions']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
