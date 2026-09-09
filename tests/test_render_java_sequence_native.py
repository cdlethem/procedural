"""Opt-in frame-sequence state continuity against actual Processing output."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from PIL import Image
from tools import render_java

ROOT = Path(__file__).resolve().parents[1]

@unittest.skipUnless(os.environ.get('PROCEDURALS_TEST_JAR'), 'accepted JAR and pinned runtime required')
class SequenceNativeTests(unittest.TestCase):
    def test_accumulating_sequence_and_single_final_agree(self):
        parent=ROOT/'.work/tmp';parent.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            work=Path(directory)
            common=[str(ROOT/'tests/native/FrameSelection/FrameSelection.pde'),
                    '--library',os.environ['PROCEDURALS_TEST_JAR'],'--seed','42']
            output=work/'sequence'
            render_java.main(common+['--frames','1,3,5','--output',str(output)])
            r=json.loads((output/'report.json').read_text())
            self.assertEqual(r['status'],'passed')
            self.assertEqual(r['requested_frames'],[1,3,5])
            variant=r['variants'][0]
            self.assertEqual(variant['native']['draws'],5)
            self.assertEqual(variant['native']['frames'],3)
            self.assertEqual([v['frame'] for v in variant['captures']],[1,3,5])
            self.assertNotIn('image',variant)
            final=None
            for capture in variant['captures']:
                with Image.open(capture['image']) as source:
                    actual=source.convert('RGB')
                    expected=Image.new('RGB',(32,16))
                    for x in range(capture['frame']):
                        for y in range(16):expected.putpixel((x,y),(42,x+1,0))
                    self.assertEqual(actual.tobytes(),expected.tobytes())
                    final=actual.tobytes()
            self.assertEqual(len(list((output/'variant-00').glob('frame-*.png'))),3)
            self.assertEqual(sorted(p.name for p in (output/'contact-images').iterdir()),
                             ['variant-00-frame-%05d.png'%f for f in [1,3,5]])
            single=work/'single'
            render_java.main(common+['--frame','5','--output',str(single)])
            sr=json.loads((single/'report.json').read_text())
            with Image.open(sr['variants'][0]['image']) as source:
                self.assertEqual(source.convert('RGB').tobytes(),final)

    def test_early_exit_preserves_partial_capture_without_success(self):
        parent=ROOT/'.work/tmp';parent.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            work=Path(directory);sketch=work/'Early.pde'
            sketch.write_text("void settings(){size(16,16,JAVA2D);pixelDensity(1);}\n"
                "void configureRender(long seed, java.util.Map<String,Double> p){}\n"
                "void draw(){background(42);if(frameCount==2)exit();}\n")
            output=work/'render'
            with self.assertRaises(Exception):
                render_java.main([str(sketch),'--library',os.environ['PROCEDURALS_TEST_JAR'],
                    '--seed','42','--frames','1,3','--output',str(output)])
            report=json.loads((output/'report.json').read_text())
            self.assertEqual(report['status'],'failed')
            self.assertEqual(report['variants'],[])
            self.assertTrue((output/'variant-00/frame-00001.png').is_file())
            self.assertFalse((output/'variant-00/frame-00003.png').exists())
