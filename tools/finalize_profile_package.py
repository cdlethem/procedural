#!/usr/bin/env python3
"""Finalize the reviewed CP7 starter by adding documentation without changing shipped code.

The command is inert unless --finalize is supplied.  It never rewrites an existing
final archive or evidence record, and it verifies every inherited non-document ZIP
member by uncompressed bytes.
"""
from __future__ import annotations
import argparse,hashlib,json,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'.work/dist/cp7/java-savefix/procedurals-processing-0.7.0.zip'
FINAL=ROOT/'.work/dist/cp7/final/procedurals-processing-0.7.0.zip'
RESULT=ROOT/'evidence/reproductions/cp7-p3d-savefix/result.json'
EVIDENCE=ROOT/'evidence/distribution/cp7-java.json'
PDE=ROOT/'packages/java-processing/examples/ProfileMarks/ProfileMarks.pde'
GUIDES=('getting-started.md','path-marks.md','placement-marks.md','region-marks.md','grain-marks.md','branch-marks.md','profile-marks.md')
DOCS=(*GUIDES,'installing-profile-marks.md','reference/operations.md')
CATALOG=tuple(sorted((ROOT/'catalog/operations').glob('*.json')))

def sha(path:Path)->str:
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def rel(path:Path)->str:return str(path.resolve().relative_to(ROOT))
def current_documents()->dict[str,Path]:
 values={}
 for name in DOCS:
  source=ROOT/'docs'/name
  if not source.is_file():raise RuntimeError('required final package document missing: '+str(source))
  values['procedurals/docs/'+name]=source
 for source in CATALOG:
  if not source.is_file():raise RuntimeError('relevant catalog operation missing: '+str(source))
  values['procedurals/catalog/operations/'+source.name]=source
 return values
def verify_result()->dict:
 if not RESULT.is_file():raise RuntimeError('passed corrected installed P3D result is missing')
 data=json.loads(RESULT.read_text())
 if data.get('status')!='passed':raise RuntimeError('corrected installed P3D result is not passed')
 before,after=data.get('input_sha256'),data.get('input_sha256_after')
 if not isinstance(before,dict) or before!=after:raise RuntimeError('corrected installed P3D result bindings are incomplete')
 pde_key=rel(PDE)
 if before.get(pde_key)!=sha(PDE):raise RuntimeError('current corrected ProfileMarks PDE differs from passed installed result')
 distribution=ROOT/'.work/cp7-distribution/savefix-result.json'
 if before.get(rel(distribution))!=sha(distribution):raise RuntimeError('distribution report differs from installed run binding')
 staged=json.loads(distribution.read_text())
 if staged.get('status')!='passed' or staged['artifacts']['starter']['sha256']!=sha(SOURCE):raise RuntimeError('source archive is not the validated staged archive')
 return data
def inherited_bytes(archive:zipfile.ZipFile,replacements:dict[str,Path])->dict[str,bytes]:
 values={}
 for info in archive.infolist():
  if info.is_dir():continue
  if info.filename not in replacements:values[info.filename]=archive.read(info)
 return values
def finalise(documents:dict[str,Path],result:dict)->None:
 if FINAL.exists() or EVIDENCE.exists():raise RuntimeError('final CP7 archive/evidence already exists; preserve it')
 if not SOURCE.is_file():raise RuntimeError('corrected staged CP7 archive is missing')
 FINAL.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(SOURCE) as old:
  original={info.filename:old.read(info) for info in old.infolist() if not info.is_dir()}
  pde_name='procedurals/examples/ProfileMarks/ProfileMarks.pde'
  if original.get(pde_name)!=PDE.read_bytes():raise RuntimeError('staged archive ProfileMarks PDE differs from current corrected source')
  required_examples={'procedurals/examples/'+name+'/' for name in ('FieldMarks','PathMarks','PlacementMarks','RegionMarks','GrainMarks','BranchMarks','ProfileMarks')}
  names=set(original)
  if any(not any(name.startswith(prefix) for name in names) for prefix in required_examples):raise RuntimeError('staged archive lacks one of seven starters')
  with zipfile.ZipFile(FINAL,'x',zipfile.ZIP_DEFLATED) as new:
   for info in old.infolist():
    if info.is_dir():continue
    payload=documents[info.filename].read_bytes() if info.filename in documents else old.read(info)
    replacement=zipfile.ZipInfo(info.filename);replacement.date_time=info.date_time;replacement.compress_type=zipfile.ZIP_DEFLATED;replacement.external_attr=info.external_attr
    new.writestr(replacement,payload)
   for name,source in documents.items():
    if name not in original:new.writestr(name,source.read_bytes(),compress_type=zipfile.ZIP_DEFLATED)
 with zipfile.ZipFile(FINAL) as new:
  final={info.filename:new.read(info) for info in new.infolist() if not info.is_dir()}
 inherited={name:payload for name,payload in original.items() if name not in documents}
 for name,payload in inherited.items():
  if final.get(name)!=payload:raise RuntimeError('non-document archive member changed: '+name)
 for name,source in documents.items():
  if final.get(name)!=source.read_bytes():raise RuntimeError('final document differs from current source: '+name)
 report={'status':'passed','scope':'Local CP7 Java starter finalization: current documentation/catalog additions only; inherited JARs, examples, properties and notices verified byte-identical by uncompressed payload. Native P3D acceptance is bound separately.','source_archive':{'path':rel(SOURCE),'sha256':sha(SOURCE)},'final_archive':{'path':rel(FINAL),'sha256':sha(FINAL)},'documents':{name:{'source':rel(path),'sha256':sha(path)} for name,path in documents.items()},'preserved_non_document_members':len(inherited),'seven_starters_present':True,'corrected_pde':{'path':rel(PDE),'sha256':sha(PDE),'archive_member':'procedurals/examples/ProfileMarks/ProfileMarks.pde','matches_current':True},'installed_p3d_result':{'path':rel(RESULT),'sha256':sha(RESULT),'status':result['status'],'scope':result.get('scope')}}
 EVIDENCE.parent.mkdir(parents=True,exist_ok=True);EVIDENCE.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'status':'passed','final_archive':rel(FINAL),'evidence':rel(EVIDENCE)}))
def main()->None:
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--finalize',action='store_true',help='write the new final archive and evidence after root docs review');a=p.parse_args()
 if not a.finalize:
  print(json.dumps({'status':'prepared','scope':'no archive or evidence written; rerun with --finalize after root confirms documentation readiness','source_archive':rel(SOURCE),'required_documents':['docs/'+x for x in DOCS]}));return
 finalise(current_documents(),verify_result())
if __name__=='__main__':main()
