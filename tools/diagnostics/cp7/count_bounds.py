#!/usr/bin/env python3
"""Private CP7 retained-array count arithmetic; deliberately creates no geometry."""
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'evidence/investigations/cp7-count-bounds.json'
MEMO=ROOT/'design/operations/cp7-count-bounds.md'
MAX_FACES=715_827_881; INT_MAX=2_147_483_647; LONG_MAX=9_223_372_036_854_775_807

def counts(p,s,z,c):
    assert p>=2 and s>=3 and 0<=z<=2 and 0<=c<=2-z and not(p==2 and z==2)
    # Z pole-adjacent bands each contribute S triangles; all other bands contribute 2S.
    v=(p-z)*s+z+c
    f=s*(2*(p-1)-z+c)
    return v,f

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 small=[]
 for p in range(2,6):
  for s in (3,4,12):
   for z in range(3):
    if p==2 and z==2:continue
    for c in range(3-z):
     v,f=counts(p,s,z,c);assert v<=f+1
     small.append({'P':p,'S':s,'Z':z,'C':c,'V':v,'F':f,'v_le_f_plus_one':True})
 boundary=[
  {'id':'p2-one-pole-open','P':2,'S':MAX_FACES,'Z':1,'C':0},
  {'id':'p2-one-pole-cap','P':2,'S':MAX_FACES,'Z':1,'C':1},
  {'id':'faces-at-limit','P':2,'S':MAX_FACES,'Z':1,'C':0},
  {'id':'faces-too-large','P':2,'S':MAX_FACES+1,'Z':1,'C':0},
 ]
 for row in boundary:
  v,f=counts(row['P'],row['S'],row['Z'],row['C']);row.update({'V':v,'F':f,'within_max_faces':f<=MAX_FACES,'three_V':3*v,'three_F':3*f})
 # Largest intermediate allowed by carrier bounds, independent of any mesh allocation.
 max_factor=2*INT_MAX-2-0+2
 signed64={'input_list_length_max':INT_MAX,'slice_max':MAX_FACES,'max_face_factor':max_factor,'max_v_product':INT_MAX*MAX_FACES,'max_f_product':MAX_FACES*max_factor,'long_max':LONG_MAX}
 assert signed64['max_v_product']<LONG_MAX and signed64['max_f_product']<LONG_MAX
 report={'status':'observational','scope':'Private integer representation proof only; maxFaces is not a heap, artistic, runtime, or recommended profile/subdivision bound.','formula':{'vertices':'V = (P - Z) * S + Z + C','faces':'F = S * (2 * (P - 1) - Z + C)','domain':'P >= 2; S >= 3; endpoint poles Z in 0..2; P=2,Z=2 invalid; enabled positive endpoint caps C <= 2-Z'},'proof':'For each valid band, a positive-positive band has 2S faces and a pole-adjacent band has S; there are Z pole-adjacent bands. Adding C cap fans gives F. V has one S-vertex ring per nonpole endpoint/profile point, one vertex per pole, and one center per enabled cap. Direct subtraction gives F + 1 - V = S * (P - 2 + C) + 1 - Z - C. For Z=0 this is S*(P-2)+C*(S-1)+1; for Z=1 it is S*(P-2)+C*(S-1); for Z=2, C=0 and P>=3, so it is S*(P-2)-1. Each is nonnegative for the stated domain, so V <= F+1.','max_faces':MAX_FACES,'derived_capacities':{'three_V_max':3*(MAX_FACES+1),'three_F_max':3*MAX_FACES,'int_max':INT_MAX},'small_combinations':small,'boundary_cases':boundary,'signed64_evaluation':signed64,'source_bindings':{str(Path(__file__).relative_to(ROOT)):sha(Path(__file__))},'runtime':sys.version}
 OUT.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n');print(json.dumps({'passed':True,'small_cases':len(small),'report':str(OUT)}))
if __name__=='__main__':main()
