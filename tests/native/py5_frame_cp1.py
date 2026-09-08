"""Registered actual py5 CP1 command-route and four-edit acceptance."""
import hashlib
import json
from pathlib import Path
import struct
from PIL import Image,ImageChops
from procedurals._py5_frame import Py5Frame
from mark_field import create_mark_field,mark_commands

ROOT=Path(__file__).resolve().parents[2]

def model_hash(marks):
    h=hashlib.sha256()
    for row in zip(*(marks[k] for k in ('x','y','heading','length_factor','colour_cycles'))):h.update(struct.pack('>5d',*row))
    return h.hexdigest()

def run_cp1(sketch):
    plan=json.loads((ROOT/'evidence/reproductions/cp1-java2d/plan.json').read_text())
    previous={c['id']:c for c in json.loads((ROOT/'evidence/reproductions/cp1-java2d/result.json').read_text())['native']['cases']}
    output=ROOT/'.work/reproductions/py5-adapter';output.mkdir(parents=True,exist_ok=True)
    marks=create_mark_field();snapshot=model_hash(marks);cases=[];images={};edits={}
    for case in plan['cases']:
        frame=Py5Frame(sketch);completed=None;geometry=hashlib.sha256();color=hashlib.sha256();count=0
        try:
            frame.begin({'width':640,'height':640,'density':1,'background':0xece7da})
            batch=[]
            for command in mark_commands(marks,case['maxLength'],[int(v,16) for v in case['colors']],case['mark']=='bar'):
                points=command['vertices'] if command['kind']=='quad2' else [command['from'],command['to']]
                for point in points:geometry.update(struct.pack('>2f',*point))
                color.update(struct.pack('>I',(180<<24)|command['rgb']));count+=1
                batch.append(command)
                if len(batch)==4096:frame.batch(batch);batch=[]
            frame.batch(batch)
            assert frame.count==count==25600 and model_hash(marks)==snapshot
            record={'id':case['id'],'model_sha256':snapshot,'geometry_sha256':geometry.hexdigest(),
                    'color_sha256':color.hexdigest(),'commands':count}
            for key in ('model_sha256','geometry_sha256','color_sha256','commands'):
                assert record[key]==previous[case['id']][key],(case['id'],key)
            completed=frame.end()
            destination=output/('cp1-'+case['id']+'.png')
            completed.save(str(destination),drop_alpha=False,use_thread=False)
            with Image.open(destination) as image:
                assert image.size==(640,640)
                pixels=image.convert('RGBA');images[case['id']]=pixels
            data=pixels.tobytes();assert all(v==255 for v in data[3::4])
            coverage=sum(data[i:i+3]!=bytes((236,231,218)) for i in range(0,len(data),4));assert coverage>0
            record.update(nonbackground_pixels=coverage,rgba_sha256=hashlib.sha256(data).hexdigest(),
                          image_path=str(destination.relative_to(ROOT)),png_sha256=hashlib.sha256(destination.read_bytes()).hexdigest())
            cases.append(record)
        finally:
            if completed is not None:Py5Frame.release_completed(completed)
            elif frame.state!='completed':frame.abort()
    for name in ('length','palette','bar'):
        diff=ImageChops.difference(images['base'].convert('RGB'),images[name].convert('RGB')).tobytes()
        changed=sum(any(diff[i:i+3]) for i in range(0,len(diff),3));assert changed>0
        edits[name]=changed
    return {'passed':True,'scope':'Actual py5 JAVA2D CP1 four-edit command route; not upstream or cross-host pixel identity',
            'cases':cases,'edit_changed_pixels':edits}
