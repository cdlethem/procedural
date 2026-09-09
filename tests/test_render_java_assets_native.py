"""Opt-in actual asset loading through the Java render helper."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from PIL import Image
from tools import render_java

ROOT = Path(__file__).resolve().parents[1]

@unittest.skipUnless(os.environ.get('PROCEDURALS_TEST_JAR'), 'accepted JAR and pinned runtime required')
class AssetRenderNativeTests(unittest.TestCase):
    def test_nested_asset_and_isolated_variants(self):
        parent = ROOT / '.work/tmp'
        parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as temporary:
            work = Path(temporary)
            assets = work / 'assets'
            (assets / 'nested').mkdir(parents=True)
            source = assets / 'nested/pattern.png'
            expected = Image.new('RGB', (16,16), (23,71,149))
            expected.save(source)
            original = source.read_bytes()
            output = work / 'render'
            render_java.main([str(ROOT/'tests/native/AssetRender/AssetRender.pde'),
                '--library',os.environ['PROCEDURALS_TEST_JAR'],'--seed','42',
                '--assets',str(assets),'--sweep','marker=0,1','--output',str(output)])
            report=json.loads((output/'report.json').read_text())
            self.assertEqual(report['status'],'passed')
            for i,variant in enumerate(report['variants']):
                with Image.open(variant['image']) as rendered:
                    expected.putpixel((0,0), (255*i,)*3)
                    self.assertEqual(rendered.convert('RGB').tobytes(),expected.tobytes())
                staged=output/('variant-%02d'%i)/'data/nested/pattern.png'
                self.assertEqual(staged.read_bytes(), original)
                self.assertFalse(staged.is_symlink())
                self.assertNotEqual(staged.stat().st_ino, source.stat().st_ino)
            self.assertEqual(source.read_bytes(),original)
