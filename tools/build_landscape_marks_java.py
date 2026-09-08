#!/usr/bin/env python3
"""Package the accepted R3 example, preserving the Java0.13 core and prior payloads."""
import argparse
import json
import zipfile
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.build_lattice_marks_java import zip_payloads, safe_member, digest

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'.work/dist/r3/java')
    args = parser.parse_args()
    output = args.output.resolve()
    output.relative_to(ROOT/'.work')
    if output.exists(): raise RuntimeError('Preserve prior package attempts')
    prior_path = ROOT/'evidence/distribution/r2-review.json'
    review_path = ROOT/'evidence/reproductions/r3-p2d/root-review.json'
    result_path = ROOT/'evidence/reproductions/r3-p2d/edits.json'
    prior, review, result = [json.loads(p.read_text()) for p in (prior_path,review_path,result_path)]
    for r in (prior,review):
        if r.get('status')!='accepted' or r.get('owner')!='root' or r.get('reviewer')!='root':
            raise RuntimeError('Accepted root reviews required')
    if result.get('status')!='passed': raise RuntimeError('Accepted evaluated capture required')
    for group in ('implementation_sha256','evidence_sha256'):
        for name, expected in review[group].items():
            if digest(ROOT/name)!=expected: raise RuntimeError('Changed reviewed input: '+name)
    source = ROOT/prior['final_archive']['path']
    if digest(source)!=prior['final_archive']['sha256']: raise RuntimeError('Prior archive changed')
    stage = ROOT/'.work/examples/r3-candidate1'
    staged = json.loads((stage/'result.json').read_text())
    if staged.get('status')!='passed' or staged['inputs_before']!=staged['inputs_after']:
        raise RuntimeError('Stable official PDE staging required')
    for name, expected in {**staged['inputs_after'],**staged['artifacts_sha256']}.items():
        if digest(ROOT/name)!=expected or result['input_sha256'].get(name)!=expected:
            raise RuntimeError('Native/stage binding mismatch: '+name)
    old, infos = zip_payloads(source)
    jar = 'procedurals/library/procedurals.jar'
    if old[jar]!=(stage/'LandscapeMarks/code/procedurals.jar').read_bytes():
        raise RuntimeError('Native JAR differs from prior package')
    additions = {
      'procedurals/examples/LandscapeMarks/LandscapeComposition.java':ROOT/'packages/java/examples/LandscapeMarks/LandscapeComposition.java',
      'procedurals/examples/LandscapeMarks/LandscapeMarks.pde':ROOT/'packages/java-processing/examples/LandscapeMarks/LandscapeMarks.pde',
      'procedurals/docs/landscape-marks.md':ROOT/'docs/landscape-marks.md',
      'procedurals/docs/installing-landscape-marks.md':ROOT/'docs/installing-landscape-marks.md'}
    for member, path in additions.items():
        safe_member(member)
        if member in old: raise RuntimeError('New example member already present')
        if '/examples/' in member and path.read_bytes()!=(stage/'LandscapeMarks'/path.name).read_bytes():
            raise RuntimeError('Staged example mismatch')
    version='procedurals/library.properties'
    marker=b'version=13\nprettyVersion=0.13.0\n'
    if marker not in old[version]: raise RuntimeError('Unexpected inherited version')
    payloads=dict(old)
    payloads[version]=old[version].replace(marker,b'version=14\nprettyVersion=0.14.0\n',1)
    payloads.update({member:path.read_bytes() for member,path in additions.items()})
    inputs=[Path(__file__).resolve(),ROOT/'tools/build_lattice_marks_java.py',prior_path,review_path,result_path,source,stage/'result.json',*additions.values()]
    before={str(p.relative_to(ROOT)):digest(p) for p in inputs}
    output.mkdir(parents=True)
    archive=output/'procedurals-processing-0.14.0.zip'
    with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED) as z:
        for member, data in payloads.items(): z.writestr(member,data)
    actual,_=zip_payloads(archive)
    if actual!=payloads: raise RuntimeError('Archive bytes differ')
    if any(actual[n]!=data for n,data in old.items() if n!=version): raise RuntimeError('Prior content changed')
    if before!={str(p.relative_to(ROOT)):digest(p) for p in inputs}: raise RuntimeError('Inputs changed')
    operations=sum(n.startswith('procedurals/catalog/operations/') and n.endswith('.json') for n in actual)
    starters=len({n.split('/')[2] for n in actual if n.startswith('procedurals/examples/')})
    if operations!=14 or starters!=14: raise RuntimeError('Unexpected delivery counts')
    report={'status':'staged','review_status':'pending_root','input_sha256':before,'archive':{'path':str(archive.relative_to(ROOT)),'sha256':digest(archive)},'operations':operations,'starters':starters,'members':len(actual),'unchanged_prior_members':len(old)-1,'core_jar_unchanged':True}
    (output/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report['archive']))

if __name__=='__main__':main()
