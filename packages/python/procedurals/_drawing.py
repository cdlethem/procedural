"""Internal pure validation for drawing.fresh-raster-2d v0.1.0.

Motivated by survey/out/2018/Generativos/pelines/notes.md and the ciserp
counterexample. Bounds are reviewed engineering policy, not artistic ranges.
No host objects or renderer support are provided by this module.
"""
from collections.abc import Mapping
import math
import struct


class DrawingError(ValueError):
    def __init__(self, code):
        self.code=code
        super().__init__(code)


def _number(value,code):
    if isinstance(value,bool) or not isinstance(value,(int,float)):
        raise DrawingError(code)
    try:value=float(value)
    except (OverflowError,ValueError):raise DrawingError(code) from None
    if not math.isfinite(value):raise DrawingError(code)
    return 0.0 if value==0 else value


def _integer(value,lo,hi,code):
    value=_number(value,code)
    if value!=math.floor(value) or not lo<=value<=hi:raise DrawingError(code)
    return int(value)


def validate_environment(value):
    """Return a detached environment; no allocation of a native surface."""
    code='INVALID_ENVIRONMENT'
    if not isinstance(value,Mapping) or set(value)!= {'width','height','density','background'}:
        raise DrawingError(code)
    return {'width':_integer(value['width'],1,2048,code),
            'height':_integer(value['height'],1,2048,code),
            'density':_integer(value['density'],1,1,code),
            'background':_integer(value['background'],0,16777215,code)}


def _point(value):
    if not isinstance(value,(list,tuple)) or len(value)!=2:raise DrawingError('INVALID_COMMAND')
    return [_number(value[0],'INVALID_COMMAND'),_number(value[1],'INVALID_COMMAND')]


def _convex(points):
    # Binary64 ratios have power-of-two denominators. Scale all coordinates to
    # one exact integer lattice; determinant signs are unchanged. No epsilon or
    # rounded multiply/subtract can erase a thin shape's nonzero turn.
    ratios=[v.as_integer_ratio() for p in points for v in p]
    denominator=max(d for _,d in ratios)
    coords=[n*(denominator//d) for n,d in ratios]
    sign=0
    for i in range(4):
        a=2*i;b=2*((i+1)%4);c=2*((i+2)%4)
        turn=(coords[b]-coords[a])*(coords[c+1]-coords[a+1])-(coords[b+1]-coords[a+1])*(coords[c]-coords[a])
        current=(turn>0)-(turn<0)
        if current==0 or (sign and current!=sign):return False
        sign=current
    return True


def _f32(value):
    try:result=struct.unpack('>f',struct.pack('>f',value))[0]
    except OverflowError:raise DrawingError('INVALID_COMMAND') from None
    if not math.isfinite(result):raise DrawingError('INVALID_COMMAND')
    return 0.0 if result==0 else result


def normalize_command(command,environment):
    """Normalize one command to detached values for a future adapter.

    The frame must already have validated its environment. This internal routine
    does not own a frame, advance indices, retain caller data or perform drawing.
    """
    code='INVALID_COMMAND'
    if not isinstance(command,Mapping):raise DrawingError(code)
    kind=command.get('kind')
    if kind=='segment2':
        if set(command)!={'kind','from','to','rgb','opacity8','width','cap'} or command['cap']!='round':
            raise DrawingError(code)
        points=[_point(command['from']),_point(command['to'])]
        width=_number(command['width'],code)
        if width<=0:raise DrawingError(code)
    elif kind=='quad2':
        if set(command)!={'kind','vertices','rgb','opacity8'}:raise DrawingError(code)
        vertices=command['vertices']
        if not isinstance(vertices,(list,tuple)) or len(vertices)!=4:raise DrawingError(code)
        points=[_point(p) for p in vertices];width=None
    else:raise DrawingError(code)
    rgb=_integer(command['rgb'],0,16777215,code)
    opacity=_integer(command['opacity8'],0,255,code)
    if (kind=='segment2' and points[0]==points[1]) or (kind=='quad2' and not _convex(points)):
        raise DrawingError(code)
    converted=[[_f32(x),_f32(y)] for x,y in points]
    if width is not None:width=_f32(width)
    w,h=environment['width'],environment['height'];m=max(w,h)
    if any(not (-m<=x<=w+m and -m<=y<=h+m) for x,y in converted):raise DrawingError(code)
    if width is not None and not 1/256<=width<=m:raise DrawingError(code)
    if kind=='quad2' and not _convex(converted):raise DrawingError(code)
    result={'outcome':'noop' if kind=='segment2' and converted[0]==converted[1] else 'emit',
            'kind':kind,'points':converted,'rgb':rgb,'channels':[(rgb>>16)&255,(rgb>>8)&255,rgb&255],
            'opacity8':opacity,'alpha64':opacity/255}
    if width is not None:result.update(width=width,cap='round')
    return result
