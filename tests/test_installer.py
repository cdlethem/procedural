"""Installer integrity and replacement behavior, without downloading or compiling."""
import hashlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from tools import install


class InstallerTests(unittest.TestCase):
    def setUp(self):
        (install.ROOT / '.work').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=install.ROOT / '.work')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.book = self.root / 'sketchbook with spaces'

    def archive(self, invalid=False):
        archive = self.root / 'library.zip'
        with zipfile.ZipFile(archive, 'w') as output:
            if invalid:
                output.writestr('../escape', 'bad')
            else:
                for name in ('library/procedurals.jar', 'library/procedurals-processing-adapter.jar',
                             'examples/FieldMarks/FieldMarks.pde', 'library.properties'):
                    output.writestr('procedurals/' + name, 'new')
        return archive

    def existing(self):
        target = self.book / 'libraries/procedurals'
        target.mkdir(parents=True)
        (target / 'my edited example.pde').write_text('keep me')
        return target

    def test_new_install_and_backup_on_repeat(self):
        archive = self.archive()
        target, backup = install.install_archive(archive, self.book)
        self.assertIsNone(backup)
        (target / 'custom.pde').write_text('my sketch')
        target, backup = install.install_archive(archive, self.book)
        self.assertEqual((backup / 'custom.pde').read_text(), 'my sketch')
        self.assertNotIn(backup, list((self.book / 'libraries').iterdir()))
        self.assertTrue((target / 'library/procedurals.jar').is_file())

    def test_bad_archive_preserves_existing_install(self):
        target = self.existing()
        with self.assertRaises(ValueError):
            install.install_archive(self.archive(invalid=True), self.book)
        self.assertEqual((target / 'my edited example.pde').read_text(), 'keep me')
        self.assertFalse((self.book / 'libraries/escape').exists())

    def test_incomplete_archive_preserves_existing_install(self):
        target = self.existing()
        archive = self.root / 'incomplete.zip'
        with zipfile.ZipFile(archive, 'w') as output:
            output.writestr('procedurals/library.properties', 'new')
        with self.assertRaises(ValueError):
            install.install_archive(archive, self.book)
        self.assertTrue((target / 'my edited example.pde').exists())

    def test_failed_replacement_restores_backup(self):
        target = self.existing()
        original = Path.rename
        def fail_stage(path, destination):
            if path.parent.name.startswith('.procedurals-install-'):
                raise OSError('simulated replacement failure')
            return original(path, destination)
        with patch.object(Path, 'rename', fail_stage), self.assertRaises(OSError):
            install.install_archive(self.archive(), self.book)
        self.assertEqual((target / 'my edited example.pde').read_text(), 'keep me')

    def test_corrupt_download_is_not_published(self):
        cache = self.root / 'cache'
        with patch.object(install, 'CACHE', cache), patch.object(install.urllib.request, 'urlopen', return_value=io.BytesIO(b'bad')):
            with self.assertRaises(ValueError):
                install.download('https://example.invalid/input', 'input', hashlib.sha256(b'good').hexdigest())
        self.assertEqual(list(cache.iterdir()), [])

    def test_verified_cache_needs_no_network(self):
        expected = self.root / 'input'
        expected.write_bytes(b'good')
        with patch.object(install, 'CACHE', self.root), patch.object(install.urllib.request, 'urlopen') as network:
            result = install.download('https://example.invalid/input', 'input', hashlib.sha256(b'good').hexdigest())
        self.assertEqual(result, expected)
        network.assert_not_called()


if __name__ == '__main__':
    unittest.main()
