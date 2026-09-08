#!/usr/bin/env python3
"""Exercise real py5 callbacks; injected callbacks do not prove physical key delivery."""
import argparse
import hashlib
import json
import sys
import threading
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser()
p.add_argument('--output', type=Path, required=True)
OUTPUT = p.parse_args().output.resolve()
if not OUTPUT.is_relative_to(ROOT / '.work') or OUTPUT.exists():
    raise ValueError('fresh .work output required')
OUTPUT.mkdir(parents=True)
sys.path[:0] = [str(ROOT / 'packages/python/examples/profile_marks'), str(ROOT / 'packages/python')]
import py5
from jpype import JChar, JClass
from PIL import Image
import sketch as starter
starter.OUTPUT = OUTPUT
FILES = ('packages/python/procedurals/radial_profile.py', 'packages/python/procedurals/colors.py',
         'packages/python/examples/profile_marks/profile_composition.py',
         'packages/python/examples/profile_marks/sketch.py', 'tests/native/py5_profile_marks.py',
         'design/capabilities/profile-marks-py5-acceptance.md',
         'catalog/operations/radial-profile-surface.json', 'fixtures/operations/radial-profile-surface.json',
         'design/capabilities/profile-marks-port-boundary.md',
         'evidence/conformance/profile-marks-python-parity.json')
sha = lambda data: hashlib.sha256(data).hexdigest()
REPORT = {'status': 'failed', 'scope': 'Actual py5 P3D draw and injected key callbacks; no physical input, package or support acceptance', 'states': []}
BASE = dict(profile=0, slices=32, cap_start=True, cap_end=True, alternate=False, trio=False)
STEPS = (
    ('baseline', None, BASE, 1088, None),
    ('waist', 'p', {**BASE, 'profile': 1}, 1088, True),
    ('pointed', 'p', {**BASE, 'profile': 2}, 1024, True),
    ('coarse', 'd', {**BASE, 'profile': 2, 'slices': 8}, 256, False),
    ('cylinder', 'p', {**BASE, 'slices': 8}, 272, True),
    ('start-open', 'b', {**BASE, 'slices': 8, 'cap_start': False}, 264, False),
    ('both-open', 't', {**BASE, 'slices': 8, 'cap_start': False, 'cap_end': False}, 256, False),
    ('palette', 'c', {**BASE, 'slices': 8, 'cap_start': False, 'cap_end': False, 'alternate': True}, 256, True),
    ('trio', 'x', {**BASE, 'slices': 8, 'cap_start': False, 'cap_end': False, 'alternate': True, 'trio': True}, 760, True),
    ('reset', '0', BASE, 1088, False),
)

def hashes():
    paths = [ROOT / name for name in FILES]
    package = Path(py5.__file__).parent
    paths += [package / name for name in ('__init__.py', 'sketch.py', 'base.py', 'jars/core.jar', 'jars/py5.jar')]
    java = Path(str(JClass('java.lang.System').getProperty('java.home')))
    paths += [java / 'release', java / 'lib/modules']
    return {str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path): sha(path.read_bytes()) for path in paths}

class Probe(starter.ProfileMarksSketch):
    # The controller never renders. This lock serializes injected key callbacks with
    # animation-thread draws, including model rebuilds. Physical key delivery is excluded.
    gate = threading.RLock()
    ready = threading.Event()
    failed = threading.Event()
    index = 0
    paints = 0
    prior = None
    images = {}
    pointed_values = None

    def normal(self, *args):
        self.normal_calls += 1
        return super().normal(*args)

    def vertex(self, *args):
        self.vertex_calls += 1
        return super().vertex(*args)

    def setup(self):
        try:
            super().setup()
            threading.Thread(target=self.control, daemon=True).start()
        except BaseException:
            self.fail()

    def fail(self):
        REPORT['failure'] = traceback.format_exc()
        self.failed.set()
        self.ready.set()
        self.exit_sketch()

    def draw(self):
        with self.gate:
            try:
                self.normal_calls = self.vertex_calls = 0
                self.paints += 1
                super().draw()
                name, _, settings, faces, retained = STEPS[self.index]
                assert self.shown_revision == self.index + 1 == self.paints
                assert {key: getattr(self, key) for key in BASE} == settings
                assert self.drawn_faces == self.normal_calls == faces
                assert self.vertex_calls == faces * 3
                composition = self.composition
                values = [composition.mesh_at(i).to_values() for i in range(3)]
                geometry = sha(json.dumps(values, sort_keys=True).encode())
                if self.prior:
                    assert (composition is self.prior[0]) == retained
                    assert (geometry == self.prior[1]) == retained
                if name == 'start-open':
                    self.pointed_values = values[2]
                if name == 'both-open':
                    assert values[2] == self.pointed_values
                self.load_np_pixels()
                assert self.np_pixels.shape == (640, 640, 4)
                rgba = self.np_pixels[:, :, [1, 2, 3, 0]].tobytes()
                if name == 'reset':
                    assert rgba == self.images['baseline']
                elif name == 'start-open':
                    # The removed rear cap is occluded in the fixed Java camera.
                    assert rgba == self.images['cylinder']
                elif self.prior:
                    assert rgba != self.images[self.prior[2]], 'edit did not change pixels'
                path = OUTPUT / f'{name}.png'
                self.save(str(path), drop_alpha=False, use_thread=False)
                with Image.open(path) as img:
                    assert img.size == (640, 640) and img.convert('RGBA').tobytes() == rgba
                self.images[name] = rgba
                self.prior = composition, geometry, name
                REPORT['states'].append(dict(id=name, settings=settings, faces=faces,
                    normal_calls=self.normal_calls, vertex_calls=self.vertex_calls,
                    revision=self.shown_revision, retained=retained, geometry_sha256=geometry,
                    rgba_sha256=sha(rgba), png_sha256=sha(path.read_bytes())))
                self.ready.set()
            except BaseException:
                self.fail()

    def press(self, key):
        # Only model/control/save work here; GL work stays in draw().
        with self.gate:
            self._instance.key = JChar(key)
            self.key_pressed()

    def control(self):
        try:
            for index, (name, _, _, _, _) in enumerate(STEPS):
                assert self.ready.wait(20), f'draw timeout: {name}'
                if self.failed.is_set():
                    return
                # Let Processing finish its endDraw/redraw bookkeeping before the next input.
                time.sleep(.15)
                with self.gate:
                    assert self.shown_revision == self.paints == index + 1
                    if name in ('trio', 'reset'):
                        before = self.composition, self.shown_revision, self.paints
                        self.press('s')
                        path = OUTPUT / 'profile-marks.png'
                        with Image.open(path) as img:
                            assert img.size == (640, 640)
                            assert img.convert('RGBA').tobytes() == self.images[name]
                        (OUTPUT / f'{name}-saved.png').write_bytes(path.read_bytes())
                        REPORT['states'][index]['saved_png_sha256'] = sha(path.read_bytes())
                if name in ('trio', 'reset'):
                    time.sleep(.25)
                    with self.gate:
                        assert self.composition is before[0]
                        assert (self.shown_revision, self.paints) == before[1:]
                if index + 1 < len(STEPS):
                    with self.gate:
                        self.ready.clear()
                        self.index = index + 1
                        self.press(STEPS[self.index][1])
            REPORT.update(status='passed', paint_calls=self.paints)
            self.exit_sketch()
        except BaseException:
            self.fail()

REPORT.update(py5=str(py5.__version__), python=sys.version,
              java=str(JClass('java.lang.System').getProperty('java.version')))
REPORT['input_sha256_before'] = hashes()
try:
    Probe().run_sketch(block=True)
except BaseException:
    REPORT.update(status='failed', failure=traceback.format_exc())
REPORT['input_sha256_after'] = hashes()
if REPORT['input_sha256_before'] != REPORT['input_sha256_after']:
    REPORT.update(status='failed', failure='source/runtime changed during attempt')
(OUTPUT / 'result.json').write_text(json.dumps(REPORT, indent=2) + '\n')
print(json.dumps({'status': REPORT['status'], 'output': str(OUTPUT), 'failure': REPORT.get('failure')}))
raise SystemExit(0 if REPORT['status'] == 'passed' else 1)
