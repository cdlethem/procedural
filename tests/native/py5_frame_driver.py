"""Real py5 sketch-thread executor for the registered native adapter suite."""
import importlib
import json
from pathlib import Path
import sys
import traceback

ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'packages/python'),str(ROOT/'packages/python/examples/field_marks')]
import py5
from jpype import JClass

part=sys.argv[1]
result={'passed':False,'part':part,'py5':py5.__version__,
        'java':str(JClass('java.lang.System').getProperty('java.version'))}


class NativeSketch(py5.Sketch):
    def settings(self):
        self.size(32,24,self.JAVA2D)
        self.pixel_density(2)

    def setup(self):
        try:
            self.no_loop()
            if (self._instance.sketchPixelDensity()!=2 or
                self.pixel_width!=64 or self.pixel_height!=48):
                raise AssertionError('Test parent must have actual density-two backing')
            module=importlib.import_module('py5_frame_'+part)
            native=getattr(module,'run_'+part)(self)
            result.update(native=native,passed=native['passed'])
        except BaseException as error:
            result.update(failure=str(error),traceback=traceback.format_exc())
        finally:
            self.exit_sketch()


try:
    sketch=NativeSketch()
    sketch.run_sketch(block=True)
except BaseException as error:
    result.update(passed=False,failure=str(error),traceback=traceback.format_exc())
print('PROCEDURALS_RESULT='+json.dumps(result))
sys.exit(0 if result['passed'] else 1)
