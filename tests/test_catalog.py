import copy
import hashlib
import json
from pathlib import Path
import shutil
import struct
import tempfile
import unittest
from unittest.mock import patch

from jsonschema import Draft202012Validator

from tools.check_catalog import (ROOT, check, validate_circle_placement_case,
                                 validate_circle_placement_metadata,
                                 validate_circle_shared_output,
                                 validate_partition_cross_checks,
                                 validate_partition_metadata,
                                 validate_partition_output_case,
                                 validate_partition_success_metadata,
                                 validate_triangle_cross_checks,
                                 validate_triangle_metadata,
                                 validate_triangle_points_case)


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.op_path = self.root / 'catalog/operations/regular-grid.json'
        self.op = json.loads((ROOT / 'catalog/operations/regular-grid.json').read_text())
        paths = ['catalog/operations/regular-grid.json', 'fixtures/operations/regular-grid.json',
                 'design/phase2/cluster-decisions.json', self.op['capability_decision'], self.op['design_review']]
        paths += [r['notes_path'] for r in self.op['provenance']]
        for relative in paths:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        # Corpus-level validation has its own integration suite. These tests isolate
        # catalog/source/fixture drift without duplicating the entire survey checkout.
        self.gate = patch('tools.check_catalog.validate', return_value=[])
        self.gate.start()
        self.addCleanup(self.gate.stop)

    def write_op(self, op):
        self.op_path.write_text(json.dumps(op))

    def exact_json_fixture(self):
        op = copy.deepcopy(self.op)
        op['fixture_format'] = 'exact-json-output'
        op['output_invariants'] = 'Exact retained integer cells.'
        op['output_schema'] = {'type': 'array', 'items': {'type': 'integer'}}
        op.pop('point_schema', None)
        self.write_op(op)
        path = self.root / op['fixtures']
        fixture = json.loads(path.read_text())
        fixture['comparison'] = 'exact'
        fixture['catalog_sha256'] = hashlib.sha256(self.op_path.read_bytes()).hexdigest()
        fixture['cases'] = [{'id': 'exact', 'input': fixture['cases'][0]['input'], 'output': [0, 1]}]
        path.write_text(json.dumps(fixture))
        return path, fixture

    def test_exact_json_rejects_wrong_output_and_tolerance(self):
        path, fixture = self.exact_json_fixture()
        self.assertFalse(any('exact JSON' in e or 'exact-json-output' in e for e in check(self.root)))
        fixture['cases'][0]['output'] = [0, 1.5]
        fixture['cases'][0]['comparison'] = {'absolute': 0.1}
        path.write_text(json.dumps(fixture))
        errors = check(self.root)
        self.assertTrue(any('invalid exact JSON output' in e for e in errors))
        self.assertTrue(any('inherit the exact comparison' in e for e in errors))

    def test_exact_json_error_cannot_smuggle_partial_output(self):
        path, fixture = self.exact_json_fixture()
        fixture['cases'][0]['error'] = 'INVALID_INPUT'
        path.write_text(json.dumps(fixture))
        errors = check(self.root)
        self.assertTrue(any('error case must omit output' in e for e in errors))
        # Semantic input errors may depend on relationships not encoded by JSON Schema.
        fixture['cases'][0].pop('output')
        path.write_text(json.dumps(fixture))
        self.assertFalse(any('expected invalid schema input' in e for e in check(self.root)))

    def test_rejects_inconsistent_platform_identifiers(self):
        op = copy.deepcopy(self.op)
        op['targets']['java'] = op['targets'].pop('processing-java')
        self.write_op(op)
        self.assertTrue(any('canonical platform identifiers' in message for message in check(self.root)))

    def capability_dependency_op(self):
        ledger_path = self.root / 'design/phase2/cluster-decisions.json'
        ledger = json.loads(ledger_path.read_text())
        motivator = self.op['provenance'][0]
        candidate = ledger['records'][motivator['candidate_id']]
        cluster_id = 'field.gradient-noise-2d'
        ledger['records'][motivator['candidate_id']].update(
            cluster_id='review.unresolved-computation', disposition='review_required', status='unreviewed')
        ledger['clusters'].append({
            'id': cluster_id,
            'status': 'reviewed_provisional',
            'reason': 'Reviewed independently specified capability dependency.',
            'admission_kind': 'capability_dependency',
            'architecture': {
                'level': 'operation_candidate',
                'status': 'reviewed',
                'inputs': 'finite coordinate and seed',
                'outputs': 'deterministic scalar sample',
                'invariants': 'no host drawing state',
                'open_questions': [],
            },
            'dependency_admission': {
                'status': 'reviewed',
                'owner': 'root',
                'reviewer': 'independent reviewer',
                'decision': 'docs/dependency-admission.md',
                'rationale': 'Composite source candidates justify this private dependency without admitting them.',
                'motivating_candidates': [{
                    'candidate_id': motivator['candidate_id'],
                    'source_sha256': candidate['source_sha256'],
                    'evidence_sha256': candidate['evidence_sha256'],
                    'dependency': 'pure scalar noise source',
                    'remainder': [{
                        'component': 'source drawing and palette',
                        'disposition': 'recipe',
                        'reason': 'Only the scalar source is in this operation boundary.',
                    }],
                }],
            },
        })
        ledger_path.write_text(json.dumps(ledger))
        decision = self.root / 'docs/dependency-admission.md'
        decision.parent.mkdir(parents=True, exist_ok=True)
        decision.write_text('Reviewed dependency admission.\n')
        op = copy.deepcopy(self.op)
        op.update(id='field.gradient-noise-2d', decision_cluster=cluster_id,
                  provenance=[copy.deepcopy(motivator)])
        fixture_path = self.root / op['fixtures']
        fixture = json.loads(fixture_path.read_text())
        fixture['operation'] = op['id']
        fixture_path.write_text(json.dumps(fixture))
        return op, ledger_path

    def materialized_output_fixture(self):
        op = copy.deepcopy(self.op)
        op.pop('point_schema')
        op.pop('access_schema')
        op['fixture_format'] = 'materialized-output'
        op['output_invariants'] = ('positions length equals input steps+1; '
                                   'headings length equals input steps')
        op['input_schema'] = {
            'type': 'object', 'properties': {'steps': {'type': 'integer', 'minimum': 0, 'maximum': 4}},
            'required': ['steps'], 'additionalProperties': False,
        }
        op['output_schema'] = {
            'type': 'object',
            'properties': {
                'positions': {
                    'type': 'array', 'items': {
                        'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}],
                        'items': False, 'minItems': 2, 'maxItems': 2,
                    },
                },
                'headings': {'type': 'array', 'items': {'type': 'number'}},
            },
            'required': ['positions', 'headings'], 'additionalProperties': False,
        }
        op['errors'] = {'INVALID_INPUT': 'invalid static input', 'TRACE_QUERY_INVALID': 'dynamic trace failure'}
        fixture = {
            'operation': op['id'], 'version': op['version'],
            'cases': [{
                'id': 'two-steps', 'input': {'steps': 2},
                'output': {'positions': [[0, 0], [1, 0], [2, 0]], 'headings': [0, 0]},
                'comparison': {'positions_abs': 0.0, 'headings_abs': 1e-12},
            }, {
                'id': 'dynamic-error', 'input': {'steps': 2}, 'error': 'TRACE_QUERY_INVALID',
            }],
        }
        self.write_op(op)
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        return op, fixture

    def long_materialized_output_fixture(self):
        op, _ = self.materialized_output_fixture()
        op['input_schema'] = {
            'type': 'object',
            'properties': {
                'steps': {'type': 'integer', 'minimum': 0, 'maximum': 4},
                'start': {
                    'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}],
                    'items': False, 'minItems': 2, 'maxItems': 2,
                },
            },
            'required': ['steps', 'start'], 'additionalProperties': False,
        }
        self.write_op(op)
        source = self.root / 'evidence/private-long.json'
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text('{"accepted":"independent loop"}\n')
        prefix = {
            'id': 'prefix', 'input': {'steps': 2, 'start': [0, 0]},
            'output': {'positions': [[0, 0], [1, 0], [2, 0]], 'headings': [0, 0]},
            'comparison': {'positions_abs': 0.0, 'headings_abs': 0.0},
        }
        extended = {
            'id': 'extended', 'input': {'steps': 3, 'start': [0, 0]},
            'output': {'positions': [[0, 0], [1, 0], [2, 0], [3, 0]], 'headings': [0, 0, 0]},
            'comparison': {'positions_abs': 0.0, 'headings_abs': 0.0},
        }
        fixture = {
            'operation': op['id'], 'version': op['version'],
            'catalog_sha256': hashlib.sha256(self.op_path.read_bytes()).hexdigest(),
            'cases': [prefix, extended],
            'long_cases_source': {
                'path': 'evidence/private-long.json',
                'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            },
            'long_cases': [{
                'id': 'sparse-three', 'input': copy.deepcopy(extended['input']),
                'selected': [
                    {'pointIndex': 0, 'position': [0, 0]},
                    {'pointIndex': 1, 'position': [1, 0], 'headingIndex': 0, 'heading': 0},
                    {'pointIndex': 3, 'position': [3, 0], 'headingIndex': 2, 'heading': 0},
                ],
                'comparison': {'positions_abs': 1e-9, 'headings_abs': 1e-9},
            }],
            'cross_case_checks': [{
                'id': 'prefix-by-bits', 'kind': 'raw-binary64-prefix',
                'prefix_case': 'prefix', 'extended_case': 'extended',
            }],
        }
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        return op, fixture, source

    def circle_placement_case(self, operation_id='sampling.seeded-circle-placement-2d'):
        output_schema = {
            'type': 'object',
            'properties': {
                'centres': {'type': 'array', 'items': {'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}], 'items': False}},
                'radii': {'type': 'array', 'items': {'type': 'number'}},
                'sourceIndices': {'type': 'array', 'items': {'type': 'integer'}},
                'attempts': {'type': 'integer'},
            },
            'required': ['centres', 'radii', 'sourceIndices', 'attempts'], 'additionalProperties': False,
        }
        if operation_id == 'sampling.seeded-circle-placement-2d':
            input_schema = {
                'type': 'object',
                'properties': {
                    'seed': {'type': 'integer'}, 'attempts': {'type': 'integer', 'minimum': 0, 'maximum': 1073741823},
                    'origin': {'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}], 'items': False},
                    'extent': {'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}], 'items': False},
                    'radiusRange': {'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}], 'items': False},
                    'separationScale': {'type': 'number'},
                }, 'required': ['seed', 'attempts', 'origin', 'extent', 'radiusRange', 'separationScale'], 'additionalProperties': False,
            }
            input_data = {'seed': 1, 'attempts': 3, 'origin': [0, 0], 'extent': [2, 2], 'radiusRange': [0, 1], 'separationScale': 1}
            output = {'centres': [[0, 0], [1, 1]], 'radii': [0.5, 1], 'sourceIndices': [0, 2], 'attempts': 3}
        else:
            input_schema = {
                'type': 'object',
                'properties': {
                    'centres': {'type': 'array', 'items': {'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}], 'items': False}},
                    'radii': {'type': 'array', 'items': {'type': 'number'}},
                    'separationScale': {'type': 'number'},
                }, 'required': ['centres', 'radii', 'separationScale'], 'additionalProperties': False,
            }
            input_data = {'centres': [[0, 0], [1, 1], [2, 2]], 'radii': [0, 1, 1], 'separationScale': 1}
            output = {'centres': [[0, 0], [2, 2]], 'radii': [0.5, 1], 'sourceIndices': [0, 2], 'attempts': 3}
        operation = {'id': operation_id, 'errors': {'INVALID_INPUT': 'invalid', 'PLACEMENT_ARITHMETIC_INVALID': 'dynamic'}, 'dynamic_error_stages': ['candidate_x', 'distance_squared']}
        case = {'id': 'valid', 'input': input_data, 'output': output, 'comparison': {'mode': 'binary64-exact'}}
        return operation, Draft202012Validator(input_schema), Draft202012Validator(output_schema), case

    def triangle_point_case(self, operation_id='sampling.seeded-triangle-points-2d'):
        op_name = ('seeded-triangle-points.json' if operation_id == 'sampling.seeded-triangle-points-2d'
                   else 'triangle-coordinate-map.json')
        operation = json.loads((ROOT / 'catalog/operations' / op_name).read_text())
        triangle = [[0.0, 0.0], [2.0, 0.0], [0.0, 2.0]]
        if operation_id == 'sampling.seeded-triangle-points-2d':
            input_data = {'seed': 42, 'count': 1, 'triangle': triangle}
            case = {'id': 'seeded-one', 'input': input_data,
                    'generated_unit_coordinates': [[0.0, 0.0]],
                    'generated_unit_u32': [[0, 0]],
                    'output': {'points': [[0.0, 0.0]]},
                    'points_bits_hex': [['0000000000000000', '0000000000000000']],
                    'comparison': {'mode': 'binary64-exact'}}
        else:
            input_data = {'triangle': triangle, 'unitCoordinates': [[0.0, 0.0]]}
            case = {'id': 'mapped-one', 'input': input_data,
                    'output': {'points': [[0.0, 0.0]]},
                    'points_bits_hex': [['0000000000000000', '0000000000000000']],
                    'comparison': {'mode': 'binary64-exact'}}
        return operation, Draft202012Validator(operation['input_schema']), Draft202012Validator(operation['output_schema']), case

    @staticmethod
    def triangle_seed_vectors():
        return [
            {'seed': seed, 'initial_state': [1, 2, 3, 4],
             'first_10': [
                 {'index': index, 'output_u32': 0, 'unit': 0.0, 'post_state': [1, 2, 3, 4]}
                 for index in range(10)
             ]}
            for seed in (0, 1, 42, 0x80000000, 0xffffffff)
        ]

    def partition_case(self, replacements=1):
        input_schema = {
            'type': 'object',
            'properties': {
                'seed': {'type': 'integer', 'minimum': 0, 'maximum': 4294967295},
                'replacements': {'type': 'integer', 'minimum': 0, 'maximum': 178956970},
                'origin': {'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}], 'items': False},
                'extent': {'type': 'array', 'prefixItems': [{'type': 'number', 'exclusiveMinimum': 0}, {'type': 'number', 'exclusiveMinimum': 0}], 'items': False},
                'selectionFraction': {'type': 'number', 'exclusiveMinimum': 0, 'maximum': 1},
            },
            'required': ['seed', 'replacements', 'origin', 'extent', 'selectionFraction'],
            'additionalProperties': False,
        }
        output_schema = {
            'type': 'object',
            'properties': {
                'bounds': {'type': 'array', 'items': {'type': 'array', 'prefixItems': [{'type': 'number'}] * 4, 'items': False}},
                'ids': {'type': 'array', 'items': {'type': 'integer'}},
                'replacements': {'type': 'integer'},
            },
            'required': ['bounds', 'ids', 'replacements'], 'additionalProperties': False,
        }
        operation = {
            'id': 'layout.seeded-quadrant-partition-2d',
            'errors': {'INVALID_INPUT': 'bad', 'INVALID_RECTANGLE': 'bad root', 'PARTITION_ARITHMETIC_INVALID': 'bad midpoint'},
            'dynamic_error_stages': ['midpoint_x', 'midpoint_y'],
        }
        input_data = {'seed': 42, 'replacements': replacements, 'origin': [0.0, 0.0],
                      'extent': [2.0, 2.0], 'selectionFraction': 0.5}
        if replacements == 0:
            output = {'bounds': [[0.0, 0.0, 2.0, 2.0]], 'ids': [0], 'replacements': 0}
        else:
            output = {'bounds': [[0.0, 0.0, 1.0, 1.0], [1.0, 0.0, 2.0, 1.0],
                                 [1.0, 1.0, 2.0, 2.0], [0.0, 1.0, 1.0, 2.0]],
                      'ids': [1, 2, 3, 4], 'replacements': 1}
        case = {'id': 'valid', 'input': input_data, 'output': output,
                'comparison': {'mode': 'binary64-exact'}}
        return operation, Draft202012Validator(input_schema), Draft202012Validator(output_schema), case

    @staticmethod
    def partition_trace(replacements):
        trace = []
        for index in range(replacements):
            trace.append({'replacementIndex': index, 'liveCount': 1 + 3 * index,
                          'unit_u32': 0, 'unit': 0.0, 'limit': (1 + 3 * index) * 0.5,
                          'selected': 0, 'parentId': 0, 'post_state': [0, 0, 0, 0]})
        return trace

    def test_reference_is_generated_and_drift_is_detected(self):
        self.assertEqual(check(self.root, write_reference=True), [])
        self.assertEqual(check(self.root), [])
        path = self.root / 'docs/reference/operations.md'
        path.write_text(path.read_text() + 'An invented default.\n')
        self.assertTrue(any('stale' in e for e in check(self.root)))

    def test_changed_note_cannot_keep_catalog_provenance(self):
        note = self.root / self.op['provenance'][0]['notes_path']
        note.write_text(note.read_text() + '\nChanged evidence.\n')
        self.assertTrue(any('stale note' in e for e in check(self.root, write_reference=True)))

    def test_omitting_member_and_reusing_stale_fixture_version_fail(self):
        op = copy.deepcopy(self.op)
        op['provenance'].pop()
        self.write_op(op)
        self.assertTrue(any('every accepted member' in e for e in check(self.root, write_reference=True)))
        self.write_op(self.op)
        fixture_path = self.root / self.op['fixtures']
        fixture = json.loads(fixture_path.read_text())
        fixture['version'] = '0.0.0'
        fixture_path.write_text(json.dumps(fixture))
        self.assertTrue(any('version mismatch' in e for e in check(self.root, write_reference=True)))

    def test_invalid_schema_and_wrong_error_codes_fail(self):
        op = copy.deepcopy(self.op)
        op['input_schema']['type'] = 'invented'
        self.write_op(op)
        # Invalid schemas must return a diagnostic, not crash or generate a reference.
        self.assertTrue(any('invalid input_schema' in e for e in check(self.root, write_reference=True)))
        self.write_op(self.op)
        path = self.root / self.op['fixtures']
        fixture = json.loads(path.read_text())
        fixture['cases'][0] = {'id': 'unknown-error', 'input': fixture['cases'][0]['input'], 'error': 'MADE_UP'}
        path.write_text(json.dumps(fixture))
        self.assertTrue(any('unknown error' in e for e in check(self.root, write_reference=True)))

    def test_unknown_fixture_format_is_rejected_without_affecting_implicit_formats(self):
        op = copy.deepcopy(self.op)
        op['fixture_format'] = 'invented-output-layout'
        self.write_op(op)
        self.assertTrue(any('unknown fixture_format' in error for error in check(self.root, write_reference=True)))

    def test_capability_dependency_provenance_must_match_declared_motivator(self):
        op, ledger_path = self.capability_dependency_op()
        self.write_op(op)
        self.assertEqual(check(self.root, write_reference=True), [])
        op['provenance'][0]['evidence_sha256'] = 'stale'
        self.write_op(op)
        self.assertTrue(any('stale evidence' in error for error in check(self.root, write_reference=True)))
        op['provenance'][0]['evidence_sha256'] = self.op['provenance'][0]['evidence_sha256']
        self.write_op(op)
        ledger = json.loads(ledger_path.read_text())
        ledger['clusters'][-1]['dependency_admission']['motivating_candidates'][0]['source_sha256'] = 'forged'
        ledger_path.write_text(json.dumps(ledger))
        self.assertTrue(any('stale source' in error for error in check(self.root, write_reference=True)))

    def test_optional_query_schemas_validate_noise_style_fixtures(self):
        op = copy.deepcopy(self.op)
        op['input_schema'] = {
            'type': 'object', 'properties': {'raw_seed': {'type': 'integer'}},
            'required': ['raw_seed'], 'additionalProperties': False,
        }
        op['output_schema'] = {
            'type': 'object', 'properties': {'seed': {'type': 'integer'}},
            'required': ['seed'], 'additionalProperties': False,
        }
        op['query_schema'] = {
            'type': 'array', 'prefixItems': [{'type': 'number'}, {'type': 'number'}],
            'items': False, 'minItems': 2, 'maxItems': 2,
        }
        op['query_output_schema'] = {'type': 'number', 'minimum': 0, 'maximum': 1}
        op['errors'] = {'INVALID_INPUT': 'bad seed', 'INVALID_QUERY': 'bad coordinate'}
        op.pop('point_schema')
        self.write_op(op)
        fixture_path = self.root / op['fixtures']
        fixture = json.loads(fixture_path.read_text())
        fixture['cases'] = [{
            'id': 'seed-and-query', 'input': {'raw_seed': 7}, 'serialized': {'seed': 7},
            'queries': [{'input': [1, 2], 'output': 0.5}],
        }]
        fixture['query_cases'] = [{'id': 'short-coordinate', 'input': [1], 'error': 'INVALID_QUERY'}]
        fixture_path.write_text(json.dumps(fixture))
        self.assertEqual(check(self.root, write_reference=True), [])
        fixture['cases'][0]['queries'][0]['output'] = 2
        fixture_path.write_text(json.dumps(fixture))
        self.assertTrue(any('invalid query output' in error for error in check(self.root, write_reference=True)))
        fixture['cases'][0]['queries'][0]['output'] = 0.5
        fixture['cases'][0]['id'] = ''
        fixture_path.write_text(json.dumps(fixture))
        self.assertTrue(any('fixture case ids must be nonempty and unique' in error
                            for error in check(self.root, write_reference=True)))

    def test_materialized_output_requires_valid_success_output_without_query_schemas(self):
        self.materialized_output_fixture()
        self.assertEqual(check(self.root, write_reference=True), [])

    def test_materialized_output_rejects_missing_or_schema_invalid_output(self):
        op, fixture = self.materialized_output_fixture()
        fixture['cases'][0].pop('output')
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        self.assertTrue(any('requires output' in error for error in check(self.root, write_reference=True)))
        fixture['cases'][0]['output'] = {'positions': [[0, 0], [1, 0], [2, 0]], 'headings': ['bad']}
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        self.assertTrue(any('invalid materialized output' in error for error in check(self.root, write_reference=True)))
        fixture['cases'][1]['output'] = fixture['cases'][0]['output']
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        self.assertTrue(any('error case must omit output' in error for error in check(self.root, write_reference=True)))

    def test_materialized_output_rejects_wrong_sequence_lengths(self):
        op, fixture = self.materialized_output_fixture()
        fixture['cases'][0]['input']['steps'] = 2.0
        fixture['cases'][0]['output']['positions'].pop()
        fixture['cases'][0]['output']['headings'].append(0)
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        errors = check(self.root, write_reference=True)
        self.assertTrue(any('positions length must equal steps+1' in error for error in errors))
        self.assertTrue(any('headings length must equal steps' in error for error in errors))

    def test_materialized_output_requires_per_case_finite_comparison(self):
        op, fixture = self.materialized_output_fixture()
        fixture['cases'][0].pop('comparison')
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        errors = check(self.root, write_reference=True)
        self.assertTrue(any('requires comparison metadata' in error for error in errors))
        fixture['cases'][0]['comparison'] = {'positions_abs': True, 'headings_abs': -1}
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        errors = check(self.root, write_reference=True)
        self.assertTrue(any('invalid comparison positions_abs' in error for error in errors))
        self.assertTrue(any('invalid comparison headings_abs' in error for error in errors))
        fixture['comparison'] = {'positions_abs': 0, 'headings_abs': 0}
        fixture['cases'][1]['comparison'] = {'positions_abs': 0, 'headings_abs': 0}
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        errors = check(self.root, write_reference=True)
        self.assertTrue(any('comparison must be per successful case' in error for error in errors))
        self.assertTrue(any('error case must omit comparison' in error for error in errors))

    def test_materialized_output_rejects_nonfinite_numbers(self):
        op, fixture = self.materialized_output_fixture()
        fixture['cases'][0]['output']['positions'][1][0] = float('nan')
        fixture['cases'][0]['output']['headings'][0] = float('inf')
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        self.assertTrue(any('numbers must be finite' in error
                            for error in check(self.root, write_reference=True)))

    def test_materialized_long_cases_and_cross_case_checks_validate(self):
        self.long_materialized_output_fixture()
        self.assertEqual(check(self.root, write_reference=True), [])

    def test_materialized_long_extensions_reject_sparse_source_cross_and_catalog_mutations(self):
        op, fixture, source = self.long_materialized_output_fixture()
        fixture_path = self.root / op['fixtures']

        wrong_sparse = copy.deepcopy(fixture)
        wrong_sparse['long_cases'][0]['selected'][1]['pointIndex'] = 2
        fixture_path.write_text(json.dumps(wrong_sparse))
        self.assertTrue(any('headingIndex must equal pointIndex-1' in error
                            for error in check(self.root, write_reference=True)))

        wrong_final = copy.deepcopy(fixture)
        wrong_final['long_cases'][0]['selected'][-1]['pointIndex'] = 2
        fixture_path.write_text(json.dumps(wrong_final))
        self.assertTrue(any('must end at pointIndex steps' in error
                            for error in check(self.root, write_reference=True)))

        missing_heading = copy.deepcopy(fixture)
        missing_heading['long_cases'][0]['selected'][1].pop('heading')
        fixture_path.write_text(json.dumps(missing_heading))
        self.assertTrue(any('requires finite heading' in error
                            for error in check(self.root, write_reference=True)))

        fixture_path.write_text(json.dumps(fixture))
        source.write_text('changed source\n')
        self.assertTrue(any('source sha256 is stale' in error
                            for error in check(self.root, write_reference=True)))

        source.write_text('{"accepted":"independent loop"}\n')
        unknown_cross = copy.deepcopy(fixture)
        unknown_cross['cross_case_checks'][0]['prefix_case'] = 'missing'
        fixture_path.write_text(json.dumps(unknown_cross))
        self.assertTrue(any('references unknown successful case' in error
                            for error in check(self.root, write_reference=True)))

        bad_hash = copy.deepcopy(fixture)
        bad_hash['catalog_sha256'] = 'bad'
        fixture_path.write_text(json.dumps(bad_hash))
        self.assertTrue(any('catalog_sha256 is stale' in error
                            for error in check(self.root, write_reference=True)))

    def test_materialized_large_json_integer_reports_diagnostic_without_crashing(self):
        op, fixture = self.materialized_output_fixture()
        fixture['cases'][0]['comparison']['positions_abs'] = 10 ** 1000
        (self.root / op['fixtures']).write_text(json.dumps(fixture))
        self.assertTrue(any('invalid comparison positions_abs' in error
                            for error in check(self.root, write_reference=True)))

    def test_circle_placement_fixture_accepts_exact_seeded_and_filter_records(self):
        for operation_id in ('sampling.seeded-circle-placement-2d', 'sampling.ordered-circle-filter-2d'):
            op, input_validator, output_validator, case = self.circle_placement_case(operation_id)
            self.assertEqual(validate_circle_placement_case('circle.json', op, case, input_validator, output_validator), [])

    def test_circle_placement_rejects_noncanonical_nonfinite_and_mismatched_output(self):
        op, input_validator, output_validator, case = self.circle_placement_case()
        bad_zero = copy.deepcopy(case)
        bad_zero['output']['centres'][0][0] = -0.0
        self.assertTrue(any('finite canonical coordinate' in error for error in validate_circle_placement_case('circle.json', op, bad_zero, input_validator, output_validator)))
        bad_radius = copy.deepcopy(case)
        bad_radius['output']['radii'][0] = float('inf')
        self.assertTrue(any('invalid circle-placement output schema' in error or 'radii must be finite canonical' in error for error in validate_circle_placement_case('circle.json', op, bad_radius, input_validator, output_validator)))
        zero_radius = copy.deepcopy(case)
        zero_radius['output']['radii'][0] = 0.0
        self.assertTrue(any('radii must be finite canonical positive' in error for error in validate_circle_placement_case('circle.json', op, zero_radius, input_validator, output_validator)))
        mismatch = copy.deepcopy(case)
        mismatch['output']['radii'].pop()
        mismatch['output']['sourceIndices'] = [2, 1, 0]
        mismatch['output']['attempts'] = -0.0
        errors = validate_circle_placement_case('circle.json', op, mismatch, input_validator, output_validator)
        self.assertTrue(any('lengths must match' in error for error in errors))
        self.assertTrue(any('output attempts must equal' in error or 'retained count must not exceed attempts' in error for error in errors))
        self.assertTrue(any('strictly increasing' in error for error in errors))
        self.assertTrue(any('output attempts must be bounded finite integral' in error for error in errors))
        signed_index = copy.deepcopy(case)
        signed_index['output']['sourceIndices'][0] = -0.0
        self.assertTrue(any('sourceIndices must be finite canonical integral' in error for error in validate_circle_placement_case('circle.json', op, signed_index, input_validator, output_validator)))

    def test_circle_placement_cross_field_and_error_records_are_narrowly_checked(self):
        op, input_validator, output_validator, case = self.circle_placement_case()
        semantic_invalid = {'id': 'minimum-exceeds-maximum', 'input': copy.deepcopy(case['input']), 'error': 'INVALID_INPUT'}
        semantic_invalid['input']['radiusRange'] = [2, 1]
        self.assertEqual(validate_circle_placement_case('circle.json', op, semantic_invalid, input_validator, output_validator), [])
        invalid_success = copy.deepcopy(case)
        invalid_success['input']['radiusRange'] = [2, 1]
        self.assertTrue(any('cross-field invariant' in error for error in validate_circle_placement_case('circle.json', op, invalid_success, input_validator, output_validator)))
        filter_op, filter_input_validator, filter_output_validator, filter_case = self.circle_placement_case('sampling.ordered-circle-filter-2d')
        filter_invalid = {'id': 'mismatched-arrays', 'input': copy.deepcopy(filter_case['input']), 'error': 'INVALID_INPUT'}
        filter_invalid['input']['radii'].pop()
        self.assertEqual(validate_circle_placement_case('filter.json', filter_op, filter_invalid, filter_input_validator, filter_output_validator), [])
        filter_success = copy.deepcopy(filter_case)
        filter_success['input']['radii'].pop()
        self.assertTrue(any('cross-field invariant' in error for error in validate_circle_placement_case('filter.json', filter_op, filter_success, filter_input_validator, filter_output_validator)))
        dynamic = {'id': 'dynamic', 'input': copy.deepcopy(case['input']), 'error': 'PLACEMENT_ARITHMETIC_INVALID', 'error_detail': {'candidateIndex': 1, 'stage': 'candidate_x'}}
        self.assertEqual(validate_circle_placement_case('circle.json', op, dynamic, input_validator, output_validator), [])
        dynamic['error_detail'] = {'candidateIndex': 3, 'stage': 'invented'}
        errors = validate_circle_placement_case('circle.json', op, dynamic, input_validator, output_validator)
        self.assertTrue(any('candidateIndex outside' in error for error in errors))
        self.assertTrue(any('stage is not declared' in error for error in errors))
        dynamic['output'] = copy.deepcopy(case['output'])
        dynamic['comparison'] = {'mode': 'binary64-exact'}
        self.assertTrue(any('error case must omit' in error for error in validate_circle_placement_case('circle.json', op, dynamic, input_validator, output_validator)))
        dynamic_input = {'id': 'dynamic-nonfinite', 'input': copy.deepcopy(case['input']), 'error': 'PLACEMENT_ARITHMETIC_INVALID', 'error_detail': {'candidateIndex': 0, 'stage': 'candidate_x'}}
        dynamic_input['input']['origin'][0] = float('nan')
        self.assertTrue(any('dynamic arithmetic input must have only finite' in error for error in validate_circle_placement_case('circle.json', op, dynamic_input, input_validator, output_validator)))
        success_detail = copy.deepcopy(case)
        success_detail['error_detail'] = {'candidateIndex': 0, 'stage': 'candidate_x'}
        self.assertTrue(any('successful case must omit error_detail' in error for error in validate_circle_placement_case('circle.json', op, success_detail, input_validator, output_validator)))
        null_error = {'id': 'null-error', 'input': copy.deepcopy(case['input']), 'error': None}
        self.assertTrue(any('constructor fixture error must be' in error for error in validate_circle_placement_case('circle.json', op, null_error, input_validator, output_validator)))

    def test_circle_placement_rejects_bool_large_count_and_shared_schema_drift(self):
        op, input_validator, output_validator, case = self.circle_placement_case()
        bool_input = copy.deepcopy(case)
        bool_input['input']['attempts'] = True
        self.assertTrue(any('unexpected schema error' in error for error in validate_circle_placement_case('circle.json', op, bool_input, input_validator, output_validator)))
        huge = copy.deepcopy(case)
        huge['output']['attempts'] = 10 ** 1000
        self.assertTrue(any('output attempts must be bounded finite integral' in error for error in validate_circle_placement_case('circle.json', op, huge, input_validator, output_validator)))
        target = self.root / 'catalog/operations/filter.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        op['shared_output_operation'] = 'sampling.ordered-circle-filter-2d'
        op.update(fixture_format='circle-placement-output', output_invariants='packed immutable output', output_schema={'type': 'array'},
                  behavior={'layout': 'parallel retained arrays', 'native_types': 'passive arrays', 'numerics': 'binary64 exact', 'native_errors': 'no partial output'})
        target.write_text(json.dumps({'id': 'sampling.ordered-circle-filter-2d', 'fixture_format': op['fixture_format'],
                                      'output_invariants': op['output_invariants'], 'output_schema': op['output_schema'],
                                      'behavior': copy.deepcopy(op['behavior'])}))
        self.assertEqual(validate_circle_shared_output(self.root, 'seeded.json', op), [])
        for field in ('fixture_format', 'output_invariants', 'output_schema'):
            drift = copy.deepcopy(op)
            drift[field] = 'drifted' if field != 'output_schema' else {'type': 'object'}
            self.assertTrue(any(field + ' differs' in error for error in validate_circle_shared_output(self.root, 'seeded.json', drift)))
        for field in ('layout', 'native_types', 'numerics', 'native_errors'):
            drift = copy.deepcopy(op)
            drift['behavior'][field] = 'drifted'
            self.assertTrue(any('behavior.' + field + ' differs' in error for error in validate_circle_shared_output(self.root, 'seeded.json', drift)))

    def test_circle_seeded_metadata_binds_sources_and_structural_references(self):
        op = json.loads((ROOT / 'catalog/operations/seeded-circle-placement.json').read_text())
        fixture = json.loads((ROOT / 'fixtures/operations/seeded-circle-placement.json').read_text())
        validator = Draft202012Validator(op['input_schema'])
        self.assertEqual(validate_circle_placement_metadata(ROOT, 'seeded.json', op, fixture, validator), [])
        bad_unit = copy.deepcopy(fixture)
        bad_unit['seed_vectors'][0]['first_10'][0]['unit'] = 1.0
        self.assertTrue(any('unit must be finite canonical [0,1)' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, bad_unit, validator)))
        inconsistent_unit = copy.deepcopy(fixture)
        inconsistent_unit['seed_vectors'][0]['first_10'][0]['unit'] = 0.5
        self.assertTrue(any('unit must equal output_u32 / 2^32 exactly' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, inconsistent_unit, validator)))
        off_lattice = copy.deepcopy(fixture)
        off_lattice['mapping_vectors'][0]['units'][0] = 0.1
        self.assertTrue(any('mapping units must lie on the uint32 / 2^32 lattice' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, off_lattice, validator)))
        for required_id in ('centre-separate-rounding-no-fma', 'radius-left-associated-order'):
            missing_mapping = copy.deepcopy(fixture)
            missing_mapping['mapping_vectors'] = [v for v in missing_mapping['mapping_vectors'] if v['id'] != required_id]
            self.assertTrue(any('required mapping vectors missing' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, missing_mapping, validator)))
        bad_index = copy.deepcopy(fixture)
        bad_index['seed_vectors'][0]['first_10'][0]['index'] = False
        self.assertTrue(any('sample index must be canonical integral ordinal' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, bad_index, validator)))
        bad_mapping = copy.deepcopy(fixture)
        bad_mapping['mapping_vectors'][0]['config']['extent'][0] = float('inf')
        self.assertTrue(any('mapping vector config violates' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, bad_mapping, validator)))
        reversed_mapping = copy.deepcopy(fixture)
        reversed_mapping['mapping_vectors'][0]['config']['radiusRange'] = [64.0, 4.0]
        self.assertTrue(any('mapping vector config violates' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, reversed_mapping, validator)))
        bad_binding = copy.deepcopy(fixture)
        bad_binding['baseline_hash_binding']['evidence_sha256'] = '0' * 64
        self.assertTrue(any('baseline evidence source binding is stale' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, bad_binding, validator)))
        bad_prefix = copy.deepcopy(fixture)
        bad_prefix['cross_case_checks'][0]['extended_case'] = 'missing'
        self.assertTrue(any('references unknown successful case' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, bad_prefix, validator)))
        bad_equivalence = copy.deepcopy(fixture)
        for case in bad_equivalence['cases']:
            if case.get('id') == 'ordinary-8':
                case['output']['radii'][0] = 99.0
                break
        self.assertTrue(any('seeded/filter outputs must be exactly equal' in error for error in validate_circle_placement_metadata(ROOT, 'seeded.json', op, bad_equivalence, validator)))

    def test_triangle_points_output_rejects_count_bits_bounds_and_error_shape(self):
        op, input_validator, output_validator, case = self.triangle_point_case()
        self.assertEqual(validate_triangle_points_case('triangle.json', op, case, input_validator, output_validator), [])
        bad_count = copy.deepcopy(case)
        bad_count['output']['points'].append([0.0, 0.0])
        bad_count['points_bits_hex'].append(['0000000000000000', '0000000000000000'])
        self.assertTrue(any('length must equal' in error for error in validate_triangle_points_case('triangle.json', op, bad_count, input_validator, output_validator)))
        bad_zero = copy.deepcopy(case)
        bad_zero['output']['points'][0][0] = -0.0
        bad_zero['points_bits_hex'][0][0] = '8000000000000000'
        self.assertTrue(any('finite canonical' in error for error in validate_triangle_points_case('triangle.json', op, bad_zero, input_validator, output_validator)))
        outside = copy.deepcopy(case)
        outside['output']['points'][0][0] = 3.0
        outside['points_bits_hex'][0][0] = struct.pack('>d', 3.0).hex()
        self.assertTrue(any('outside closed vertex interval' in error for error in validate_triangle_points_case('triangle.json', op, outside, input_validator, output_validator)))
        bad_bits = copy.deepcopy(case)
        bad_bits['points_bits_hex'][0][0] = '3ff0000000000000'
        self.assertTrue(any('differs from output binary64' in error for error in validate_triangle_points_case('triangle.json', op, bad_bits, input_validator, output_validator)))
        off_lattice = copy.deepcopy(case)
        off_lattice['generated_unit_coordinates'][0][0] = 0.1
        self.assertTrue(any('uint32/2^32 lattice' in error for error in validate_triangle_points_case('triangle.json', op, off_lattice, input_validator, output_validator)))
        bool_word = copy.deepcopy(case)
        bool_word['generated_unit_u32'][0][0] = False
        self.assertTrue(any('canonical uint32' in error for error in validate_triangle_points_case('triangle.json', op, bool_word, input_validator, output_validator)))
        outside_word = copy.deepcopy(case)
        outside_word['generated_unit_u32'][0][0] = 4294967296
        self.assertTrue(any('canonical uint32' in error for error in validate_triangle_points_case('triangle.json', op, outside_word, input_validator, output_validator)))
        mismatch_word = copy.deepcopy(case)
        mismatch_word['generated_unit_u32'][0][0] = 1
        self.assertTrue(any('must equal generated_unit_u32/2^32' in error for error in validate_triangle_points_case('triangle.json', op, mismatch_word, input_validator, output_validator)))
        failure = {'id': 'invalid', 'input': copy.deepcopy(case['input']), 'error': 'INVALID_INPUT',
                   'output': copy.deepcopy(case['output']), 'generated_unit_u32': [[0, 0]]}
        failure['input']['count'] = -1
        self.assertTrue(any('error case must omit output' in error for error in validate_triangle_points_case('triangle.json', op, failure, input_validator, output_validator)))

    def test_triangle_points_cross_checks_resolve_actual_prefix_and_mapping_bits(self):
        seeded_op, _, _, prefix = self.triangle_point_case()
        extended = copy.deepcopy(prefix)
        extended['id'] = 'seeded-two'
        extended['input']['count'] = 2
        extended['generated_unit_coordinates'].append([0.0, 0.0])
        extended['generated_unit_u32'].append([0, 0])
        extended['output']['points'].append([0.0, 0.0])
        extended['points_bits_hex'].append(['0000000000000000', '0000000000000000'])
        mapped_op, _, _, mapped = self.triangle_point_case('sampling.triangle-coordinate-map-2d')
        mapped['id'] = 'mapped-prefix'
        mapped['input']['unitCoordinates'] = copy.deepcopy(prefix['generated_unit_coordinates'])
        mapping_path = self.root / 'fixtures/operations/triangle-coordinate-map.json'
        mapping_path.parent.mkdir(parents=True, exist_ok=True)
        mapping_path.write_text(json.dumps({'operation': mapped_op['id'], 'cases': [mapped]}))
        fixture = {
            'cases': [prefix, extended],
            'cross_case_checks': [
                {'id': 'prefix', 'kind': 'raw-binary64-prefix', 'prefix_case': 'seeded-one', 'extended_case': 'seeded-two'},
                {'id': 'map', 'kind': 'seeded-output-equals-explicit-map', 'seeded_case': 'seeded-one',
                 'mapping_fixture': 'fixtures/operations/triangle-coordinate-map.json', 'mapping_case': 'mapped-prefix'},
            ],
        }
        self.assertEqual(validate_triangle_cross_checks(self.root, 'seeded.json', seeded_op, fixture), [])
        mismatch = copy.deepcopy(fixture)
        mismatch['cross_case_checks'][0]['extended_case'] = 'missing'
        self.assertTrue(any('prefix references unknown' in error for error in validate_triangle_cross_checks(self.root, 'seeded.json', seeded_op, mismatch)))
        mapping_mismatch = copy.deepcopy(fixture)
        mapping_mismatch['cross_case_checks'][1]['mapping_case'] = 'missing'
        self.assertTrue(any('unknown mapping' in error for error in validate_triangle_cross_checks(self.root, 'seeded.json', seeded_op, mapping_mismatch)))
        changed = dict(mapped, output={'points': [[1.0, 0.0]]},
                       points_bits_hex=[['3ff0000000000000', '0000000000000000']])
        mapping_path.write_text(json.dumps({'operation': mapped_op['id'], 'cases': [changed]}))
        self.assertTrue(any('must be exactly equal' in error for error in validate_triangle_cross_checks(self.root, 'seeded.json', seeded_op, fixture)))

    def test_triangle_points_metadata_binds_generator_and_shared_seed_vectors(self):
        op, _, _, case = self.triangle_point_case()
        generator = self.root / 'tools/triangle-generator.py'
        generator.parent.mkdir(parents=True, exist_ok=True)
        generator.write_text('independent fixture generator\n')
        evidence = self.root / 'evidence/cp3-stream.json'
        evidence.parent.mkdir(parents=True, exist_ok=True)
        evidence.write_text('{}\n')
        shared = self.root / 'fixtures/operations/seeded-circle-placement.json'
        shared.parent.mkdir(parents=True, exist_ok=True)
        vectors = self.triangle_seed_vectors()
        shared.write_text(json.dumps({'seed_vectors': vectors}))
        fixture = {
            'operation': op['id'], 'version': op['version'], 'fixture_format': 'triangle-points-output',
            'fixture_status': 'generated contract vectors; native validation is separate',
            'catalog_sha256': '0' * 64,
            'generator': {'path': 'tools/triangle-generator.py', 'reference': 'independent oracle',
                          'sha256': hashlib.sha256(generator.read_bytes()).hexdigest()},
            'rng_provenance': {
                'kind': 'private-xoshiro128starstar-1-1',
                'shared_cp3_stream_evidence': 'evidence/cp3-stream.json',
                'shared_cp3_stream_evidence_sha256': hashlib.sha256(evidence.read_bytes()).hexdigest(),
                'shared_cp3_fixture': 'fixtures/operations/seeded-circle-placement.json',
                'shared_cp3_fixture_sha256': hashlib.sha256(shared.read_bytes()).hexdigest(),
                'draws_per_requested_replacement': 2, 'draws_for_zero_replacements': 0,
            },
            'seed_vectors': vectors, 'cases': [case],
            'cross_case_checks': [],
            'native_only_cases': [{'id': 'ownership', 'description': 'Detached access is native-only.'}],
            'native_ownership_access_requirements': {'status': 'planned', 'requirements': ['test detached point access']},
        }
        self.assertEqual(validate_triangle_metadata(self.root, 'triangle.json', op, fixture), [])
        stale = copy.deepcopy(fixture)
        stale['generator']['sha256'] = '0' * 64
        self.assertTrue(any('generator source binding is stale' in error for error in validate_triangle_metadata(self.root, 'triangle.json', op, stale)))
        wrong_vectors = copy.deepcopy(fixture)
        wrong_vectors['seed_vectors'][0]['first_10'][0]['unit'] = 0.5
        self.assertTrue(any('must exactly equal shared CP3' in error for error in validate_triangle_metadata(self.root, 'triangle.json', op, wrong_vectors)))
        bool_draws = copy.deepcopy(fixture)
        bool_draws['rng_provenance']['draws_for_zero_replacements'] = False
        self.assertTrue(any('draws must be exactly two' in error for error in validate_triangle_metadata(self.root, 'triangle.json', op, bool_draws)))

        mapping_op, _, _, mapped = self.triangle_point_case('sampling.triangle-coordinate-map-2d')
        mapping_fixture = {
            'operation': mapping_op['id'], 'version': mapping_op['version'], 'fixture_format': 'triangle-points-output',
            'fixture_status': 'generated contract vectors; native validation is separate', 'catalog_sha256': '0' * 64,
            'generator': {'path': 'tools/triangle-generator.py', 'reference': 'independent oracle',
                          'sha256': hashlib.sha256(generator.read_bytes()).hexdigest()},
            'mapping_provenance': {'arithmetic': 'nested map', 'draws_per_pair': 0, 'sqrt_scope': 'fixture oracle scope'},
            'cases': [mapped], 'cross_case_checks': [],
            'native_only_cases': [{'id': 'ownership', 'description': 'Detached access is native-only.'}],
            'native_ownership_access_requirements': {'status': 'planned', 'requirements': ['test detached point access']},
        }
        self.assertEqual(validate_triangle_metadata(self.root, 'mapped.json', mapping_op, mapping_fixture), [])
        missing_scope = copy.deepcopy(mapping_fixture)
        missing_scope['mapping_provenance'].pop('sqrt_scope')
        self.assertTrue(any('sqrt_scope' in error for error in validate_triangle_metadata(self.root, 'mapped.json', mapping_op, missing_scope)))

    def test_partition_output_rejects_malformed_bounds_ids_and_dynamic_detail(self):
        op, input_validator, output_validator, case = self.partition_case()
        self.assertEqual(validate_partition_output_case('partition.json', op, case, input_validator, output_validator), [])
        bad_bound = copy.deepcopy(case)
        bad_bound['output']['bounds'][0][2] = -0.0
        self.assertTrue(any('strict-interior' in error for error in validate_partition_output_case('partition.json', op, bad_bound, input_validator, output_validator)))
        root_leak = copy.deepcopy(case)
        root_leak['output']['ids'][0] = 0
        self.assertTrue(any('must not retain root id0' in error for error in validate_partition_output_case('partition.json', op, root_leak, input_validator, output_validator)))
        malformed = {'id': 'dynamic', 'input': copy.deepcopy(case['input']),
                     'error': 'PARTITION_ARITHMETIC_INVALID',
                     'error_detail': {'replacementIndex': False, 'stage': 'not-a-stage'},
                     'selection_trace': [dict(self.partition_trace(1)[0], midpoint_bits_hex=['0000000000000000', '0000000000000000'])]}
        errors = validate_partition_output_case('partition.json', op, malformed, input_validator, output_validator)
        self.assertTrue(any('replacementIndex outside' in error for error in errors))
        self.assertTrue(any('stage is not declared' in error for error in errors))
        static_detail = {'id': 'static', 'input': copy.deepcopy(case['input']), 'error': 'INVALID_RECTANGLE',
                         'error_detail': {'replacementIndex': 0, 'stage': 'midpoint_x'}}
        self.assertTrue(any('only PARTITION_ARITHMETIC_INVALID' in error for error in validate_partition_output_case('partition.json', op, static_detail, input_validator, output_validator)))
        zero_op, zero_input_validator, zero_output_validator, zero = self.partition_case(0)
        zero['input']['replacements'] = -0.0
        self.assertEqual(validate_partition_output_case('partition.json', zero_op, zero, zero_input_validator, zero_output_validator), [])

    def test_partition_metadata_rejects_stale_source_and_cross_case_reference(self):
        op, input_validator, output_validator, case = self.partition_case()
        generated = self.root / 'tools/partition-generator.py'
        generated.parent.mkdir(parents=True, exist_ok=True)
        generated.write_text('generated partition vectors\n')
        cp3_evidence = self.root / 'evidence/cp3-stream.json'
        cp3_evidence.parent.mkdir(parents=True, exist_ok=True)
        cp3_evidence.write_text('{}\n')
        cp3_fixture = self.root / 'fixtures/operations/seeded-circle-placement.json'
        cp3_fixture.parent.mkdir(parents=True, exist_ok=True)
        cp3_fixture.write_text('{}\n')
        case['bounds_bits_hex'] = [[struct.pack('>d', value).hex() for value in bound]
                                   for bound in case['output']['bounds']]
        case['selection_trace'] = self.partition_trace(1)
        self.assertEqual(validate_partition_success_metadata('partition.json', case), [])
        mismatched_bits = copy.deepcopy(case)
        mismatched_bits['bounds_bits_hex'][0][0] = '8000000000000000'
        self.assertTrue(any('differs from output binary64 values' in error
                            for error in validate_partition_success_metadata('partition.json', mismatched_bits)))
        zero_op, _, _, zero = self.partition_case(0)
        zero['id'] = 'zero'
        zero['bounds_bits_hex'] = [[struct.pack('>d', value).hex() for value in bound]
                                   for bound in zero['output']['bounds']]
        zero['selection_trace'] = []
        fixture = {
            'operation': op['id'], 'version': '0.1.0', 'fixture_format': 'partition-output',
            'fixture_status': 'generated shared-contract vectors; native implementation validation is separate',
            'catalog_sha256': '0' * 64,
            'generator': {'path': 'tools/partition-generator.py', 'reference': 'private independent oracle',
                          'sha256': hashlib.sha256(generated.read_bytes()).hexdigest()},
            'rng_provenance': {
                'kind': 'private-xoshiro128starstar-1-1',
                'shared_cp3_stream_evidence': 'evidence/cp3-stream.json',
                'shared_cp3_stream_evidence_sha256': hashlib.sha256(cp3_evidence.read_bytes()).hexdigest(),
                'shared_cp3_fixture': 'fixtures/operations/seeded-circle-placement.json',
                'shared_cp3_fixture_sha256': hashlib.sha256(cp3_fixture.read_bytes()).hexdigest(),
                'draws_per_requested_replacement': 1, 'draws_for_zero_replacements': 0,
            },
            'seed_vectors': [
                {'seed': seed, 'initial_state': [1, 2, 3, 4],
                 'first_10': [{'index': index, 'output_u32': 0, 'unit': 0.0, 'post_state': [1, 2, 3, 4]}
                              for index in range(10)]}
                for seed in (0, 1, 42, 0x80000000, 0xffffffff)
            ],
            'cases': [zero, case],
            'cross_case_checks': [
                {'id': 'empty', 'kind': 'empty-selection-trace', 'case': 'zero'},
                {'id': 'draws', 'kind': 'selection-trace-count-equals-attempted-replacements-including-failing-draw', 'cases': ['zero', 'valid']},
                {'id': 'ids', 'kind': 'stable-ids-in-mutation-ordered-result', 'case': 'valid'},
            ],
            'native_only_cases': [{'id': 'ownership', 'description': 'Detached access is native-only.'}],
            'native_ownership_access_requirements': {'status': 'planned', 'requirements': ['test detached bounds access']},
        }
        self.assertEqual(validate_partition_metadata(self.root, 'partition.json', fixture), [])
        self.assertEqual(validate_partition_cross_checks('partition.json', fixture), [])
        stale = copy.deepcopy(fixture)
        stale['generator']['sha256'] = '0' * 64
        self.assertTrue(any('generator source binding is stale' in error for error in validate_partition_metadata(self.root, 'partition.json', stale)))
        unknown = copy.deepcopy(fixture)
        unknown['cross_case_checks'][0]['case'] = 'missing'
        self.assertTrue(any('unknown successful case' in error for error in validate_partition_cross_checks('partition.json', unknown)))

    def test_current_partition_fixture_branch_validates_before_contract_publication(self):
        op = json.loads((ROOT / 'catalog/operations/seeded-quadrant-partition.json').read_text())
        fixture = json.loads((ROOT / 'fixtures/operations/seeded-quadrant-partition.json').read_text())
        self.assertIn(op['status'], {'draft', 'reviewed'})
        input_validator = Draft202012Validator(op['input_schema'])
        output_validator = Draft202012Validator(op['output_schema'])
        errors = validate_partition_metadata(ROOT, 'partition.json', fixture)
        errors.extend(validate_partition_cross_checks('partition.json', fixture))
        for case in fixture['cases']:
            errors.extend(validate_partition_output_case('partition.json', op, case, input_validator, output_validator))
            if case.get('error') is None:
                errors.extend(validate_partition_success_metadata('partition.json', case))
        self.assertEqual(errors, [])


if __name__ == '__main__':
    unittest.main()
