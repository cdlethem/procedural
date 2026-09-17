import base64
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
    def test_dynamics_gallery_requires_exact_changes_and_root_bindings(self):
        import shutil
        from tools.reviewed_export_extension import (
            DYNAMICS_WEB, DYNAMICS_WEB_ROOT, DYNAMICS_WEB_FILES,
            DYNAMICS_WEB_REQUIRED, COPY_SURFACE, SECOND_ROOT, WEB_GALLERY,
            _validate_dynamics_web,
        )
        repository = Path(__file__).resolve().parents[1]
        predecessor = repository / '.work/expansion-full/web-second-predecessor'
        if (repository / DYNAMICS_WEB).exists():
            prior = json.loads((repository / DYNAMICS_WEB).read_text())['previous_bytes']
        elif predecessor.exists():
            prior = {name: (predecessor / name).read_text()
                     for name in DYNAMICS_WEB_FILES | {HELPER, 'tests/test_reviewed_export_extension.py'}}
        else:
            self.skipTest('web predecessor not yet recorded')
        with tempfile.TemporaryDirectory(dir=repository / '.work') as temporary:
            root = Path(temporary)
            for name in DYNAMICS_WEB_REQUIRED | {COPY_SURFACE, SECOND_ROOT, WEB_GALLERY}:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(repository / name, root / name)
            digest = lambda name: hashlib.sha256((root / name).read_bytes()).hexdigest()
            accepted = {
                'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                'implementation_sha256': {name: digest(name) for name in DYNAMICS_WEB_REQUIRED},
                'evidence_sha256': {name: digest(name) for name in (COPY_SURFACE, SECOND_ROOT)},
            }
            (root / DYNAMICS_WEB_ROOT).parent.mkdir(parents=True, exist_ok=True)
            (root / DYNAMICS_WEB_ROOT).write_text(json.dumps(accepted))
            review = {
                'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                'previous_review_sha256': digest(COPY_SURFACE),
                'implementation_sha256': dict(accepted['implementation_sha256']),
                'evidence_sha256': {name: digest(name) for name in (COPY_SURFACE, DYNAMICS_WEB_ROOT)},
                'previous_bytes': prior,
                'extensions': {name: {'before': prior[name], 'after': (root / name).read_text()}
                               for name in DYNAMICS_WEB_FILES},
            }
            (root / DYNAMICS_WEB).write_text(json.dumps(review))
            snapshots = {}
            self.assertTrue(_validate_dynamics_web(root, snapshots))
            self.assertEqual(snapshots, {name: text.encode() for name, text in prior.items()})
            for name in DYNAMICS_WEB_FILES:
                original = (root / name).read_text()
                changed = original + '\n// unrelated edit\n'
                (root / name).write_text(changed)
                forged_root = json.loads(json.dumps(accepted))
                forged_root['implementation_sha256'][name] = digest(name)
                (root / DYNAMICS_WEB_ROOT).write_text(json.dumps(forged_root))
                forged = json.loads(json.dumps(review))
                forged['implementation_sha256'][name] = digest(name)
                forged['evidence_sha256'][DYNAMICS_WEB_ROOT] = digest(DYNAMICS_WEB_ROOT)
                forged['extensions'][name]['after'] = changed
                (root / DYNAMICS_WEB).write_text(json.dumps(forged))
                self.assertFalse(_validate_dynamics_web(root, {}))
                (root / name).write_text(original)
            (root / DYNAMICS_WEB_ROOT).write_text(json.dumps(accepted))
            for name in DYNAMICS_WEB_REQUIRED:
                forged = json.loads(json.dumps(review))
                forged['implementation_sha256'].pop(name)
                (root / DYNAMICS_WEB).write_text(json.dumps(forged))
                self.assertFalse(_validate_dynamics_web(root, {}))
            (root / DYNAMICS_WEB).write_text(json.dumps(review))
            accepted['reviewer'] = 'worker'
            (root / DYNAMICS_WEB_ROOT).write_text(json.dumps(accepted))
            review['evidence_sha256'][DYNAMICS_WEB_ROOT] = digest(DYNAMICS_WEB_ROOT)
            (root / DYNAMICS_WEB).write_text(json.dumps(review))
            self.assertFalse(_validate_dynamics_web(root, {}))

    def test_web_gallery_successor_has_fixed_transforms_and_root_bindings(self):
        import shutil
        from tools.reviewed_export_extension import (
            EXPANSION_SURFACE, WEB_GALLERY, WEB_GALLERY_ROOT, WEB_GALLERY_PREVIOUS,
            WEB_GALLERY_FILES, WEB_GALLERY_DEPENDENCIES, _validate_web_gallery,
            web_gallery_successor,
        )
        repository = Path(__file__).resolve().parents[1]
        digest = lambda value: hashlib.sha256(value.encode()).hexdigest()
        before = {
            name: subprocess.check_output(
                ['git', 'show', f'cd1d7d48:{name}'], cwd=repository,
            ).decode() for name in WEB_GALLERY_FILES
        }
        accepted_gallery = json.loads((repository / WEB_GALLERY).read_text())
        after = {name: accepted_gallery['extensions'][name]['after'] for name in WEB_GALLERY_FILES}
        for name in WEB_GALLERY_FILES:
            self.assertEqual(web_gallery_successor(name, before[name]), after[name], name)
            self.assertNotEqual(web_gallery_successor(name, before[name] + '// unrelated\n'), after[name])
        self.assertIsNone(web_gallery_successor('unrelated.py', 'anything'))

        with tempfile.TemporaryDirectory(dir=repository / '.work') as temporary:
            root = Path(temporary)
            def write(name, data):
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(data)
            for name in WEB_GALLERY_FILES | WEB_GALLERY_DEPENDENCIES:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(repository / name, root / name)
            for name in WEB_GALLERY_FILES:
                (root / name).write_text(after[name])
            old_helper, old_test = 'reviewed helper preimage', 'reviewed test preimage'
            prior = {**before, HELPER: old_helper,
                     'tests/test_reviewed_export_extension.py': old_test}
            current = {name: (root / name).read_text() for name in WEB_GALLERY_FILES | WEB_GALLERY_DEPENDENCIES}
            current[HELPER] = (repository / HELPER).read_text()
            current['tests/test_reviewed_export_extension.py'] = (repository / 'tests/test_reviewed_export_extension.py').read_text()
            for name in (HELPER, 'tests/test_reviewed_export_extension.py'):
                write(name, current[name])
            expansion = {'implementation_sha256': {HELPER: digest(old_helper),
                         'tests/test_reviewed_export_extension.py': digest(old_test)}}
            previous_web = {'implementation_sha256': {name: digest(before[name]) for name in WEB_GALLERY_FILES}}
            write(EXPANSION_SURFACE, json.dumps(expansion))
            write(WEB_GALLERY_PREVIOUS, json.dumps(previous_web))
            web = {'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                   'implementation_sha256': {name: digest(current[name]) for name in WEB_GALLERY_FILES | WEB_GALLERY_DEPENDENCIES},
                   'evidence_sha256': {WEB_GALLERY_PREVIOUS: digest((root / WEB_GALLERY_PREVIOUS).read_text())}}
            write(WEB_GALLERY_ROOT, json.dumps(web))
            successor = {
                'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                'previous_review_sha256': digest((root / EXPANSION_SURFACE).read_text()),
                'implementation_sha256': {name: digest(text) for name, text in current.items()},
                'evidence_sha256': {name: digest((root / name).read_text()) for name in
                                    (EXPANSION_SURFACE, WEB_GALLERY_ROOT, WEB_GALLERY_PREVIOUS)},
                'previous_bytes': prior,
                'extensions': {name: {'before': before[name], 'after': after[name]} for name in WEB_GALLERY_FILES},
            }
            write(WEB_GALLERY, json.dumps(successor))
            snapshots = {}
            self.assertTrue(_validate_web_gallery(root, snapshots))
            self.assertEqual({name: snapshots[name].decode() for name in prior}, prior)

            for name in WEB_GALLERY_FILES:
                changed = after[name] + '\n// unrelated edit\n'
                write(name, changed)
                forged_web = json.loads(json.dumps(web))
                forged_web['implementation_sha256'][name] = digest(changed)
                write(WEB_GALLERY_ROOT, json.dumps(forged_web))
                forged = json.loads(json.dumps(successor))
                forged['implementation_sha256'][name] = digest(changed)
                forged['evidence_sha256'][WEB_GALLERY_ROOT] = digest((root / WEB_GALLERY_ROOT).read_text())
                forged['extensions'][name]['after'] = changed
                write(WEB_GALLERY, json.dumps(forged))
                self.assertFalse(_validate_web_gallery(root, {}), name)
                write(name, after[name])
                write(WEB_GALLERY_ROOT, json.dumps(web))
                write(WEB_GALLERY, json.dumps(successor))
            for name in WEB_GALLERY_DEPENDENCIES:
                original = current[name]
                write(name, original + '// changed\n')
                self.assertFalse(_validate_web_gallery(root, {}), name)
                write(name, original)
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['previous_bytes'].update({'arbitrary.py': 'forged'}),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['extensions']['apps/web/lib/studio.ts'].update(before='forged'),
                lambda r: r['implementation_sha256'].pop(HELPER),
                lambda r: r['evidence_sha256'].pop(WEB_GALLERY_ROOT),
            ):
                forged = json.loads(json.dumps(successor))
                mutate(forged)
                write(WEB_GALLERY, json.dumps(forged))
                self.assertFalse(_validate_web_gallery(root, {}))
            write(WEB_GALLERY, json.dumps(successor))
            forged_web = json.loads(json.dumps(web))
            forged_web['status'] = 'draft'
            write(WEB_GALLERY_ROOT, json.dumps(forged_web))
            forged = json.loads(json.dumps(successor))
            forged['evidence_sha256'][WEB_GALLERY_ROOT] = digest((root / WEB_GALLERY_ROOT).read_text())
            write(WEB_GALLERY, json.dumps(forged))
            self.assertFalse(_validate_web_gallery(root, {}))

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
        from tools.reviewed_export_extension import SUCCESSOR, HELPER, TRIANGLE, BRANCH, PROFILE, JS_PORTS, P5_BATCH, P5_GALLERY, P5_TENFOLD, BATCH1_SURFACE, BATCH1_GENERATOR, BATCH1_ROOT_REVIEWS, BATCH1_BINDINGS, EXPANSION_SURFACE, EXPANSION_ROOT, EXPANSION_GUIDES, EXPANSION_BINDINGS, WEB_GALLERY, WEB_GALLERY_ROOT, WEB_GALLERY_PREVIOUS, WEB_GALLERY_FILES, WEB_GALLERY_DEPENDENCIES, SECOND_SURFACE, SECOND_ROOT, SECOND_REQUIRED, SECOND_TRANSITIVE, SECOND_GUIDES, SECOND_MODULES, JS_INDEX, SECOND_ADDITIONS, second_generator_successor, COPY_SURFACE, COPY_ROOT, COPY_PATHS, copy_cleanup_successor
        import shutil
        repository = Path(__file__).resolve().parents[1]
        if not (repository / WEB_GALLERY).exists():
            self.skipTest('five-study web gallery successor awaits root acceptance')
        if (repository / COPY_SURFACE).exists():
            copy_prior = json.loads((repository / COPY_SURFACE).read_text())['previous_bytes']
        else:
            manifest_path = repository / '.work/expansion-full/copy-cleanup.json'
            predecessor = repository / '.work/expansion-full/copy-predecessor'
            if not manifest_path.exists() or not (predecessor / HELPER).exists():
                self.skipTest('copy successor awaits root review or local draft preimages')
            manifest = json.loads(manifest_path.read_text())
            copy_prior = {entry['path']: base64.b64decode(entry['prior_bytes_base64']).decode()
                          for entry in manifest['entries']}
            copy_prior.update({name: (predecessor / name).read_text()
                               for name in (HELPER, 'tests/test_reviewed_export_extension.py')})
        self.assertEqual(set(copy_prior), COPY_PATHS | {HELPER, 'tests/test_reviewed_export_extension.py'})
        for name in COPY_PATHS:
            self.assertEqual(copy_cleanup_successor(name, copy_prior[name]), (repository / name).read_text())
            self.assertIsNone(copy_cleanup_successor(name, copy_prior[name] + '\nUnrelated text.\n'))
        self.assertIsNone(copy_cleanup_successor('unlisted.md', 'anything'))
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
        expansion = json.loads((repository / EXPANSION_SURFACE).read_text())
        expansion_root = json.loads((repository / EXPANSION_ROOT).read_text())
        web_gallery = json.loads((repository / WEB_GALLERY).read_text())
        web_root = json.loads((repository / WEB_GALLERY_ROOT).read_text())
        files = {REVIEW, SUCCESSOR, TRIANGLE, BRANCH, CORRECTION, ROOT_CORRECTION, SOURCE_COMPARISON, PROFILE, JS_PORTS, P5_BATCH, P5_GALLERY, P5_TENFOLD, BATCH1_SURFACE, EXPANSION_SURFACE, EXPANSION_ROOT, WEB_GALLERY, WEB_GALLERY_ROOT, WEB_GALLERY_PREVIOUS, *WEB_GALLERY_FILES, *WEB_GALLERY_DEPENDENCIES, *SECOND_REQUIRED, *COPY_PATHS, *PATHS}
        for record in (correction, root_correction, profile, ports, batch, gallery, tenfold, coverage, expansion, expansion_root, web_gallery, web_root):
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
            # This historical-chain test begins before the later nine-study registration.
            for name in WEB_GALLERY_FILES:
                (root / name).write_text(web_gallery['extensions'][name]['after'])
            relative = 'packages/javascript/src/index.js'
            digest = lambda value: hashlib.sha256(value.encode()).hexdigest()
            # Synthetic acceptance stays inside .work. The exact predecessor bytes
            # come from the bound reviews, including the web-gallery helper/test.
            second_prior = {name: expansion['extensions'][name]['after']
                            for name in (JS_INDEX, BATCH1_GENERATOR)}
            for name in (HELPER, 'tests/test_reviewed_export_extension.py'):
                second_prior[name] = subprocess.check_output(
                    ['git', 'show', f'6d4759b8:{name}'], cwd=repository).decode()
            for name, prior in second_prior.items():
                predecessor = expansion if name in (JS_INDEX, BATCH1_GENERATOR) else web_gallery
                self.assertEqual(digest(prior), predecessor['implementation_sha256'][name])
            second_expected = {
                JS_INDEX: second_prior[JS_INDEX] + SECOND_ADDITIONS,
                BATCH1_GENERATOR: second_generator_successor(second_prior[BATCH1_GENERATOR]),
            }
            for name, after in second_expected.items():
                self.assertEqual((root / name).read_text(), after)
            second_root = {
                'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                'implementation_sha256': {name: digest(copy_prior[name] if name in copy_prior else (root / name).read_text())
                                          for name in SECOND_REQUIRED | COPY_PATHS},
                'evidence_sha256': {WEB_GALLERY: digest((root / WEB_GALLERY).read_text())},
            }
            (root / SECOND_ROOT).parent.mkdir(parents=True, exist_ok=True)
            (root / SECOND_ROOT).write_text(json.dumps(second_root))
            second = {
                'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                'previous_review_sha256': digest((root / WEB_GALLERY).read_text()),
                'implementation_sha256': dict(second_root['implementation_sha256']),
                'evidence_sha256': {
                    WEB_GALLERY: digest((root / WEB_GALLERY).read_text()),
                    EXPANSION_SURFACE: digest((root / EXPANSION_SURFACE).read_text()),
                    SECOND_ROOT: digest((root / SECOND_ROOT).read_text()),
                },
                'previous_bytes': second_prior,
                'extensions': {name: {'before': second_prior[name], 'after': after}
                               for name, after in second_expected.items()},
            }
            (root / SECOND_SURFACE).parent.mkdir(parents=True, exist_ok=True)
            (root / SECOND_SURFACE).write_text(json.dumps(second))
            copy_root = {
                'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                'implementation_sha256': {name: digest((root / name).read_text())
                                          for name in COPY_PATHS | {HELPER, 'tests/test_reviewed_export_extension.py'}},
                'evidence_sha256': {
                    SECOND_ROOT: digest((root / SECOND_ROOT).read_text()),
                    SECOND_SURFACE: digest((root / SECOND_SURFACE).read_text()),
                },
            }
            (root / COPY_ROOT).parent.mkdir(parents=True, exist_ok=True)
            (root / COPY_ROOT).write_text(json.dumps(copy_root))
            copy = {
                'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                'previous_review_sha256': digest((root / SECOND_SURFACE).read_text()),
                'implementation_sha256': dict(copy_root['implementation_sha256']),
                'evidence_sha256': {
                    SECOND_SURFACE: digest((root / SECOND_SURFACE).read_text()),
                    COPY_ROOT: digest((root / COPY_ROOT).read_text()),
                },
                'previous_bytes': copy_prior,
                'extensions': {name: {'before': copy_prior[name], 'after': (root / name).read_text()}
                               for name in COPY_PATHS},
            }
            (root / COPY_SURFACE).parent.mkdir(parents=True, exist_ok=True)
            (root / COPY_SURFACE).write_text(json.dumps(copy))
            for name in COPY_PATHS:
                self.assertEqual(historical_export_bytes(root, name, digest(copy_prior[name])),
                                 copy_prior[name].encode())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(owner='worker'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['evidence_sha256'].pop(COPY_ROOT),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['previous_bytes'].update({'unlisted.md': 'forged'}),
                lambda r: r['extensions'].pop(next(iter(sorted(COPY_PATHS)))),
            ):
                forged = json.loads(json.dumps(copy)); mutate(forged)
                (root / COPY_SURFACE).write_text(json.dumps(forged))
                self.assertIsNone(historical_export_bytes(root, JS_INDEX, digest(second_prior[JS_INDEX])))
            (root / COPY_SURFACE).write_text(json.dumps(copy))
            prose = next(iter(sorted(COPY_PATHS)))
            original_prose = (root / prose).read_text()
            changed_prose = original_prose + '\nUnrelated prose.\n'
            (root / prose).write_text(changed_prose)
            forged_root = json.loads(json.dumps(copy_root))
            forged_root['implementation_sha256'][prose] = digest(changed_prose)
            (root / COPY_ROOT).write_text(json.dumps(forged_root))
            forged = json.loads(json.dumps(copy))
            forged['implementation_sha256'][prose] = digest(changed_prose)
            forged['evidence_sha256'][COPY_ROOT] = digest((root / COPY_ROOT).read_text())
            forged['extensions'][prose]['after'] = changed_prose
            (root / COPY_SURFACE).write_text(json.dumps(forged))
            self.assertIsNone(historical_export_bytes(root, prose, digest(copy_prior[prose])))
            (root / prose).write_text(original_prose)
            (root / COPY_ROOT).write_text(json.dumps(copy_root))
            (root / COPY_SURFACE).write_text(json.dumps(copy))
            (root / prose).unlink()
            self.assertIsNone(historical_export_bytes(root, JS_INDEX, digest(second_prior[JS_INDEX])))
            (root / prose).write_text(original_prose)
            for name in COPY_PATHS | {HELPER, 'tests/test_reviewed_export_extension.py'}:
                child = json.loads(json.dumps(copy_root))
                child['implementation_sha256'].pop(name)
                (root / COPY_ROOT).write_text(json.dumps(child))
                forged = json.loads(json.dumps(copy))
                forged['evidence_sha256'][COPY_ROOT] = digest((root / COPY_ROOT).read_text())
                (root / COPY_SURFACE).write_text(json.dumps(forged))
                self.assertIsNone(historical_export_bytes(root, JS_INDEX, digest(second_prior[JS_INDEX])), name)
            (root / COPY_ROOT).write_text(json.dumps(copy_root))
            (root / COPY_SURFACE).write_text(json.dumps(copy))
            for name in second_prior:
                self.assertEqual(historical_export_bytes(root, name, digest(second_prior[name])),
                                 second_prior[name].encode())
            # Isolate the second-stage failure tests from the newer copy stage.
            (root / COPY_SURFACE).unlink()
            for name, prior in copy_prior.items():
                (root / name).write_text(prior)
            for name in second_prior:
                self.assertEqual(historical_export_bytes(root, name, digest(second_prior[name])),
                                 second_prior[name].encode())
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(owner='worker'),
                lambda r: r.update(reviewer='worker'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['evidence_sha256'].pop(WEB_GALLERY),
                lambda r: r['evidence_sha256'].pop(EXPANSION_SURFACE),
                lambda r: r['evidence_sha256'].pop(SECOND_ROOT),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['previous_bytes'].update({'unrelated.py': 'forged'}),
                lambda r: r['extensions'][JS_INDEX].update(after='forged'),
                lambda r: r['extensions'][BATCH1_GENERATOR].update(before='forged'),
            ):
                forged = json.loads(json.dumps(second)); mutate(forged)
                (root / SECOND_SURFACE).write_text(json.dumps(forged))
                self.assertIsNone(historical_export_bytes(root, JS_INDEX, digest(second_prior[JS_INDEX])))
            (root / SECOND_SURFACE).write_text(json.dumps(second))
            # Even rehashing the child review cannot turn an unrelated entrypoint
            # or API generator edit into the exact successor transform.
            for name in (JS_INDEX, BATCH1_GENERATOR):
                original = (root / name).read_text()
                changed = original + '\n// unrelated replacement\n'
                (root / name).write_text(changed)
                child = json.loads(json.dumps(second_root))
                child['implementation_sha256'][name] = digest(changed)
                (root / SECOND_ROOT).write_text(json.dumps(child))
                forged = json.loads(json.dumps(second))
                forged['implementation_sha256'][name] = digest(changed)
                forged['evidence_sha256'][SECOND_ROOT] = digest((root / SECOND_ROOT).read_text())
                forged['extensions'][name]['after'] = changed
                (root / SECOND_SURFACE).write_text(json.dumps(forged))
                self.assertIsNone(historical_export_bytes(root, name, digest(second_prior[name])))
                (root / name).write_text(original)
                (root / SECOND_ROOT).write_text(json.dumps(second_root))
                (root / SECOND_SURFACE).write_text(json.dumps(second))
            for name in (next(iter(sorted(SECOND_MODULES))), SECOND_GUIDES,
                         next(iter(sorted(SECOND_TRANSITIVE)))):
                original = (root / name).read_bytes()
                (root / name).unlink()
                self.assertIsNone(historical_export_bytes(root, JS_INDEX, digest(second_prior[JS_INDEX])))
                (root / name).write_bytes(original)
            for name in SECOND_REQUIRED:
                child = json.loads(json.dumps(second_root))
                child['implementation_sha256'].pop(name)
                (root / SECOND_ROOT).write_text(json.dumps(child))
                forged = json.loads(json.dumps(second))
                forged['evidence_sha256'][SECOND_ROOT] = digest((root / SECOND_ROOT).read_text())
                (root / SECOND_SURFACE).write_text(json.dumps(forged))
                self.assertIsNone(historical_export_bytes(root, JS_INDEX, digest(second_prior[JS_INDEX])), name)
            (root / SECOND_ROOT).write_text(json.dumps(second_root))
            (root / SECOND_SURFACE).write_text(json.dumps(second))
            for name in (SECOND_GUIDES, *sorted(SECOND_MODULES), *sorted(SECOND_TRANSITIVE)):
                forged = json.loads(json.dumps(second))
                forged['implementation_sha256'].pop(name)
                (root / SECOND_SURFACE).write_text(json.dumps(forged))
                self.assertIsNone(historical_export_bytes(root, JS_INDEX, digest(second_prior[JS_INDEX])), name)
            (root / SECOND_SURFACE).write_text(json.dumps(second))
            for key in ('status', 'owner', 'reviewer'):
                child = json.loads(json.dumps(second_root)); child[key] = 'worker'
                (root / SECOND_ROOT).write_text(json.dumps(child))
                forged = json.loads(json.dumps(second))
                forged['evidence_sha256'][SECOND_ROOT] = digest((root / SECOND_ROOT).read_text())
                (root / SECOND_SURFACE).write_text(json.dumps(forged))
                self.assertIsNone(historical_export_bytes(root, JS_INDEX, digest(second_prior[JS_INDEX])))
            (root / SECOND_ROOT).write_text(json.dumps(second_root))
            (root / SECOND_SURFACE).write_text(json.dumps(second))
            # Keep the older mutation battery independent: it now starts from
            # the verified predecessor files with no newer review in the chain.
            (root / SECOND_SURFACE).unlink()
            for name, prior in second_prior.items():
                (root / name).write_text(prior)
            older_index = expansion['previous_bytes'][JS_INDEX]
            self.assertEqual(historical_export_bytes(root, JS_INDEX, digest(older_index)),
                             older_index.encode())
            # The newest surface accepts exactly two operation exports plus palette data.
            for name in (relative, BATCH1_GENERATOR, HELPER, 'tests/test_reviewed_export_extension.py'):
                retained = expansion['previous_bytes'][name]
                self.assertEqual(historical_export_bytes(root, name, digest(retained)), retained.encode())
            expansion_prior = expansion['previous_bytes'][relative]
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r.update(reviewer='worker'),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['implementation_sha256'].pop(EXPANSION_GUIDES),
                lambda r: r['implementation_sha256'].pop('packages/javascript/src/default-palettes.js'),
                lambda r: r['evidence_sha256'].pop(EXPANSION_ROOT),
                lambda r: r['previous_bytes'].update({HELPER: 'forged'}),
                lambda r: r['previous_bytes'].update({'arbitrary.py': 'forged'}),
                lambda r: r['extensions'][relative].update(after='forged'),
            ):
                record = json.loads(json.dumps(expansion)); mutate(record)
                (root / EXPANSION_SURFACE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(expansion_prior)))
            # Rehash both the successor and child review: fixed successor transforms still
            # reject unrelated entrypoint/generator edits instead of trusting hash updates.
            for name in (relative, BATCH1_GENERATOR):
                original = (root / name).read_text()
                changed = original + '\n// unrelated replacement\n'
                (root / name).write_text(changed)
                child = json.loads(json.dumps(expansion_root))
                if name in child['implementation_sha256']:
                    child['implementation_sha256'][name] = digest(changed)
                child_text = json.dumps(child)
                (root / EXPANSION_ROOT).write_text(child_text)
                record = json.loads(json.dumps(expansion))
                record['implementation_sha256'][name] = digest(changed)
                record['evidence_sha256'][EXPANSION_ROOT] = digest(child_text)
                record['extensions'][name]['after'] = changed
                (root / EXPANSION_SURFACE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, name, digest(expansion['previous_bytes'][name])))
                (root / name).write_text(original)
                (root / EXPANSION_ROOT).write_bytes((repository / EXPANSION_ROOT).read_bytes())
            new_sources = [f'packages/javascript/src/{stem}.js' for stem, _, _ in EXPANSION_BINDINGS]
            new_sources += [EXPANSION_GUIDES, 'packages/javascript/src/default-palettes.js']
            for name in new_sources:
                original = (root / name).read_text()
                changed = original + '\n// changed implementation\n'
                (root / name).write_text(changed)
                record = json.loads(json.dumps(expansion))
                record['implementation_sha256'][name] = digest(changed)
                (root / EXPANSION_SURFACE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(expansion_prior)))
                (root / name).write_text(original)
            for name in new_sources:
                child = json.loads(json.dumps(expansion_root))
                child['implementation_sha256'].pop(name)
                child_text = json.dumps(child); (root / EXPANSION_ROOT).write_text(child_text)
                record = json.loads(json.dumps(expansion))
                record['evidence_sha256'][EXPANSION_ROOT] = digest(child_text)
                (root / EXPANSION_SURFACE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(expansion_prior)))
            (root / EXPANSION_ROOT).write_bytes((repository / EXPANSION_ROOT).read_bytes())
            for key in ('status', 'owner', 'reviewer'):
                child = json.loads(json.dumps(expansion_root)); child[key] = 'worker'
                child_text = json.dumps(child); (root / EXPANSION_ROOT).write_text(child_text)
                record = json.loads(json.dumps(expansion))
                record['evidence_sha256'][EXPANSION_ROOT] = digest(child_text)
                (root / EXPANSION_SURFACE).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(expansion_prior)))
            (root / EXPANSION_ROOT).write_bytes((repository / EXPANSION_ROOT).read_bytes())
            (root / EXPANSION_SURFACE).write_bytes((repository / EXPANSION_SURFACE).read_bytes())
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
            (root / relative).write_text(second_prior[relative])
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
