#!/usr/bin/env python3
"""Stage the Java 0.15 archive with the accepted CutBranchMarks slice.

The archive is written only with ``--build``.  That mode requires the root
workload review, which is intentionally a later gate.
"""
from __future__ import annotations
import argparse, hashlib, io, json, zipfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ARCHIVE = ROOT / ".work/dist/r3/java/procedurals-processing-0.14.0.zip"
SOURCE_REVIEW = ROOT / "evidence/distribution/r3-review.json"
STAGE = ROOT / ".work/examples/line-pool-candidate1/CutBranchMarks"
STAGE_RESULT = ROOT / ".work/examples/line-pool-candidate1/result.json"
CORE_REVIEW = ROOT / "evidence/conformance/line-pool-java-root-review.json"
EDITS = ROOT / "evidence/reproductions/line-pool-p2d/edits.json"
EDITS_REVIEW = ROOT / "evidence/reproductions/line-pool-p2d/edits-review.json"
WORKLOAD = ROOT / "evidence/reproductions/line-pool-p2d/workload.json"
WORKLOAD_REVIEW = ROOT / "evidence/reproductions/line-pool-p2d/workload-review.json"
CORE = ROOT / "packages/java/src/main/java/org/procedurals/topology/LinePool2D.java"
HELPER = ROOT / "packages/java/examples/CutBranchMarks/CutBranchComposition.java"
PDE = ROOT / "packages/java-processing/examples/CutBranchMarks/CutBranchMarks.pde"
CATALOG = ROOT / "catalog/operations/seeded-line-pool-2d.json"
GUIDE = ROOT / "docs/cut-branch-marks.md"
INSTALL = ROOT / "docs/installing-cut-branch-marks.md"
OUT_DEFAULT = ROOT / ".work/dist/line-pool/java"
ARCHIVE_NAME = "procedurals-processing-0.15.0.zip"
JAR_MEMBER = "procedurals/library/procedurals.jar"
PROPERTIES = "procedurals/library.properties"
OLD_STARTERS = ("FieldMarks","PathMarks","PlacementMarks","RegionMarks","GrainMarks","BranchMarks","ProfileMarks","GlyphMarks","FacetMarks","SpringMarks","LatticeMarks","ReliefMarks","CityMarks","LandscapeMarks")

def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""): h.update(b)
    return h.hexdigest()
def rel(path: Path) -> str: return str(path.resolve().relative_to(ROOT))
def need(path: Path) -> None:
    if not path.is_file(): raise RuntimeError("required packaging input missing: " + rel(path))
def payload(path: Path) -> tuple[dict[str, bytes], dict[str, zipfile.ZipInfo]]:
    with zipfile.ZipFile(path) as z:
        items = [x for x in z.infolist() if not x.is_dir()]
        names = [x.filename for x in items]
        if len(names) != len(set(names)): raise RuntimeError("duplicate archive member")
        if any(not n.startswith("procedurals/") or ".." in Path(n).parts or "\\" in n for n in names): raise RuntimeError("unsafe archive member")
        return ({n:z.read(n) for n in names},{x.filename:x for x in items})

def accepted() -> dict[str, Any]:
    for p in (SOURCE_ARCHIVE,SOURCE_REVIEW,STAGE_RESULT,CORE_REVIEW,EDITS,EDITS_REVIEW,WORKLOAD,WORKLOAD_REVIEW,CORE,HELPER,PDE,CATALOG,GUIDE,INSTALL,STAGE/"code/procedurals.jar",STAGE/"CutBranchComposition.java",STAGE/"CutBranchMarks.pde"):
        need(p)
    source_review=json.loads(SOURCE_REVIEW.read_text()); stage=json.loads(STAGE_RESULT.read_text()); core=json.loads(CORE_REVIEW.read_text()); er=json.loads(EDITS_REVIEW.read_text()); wr=json.loads(WORKLOAD_REVIEW.read_text())
    if source_review.get("status")!="accepted" or source_review.get("owner")!="root" or source_review.get("reviewer")!="root" or source_review.get("final_archive",{}).get("sha256")!=sha(SOURCE_ARCHIVE): raise RuntimeError("r3 archive review/hash not accepted")
    if stage.get("status")!="passed" or stage.get("inputs_before")!=stage.get("inputs_after"): raise RuntimeError("candidate stage is not passed and bound")
    stage_bindings={**stage.get("inputs_before",{}), **stage.get("artifacts_sha256",{})}
    for key, expected in stage_bindings.items():
        live=ROOT/key
        if not live.is_file() or sha(live)!=expected: raise RuntimeError("candidate stage live binding is stale: "+key)
    for live_source in (CORE,HELPER,PDE):
        key=rel(live_source)
        if stage_bindings.get(key)!=sha(live_source): raise RuntimeError("candidate stage binding is stale: "+key)
    candidate_key=".work/examples/line-pool-candidate1/CutBranchMarks/code/procedurals.jar"
    if stage.get("artifacts_sha256",{}).get(candidate_key)!=sha(STAGE/"code/procedurals.jar"):
        raise RuntimeError("candidate JAR stage binding is stale")
    if core.get("status")!="accepted" or core.get("reviewer")!="root" or core.get("core_sha256")!=sha(CORE): raise RuntimeError("line-pool core review/hash not accepted")
    if er.get("status")!="accepted" or er.get("reviewer")!="root" or er.get("native_sha256")!=sha(EDITS): raise RuntimeError("editing review/hash not accepted")
    if json.loads(EDITS.read_text()).get("status")!="passed": raise RuntimeError("underlying edits report is not passed")
    if wr.get("status")!="accepted" or wr.get("reviewer")!="root" or wr.get("result_sha256")!=sha(WORKLOAD): raise RuntimeError("workload review/hash not accepted")
    if wr.get("status")!="accepted" or json.loads(WORKLOAD.read_text()).get("status")!="passed": raise RuntimeError("underlying workload report is not passed")
    for report_path in (EDITS, WORKLOAD):
        recorded=json.loads(report_path.read_text()).get("input_sha256",{})
        for key, expected in stage_bindings.items():
            if recorded.get(key)!=expected:
                raise RuntimeError("native report misses/disagrees with staged binding: "+key)
    for src, staged in ((HELPER,STAGE/"CutBranchComposition.java"),(PDE,STAGE/"CutBranchMarks.pde")):
        if src.read_bytes()!=staged.read_bytes(): raise RuntimeError("staged source differs: "+rel(src))
    return {"source":source_review,"stage":stage,"core":core,"edits":er,"workload":wr}

def replace_jar(old_bytes: bytes, candidate: Path) -> dict[str, Any]:
    old,_=jar_payload(old_bytes); new,_=jar_payload(candidate.read_bytes())
    missing=set(old)-set(new); changed={n for n in old if n in new and old[n]!=new[n]}
    if missing or changed: raise RuntimeError("candidate JAR does not preserve old members")
    added=sorted(set(new)-set(old)); prefix="org/procedurals/topology/LinePool2D"
    if not added or any(not n.startswith(prefix) or not n.endswith(".class") for n in added): raise RuntimeError("JAR adds non-LinePool2D classes")
    if "org/procedurals/topology/LinePool2D.class" not in added: raise RuntimeError("JAR lacks main LinePool2D class")
    return {"prior_sha256":hashlib.sha256(old_bytes).hexdigest(),"candidate_sha256":sha(candidate),"added_members":{n:hashlib.sha256(new[n]).hexdigest() for n in added},"preserved_prior_members":len(old)}
def jar_payload(data: bytes):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        items=[x for x in z.infolist() if not x.is_dir()]; names=[x.filename for x in items]
        if len(names)!=len(set(names)): raise RuntimeError("duplicate JAR member")
        if z.testzip() is not None: raise RuntimeError("JAR CRC check failed")
        return ({x.filename:z.read(x.filename) for x in items},{x.filename:x for x in items})

def build(out: Path) -> None:
    reviews=accepted(); old,infos=payload(SOURCE_ARCHIVE); candidate=STAGE/"code/procedurals.jar"; jar=replace_jar(old[JAR_MEMBER],candidate)
    if out.exists(): raise RuntimeError("refusing existing output: "+str(out))
    docs={"procedurals/docs/cut-branch-marks.md":GUIDE,"procedurals/docs/installing-cut-branch-marks.md":INSTALL}
    docs["procedurals/docs/reference/operations.md"]=ROOT/"docs/reference/operations.md"
    catalogs={"procedurals/catalog/operations/seeded-line-pool-2d.json":CATALOG}
    additions={"procedurals/examples/CutBranchMarks/CutBranchComposition.java":HELPER,"procedurals/examples/CutBranchMarks/CutBranchMarks.pde":PDE,"procedurals/catalog/operations/seeded-line-pool-2d.json":CATALOG}
    if any(n in old for n in additions): raise RuntimeError("line-pool member already exists")
    old_properties=old[PROPERTIES].decode()
    if "version=14\nprettyVersion=0.14.0\n" not in old_properties: raise RuntimeError("source properties are not 0.14.0")
    props=old_properties.replace("version=14\nprettyVersion=0.14.0\n","version=15\nprettyVersion=0.15.0\n",1).encode()
    inputs=[Path(__file__).resolve(),SOURCE_ARCHIVE,SOURCE_REVIEW,STAGE_RESULT,CORE_REVIEW,EDITS,EDITS_REVIEW,WORKLOAD,WORKLOAD_REVIEW,CORE,HELPER,PDE,CATALOG,GUIDE,INSTALL,candidate,STAGE/"CutBranchComposition.java",STAGE/"CutBranchMarks.pde",*docs.values(),*catalogs.values()]
    before={rel(p):sha(p) for p in inputs}; out.mkdir(parents=True); ap=out/ARCHIVE_NAME
    with zipfile.ZipFile(ap,"x",zipfile.ZIP_DEFLATED) as z:
        for n,b in old.items():
            if n==JAR_MEMBER:b=candidate.read_bytes()
            elif n==PROPERTIES:b=props
            elif n in docs:b=docs[n].read_bytes()
            elif n in catalogs:b=catalogs[n].read_bytes()
            z.writestr(n,b)
        for n,p in {**docs,**catalogs,**additions}.items():
            if n not in old:z.writestr(n,p.read_bytes())
    after={rel(p):sha(p) for p in inputs};
    if before!=after: raise RuntimeError("packaging input changed")
    current,_=payload(ap)
    allowed_changed={JAR_MEMBER,PROPERTIES,"procedurals/docs/reference/operations.md"}
    for n,b in old.items():
        if n not in allowed_changed and current.get(n)!=b: raise RuntimeError("inherited archive member changed: "+n)
    for n,p in {**docs,**catalogs,**additions}.items():
        if current.get(n)!=p.read_bytes(): raise RuntimeError("new/refresh payload mismatch: "+n)
    starts=sum(any(n.startswith("procedurals/examples/"+s+"/") for n in current) for s in OLD_STARTERS+("CutBranchMarks",)); ops=sum(n.startswith("procedurals/catalog/operations/") and n.endswith(".json") for n in current)
    if starts!=15 or ops!=15: raise RuntimeError("unexpected 15 starter/15 operation layout")
    report={"status":"staged","review_status":"pending_root_distribution_review","scope":"Java 0.15.0 archive; 15 operations and 15 starters. Other targets and registry publication are not claimed.","input_sha256":before,"input_sha256_after":after,"accepted_reviews":{k:{"status":v.get("status"),"sha256":sha(p)} for k,v,p in (("r3",reviews["source"],SOURCE_REVIEW),("core",reviews["core"],CORE_REVIEW),("edits",reviews["edits"],EDITS_REVIEW),("workload",reviews["workload"],WORKLOAD_REVIEW))},"archive":{"path":rel(ap),"sha256":sha(ap),"members":len(current),"starters":starts,"operations":ops,"core_jar":jar},"library_properties":{"version":15,"pretty_version":"0.15.0"}}
    (out/"result.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n"); print(json.dumps({"status":"staged","archive":rel(ap),"report":rel(out/"result.json")}))

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--build",action="store_true"); ap.add_argument("--output",type=Path,default=OUT_DEFAULT); a=ap.parse_args(); out=a.output.resolve()
    if ROOT/".work" not in out.parents: raise RuntimeError("output must be below .work")
    if not a.build: print(json.dumps({"status":"prepared","review_gate":"evidence/reproductions/line-pool-p2d/workload-review.json + workload.json","output":rel(out/ARCHIVE_NAME)})); return
    build(out)
if __name__=="__main__": main()
