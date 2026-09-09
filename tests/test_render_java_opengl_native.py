"""Opt-in actual OpenGL helper profiles, layering and depth behavior."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from PIL import Image
from tools import render_java
ROOT=Path(__file__).resolve().parents[1]
@unittest.skipUnless(os.environ.get('PROCEDURALS_TEST_JAR'),'accepted JAR and pinned OpenGL runtime required')
class OpenGLNativeTests(unittest.TestCase):
    def test_explicit_profiles_and_depth(self):
        parent=ROOT/'.work/tmp';parent.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            for mode,sketch in [('P2D','Renderer2D'),('P3D','Renderer3D')]:
                output=Path(directory)/mode
                render_java.main([str(ROOT/('tests/native/'+sketch+'/'+sketch+'.pde')),
                    '--library',os.environ['PROCEDURALS_TEST_JAR'],'--seed','42',
                    '--renderer',mode,'--frames','1,2','--output',str(output)])
                r=json.loads((output/'report.json').read_text());self.assertEqual(r['status'],'passed')
                self.assertEqual(r['variants'][0]['native']['draws'],2)
                self.assertEqual(r['variants'][0]['native']['renderer'], 'processing.opengl.PGraphics'+('2D' if mode=='P2D' else '3D'))
                for i,capture in enumerate(r['variants'][0]['captures']):
                    with Image.open(capture['image']) as source:
                        im=source.convert('RGB')
                        self.assertEqual(im.getpixel((32,32)),(255,0,0) if i==0 else (0,255,0))
                        self.assertEqual(im.getpixel((12,12)),(0,0,255))
                        self.assertEqual(im.getpixel((2,2)),(255,255,255))

    def test_renderer_mismatch_fails_without_capture(self):
        parent=ROOT/'.work/tmp';parent.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            output=Path(directory)/'mismatch'
            with self.assertRaisesRegex(RuntimeError,'renderer or density mismatch'):
                render_java.main([str(ROOT/'tests/native/Renderer3D/Renderer3D.pde'),
                    '--library',os.environ['PROCEDURALS_TEST_JAR'],'--seed','42',
                    '--renderer','P2D','--output',str(output)])
            self.assertEqual(json.loads((output/'report.json').read_text())['status'],'failed')
            self.assertFalse(list(output.glob('variant-*/*.png')))
