import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from tools.reviewed_export_extension import (CORRECTION, HELPER, PATHS, REVIEW,
                                             CORRECTED_SOURCES, ROOT_CORRECTION, SOURCE_COMPARISON,
                                             _validate_retained_output_correction,
                                             historical_export_bytes)


class ReviewedExportTests(unittest.TestCase):
    def test_retained_output_successor_is_narrow_and_fail_closed(self):
        import shutil
        repository = Path(__file__).resolve().parents[1]
        root_review = json.loads((repository / ROOT_CORRECTION).read_text())
        comparison = json.loads((repository / SOURCE_COMPARISON).read_text())
        files = {ROOT_CORRECTION, SOURCE_COMPARISON, HELPER, *CORRECTED_SOURCES}
        files.update(root_review['implementation_sha256'])
        files.update(root_review['evidence_sha256'])
        with tempfile.TemporaryDirectory(dir=repository / '.work') as temporary:
            root = Path(temporary)
            for name in files:
                source = repository / name
                if source.exists():
                    (root / name).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source, root / name)
            previous_bytes = {
                name: subprocess.check_output(['git', 'show', f'4905c054bf6540bdade201f3e64e78423b24d53e:{name}'], cwd=repository).decode()
                for name in (*CORRECTED_SOURCES, HELPER)
            }
            current = {name: (repository / name).read_text() for name in (*CORRECTED_SOURCES, HELPER)}
            digest = lambda data: hashlib.sha256(data.encode()).hexdigest()
            correction = {
                'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                'previous_review_sha256': digest((repository / ROOT_CORRECTION).read_text()),
                'implementation_sha256': {name: digest(text) for name, text in current.items()},
                'evidence_sha256': {ROOT_CORRECTION: digest((repository / ROOT_CORRECTION).read_text()), SOURCE_COMPARISON: digest((repository / SOURCE_COMPARISON).read_text())},
                'previous_bytes': previous_bytes,
                'extensions': {name: {'before': previous_bytes[name], 'after': current[name]} for name in current},
            }
            (root / CORRECTION).parent.mkdir(parents=True, exist_ok=True)
            (root / CORRECTION).write_text(json.dumps(correction))
            snapshots = {}
            self.assertTrue(_validate_retained_output_correction(root, snapshots))
            forged = json.loads(json.dumps(correction)); forged['previous_bytes'][next(iter(CORRECTED_SOURCES))] += 'forged'
            (root / CORRECTION).write_text(json.dumps(forged))
            self.assertFalse(_validate_retained_output_correction(root, {}))
            forged = json.loads(json.dumps(correction)); forged['extensions']['arbitrary.py'] = {'before': '', 'after': ''}
            (root / CORRECTION).write_text(json.dumps(forged))
            self.assertFalse(_validate_retained_output_correction(root, {}))

            for key, name in [('implementation_sha256', HELPER), ('evidence_sha256', SOURCE_COMPARISON)]:
                forged = json.loads(json.dumps(correction))
                del forged[key][name]
                (root / CORRECTION).write_text(json.dumps(forged))
                self.assertFalse(_validate_retained_output_correction(root, {}))
            forged = json.loads(json.dumps(correction))
            forged['previous_bytes'][HELPER] += 'forged'
            forged['extensions'][HELPER]['before'] += 'forged'
            (root / CORRECTION).write_text(json.dumps(forged))
            self.assertFalse(_validate_retained_output_correction(root, {}))
            # Even self-consistent rehashed source claims cannot authorize a geometry edit.
            name = 'packages/javascript/src/branch-tree.js'
            changed = current[name].replace('Math.cos(', 'Math.sin(')
            self.assertNotEqual(changed, current[name])
            (root / name).write_text(changed)
            revised_root = json.loads((root / ROOT_CORRECTION).read_text())
            revised_root['implementation_sha256'][name] = digest(changed)
            revised_comparison = json.loads((root / SOURCE_COMPARISON).read_text())
            revised_comparison['sources'][name]['after_sha256'] = digest(changed)
            (root / SOURCE_COMPARISON).write_text(json.dumps(revised_comparison))
            revised_root['evidence_sha256'][SOURCE_COMPARISON] = digest((root / SOURCE_COMPARISON).read_text())
            (root / ROOT_CORRECTION).write_text(json.dumps(revised_root))
            forged = json.loads(json.dumps(correction))
            forged['implementation_sha256'][name] = digest(changed)
            forged['extensions'][name]['after'] = changed
            forged['previous_review_sha256'] = digest((root / ROOT_CORRECTION).read_text())
            for evidence in (ROOT_CORRECTION, SOURCE_COMPARISON):
                forged['evidence_sha256'][evidence] = digest((root / evidence).read_text())
            (root / CORRECTION).write_text(json.dumps(forged))
            self.assertFalse(_validate_retained_output_correction(root, {}))

    def test_exact_review_and_fail_closed_mutations(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            relative = sorted(PATHS)[0]
            path = root / relative
            path.parent.mkdir(parents=True)
            path.write_text('after')
            for other in PATHS - {relative}:
                (root / other).parent.mkdir(parents=True, exist_ok=True)
                (root / other).write_text('after')
            dependency = root / 'dependency'
            dependency.write_text('verified')
            digest = lambda value: hashlib.sha256(value.encode()).hexdigest()
            review = {'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                      'implementation_sha256': {relative: digest('after')},
                      'evidence_sha256': {'dependency': digest('verified')},
                      'extensions': {p: {'before': 'before', 'after': 'after'} for p in PATHS}}
            record = root / REVIEW
            record.parent.mkdir(parents=True)
            record.write_text(json.dumps(review))
            self.assertEqual(historical_export_bytes(root, relative, digest('before')), b'before')
            self.assertIsNone(historical_export_bytes(root, 'dependency', digest('before')))
            self.assertIsNone(historical_export_bytes(root, relative, digest('wrong')))
            path.write_text('after plus unrelated edit')
            self.assertIsNone(historical_export_bytes(root, relative, digest('before')))
            path.write_text('after')
            dependency.write_text('changed')
            self.assertIsNone(historical_export_bytes(root, relative, digest('before')))
            dependency.write_text('verified')
            review['status'] = 'draft'
            record.write_text(json.dumps(review))
            self.assertIsNone(historical_export_bytes(root, relative, digest('before')))

    def test_successor_preserves_both_historical_exports_and_rejects_mutation(self):
        from tools.reviewed_export_extension import SUCCESSOR, HELPER, TRIANGLE, BRANCH, PROFILE, JS_PORTS, P5_BATCH, P5_GALLERY, P5_TENFOLD, BATCH1_SURFACE, BATCH1_GENERATOR, BATCH1_ROOT_REVIEWS, BATCH1_BINDINGS
        import shutil
        repository = Path(__file__).resolve().parents[1]
        previous = json.loads((repository / REVIEW).read_text())
        successor = json.loads((repository / SUCCESSOR).read_text())
        triangle = json.loads((repository / TRIANGLE).read_text())
        branch = json.loads((repository / BRANCH).read_text())
        correction = json.loads((repository / CORRECTION).read_text())
        root_correction = json.loads((repository / ROOT_CORRECTION).read_text())
        profile = json.loads((repository / PROFILE).read_text())
        ports = json.loads((repository / JS_PORTS).read_text())
        batch = json.loads((repository / P5_BATCH).read_text())
        gallery = json.loads((repository / P5_GALLERY).read_text())
        tenfold = json.loads((repository / P5_TENFOLD).read_text())
        coverage = json.loads((repository / BATCH1_SURFACE).read_text())
        files = {REVIEW, SUCCESSOR, TRIANGLE, BRANCH, CORRECTION, ROOT_CORRECTION, SOURCE_COMPARISON, PROFILE, JS_PORTS, P5_BATCH, P5_GALLERY, P5_TENFOLD, BATCH1_SURFACE, *PATHS}
        for record in (correction, root_correction, profile, ports, batch, gallery, tenfold, coverage):
            files.update(record['implementation_sha256'])
            files.update(record['evidence_sha256'])
        for review in (previous, successor, triangle, branch):
            files.update(review['implementation_sha256'])
            files.update(review['evidence_sha256'])
        for name in ports['evidence_sha256']:
            if name.startswith('evidence/ports/') and name.endswith('/root-review.json'):
                accepted = json.loads((repository / name).read_text())
                files.update(accepted['implementation_sha256'])
                files.update(accepted['evidence_sha256'])
        for name in BATCH1_ROOT_REVIEWS:
            accepted = json.loads((repository / name).read_text())
            files.update(accepted['implementation_sha256'])
            files.update(accepted['evidence_sha256'])
        with tempfile.TemporaryDirectory(dir=repository / '.work') as temporary:
            root = Path(temporary)
            for name in files:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(repository / name, root / name)
            relative = 'packages/javascript/src/index.js'
            digest = lambda value: hashlib.sha256(value.encode()).hexdigest()
            for name in (relative, BATCH1_GENERATOR, HELPER, 'tests/test_reviewed_export_extension.py'):
                prior = coverage['previous_bytes'][name]
                self.assertEqual(historical_export_bytes(root, name, digest(prior)), prior.encode())
            coverage_prior = coverage['previous_bytes'][relative]
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(owner='worker'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['implementation_sha256'].pop('packages/javascript/src/octave-gradient-noise.js'),
                lambda r: r['evidence_sha256'].pop(P5_TENFOLD),
                lambda r: r['previous_bytes'].update({'arbitrary.py': 'forged'}),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['extensions'][relative].update(after='forged'),
                lambda r: r['extensions'][BATCH1_GENERATOR].update(after='forged'),
            ):
                record = json.loads(json.dumps(coverage)); mutate(record)
                (root / BATCH1_SURFACE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(coverage_prior)))
            for name in BATCH1_ROOT_REVIEWS:
                original = (root / name).read_bytes()
                for mutate in (
                    lambda r: r.update(status='draft'),
                    lambda r: r.update(owner='worker'),
                    lambda r: r.update(reviewer='worker'),
                ):
                    child = json.loads(original)
                    mutate(child)
                    child_text = json.dumps(child)
                    record = json.loads(json.dumps(coverage))
                    record['evidence_sha256'][name] = digest(child_text)
                    (root / name).write_text(child_text)
                    (root / BATCH1_SURFACE).write_text(json.dumps(record))
                    self.assertIsNone(historical_export_bytes(root, relative, digest(coverage_prior)))
                (root / name).write_bytes(original)
            # The successor's own current binding can be made coherent while a child
            # review still rejects an altered module through its independent binding.
            stem, _, _ = BATCH1_BINDINGS[0]
            child_path = BATCH1_ROOT_REVIEWS[0]
            module = f'packages/javascript/src/{stem}.js'
            original = (root / module).read_text()
            changed = original + '\n// altered child module\n'
            record = json.loads(json.dumps(coverage))
            record['implementation_sha256'][module] = digest(changed)
            (root / module).write_text(changed)
            (root / BATCH1_SURFACE).write_text(json.dumps(record))
            self.assertIsNone(historical_export_bytes(root, relative, digest(coverage_prior)))
            (root / module).write_text(original)
            # Even rehashed, unrelated edits are not authorized by this successor.
            for name in (relative, BATCH1_GENERATOR):
                original = (root / name).read_text()
                changed = original + '\n// unrelated replacement\n'
                (root / name).write_text(changed)
                record = json.loads(json.dumps(coverage))
                record['implementation_sha256'][name] = digest(changed)
                record['extensions'][name]['after'] = changed
                (root / BATCH1_SURFACE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, name, digest(coverage['previous_bytes'][name])))
                (root / name).write_text(original)
            (root / BATCH1_SURFACE).write_bytes((repository / BATCH1_SURFACE).read_bytes())
            tenfold_prior = tenfold['extensions'][relative]['before']
            self.assertEqual(historical_export_bytes(root, relative, digest(tenfold_prior)), tenfold_prior.encode())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(reviewer='worker'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['implementation_sha256'].pop('packages/javascript/src/chaikin-polyline-2d.js'),
                lambda r: r['evidence_sha256'].pop(P5_GALLERY),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['extensions'][relative].update(after='forged'),
            ):
                record = json.loads(json.dumps(tenfold)); mutate(record)
                (root / P5_TENFOLD).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(tenfold_prior)))
            (root / P5_TENFOLD).write_bytes((repository / P5_TENFOLD).read_bytes())
            gallery_prior = gallery['extensions'][relative]['before']
            self.assertEqual(historical_export_bytes(root, relative, digest(gallery_prior)), gallery_prior.encode())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(owner='worker'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['implementation_sha256'].pop('packages/javascript/src/voronoi-cells-2d.js'),
                lambda r: r['evidence_sha256'].pop(P5_BATCH),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['extensions'][relative].update(after='forged'),
            ):
                record = json.loads(json.dumps(gallery)); mutate(record)
                (root / P5_GALLERY).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(gallery_prior)))
            (root / P5_GALLERY).write_bytes((repository / P5_GALLERY).read_bytes())
            current_prior = batch['extensions'][relative]['before']
            self.assertEqual(historical_export_bytes(root, relative, digest(current_prior)), current_prior.encode())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(owner='worker'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['implementation_sha256'].pop(HELPER),
                lambda r: r['implementation_sha256'].pop('packages/javascript/src/radial-pull.js'),
                lambda r: r['evidence_sha256'].pop(JS_PORTS),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['extensions'][relative].update(after='forged'),
            ):
                record = json.loads(json.dumps(batch)); mutate(record)
                (root / P5_BATCH).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(current_prior)))
            (root / P5_BATCH).write_bytes((repository / P5_BATCH).read_bytes())
            retained = ports['extensions'][relative]['before']
            self.assertEqual(historical_export_bytes(root, relative, digest(retained)), retained.encode())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(owner='worker'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['implementation_sha256'].pop(HELPER),
                lambda r: r['evidence_sha256'].pop(PROFILE),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['previous_bytes'].update({'unexpected': 'forged'}),
                lambda r: r['extensions'][relative].update(before='forged'),
                lambda r: r['extensions'][relative].update(after='forged'),
            ):
                record = json.loads(json.dumps(ports)); mutate(record)
                (root / JS_PORTS).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(retained)))
            (root / JS_PORTS).write_bytes((repository / JS_PORTS).read_bytes())
            # Rehashing an unrelated export cannot turn it into an approved addition.
            changed = ports['extensions'][relative]['after'] + 'export const unrelated = 1;\n'
            record = json.loads(json.dumps(ports))
            record['extensions'][relative]['after'] = changed
            record['implementation_sha256'][relative] = digest(changed)
            (root / relative).write_text(changed)
            (root / JS_PORTS).write_text(json.dumps(record))
            self.assertIsNone(historical_export_bytes(root, relative, digest(retained)))
            (root / relative).write_bytes((repository / relative).read_bytes())
            (root / JS_PORTS).write_bytes((repository / JS_PORTS).read_bytes())
            old = previous['extensions'][relative]['before']
            middle = successor['extensions'][relative]['before']
            self.assertEqual(historical_export_bytes(root, relative, digest(old)), old.encode())
            self.assertEqual(historical_export_bytes(root, relative, digest(middle)), middle.encode())
            python = 'packages/python/procedurals/__init__.py'
            python_old = previous['extensions'][python]['before']
            self.assertEqual(historical_export_bytes(root, python, digest(python_old)), python_old.encode())
            self.assertIsNone(historical_export_bytes(root, HELPER, digest(successor['previous_bytes'][HELPER])))
            for name in (relative, HELPER, 'packages/javascript/src/quadrant-partition.js',
                         'packages/javascript/src/circle-placements.js',
                         'evidence/conformance/p5js-region-marks.json', REVIEW):
                original = (root / name).read_bytes()
                (root / name).write_bytes(original + b'\nchanged')
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)), name)
                self.assertIsNone(historical_export_bytes(root, relative, digest(middle)), name)
                (root / name).write_bytes(original)
            latest = triangle['extensions'][relative]['before']
            self.assertEqual(historical_export_bytes(root, relative, digest(latest)), latest.encode())
            for name in ('packages/python/procedurals/triangle_points.py',
                         'packages/javascript/src/triangle-points.js',
                         'packages/python/procedurals/__init__.py'):
                original = (root / name).read_bytes()
                (root / name).write_bytes(original + b'\nchanged')
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)), name)
                (root / name).write_bytes(original)
            for name in ('packages/javascript/src/branch-tree.js',
                         'packages/python/procedurals/branch_tree.py'):
                original = (root / name).read_bytes()
                (root / name).write_bytes(original + b'changed')
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)), name)
                (root / name).write_bytes(original)
            for path in PATHS:
                retained = branch['extensions'][path]['before']
                self.assertEqual(historical_export_bytes(root, path, digest(retained)), retained.encode())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r['implementation_sha256'].pop(HELPER),
                lambda r: r['previous_bytes'].update({'arbitrary.py': 'forbidden'}),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['extensions'][python].update(after='wrong'),
            ):
                record = json.loads(json.dumps(branch)); mutate(record)
                (root / BRANCH).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)))
            (root / BRANCH).write_bytes((repository / BRANCH).read_bytes())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r['implementation_sha256'].pop(HELPER),
                lambda r: r['previous_bytes'].update({'unrelated.py': 'forbidden'}),
                lambda r: r['previous_bytes'].update({HELPER: 'wrong'}),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['extensions'][python].update(after='wrong'),
            ):
                record = json.loads(json.dumps(triangle)); mutate(record)
                (root / TRIANGLE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)))
            (root / TRIANGLE).write_bytes((repository / TRIANGLE).read_bytes())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r['implementation_sha256'].pop(HELPER),
                lambda r: r['previous_bytes'].update({HELPER: 'wrong historical helper'}),
                lambda r: r['previous_bytes'].update({'unrelated.py': 'forbidden snapshot'}),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['extensions'][relative].update(before='wrong historical entrypoint'),
            ):
                record = json.loads(json.dumps(successor))
                mutate(record)
                (root / SUCCESSOR).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)))
                self.assertIsNone(historical_export_bytes(root, relative, digest(middle)))

            (root / SUCCESSOR).write_bytes((repository / SUCCESSOR).read_bytes())
            for path in PATHS:
                retained = profile['extensions'][path]['before']
                self.assertEqual(historical_export_bytes(root, path, digest(retained)), retained.encode())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r['implementation_sha256'].pop(HELPER),
                lambda r: r['evidence_sha256'].pop(CORRECTION),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['extensions'][relative].update(before='forged'),
            ):
                record = json.loads(json.dumps(profile)); mutate(record)
                (root / PROFILE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)))
            (root / PROFILE).write_bytes((repository / PROFILE).read_bytes())
            original = (root / relative).read_text()
            altered = original + 'export const unrelated = 1;\n'
            (root / relative).write_text(altered)
            record = json.loads(json.dumps(profile))
            record['implementation_sha256'][relative] = digest(altered)
            record['extensions'][relative]['after'] = altered
            (root / PROFILE).write_text(json.dumps(record))
            self.assertIsNone(historical_export_bytes(root, relative, digest(old)))
