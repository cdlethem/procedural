"""Example-owned field composition motivated by 2018/Generativos/pelines.

Retain five attributes so mark and palette edits do not resample the field.
Constants are composition choices, not recommended artistic parameter ranges.
"""
from array import array
import math
from procedurals import regular_grid, gradient_noise_2d_01, cyclic_palette


def create_mark_field(seed=42, columns=160, rows=160, pitch=4):
    grid=regular_grid({'origin':[pitch/2,pitch/2],'spacing':[pitch,pitch],
                       'columns':columns,'rows':rows})
    field=gradient_noise_2d_01({'seed':seed})
    marks={key:array('d') for key in ('x','y','heading','length_factor','colour_cycles')}
    point=[0.0,0.0]
    for i in range(grid.size):
        grid.point_into(i,point,0)
        x,y=point
        marks['x'].append(x);marks['y'].append(y)
        marks['heading'].append(4*math.pi*field.sample(17+x*.009,17+y*.009))
        marks['length_factor'].append(field.sample(113+x*.013,113+y*.013))
        marks['colour_cycles'].append(3*field.sample(271+x*.007,271+y*.007))
    return marks


def mark_commands(marks, max_length, colors, bars=False):
    """Stream plain drawing values; the target adapter validates and draws them."""
    palette=cyclic_palette({'colors':colors})
    for i in range(len(marks['x'])):
        x,y=marks['x'][i],marks['y'][i]
        cosine,sine=math.cos(marks['heading'][i]),math.sin(marks['heading'][i])
        length=max_length*marks['length_factor'][i]
        if length==0:
            continue
        dx,dy=.5*length*cosine,.5*length*sine
        rgb=palette.sample(marks['colour_cycles'][i])
        if bars:
            nx,ny=-sine*1.25,cosine*1.25
            yield {'kind':'quad2','vertices':[[x-dx-nx,y-dy-ny],[x+dx-nx,y+dy-ny],
                   [x+dx+nx,y+dy+ny],[x-dx+nx,y-dy+ny]],'rgb':rgb,'opacity8':180}
        else:
            yield {'kind':'segment2','from':[x-dx,y-dy],'to':[x+dx,y+dy],
                   'rgb':rgb,'opacity8':180,'width':1,'cap':'round'}
