"""Actual example setup, programmatic key-handler edits and saved PNG check."""
import hashlib
import json
from pathlib import Path
import sys
import traceback

ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'packages/python/examples/field_marks'),str(ROOT/'packages/python')]
import py5
from jpype import JClass,JChar
from PIL import Image
from sketch import FieldMarks,OUTPUT
from py5_frame_cp1 import model_hash

result={'passed':False,'part':'ui','py5':py5.__version__,
        'java':str(JClass('java.lang.System').getProperty('java.version'))}


class CheckFieldMarks(FieldMarks):
    def setup(self):
        try:
            super().setup()
            expected={case['id']:case for case in json.loads(
                (ROOT/'evidence/conformance/py5-adapter-cp1.json').read_text())['native']['native']['cases']}
            snapshot=model_hash(self.marks)
            checks=[]
            def check(name):
                assert self._instance.sketchPixelDensity()==1
                assert (self.width,self.height,self.pixel_width,self.pixel_height)==(640,640,640,640)
                self.load_np_pixels()
                rgba=self.np_pixels[:,:,[1,2,3,0]].tobytes()
                actual=hashlib.sha256(rgba).hexdigest()
                assert actual==expected[name]['rgba_sha256'],(name,actual)
                assert model_hash(self.marks)==snapshot
                assert self.revision==len(checks)+1
                checks.append({'id':name,'rgba_sha256':actual,'revision':self.revision})
            def key(value):
                self._instance.key=JChar(value)
                self.key_pressed()
            check('base')
            key('l');check('length')
            self.max_length=16
            key('p');check('palette')
            self.palette_index=0
            key('b');check('bar')
            key('s')
            path=OUTPUT/'field-marks.png'
            with Image.open(path) as saved:
                assert saved.size==(640,640)
                assert hashlib.sha256(saved.convert('RGBA').tobytes()).hexdigest()==checks[-1]['rgba_sha256']
            assert self.revision==4
            result.update(passed=True,native={'passed':True,'checks':checks,
                'saved_png_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                'scope':'Actual setup and programmatic key handlers; not physical keyboard or human usability'})
        except BaseException:
            result.update(traceback=traceback.format_exc())
        finally:self.exit_sketch()


try:CheckFieldMarks().run_sketch(block=True)
except BaseException:result.update(passed=False,traceback=traceback.format_exc())
print('PROCEDURALS_RESULT='+json.dumps(result))
sys.exit(0 if result['passed'] else 1)
