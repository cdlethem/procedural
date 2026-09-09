"""Private exact closed-segment contact study and native-view data; no public API."""
from fractions import Fraction as F
from pathlib import Path
import argparse
import json
from nearest_hit_study import cross


def contact(query, obstacle):
    a, b = tuple(map(F, query[:2])), tuple(map(F, query[2:]))
    c, d = tuple(map(F, obstacle[:2])), tuple(map(F, obstacle[2:]))
    r = tuple(b[i]-a[i] for i in range(2))
    s = tuple(d[i]-c[i] for i in range(2))
    delta = tuple(c[i]-a[i] for i in range(2))
    if r == (0, 0):
        if s == (0, 0):
            return (F(0), F(0)) if a == c else None
        axis = 0 if s[0] else 1
        u = (a[axis]-c[axis])/s[axis]
        return (F(0), F(0)) if cross(tuple(a[i]-c[i] for i in range(2)), s) == 0 and 0 <= u <= 1 else None
    denominator = cross(r, s)
    if denominator:
        t, u = cross(delta, s)/denominator, cross(delta, r)/denominator
        return (t, t) if 0 <= t <= 1 and 0 <= u <= 1 else None
    if cross(delta, r):
        return None
    axis = 0 if r[0] else 1
    first, last = sorted(((c[axis]-a[axis])/r[axis], (d[axis]-a[axis])/r[axis]))
    lo, hi = max(F(0), first), min(F(1), last)
    return (lo, hi) if lo <= hi else None


def nearest(query, obstacles):
    candidates = [(hit[0], i, hit[1]) for i, obstacle in enumerate(obstacles)
                  if (hit := contact(query, obstacle)) is not None]
    return min(candidates) if candidates else None


def witnesses():
    q = [0,0,10,0]
    cases = [([3,-2,3,2], (F(3,10),F(3,10))), ([0,0,5,0],(F(0),F(1,2))),
             ([5,0,0,0],(F(0),F(1,2))), ([3,0,7,0],(F(3,10),F(7,10))),
             ([10,0,12,0],(F(1),F(1))), ([11,0,12,0],None),
             ([3,0,3,0],(F(3,10),F(3,10))), ([3,1,3,1],None)]
    for blocker, expected in cases:
        assert contact(q, blocker) == expected, blocker
    assert contact([3,0,3,0], q) == (F(0), F(0))
    assert contact([3,1,3,1], q) is None
    assert contact([3,0,3,0], [3,0,3,0]) == (F(0), F(0))
    assert nearest(q, [[3,-2,3,2], [3,0,7,0]]) == (F(3,10),0,F(3,10))
    assert nearest(q, [[0,0,5,0], [3,-2,3,2]]) == (F(0),0,F(1,2))
    return len(cases)+5


def view_rows(shift):
    rows=[]; hits=[]
    def line(panel, kind, segment):
        rows.append('\t'.join(map(str, [panel,kind,*map(float, segment)])))
    def draw(panel, query, obstacles):
        line(panel,'original',query)
        hit=nearest(query, obstacles)
        if hit is None:
            return
        t,index,hi=hit
        endpoint=[F(query[i])+t*(F(query[i+2])-F(query[i])) for i in range(2)]
        line(panel,'trimmed',list(query[:2])+endpoint)
        line(panel,'hit',endpoint+endpoint)
        hits.append({'panel':panel,'t':str(t),'obstacle':index,'contact_end':str(hi)})
    # Shared-origin rays deliberately exclude their entire emitting group.
    origins=[(85,90),(245+shift,70),(395,130),(100,300),(270,265),(380,385)]
    rays=[(group,[x,y,x+dx*400,y+dy*400]) for group,(x,y) in enumerate(origins)
          for dx,dy in [(1,1),(-1,1),(-1,-1),(1,-1)]]
    for group,query in rays:
        draw(0,query,[line for other,line in rays if other!=group])
    # Different use: stop directed connectors at supplied closed boundary edges.
    polygon=[(190+shift,110),(360,170),(320,365),(140,320)]
    obstacles=[list(a)+list(polygon[(i+1)%len(polygon)]) for i,a in enumerate(polygon)]
    for obstacle in obstacles:
        line(1,'obstacle',obstacle)
    for x,y in [(50,60),(150,40),(290,40),(440,80),(460,230),(430,430),(290,460),(130,440),(40,300),(40,170)]:
        draw(1,[x,y,250,240],obstacles)
    return rows,hits


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);a=ap.parse_args()
    root=Path(__file__).resolve().parents[3]
    out=a.output.resolve()
    if not out.is_relative_to(root/'.work') or out.exists():
        raise ValueError('require fresh output under repository .work')
    count=witnesses();out.mkdir(parents=True)
    results={}
    for name,shift in [('baseline',0),('shifted',35)]:
        rows,hits=view_rows(shift);(out/(name+'.tsv')).write_text('\n'.join(rows)+'\n')
        results[name]={'rows':len(rows),'hits':hits}
    assert results['baseline']!=results['shifted']
    (out/'result.json').write_text(json.dumps({'status':'passed-private-exact-study','witnesses':count,'views':results},indent=2)+'\n')
    print(json.dumps({'status':'passed-private-exact-study','witnesses':count,'output':str(out)}))

if __name__=='__main__':
    main()
