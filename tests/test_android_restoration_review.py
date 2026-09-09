import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from tools.android_restoration_review import (
    BASE,
    FIELD,
    FIELD_RESULT,
    HELPER,
    REVIEW,
    validated_legacy_context,
)
from tools.drawing_native_evidence import check_android_native


ROOT = Path(__file__).resolve().parents[1]
PROFILE_PATH = 'catalog/drawing/fresh-raster-2d.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class AndroidRestorationReviewTests(unittest.TestCase):
    """Exercise the successor boundary without copying any Android toolchain output."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.profile = json.loads((ROOT / PROFILE_PATH).read_text())
        self.target = self.profile['targets']['processing-android']
        self._copy_successor_snapshot()

    def _copy(self, relative):
        source = ROOT / relative
        destination = self.root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)

    def _copy_successor_snapshot(self):
        review = json.loads((ROOT / REVIEW).read_text())
        base = json.loads((ROOT / BASE).read_text())
        paths = {REVIEW, BASE, FIELD_RESULT,
                 'evidence/documentation/java-grid-path-comments-review.json',
                 'evidence/documentation/java-grid-path-comment-snapshots.json'}
        paths.update(review['implementation_sha256'])
        paths.update(review['evidence_sha256'])
        paths.update(base['implementation_sha256'])
        for relative in paths:
            self._copy(relative)

    def _review(self):
        return json.loads((self.root / REVIEW).read_text())

    def _write_review(self, review):
        (self.root / REVIEW).write_text(json.dumps(review, sort_keys=True))

    def _rehash_review_path(self, relative):
        review = self._review()
        review['implementation_sha256'][relative] = digest(self.root / relative)
        self._write_review(review)

    def _rehash_result_evidence(self):
        review = self._review()
        review['evidence_sha256'][FIELD_RESULT] = digest(self.root / FIELD_RESULT)
        self._write_review(review)

    def _assert_rejected(self, profile=None, target=None):
        with self.assertRaises(ValueError):
            validated_legacy_context(self.root, profile or self.profile, target or self.target)

    def test_current_successor_returns_intact_legacy_review_and_only_field_replacement(self):
        base, legacy_target, replacements = validated_legacy_context(
            self.root, self.profile, self.target)
        expected_base = json.loads((self.root / BASE).read_text())
        current = self._review()['implementation_sha256']
        self.assertEqual(base, expected_base)
        self.assertEqual(legacy_target['native_review'], BASE)
        self.assertEqual(legacy_target['evidence'], list(expected_base['evidence_sha256']))
        self.assertEqual(replacements, {FIELD: current[FIELD]})
        self.assertNotIn(HELPER, replacements)

    def test_current_repository_passes_drawing_native_integration(self):
        self.assertEqual(check_android_native(ROOT, self.profile, self.target), [])

    def test_changed_field_activity_rehashed_in_successor_still_requires_field_result_binding(self):
        path = self.root / FIELD
        path.write_text(path.read_text() + '\n// changed activity\n')
        self._rehash_review_path(FIELD)
        self._assert_rejected()

    def test_changed_helper_rehashed_in_successor_still_requires_field_result_binding(self):
        path = self.root / HELPER
        path.write_text(path.read_text() + '\n// changed helper\n')
        self._rehash_review_path(HELPER)
        self._assert_rejected()

    def test_rehashed_renderer_replacement_is_not_allowed(self):
        renderer = 'packages/java-android/examples/FieldMarks/FieldMarksRenderer.java'
        path = self.root / renderer
        path.write_text(path.read_text() + '\n// changed renderer\n')
        self._rehash_review_path(renderer)
        self._assert_rejected()

    def test_rehashed_legacy_core_replacement_is_not_allowed(self):
        core = 'packages/java/src/main/java/org/procedurals/fields/GradientNoise2D01.java'
        path = self.root / core
        path.write_text(path.read_text() + '\n// changed core\n')
        self._rehash_review_path(core)
        self._assert_rejected()

    def test_missing_field_probe_binding_is_rejected(self):
        result = json.loads((self.root / FIELD_RESULT).read_text())
        del result['input_sha256']['tests/native/android-field-marks/FieldMarksProbeActivity.java']
        (self.root / FIELD_RESULT).write_text(json.dumps(result, sort_keys=True))
        self._rehash_result_evidence()
        self._assert_rejected()

    def test_false_display_equality_is_rejected_even_when_result_and_review_are_rehashed(self):
        result = json.loads((self.root / FIELD_RESULT).read_text())
        result['display_restore']['equal'] = False
        (self.root / FIELD_RESULT).write_text(json.dumps(result, sort_keys=True))
        self._rehash_result_evidence()
        self._assert_rejected()

    def test_wrong_resume_counts_are_rejected_even_when_result_and_review_are_rehashed(self):
        result = json.loads((self.root / FIELD_RESULT).read_text())
        result['native']['composition_count'] = 7
        (self.root / FIELD_RESULT).write_text(json.dumps(result, sort_keys=True))
        self._rehash_result_evidence()
        self._assert_rejected()

    def test_mutated_legacy_review_identity_is_rejected(self):
        path = self.root / BASE
        path.write_text(path.read_text() + '\n')
        self._assert_rejected()

    def test_profile_semantic_change_is_rejected(self):
        changed = json.loads(json.dumps(self.profile))
        changed['rendering']['compositing'] = 'changed semantic behavior'
        self._assert_rejected(profile=changed)


if __name__ == '__main__':
    unittest.main()
