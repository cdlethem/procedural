#!/usr/bin/env python3
"""Validate the operation catalog and its generated reference (not runtime conformance)."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import struct

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from jsonschema import Draft202012Validator

from tools.check_phase2_design import load_ledger, validate
from tools.operation_attestations import display_dimension, load_attestations

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = Path('docs/reference/operations.md')
CAPABILITY_DEPENDENCY_ADMISSION = 'capability_dependency'
EXACT_JSON_OUTPUT = 'exact-json-output'
MATERIALIZED_OUTPUT = 'materialized-output'
CIRCLE_PLACEMENT_OUTPUT = 'circle-placement-output'
PARTITION_OUTPUT = 'partition-output'
TRIANGLE_POINTS_OUTPUT = 'triangle-points-output'
BRANCH_TREE_OUTPUT = 'branch-tree-output'
RADIAL_PROFILE_OUTPUT = 'radial-profile-surface-output'
ANNULAR_SOLID_OUTPUT = 'annular-solid-3d-output'
DELAUNAY_OUTPUT = 'delaunay-output'
SPRING_OUTPUT = 'target-spring-state-output'
CIRCLE_PLACEMENT_IDS = {
    'sampling.seeded-circle-placement-2d',
    'sampling.ordered-circle-filter-2d',
}
CIRCLE_PLACEMENT_BOUND = 1_073_741_823
PARTITION_ID = 'layout.seeded-quadrant-partition-2d'
PARTITION_REPLACEMENT_BOUND = 178_956_970
PARTITION_LEAF_BOUND = 536_870_911
TRIANGLE_POINT_IDS = {
    'sampling.seeded-triangle-points-2d',
    'sampling.triangle-coordinate-map-2d',
}
TRIANGLE_SEEDED_ID = 'sampling.seeded-triangle-points-2d'
TRIANGLE_MAPPED_ID = 'sampling.triangle-coordinate-map-2d'
TRIANGLE_POINT_BOUND = 1_073_741_823


def finite_number(value: object) -> bool:
    """Return false rather than raising when an arbitrary JSON integer exceeds float."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def finite_nonnegative_number(value: object) -> bool:
    return finite_number(value) and value >= 0


def finite_integral_number(value: object) -> bool:
    if not finite_number(value):
        return False
    try:
        return float(value).is_integer()
    except OverflowError:
        return False


def finite_trace_output(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    positions = value.get('positions')
    headings = value.get('headings')
    if not isinstance(positions, list) or not isinstance(headings, list):
        return False
    coordinates = [coordinate for position in positions
                   if isinstance(position, list) for coordinate in position]
    values = [*coordinates, *headings]
    return all(finite_number(number) for number in values)


def canonical_zero(value: object) -> float | int:
    return 0.0 if value == 0 else value


def finite_position(value: object) -> bool:
    return (isinstance(value, list) and len(value) == 2
            and all(finite_number(component) for component in value))


def finite_canonical_number(value: object) -> bool:
    """A fixture number must be finite and must not encode a negative zero."""
    if not finite_number(value):
        return False
    if value != 0:
        return True
    try:
        return math.copysign(1.0, value) > 0
    except (TypeError, OverflowError):
        return False


def finite_canonical_pair(value: object) -> bool:
    return (isinstance(value, list) and len(value) == 2
            and all(finite_canonical_number(component) for component in value))


def positive_finite_canonical(value: object) -> bool:
    return finite_canonical_number(value) and value > 0


def finite_canonical_integral(value: object) -> bool:
    return finite_canonical_number(value) and finite_integral_number(value)


def recursively_finite_numbers(value: object) -> bool:
    """JSON Schema considers NaN/Infinity numbers; CP3 fixtures do not."""
    if isinstance(value, dict):
        return all(recursively_finite_numbers(item) for item in value.values())
    if isinstance(value, list):
        return all(recursively_finite_numbers(item) for item in value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return finite_number(value)
    return True


def circle_input_count(operation_id: str, value: object) -> int | None:
    if not isinstance(value, dict):
        return None
    if operation_id == 'sampling.seeded-circle-placement-2d':
        count = value.get('attempts')
    elif operation_id == 'sampling.ordered-circle-filter-2d':
        centres = value.get('centres')
        count = len(centres) if isinstance(centres, list) else None
    else:
        return None
    if not finite_integral_number(count):
        return None
    return int(count)


def circle_input_semantic_errors(operation_id: str, value: object) -> list[str]:
    """The two CP3 contracts have only these narrow cross-field fixture invariants."""
    if not isinstance(value, dict):
        return []
    errors: list[str] = []
    if operation_id == 'sampling.seeded-circle-placement-2d':
        radius_range = value.get('radiusRange')
        if (isinstance(radius_range, list) and len(radius_range) == 2
                and all(finite_number(item) for item in radius_range)
                and radius_range[0] > radius_range[1]):
            errors.append('radiusRange minimum exceeds maximum')
    elif operation_id == 'sampling.ordered-circle-filter-2d':
        centres, radii = value.get('centres'), value.get('radii')
        if isinstance(centres, list) and isinstance(radii, list) and len(centres) != len(radii):
            errors.append('centres/radii lengths differ')
    return errors


def circle_dynamic_stages(operation: dict) -> set[str]:
    """Read the CP3 contract's explicit stage vocabulary without parsing prose."""
    stages = operation.get('dynamic_error_stages')
    if stages is None and isinstance(operation.get('behavior'), dict):
        stages = operation['behavior'].get('dynamic_error_stages')
    if not isinstance(stages, list) or not stages or any(not isinstance(stage, str) or not stage for stage in stages):
        return set()
    return set(stages)


def validate_circle_placement_case(prefix: str, operation: dict, case: dict,
                                   input_validator: Draft202012Validator,
                                   output_validator: Draft202012Validator) -> list[str]:
    """Validate exact, fully materialized CP3 placement output fixtures."""
    errors: list[str] = []
    case_id = case.get('id', '<invalid-id>')
    label = f'{prefix}/{case_id}'
    operation_id = operation.get('id')
    input_data = case.get('input')
    schema_errors = list(input_validator.iter_errors(input_data))
    semantic_errors = circle_input_semantic_errors(operation_id, input_data)
    finite_input = recursively_finite_numbers(input_data)
    has_error = 'error' in case
    error = case.get('error')
    if has_error and error not in {'INVALID_INPUT', 'PLACEMENT_ARITHMETIC_INVALID'}:
        errors.append(f'{label}: constructor fixture error must be INVALID_INPUT or PLACEMENT_ARITHMETIC_INVALID')
    if error == 'INVALID_INPUT':
        if not schema_errors and not semantic_errors and finite_input:
            errors.append(f'{label}: expected invalid schema or known cross-field input')
    elif error == 'PLACEMENT_ARITHMETIC_INVALID':
        if schema_errors:
            errors.append(f'{label}: dynamic arithmetic input has unexpected schema error')
        elif semantic_errors:
            errors.append(f'{label}: dynamic arithmetic input violates cross-field invariant: {semantic_errors[0]}')
        elif not finite_input:
            errors.append(f'{label}: dynamic arithmetic input must have only finite numbers')
    elif has_error:
        # A null/empty/foreign error is a malformed error record, never a success.
        pass
    else:
        if schema_errors:
            errors.append(f'{label}: unexpected schema error')
        elif semantic_errors:
            errors.append(f'{label}: successful input violates cross-field invariant: {semantic_errors[0]}')
        elif not finite_input:
            errors.append(f'{label}: successful input must have only finite numbers')
    if has_error:
        if error not in operation.get('errors', {}):
            errors.append(f'{label}: unknown error')
        if 'output' in case:
            errors.append(f'{label}: error case must omit output')
        if 'comparison' in case:
            errors.append(f'{label}: error case must omit comparison')
        if error == 'PLACEMENT_ARITHMETIC_INVALID':
            detail = case.get('error_detail')
            if not isinstance(detail, dict) or set(detail) != {'candidateIndex', 'stage'}:
                errors.append(f'{label}: arithmetic error requires candidateIndex and stage only')
            else:
                count = circle_input_count(operation_id, input_data)
                index = detail.get('candidateIndex')
                if count is None or not finite_integral_number(index) or not 0 <= int(index) < count:
                    errors.append(f'{label}: arithmetic candidateIndex outside input candidate range')
                stages = circle_dynamic_stages(operation)
                if not stages:
                    errors.append(f'{prefix}: circle-placement contract requires explicit dynamic_error_stages')
                elif detail.get('stage') not in stages:
                    errors.append(f'{label}: arithmetic stage is not declared by contract')
        elif 'error_detail' in case:
            errors.append(f'{label}: only PLACEMENT_ARITHMETIC_INVALID may include error_detail')
        return errors

    if 'error_detail' in case:
        errors.append(f'{label}: successful case must omit error_detail')

    if 'output' not in case:
        errors.append(f'{label}: circle-placement-output requires output')
        return errors
    output = case['output']
    if not output_validator.is_valid(output):
        errors.append(f'{label}: invalid circle-placement output schema')
        return errors
    if not isinstance(output, dict):
        errors.append(f'{label}: circle-placement output must be an object')
        return errors
    centres, radii, indices, attempts = (output.get('centres'), output.get('radii'),
                                         output.get('sourceIndices'), output.get('attempts'))
    if not isinstance(centres, list) or not isinstance(radii, list) or not isinstance(indices, list):
        errors.append(f'{label}: circle-placement output arrays are missing')
        return errors
    if not (len(centres) == len(radii) == len(indices)):
        errors.append(f'{label}: centres/radii/sourceIndices lengths must match')
    if any(not finite_canonical_pair(centre) for centre in centres):
        errors.append(f'{label}: output centres must be finite canonical coordinate pairs')
    if any(not positive_finite_canonical(radius) for radius in radii):
        errors.append(f'{label}: output radii must be finite canonical positive numbers')
    if not finite_canonical_integral(attempts) or int(attempts) < 0 or int(attempts) > CIRCLE_PLACEMENT_BOUND:
        errors.append(f'{label}: output attempts must be bounded finite integral')
    expected_attempts = circle_input_count(operation_id, input_data)
    if expected_attempts is None or attempts != expected_attempts:
        errors.append(f'{label}: output attempts must equal input attempt count')
    if any(not finite_canonical_integral(index) for index in indices):
        errors.append(f'{label}: sourceIndices must be finite canonical integral')
    else:
        integer_indices = [int(index) for index in indices]
        upper = expected_attempts if expected_attempts is not None else -1
        if any(index < 0 or index >= upper for index in integer_indices):
            errors.append(f'{label}: sourceIndices must fall within input candidate range')
        if integer_indices != sorted(integer_indices) or len(set(integer_indices)) != len(integer_indices):
            errors.append(f'{label}: sourceIndices must be strictly increasing')
    if finite_integral_number(attempts) and len(indices) > int(attempts):
        errors.append(f'{label}: output retained count must not exceed attempts')
    if case.get('comparison') != {'mode': 'binary64-exact'}:
        errors.append(f'{label}: successful circle-placement case requires exact binary64 comparison')
    return errors


def partition_input_replacements(value: object) -> int | None:
    """Read a valid bounded input count; accepted input zeros normalize to +0 later."""
    if not isinstance(value, dict):
        return None
    replacements = value.get('replacements')
    if not finite_integral_number(replacements):
        return None
    count = int(replacements)
    return count if 0 <= count <= PARTITION_REPLACEMENT_BOUND else None


def finite_canonical_bounds(value: object) -> bool:
    """A retained partition leaf is one finite canonical [left, top, right, bottom]."""
    return (isinstance(value, list) and len(value) == 4
            and all(finite_canonical_number(component) for component in value)
            and value[0] < value[2] and value[1] < value[3])


def validate_partition_output_case(prefix: str, operation: dict, case: dict,
                                   input_validator: Draft202012Validator,
                                   output_validator: Draft202012Validator) -> list[str]:
    """Validate full CP4 partition fixture records without reimplementing partitioning."""
    errors: list[str] = []
    case_id = case.get('id', '<invalid-id>')
    label = f'{prefix}/{case_id}'
    input_data = case.get('input')
    schema_errors = list(input_validator.iter_errors(input_data))
    finite_input = recursively_finite_numbers(input_data)
    has_error = 'error' in case
    error = case.get('error')
    constructor_errors = {'INVALID_INPUT', 'INVALID_RECTANGLE', 'PARTITION_ARITHMETIC_INVALID'}
    if has_error and error not in constructor_errors:
        errors.append(f'{label}: constructor fixture error must be INVALID_INPUT, INVALID_RECTANGLE or PARTITION_ARITHMETIC_INVALID')
    if error == 'INVALID_INPUT':
        if not schema_errors and finite_input:
            errors.append(f'{label}: expected invalid schema or nonfinite input')
    elif error in {'INVALID_RECTANGLE', 'PARTITION_ARITHMETIC_INVALID'}:
        if schema_errors:
            errors.append(f'{label}: construction arithmetic input has unexpected schema error')
        elif not finite_input:
            errors.append(f'{label}: construction arithmetic input must have only finite numbers')
    elif not has_error:
        if schema_errors:
            errors.append(f'{label}: unexpected schema error')
        elif not finite_input:
            errors.append(f'{label}: successful input must have only finite numbers')

    if has_error:
        if error not in operation.get('errors', {}):
            errors.append(f'{label}: unknown error')
        if 'output' in case:
            errors.append(f'{label}: error case must omit output')
        if 'comparison' in case:
            errors.append(f'{label}: error case must omit comparison')
        if error == 'PARTITION_ARITHMETIC_INVALID':
            detail = case.get('error_detail')
            if not isinstance(detail, dict) or set(detail) != {'replacementIndex', 'stage'}:
                errors.append(f'{label}: partition arithmetic error requires replacementIndex and stage only')
            else:
                replacements = partition_input_replacements(input_data)
                index = detail.get('replacementIndex')
                if (replacements is None or not finite_canonical_integral(index)
                        or not 0 <= int(index) < replacements):
                    errors.append(f'{label}: replacementIndex outside input replacement range')
                stages = operation.get('dynamic_error_stages')
                if not isinstance(stages, list) or set(stages) != {'midpoint_x', 'midpoint_y'}:
                    errors.append(f'{prefix}: partition contract requires midpoint_x/midpoint_y stages')
                elif detail.get('stage') not in stages:
                    errors.append(f'{label}: arithmetic stage is not declared by contract')
                if (finite_canonical_integral(detail.get('replacementIndex'))
                        and int(detail['replacementIndex']) >= 0):
                    errors.extend(validate_partition_selection_trace(
                        prefix, case, int(detail['replacementIndex']) + 1))
        elif 'error_detail' in case:
            errors.append(f'{label}: only PARTITION_ARITHMETIC_INVALID may include error_detail')
        if error != 'PARTITION_ARITHMETIC_INVALID' and 'selection_trace' in case:
            errors.append(f'{label}: only dynamic partition errors may include selection_trace')
        return errors

    if 'error_detail' in case:
        errors.append(f'{label}: successful case must omit error_detail')
    if 'output' not in case:
        errors.append(f'{label}: partition-output requires output')
        return errors
    output = case['output']
    if not output_validator.is_valid(output):
        errors.append(f'{label}: invalid partition output schema')
        return errors
    if not isinstance(output, dict):
        errors.append(f'{label}: partition output must be an object')
        return errors
    bounds, ids, replacements = output.get('bounds'), output.get('ids'), output.get('replacements')
    if not isinstance(bounds, list) or not isinstance(ids, list):
        errors.append(f'{label}: output bounds/ids arrays are missing')
        return errors
    input_replacements = partition_input_replacements(input_data)
    if input_replacements is None:
        errors.append(f'{label}: successful input has no canonical bounded replacement count')
        return errors
    expected_size = 1 + 3 * input_replacements
    if len(bounds) != expected_size or len(ids) != expected_size:
        errors.append(f'{label}: bounds/ids length must equal 1+3*replacements')
    if len(bounds) != len(ids):
        errors.append(f'{label}: bounds/ids lengths must match')
    if any(not finite_canonical_bounds(bound) for bound in bounds):
        errors.append(f'{label}: bounds must be finite canonical strict-interior four-tuples')
    if not finite_canonical_integral(replacements) or int(replacements) != input_replacements:
        errors.append(f'{label}: output replacements must equal canonical input replacements')
    if any(not finite_canonical_integral(identity) for identity in ids):
        errors.append(f'{label}: ids must be finite canonical integral values')
    else:
        integers = [int(identity) for identity in ids]
        if any(identity < 0 or identity > 4 * input_replacements for identity in integers):
            errors.append(f'{label}: ids must fall within 0..4*replacements')
        if integers != sorted(integers) or len(set(integers)) != len(integers):
            errors.append(f'{label}: ids must be strictly increasing and unique')
        if input_replacements == 0 and integers != [0]:
            errors.append(f'{label}: zero replacements must retain only root id0')
        if input_replacements > 0 and 0 in integers:
            errors.append(f'{label}: positive replacements must not retain root id0')
    if case.get('comparison') != {'mode': 'binary64-exact'}:
        errors.append(f'{label}: successful partition case requires exact binary64 comparison')
    return errors


def validate_circle_shared_output(root: Path, prefix: str, operation: dict) -> list[str]:
    """Seeded placement must name the reviewed filter whose output it returns."""
    if operation.get('id') != 'sampling.seeded-circle-placement-2d':
        return []
    errors: list[str] = []
    target_id = operation.get('shared_output_operation')
    if target_id != 'sampling.ordered-circle-filter-2d':
        return [f'{prefix}: seeded circle placement must reference ordered circle filter output']
    target = None
    for path in sorted((root / 'catalog/operations').glob('*.json')):
        candidate = load_ledger(path)
        if candidate.get('id') == target_id:
            target = candidate
            break
    if target is None:
        return [f'{prefix}: shared_output_operation target does not exist']
    for field in ('fixture_format', 'output_invariants', 'output_schema'):
        if operation.get(field) != target.get(field):
            errors.append(f'{prefix}: shared_output_operation {field} differs from filter')
    operation_behavior = operation.get('behavior')
    target_behavior = target.get('behavior')
    for field in ('layout', 'native_types', 'numerics', 'native_errors'):
        actual = operation_behavior.get(field) if isinstance(operation_behavior, dict) else None
        expected = target_behavior.get(field) if isinstance(target_behavior, dict) else None
        if actual != expected:
            errors.append(f'{prefix}: shared_output_operation behavior.{field} differs from filter')
    return errors


def hex_digest(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(character in '0123456789abcdef' for character in value)


def uint32(value: object) -> bool:
    return finite_canonical_integral(value) and 0 <= int(value) <= 0xffffffff


def validate_circle_metadata_source(root: Path, prefix: str, fixture: dict) -> list[str]:
    errors: list[str] = []
    generator = fixture.get('generator')
    if not isinstance(generator, dict) or set(generator) != {'path', 'reference', 'sha256'}:
        return [f'{prefix}: circle-placement generator binding must contain path/reference/sha256']
    path = fixture_source(root, generator.get('path'))
    if path is None or not path.is_file() or not hex_digest(generator.get('sha256')) or sha256_file(path) != generator['sha256']:
        errors.append(f'{prefix}: circle-placement generator source binding is stale or invalid')
    if not isinstance(generator.get('reference'), str) or not generator['reference'].strip():
        errors.append(f'{prefix}: circle-placement generator reference is missing')
    return errors


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def circle_case_index(fixture: dict) -> dict[str, dict]:
    cases = fixture.get('cases')
    if not isinstance(cases, list):
        return {}
    return {case['id']: case for case in cases if isinstance(case, dict) and isinstance(case.get('id'), str)
            and case.get('error') is None}


def validate_circle_seed_vectors(prefix: str, fixture: dict) -> list[str]:
    errors: list[str] = []
    vectors = fixture.get('seed_vectors')
    if not isinstance(vectors, list) or not vectors:
        return [f'{prefix}: seeded circle fixture requires nonempty seed_vectors']
    seeds = []
    for ordinal, vector in enumerate(vectors):
        label = f'{prefix}/seed_vectors[{ordinal}]'
        if not isinstance(vector, dict) or set(vector) != {'seed', 'initial_state', 'first_10'}:
            errors.append(f'{label}: vector must contain seed/initial_state/first_10')
            continue
        seed = vector.get('seed')
        if not uint32(seed):
            errors.append(f'{label}: seed must be canonical uint32')
        else:
            seeds.append(int(seed))
        state = vector.get('initial_state')
        if not isinstance(state, list) or len(state) != 4 or any(not uint32(word) for word in state):
            errors.append(f'{label}: initial_state must contain four canonical uint32 words')
        samples = vector.get('first_10')
        if not isinstance(samples, list) or len(samples) != 10:
            errors.append(f'{label}: first_10 must contain exactly ten samples')
            continue
        for index, sample in enumerate(samples):
            sample_label = f'{label}/first_10[{index}]'
            if not isinstance(sample, dict) or set(sample) != {'index', 'output_u32', 'unit', 'post_state'}:
                errors.append(f'{sample_label}: sample shape differs')
                continue
            sample_index = sample.get('index')
            if not finite_canonical_integral(sample_index) or int(sample_index) != index:
                errors.append(f'{sample_label}: sample index must be canonical integral ordinal')
            if not uint32(sample.get('output_u32')):
                errors.append(f'{sample_label}: output_u32 must be canonical uint32')
            unit = sample.get('unit')
            if not finite_canonical_number(unit) or not 0 <= unit < 1:
                errors.append(f'{sample_label}: unit must be finite canonical [0,1)')
            elif uint32(sample.get('output_u32')) and unit != sample['output_u32'] / 4294967296:
                errors.append(f'{sample_label}: unit must equal output_u32 / 2^32 exactly')
            state = sample.get('post_state')
            if not isinstance(state, list) or len(state) != 4 or any(not uint32(word) for word in state):
                errors.append(f'{sample_label}: post_state must contain four canonical uint32 words')
    if len(seeds) != len(vectors) or len(set(seeds)) != len(seeds):
        errors.append(f'{prefix}: seed_vectors seeds must be unique canonical uint32 values')
    return errors


def validate_circle_mapping_vectors(prefix: str, fixture: dict,
                                    input_validator: Draft202012Validator) -> list[str]:
    errors: list[str] = []
    vectors = fixture.get('mapping_vectors')
    if not isinstance(vectors, list) or not vectors:
        return [f'{prefix}: seeded circle fixture requires nonempty mapping_vectors']
    ids: list[str] = []
    for ordinal, vector in enumerate(vectors):
        label = f'{prefix}/mapping_vectors[{ordinal}]'
        if not isinstance(vector, dict) or set(vector) != {'id', 'config', 'units', 'mapped'}:
            errors.append(f'{label}: mapping vector shape differs')
            continue
        vector_id = vector.get('id')
        if not isinstance(vector_id, str) or not vector_id.strip():
            errors.append(f'{label}: mapping vector id must be nonempty')
        else:
            ids.append(vector_id)
        config = vector.get('config')
        if (not input_validator.is_valid(config) or not recursively_finite_numbers(config)
                or circle_input_semantic_errors('sampling.seeded-circle-placement-2d', config)):
            errors.append(f'{label}: mapping vector config violates seeded input schema')
        units = vector.get('units')
        if not isinstance(units, list) or len(units) != 4 or any(not finite_canonical_number(unit) or not 0 <= unit < 1 for unit in units):
            errors.append(f'{label}: units must contain four finite canonical [0,1) values')
        elif any(not float(unit * 4294967296).is_integer() for unit in units):
            errors.append(f'{label}: mapping units must lie on the uint32 / 2^32 lattice')
        mapped = vector.get('mapped')
        if not isinstance(mapped, dict) or set(mapped) != {'centre', 'radius'}:
            errors.append(f'{label}: mapped value must contain centre/radius')
        else:
            if not finite_canonical_pair(mapped.get('centre')):
                errors.append(f'{label}: mapped centre must be a finite canonical pair')
            if not positive_finite_canonical(mapped.get('radius')):
                errors.append(f'{label}: mapped radius must be finite canonical positive')
    if len(ids) != len(vectors) or len(set(ids)) != len(ids):
        errors.append(f'{prefix}: mapping_vectors ids must be nonempty and unique')
    required_ids = {'zero-units', 'max-u32-units', 'constant-radius-units',
                    'centre-separate-rounding-no-fma', 'radius-left-associated-order'}
    if not required_ids.issubset(ids):
        errors.append(f'{prefix}: required mapping vectors missing: {sorted(required_ids - set(ids))}')
    return errors


def validate_circle_baseline_binding(root: Path, prefix: str, fixture: dict) -> list[str]:
    errors: list[str] = []
    binding = fixture.get('baseline_hash_binding')
    required = {'evidence_path', 'evidence_sha256', 'base_rings_5000_accepted_sha256',
                'extended_baseline_10000_accepted_sha256', 'verified'}
    if not isinstance(binding, dict) or set(binding) != required:
        return [f'{prefix}: seeded circle fixture baseline_hash_binding shape differs']
    path = fixture_source(root, binding.get('evidence_path'))
    if path is None or not path.is_file() or not hex_digest(binding.get('evidence_sha256')) or sha256_file(path) != binding['evidence_sha256']:
        errors.append(f'{prefix}: baseline evidence source binding is stale or invalid')
        return errors
    if binding.get('verified') is not True:
        errors.append(f'{prefix}: baseline_hash_binding verified must be true')
    for key in ('base_rings_5000_accepted_sha256', 'extended_baseline_10000_accepted_sha256'):
        if not hex_digest(binding.get(key)):
            errors.append(f'{prefix}: {key} must be sha256')
    try:
        evidence = load_ledger(path)
    except Exception:
        errors.append(f'{prefix}: baseline evidence is not readable JSON')
        return errors
    if binding.get('base_rings_5000_accepted_sha256') != evidence.get('profiles', {}).get('base-rings', {}).get('accepted_sha256'):
        errors.append(f'{prefix}: baseline accepted hash differs from evidence')
    if binding.get('extended_baseline_10000_accepted_sha256') != evidence.get('extended_baseline', {}).get('accepted_sha256'):
        errors.append(f'{prefix}: extended baseline accepted hash differs from evidence')
    return errors


def validate_circle_cross_checks(root: Path, prefix: str, fixture: dict) -> list[str]:
    errors: list[str] = []
    checks = fixture.get('cross_case_checks')
    if not isinstance(checks, list) or not checks:
        return [f'{prefix}: seeded circle fixture requires nonempty cross_case_checks']
    success = circle_case_index(fixture)
    ids: list[str] = []
    for ordinal, check in enumerate(checks):
        label = f'{prefix}/cross_case_checks[{ordinal}]'
        if not isinstance(check, dict) or not isinstance(check.get('id'), str) or not check['id'].strip():
            errors.append(f'{label}: check id must be nonempty')
            continue
        ids.append(check['id'])
        kind = check.get('kind')
        if kind == 'accepted-binary64-prefix':
            if set(check) != {'id', 'kind', 'prefix_case', 'extended_case'}:
                errors.append(f'{label}: accepted prefix check shape differs')
                continue
            first, extended = success.get(check.get('prefix_case')), success.get(check.get('extended_case'))
            if first is None or extended is None:
                errors.append(f'{label}: accepted prefix check references unknown successful case')
                continue
            first_input, extended_input = first.get('input'), extended.get('input')
            if not isinstance(first_input, dict) or not isinstance(extended_input, dict):
                errors.append(f'{label}: accepted prefix inputs must be objects')
                continue
            if not finite_integral_number(first_input.get('attempts')) or not finite_integral_number(extended_input.get('attempts')) or int(first_input['attempts']) >= int(extended_input['attempts']):
                errors.append(f'{label}: accepted prefix attempts must increase')
            if {key: value for key, value in first_input.items() if key != 'attempts'} != {key: value for key, value in extended_input.items() if key != 'attempts'}:
                errors.append(f'{label}: accepted prefix inputs must match except attempts')
            first_output, extended_output = first.get('output'), extended.get('output')
            if not isinstance(first_output, dict) or not isinstance(extended_output, dict):
                errors.append(f'{label}: accepted prefix requires successful outputs')
                continue
            for field in ('centres', 'radii', 'sourceIndices'):
                initial, longer = first_output.get(field), extended_output.get(field)
                if not isinstance(initial, list) or not isinstance(longer, list) or longer[:len(initial)] != initial:
                    errors.append(f'{label}: extended output must retain exact {field} prefix')
            if first_output.get('attempts') != first_input.get('attempts') or extended_output.get('attempts') != extended_input.get('attempts'):
                errors.append(f'{label}: prefix output attempts must match their inputs')
        elif kind == 'independently-materialized-proposals-share-filter-output':
            if set(check) != {'id', 'kind', 'seeded_case', 'filter_fixture', 'filter_case'}:
                errors.append(f'{label}: materialized filter check shape differs')
                continue
            seeded = success.get(check.get('seeded_case'))
            filter_path = fixture_source(root, check.get('filter_fixture'))
            if seeded is None or filter_path is None or not filter_path.is_file():
                errors.append(f'{label}: materialized filter check references missing seeded case or fixture')
                continue
            try:
                filter_fixture = load_ledger(filter_path)
            except Exception:
                errors.append(f'{label}: materialized filter fixture is not readable JSON')
                continue
            if filter_fixture.get('operation') != 'sampling.ordered-circle-filter-2d':
                errors.append(f'{label}: materialized filter fixture has wrong operation')
            filtered = circle_case_index(filter_fixture).get(check.get('filter_case'))
            if filtered is None:
                errors.append(f'{label}: materialized filter check references unknown successful filter case')
            elif seeded.get('output') != filtered.get('output'):
                errors.append(f'{label}: seeded/filter outputs must be exactly equal')
        else:
            errors.append(f'{label}: unknown circle-placement cross-case check kind')
    if len(ids) != len(checks) or len(set(ids)) != len(ids):
        errors.append(f'{prefix}: cross_case_checks ids must be nonempty and unique')
    return errors


def validate_circle_placement_metadata(root: Path, prefix: str, operation: dict,
                                       fixture: dict, input_validator: Draft202012Validator) -> list[str]:
    """Structural/provenance checks only; portable cores prove stream/kernel arithmetic."""
    errors = validate_circle_metadata_source(root, prefix, fixture)
    native_only = fixture.get('native_only_cases')
    if not isinstance(native_only, list) or not native_only or any(not isinstance(item, dict) or set(item) != {'id', 'description'} or not isinstance(item['id'], str) or not item['id'].strip() or not isinstance(item['description'], str) or not item['description'].strip() for item in native_only):
        errors.append(f'{prefix}: native_only_cases must contain nonempty id/description records')
    elif len({item['id'] for item in native_only}) != len(native_only):
        errors.append(f'{prefix}: native_only_cases ids must be unique')
    ownership = fixture.get('native_ownership_access_requirements')
    if not isinstance(ownership, dict) or set(ownership) != {'status', 'requirements'} or not isinstance(ownership.get('status'), str) or not ownership['status'].strip() or not isinstance(ownership.get('requirements'), list) or not ownership['requirements'] or any(not isinstance(item, str) or not item.strip() for item in ownership['requirements']):
        errors.append(f'{prefix}: native ownership/access requirements shape differs')
    if operation.get('id') == 'sampling.seeded-circle-placement-2d':
        errors.extend(validate_circle_seed_vectors(prefix, fixture))
        errors.extend(validate_circle_mapping_vectors(prefix, fixture, input_validator))
        errors.extend(validate_circle_baseline_binding(root, prefix, fixture))
        errors.extend(validate_circle_cross_checks(root, prefix, fixture))
    return errors


def valid_hex64(value: object) -> bool:
    return (isinstance(value, str) and len(value) == 16
            and all(character in '0123456789abcdef' for character in value))


def validate_partition_generator(root: Path, prefix: str, fixture: dict) -> list[str]:
    errors: list[str] = []
    generator = fixture.get('generator')
    if not isinstance(generator, dict) or set(generator) != {'path', 'reference', 'sha256'}:
        return [f'{prefix}: partition generator binding must contain path/reference/sha256']
    path = fixture_source(root, generator.get('path'))
    if (path is None or not path.is_file() or not hex_digest(generator.get('sha256'))
            or sha256_file(path) != generator['sha256']):
        errors.append(f'{prefix}: partition generator source binding is stale or invalid')
    if not isinstance(generator.get('reference'), str) or not generator['reference'].strip():
        errors.append(f'{prefix}: partition generator reference is missing')
    return errors


def validate_partition_rng_metadata(root: Path, prefix: str, fixture: dict) -> list[str]:
    """Bind CP4's declared shared stream provenance, without rerunning the RNG algorithm."""
    errors: list[str] = []
    provenance = fixture.get('rng_provenance')
    required = {'kind', 'shared_cp3_stream_evidence', 'shared_cp3_stream_evidence_sha256',
                'shared_cp3_fixture', 'shared_cp3_fixture_sha256',
                'draws_per_requested_replacement', 'draws_for_zero_replacements'}
    if not isinstance(provenance, dict) or set(provenance) != required:
        return [f'{prefix}: partition rng_provenance shape differs']
    if provenance.get('kind') != 'private-xoshiro128starstar-1-1':
        errors.append(f'{prefix}: partition rng_provenance kind must be private-xoshiro128starstar-1-1')
    for path_key, hash_key in (
            ('shared_cp3_stream_evidence', 'shared_cp3_stream_evidence_sha256'),
            ('shared_cp3_fixture', 'shared_cp3_fixture_sha256')):
        path = fixture_source(root, provenance.get(path_key))
        digest = provenance.get(hash_key)
        if path is None or not path.is_file() or not hex_digest(digest) or sha256_file(path) != digest:
            errors.append(f'{prefix}: partition {path_key} binding is stale or invalid')
    if not finite_canonical_integral(provenance.get('draws_per_requested_replacement')) or provenance['draws_per_requested_replacement'] != 1:
        errors.append(f'{prefix}: partition draws_per_requested_replacement must be canonical 1')
    if not finite_canonical_integral(provenance.get('draws_for_zero_replacements')) or provenance['draws_for_zero_replacements'] != 0:
        errors.append(f'{prefix}: partition draws_for_zero_replacements must be canonical 0')
    vectors = fixture.get('seed_vectors')
    errors.extend(validate_circle_seed_vectors(prefix, fixture))
    expected_seeds = {0, 1, 42, 0x80000000, 0xffffffff}
    if not isinstance(vectors, list) or len(vectors) != len(expected_seeds):
        errors.append(f'{prefix}: partition seed_vectors must contain the five standard seeds')
    elif {vector.get('seed') for vector in vectors if isinstance(vector, dict)} != expected_seeds:
        errors.append(f'{prefix}: partition seed_vectors must use exactly standard seeds0/1/42/high-bit/max')
    return errors


def validate_partition_native_metadata(prefix: str, fixture: dict) -> list[str]:
    errors: list[str] = []
    native_only = fixture.get('native_only_cases')
    if (not isinstance(native_only, list) or not native_only
            or any(not isinstance(item, dict) or set(item) != {'id', 'description'}
                   or not isinstance(item.get('id'), str) or not item['id'].strip()
                   or not isinstance(item.get('description'), str) or not item['description'].strip()
                   for item in native_only)):
        errors.append(f'{prefix}: partition native_only_cases must contain nonempty id/description records')
    elif len({item['id'] for item in native_only}) != len(native_only):
        errors.append(f'{prefix}: partition native_only_cases ids must be unique')
    ownership = fixture.get('native_ownership_access_requirements')
    if (not isinstance(ownership, dict) or set(ownership) != {'status', 'requirements'}
            or not isinstance(ownership.get('status'), str) or not ownership['status'].strip()
            or not isinstance(ownership.get('requirements'), list) or not ownership['requirements']
            or any(not isinstance(item, str) or not item.strip() for item in ownership['requirements'])):
        errors.append(f'{prefix}: partition native ownership/access requirements shape differs')
    return errors


def validate_partition_selection_trace(prefix: str, case: dict, expected_length: int) -> list[str]:
    """Check stream consumption metadata without simulating the live-list algorithm."""
    errors: list[str] = []
    case_id = case.get('id', '<invalid-id>')
    label = f'{prefix}/{case_id}'
    trace = case.get('selection_trace')
    if not isinstance(trace, list) or len(trace) != expected_length:
        errors.append(f'{label}: selection_trace length must equal consumed replacement draws')
        return errors
    expected_keys = {'replacementIndex', 'liveCount', 'unit_u32', 'unit', 'limit', 'selected', 'parentId', 'post_state'}
    for ordinal, record in enumerate(trace):
        trace_label = f'{label}/selection_trace[{ordinal}]'
        if not isinstance(record, dict) or not expected_keys.issubset(record) or set(record) - (expected_keys | {'midpoint_bits_hex'}):
            errors.append(f'{trace_label}: selection trace shape differs')
            continue
        if not finite_canonical_integral(record.get('replacementIndex')) or int(record['replacementIndex']) != ordinal:
            errors.append(f'{trace_label}: replacementIndex must be canonical ordinal')
        expected_live = 1 + 3 * ordinal
        if not finite_canonical_integral(record.get('liveCount')) or int(record['liveCount']) != expected_live:
            errors.append(f'{trace_label}: liveCount must equal 1+3*replacementIndex')
        if not uint32(record.get('unit_u32')):
            errors.append(f'{trace_label}: unit_u32 must be canonical uint32')
        unit = record.get('unit')
        if not finite_canonical_number(unit) or not 0 <= unit < 1:
            errors.append(f'{trace_label}: unit must be finite canonical [0,1)')
        elif uint32(record.get('unit_u32')) and unit != record['unit_u32'] / 4294967296:
            errors.append(f'{trace_label}: unit must equal unit_u32 / 2^32 exactly')
        if not finite_canonical_number(record.get('limit')) or record['limit'] <= 0:
            errors.append(f'{trace_label}: limit must be finite canonical positive')
        selected = record.get('selected')
        if (not finite_canonical_integral(selected) or not 0 <= int(selected) < expected_live):
            errors.append(f'{trace_label}: selected must be a canonical live-list index')
        parent = record.get('parentId')
        if not finite_canonical_integral(parent) or not 0 <= int(parent) <= 4 * ordinal:
            errors.append(f'{trace_label}: parentId must be a canonical created id')
        state = record.get('post_state')
        if not isinstance(state, list) or len(state) != 4 or any(not uint32(word) for word in state):
            errors.append(f'{trace_label}: post_state must contain four canonical uint32 words')
        if 'midpoint_bits_hex' in record:
            midpoint_bits = record['midpoint_bits_hex']
            if not isinstance(midpoint_bits, list) or len(midpoint_bits) != 2 or any(not valid_hex64(value) for value in midpoint_bits):
                errors.append(f'{trace_label}: midpoint_bits_hex must contain two lowercase binary64 hex values')
    return errors


def validate_partition_success_metadata(prefix: str, case: dict) -> list[str]:
    """Check declared output bits and trace shape; geometry stays a runtime oracle."""
    errors: list[str] = []
    case_id = case.get('id', '<invalid-id>')
    label = f'{prefix}/{case_id}'
    input_data, output = case.get('input'), case.get('output')
    replacements = partition_input_replacements(input_data)
    bounds = output.get('bounds') if isinstance(output, dict) else None
    bound_bits = case.get('bounds_bits_hex')
    if not isinstance(bound_bits, list) or not isinstance(bounds, list) or len(bound_bits) != len(bounds):
        errors.append(f'{label}: bounds_bits_hex must align with output bounds')
    else:
        for ordinal, (bound, bits) in enumerate(zip(bounds, bound_bits)):
            if not isinstance(bits, list) or len(bits) != 4 or any(not valid_hex64(value) for value in bits):
                errors.append(f'{label}: bounds_bits_hex[{ordinal}] must contain four lowercase binary64 hex values')
                continue
            if isinstance(bound, list) and len(bound) == 4 and all(finite_canonical_number(value) for value in bound):
                expected = [struct.pack('>d', float(value)).hex() for value in bound]
                if bits != expected:
                    errors.append(f'{label}: bounds_bits_hex[{ordinal}] differs from output binary64 values')
    if replacements is None:
        errors.append(f'{label}: successful partition input has no canonical replacement count')
    else:
        errors.extend(validate_partition_selection_trace(prefix, case, replacements))
    return errors


def validate_partition_metadata(root: Path, prefix: str, fixture: dict) -> list[str]:
    required = {'operation', 'version', 'fixture_format', 'fixture_status', 'catalog_sha256',
                'generator', 'rng_provenance', 'seed_vectors', 'cases', 'cross_case_checks',
                'native_only_cases', 'native_ownership_access_requirements'}
    errors: list[str] = []
    if set(fixture) != required:
        errors.append(f'{prefix}: partition fixture top-level shape differs')
    if fixture.get('fixture_format') != PARTITION_OUTPUT:
        errors.append(f'{prefix}: partition fixture_format must be partition-output')
    if not hex_digest(fixture.get('catalog_sha256')):
        errors.append(f'{prefix}: partition fixture requires catalog_sha256')
    errors.extend(validate_partition_generator(root, prefix, fixture))
    errors.extend(validate_partition_rng_metadata(root, prefix, fixture))
    errors.extend(validate_partition_native_metadata(prefix, fixture))
    status = fixture.get('fixture_status')
    if not isinstance(status, str) or not status.strip():
        errors.append(f'{prefix}: partition fixture_status must be a nonempty neutral status')
    return errors


def partition_case_index(fixture: dict) -> dict[str, dict]:
    cases = fixture.get('cases')
    if not isinstance(cases, list):
        return {}
    return {case['id']: case for case in cases if isinstance(case, dict)
            and isinstance(case.get('id'), str) and case.get('id').strip()}


def validate_partition_cross_checks(prefix: str, fixture: dict) -> list[str]:
    """Check declared relation references, not the replacement geometry itself."""
    errors: list[str] = []
    checks = fixture.get('cross_case_checks')
    if not isinstance(checks, list) or not checks:
        return [f'{prefix}: partition fixture requires nonempty cross_case_checks']
    cases = partition_case_index(fixture)
    ids: list[str] = []
    for ordinal, item in enumerate(checks):
        label = f'{prefix}/cross_case_checks[{ordinal}]'
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not item['id'].strip():
            errors.append(f'{label}: check id must be nonempty')
            continue
        ids.append(item['id'])
        kind = item.get('kind')
        if kind == 'empty-selection-trace':
            if set(item) != {'id', 'case', 'kind'}:
                errors.append(f'{label}: empty-selection-trace shape differs')
                continue
            case = cases.get(item.get('case'))
            if case is None or case.get('error') is not None:
                errors.append(f'{label}: empty-selection-trace references unknown successful case')
            elif partition_input_replacements(case.get('input')) != 0 or case.get('selection_trace') != []:
                errors.append(f'{label}: empty-selection-trace requires zero replacements and empty trace')
        elif kind == 'selection-trace-count-equals-attempted-replacements-including-failing-draw':
            if set(item) != {'id', 'cases', 'kind'} or not isinstance(item.get('cases'), list) or not item['cases']:
                errors.append(f'{label}: selection trace count check shape differs')
                continue
            names = item['cases']
            if any(not isinstance(name, str) or name not in cases for name in names) or len(set(names)) != len(names):
                errors.append(f'{label}: selection trace count check references unknown or duplicate cases')
                continue
            for name in names:
                case = cases[name]
                trace = case.get('selection_trace')
                if not isinstance(trace, list):
                    errors.append(f'{label}: referenced case {name} lacks selection_trace')
                    continue
                if case.get('error') == 'PARTITION_ARITHMETIC_INVALID':
                    detail = case.get('error_detail')
                    expected = int(detail['replacementIndex']) + 1 if isinstance(detail, dict) and finite_canonical_integral(detail.get('replacementIndex')) else None
                elif case.get('error') is None:
                    expected = partition_input_replacements(case.get('input'))
                else:
                    expected = None
                if expected is None or len(trace) != expected:
                    errors.append(f'{label}: case {name} trace does not match its attempted replacements')
        elif kind == 'stable-ids-in-mutation-ordered-result':
            if set(item) != {'id', 'case', 'kind'}:
                errors.append(f'{label}: stable-ids check shape differs')
                continue
            case = cases.get(item.get('case'))
            output = case.get('output') if isinstance(case, dict) else None
            if case is None or case.get('error') is not None or not isinstance(output, dict):
                errors.append(f'{label}: stable-ids check references unknown successful case')
            else:
                identities = output.get('ids')
                if not isinstance(identities, list) or identities != sorted(identities) or len(set(identities)) != len(identities):
                    errors.append(f'{label}: stable-ids case must contain strictly increasing unique ids')
        elif kind == 'explicit-non-prefix':
            if set(item) != {'id', 'short_case', 'long_case', 'kind'}:
                errors.append(f'{label}: explicit-non-prefix shape differs')
                continue
            short, longer = cases.get(item.get('short_case')), cases.get(item.get('long_case'))
            if any(case is None or case.get('error') is not None for case in (short, longer)):
                errors.append(f'{label}: explicit-non-prefix references unknown successful cases')
                continue
            short_input, long_input = short.get('input'), longer.get('input')
            short_count, long_count = partition_input_replacements(short_input), partition_input_replacements(long_input)
            if short_count is None or long_count is None or short_count >= long_count:
                errors.append(f'{label}: explicit-non-prefix counts must increase')
            elif ({key: value for key, value in short_input.items() if key != 'replacements'}
                  != {key: value for key, value in long_input.items() if key != 'replacements'}):
                errors.append(f'{label}: explicit-non-prefix inputs must match except replacements')
            short_output, long_output = short.get('output'), longer.get('output')
            if isinstance(short_output, dict) and isinstance(long_output, dict):
                if (long_output.get('bounds', [])[:len(short_output.get('bounds', []))] == short_output.get('bounds')
                        or long_output.get('ids', [])[:len(short_output.get('ids', []))] == short_output.get('ids')):
                    errors.append(f'{label}: longer final result must not claim raw bounds or ids prefix')
        else:
            errors.append(f'{label}: unknown partition cross-case check kind')
    if len(ids) != len(checks) or len(set(ids)) != len(ids):
        errors.append(f'{prefix}: partition cross_case_checks ids must be nonempty and unique')
    return errors


def triangle_input_count(operation_id: str, value: object) -> int | None:
    if not isinstance(value, dict):
        return None
    if operation_id == TRIANGLE_SEEDED_ID:
        count = value.get('count')
    elif operation_id == TRIANGLE_MAPPED_ID:
        coordinates = value.get('unitCoordinates')
        return len(coordinates) if isinstance(coordinates, list) else None
    else:
        return None
    if not finite_integral_number(count):
        return None
    result = int(count)
    return result if 0 <= result <= TRIANGLE_POINT_BOUND else None


def triangle_vertices(value: object) -> list[list[object]] | None:
    if not isinstance(value, dict):
        return None
    triangle = value.get('triangle')
    if (not isinstance(triangle, list) or len(triangle) != 3
            or any(not finite_position(vertex) for vertex in triangle)):
        return None
    return triangle


def validate_triangle_points_bits(label: str, case: dict, points: list[object]) -> list[str]:
    errors: list[str] = []
    bits = case.get('points_bits_hex')
    if not isinstance(bits, list) or len(bits) != len(points):
        return [f'{label}: points_bits_hex must align with output points']
    for ordinal, (point, pair_bits) in enumerate(zip(points, bits)):
        if (not isinstance(pair_bits, list) or len(pair_bits) != 2
                or any(not valid_hex64(item) for item in pair_bits)):
            errors.append(f'{label}: points_bits_hex[{ordinal}] must contain two lowercase binary64 hex values')
            continue
        if finite_canonical_pair(point):
            expected = [struct.pack('>d', float(value)).hex() for value in point]
            if pair_bits != expected:
                errors.append(f'{label}: points_bits_hex[{ordinal}] differs from output binary64 values')
    return errors


def validate_triangle_generated_units(label: str, case: dict, count: int) -> list[str]:
    """Check emitted seeded units structurally; the fixture oracle owns stream execution."""
    errors: list[str] = []
    pairs = case.get('generated_unit_coordinates')
    if not isinstance(pairs, list) or len(pairs) != count:
        return [f'{label}: generated_unit_coordinates must align with seeded count']
    words = case.get('generated_unit_u32')
    if not isinstance(words, list) or len(words) != count:
        return [f'{label}: generated_unit_u32 must align with seeded count']
    for ordinal, pair in enumerate(pairs):
        if not finite_canonical_pair(pair) or any(not 0 <= value < 1 for value in pair):
            errors.append(f'{label}: generated_unit_coordinates[{ordinal}] must be canonical [0,1) pair')
            continue
        word_pair = words[ordinal]
        if (not isinstance(word_pair, list) or len(word_pair) != 2
                or any(not uint32(word) for word in word_pair)):
            errors.append(f'{label}: generated_unit_u32[{ordinal}] must contain two canonical uint32 values')
            continue
        for coordinate in pair:
            # Units are declared as uint32/2^32. This checks the value encoding, not the RNG.
            if not float(coordinate * 4294967296).is_integer():
                errors.append(f'{label}: generated_unit_coordinates[{ordinal}] must lie on uint32/2^32 lattice')
                break
        if [word / 4294967296 for word in word_pair] != pair:
            errors.append(f'{label}: generated_unit_coordinates[{ordinal}] must equal generated_unit_u32/2^32')
    return errors


def validate_triangle_points_case(prefix: str, operation: dict, case: dict,
                                  input_validator: Draft202012Validator,
                                  output_validator: Draft202012Validator) -> list[str]:
    """Validate triangle-point fixture records without sampling or interpolation."""
    errors: list[str] = []
    case_id = case.get('id', '<invalid-id>')
    label = f'{prefix}/{case_id}'
    input_data = case.get('input')
    schema_errors = list(input_validator.iter_errors(input_data))
    finite_input = recursively_finite_numbers(input_data)
    has_error = 'error' in case
    error = case.get('error')
    if has_error and error != 'INVALID_INPUT':
        errors.append(f'{label}: triangle-point constructor fixture error must be INVALID_INPUT')
    if error == 'INVALID_INPUT':
        if not schema_errors and finite_input:
            errors.append(f'{label}: expected invalid schema or nonfinite input')
    elif not has_error:
        if schema_errors:
            errors.append(f'{label}: unexpected schema error')
        elif not finite_input:
            errors.append(f'{label}: successful input must have only finite numbers')

    if has_error:
        if error not in operation.get('errors', {}):
            errors.append(f'{label}: unknown error')
        for forbidden in ('output', 'comparison', 'points_bits_hex', 'generated_unit_coordinates',
                          'generated_unit_u32', 'error_detail'):
            if forbidden in case:
                errors.append(f'{label}: error case must omit {forbidden}')
        return errors

    if 'error_detail' in case:
        errors.append(f'{label}: successful case must omit error_detail')
    if 'output' not in case:
        return [*errors, f'{label}: triangle-points-output requires output']
    output = case.get('output')
    if not output_validator.is_valid(output):
        return [*errors, f'{label}: invalid triangle-point output schema']
    if not isinstance(output, dict) or not isinstance(output.get('points'), list):
        return [*errors, f'{label}: output points array is missing']
    points = output['points']
    count = triangle_input_count(operation.get('id'), input_data)
    if count is None:
        errors.append(f'{label}: successful input has no bounded point count')
    elif len(points) != count:
        errors.append(f'{label}: output points length must equal input point count')
    if any(not finite_canonical_pair(point) for point in points):
        errors.append(f'{label}: output points must be finite canonical coordinate pairs')
    vertices = triangle_vertices(input_data)
    if vertices is None:
        errors.append(f'{label}: successful input triangle is not a finite three-pair value')
    elif all(finite_canonical_pair(point) for point in points):
        for axis in range(2):
            low, high = min(vertex[axis] for vertex in vertices), max(vertex[axis] for vertex in vertices)
            if any(point[axis] < low or point[axis] > high for point in points):
                errors.append(f'{label}: output component {axis} lies outside closed vertex interval')
    if case.get('comparison') != {'mode': 'binary64-exact'}:
        errors.append(f'{label}: successful triangle-point case requires exact binary64 comparison')
    errors.extend(validate_triangle_points_bits(label, case, points))
    if operation.get('id') == TRIANGLE_SEEDED_ID and count is not None:
        errors.extend(validate_triangle_generated_units(label, case, count))
    elif operation.get('id') == TRIANGLE_MAPPED_ID:
        for forbidden in ('generated_unit_coordinates', 'generated_unit_u32'):
            if forbidden in case:
                errors.append(f'{label}: explicit mapping case must not declare {forbidden}')
    return errors


def validate_triangle_generator(root: Path, prefix: str, fixture: dict) -> list[str]:
    generator = fixture.get('generator')
    if not isinstance(generator, dict) or set(generator) != {'path', 'reference', 'sha256'}:
        return [f'{prefix}: triangle-point generator binding must contain path/reference/sha256']
    path = fixture_source(root, generator.get('path'))
    errors: list[str] = []
    if path is None or not path.is_file() or not hex_digest(generator.get('sha256')) or sha256_file(path) != generator['sha256']:
        errors.append(f'{prefix}: triangle-point generator source binding is stale or invalid')
    if not isinstance(generator.get('reference'), str) or not generator['reference'].strip():
        errors.append(f'{prefix}: triangle-point generator reference is missing')
    return errors


def validate_triangle_native_metadata(prefix: str, fixture: dict) -> list[str]:
    errors: list[str] = []
    native_only = fixture.get('native_only_cases')
    if (not isinstance(native_only, list) or not native_only
            or any(not isinstance(item, dict) or set(item) != {'id', 'description'}
                   or not isinstance(item.get('id'), str) or not item['id'].strip()
                   or not isinstance(item.get('description'), str) or not item['description'].strip()
                   for item in native_only)):
        errors.append(f'{prefix}: triangle-point native_only_cases must contain nonempty id/description records')
    elif len({item['id'] for item in native_only}) != len(native_only):
        errors.append(f'{prefix}: triangle-point native_only_cases ids must be unique')
    ownership = fixture.get('native_ownership_access_requirements')
    if (not isinstance(ownership, dict) or set(ownership) != {'status', 'requirements'}
            or not isinstance(ownership.get('status'), str) or not ownership['status'].strip()
            or not isinstance(ownership.get('requirements'), list) or not ownership['requirements']
            or any(not isinstance(item, str) or not item.strip() for item in ownership['requirements'])):
        errors.append(f'{prefix}: triangle-point native ownership/access requirements shape differs')
    return errors


def validate_triangle_seed_metadata(root: Path, prefix: str, fixture: dict) -> list[str]:
    """Bind five vectors to the existing shared CP3 fixture without executing xoshiro."""
    errors: list[str] = []
    provenance = fixture.get('rng_provenance')
    required = {'kind', 'shared_cp3_stream_evidence', 'shared_cp3_stream_evidence_sha256',
                'shared_cp3_fixture', 'shared_cp3_fixture_sha256',
                'draws_per_requested_replacement', 'draws_for_zero_replacements'}
    if not isinstance(provenance, dict) or set(provenance) != required:
        return [f'{prefix}: triangle seeded rng_provenance shape differs']
    if provenance.get('kind') != 'private-xoshiro128starstar-1-1':
        errors.append(f'{prefix}: triangle seeded rng kind must be private-xoshiro128starstar-1-1')
    for path_key, hash_key in (('shared_cp3_stream_evidence', 'shared_cp3_stream_evidence_sha256'),
                               ('shared_cp3_fixture', 'shared_cp3_fixture_sha256')):
        path = fixture_source(root, provenance.get(path_key))
        digest = provenance.get(hash_key)
        if path is None or not path.is_file() or not hex_digest(digest) or sha256_file(path) != digest:
            errors.append(f'{prefix}: triangle seeded {path_key} binding is stale or invalid')
    if (not finite_canonical_integral(provenance.get('draws_per_requested_replacement'))
            or provenance.get('draws_per_requested_replacement') != 2
            or not finite_canonical_integral(provenance.get('draws_for_zero_replacements'))
            or provenance.get('draws_for_zero_replacements') != 0):
        errors.append(f'{prefix}: triangle seeded draws must be exactly two per point and zero for empty output')
    vectors = fixture.get('seed_vectors')
    errors.extend(validate_circle_seed_vectors(prefix, fixture))
    expected_seeds = {0, 1, 42, 0x80000000, 0xffffffff}
    if not isinstance(vectors, list) or len(vectors) != len(expected_seeds):
        errors.append(f'{prefix}: triangle seeded fixture requires five shared seed vectors')
        return errors
    if {item.get('seed') for item in vectors if isinstance(item, dict)} != expected_seeds:
        errors.append(f'{prefix}: triangle seeded vectors must use standard seeds0/1/42/high-bit/max')
    shared_path = fixture_source(root, provenance.get('shared_cp3_fixture'))
    if shared_path is not None and shared_path.is_file():
        try:
            shared = load_ledger(shared_path)
        except Exception:
            errors.append(f'{prefix}: shared CP3 fixture is not readable JSON')
        else:
            if vectors != shared.get('seed_vectors'):
                errors.append(f'{prefix}: triangle seed_vectors must exactly equal shared CP3 seed vectors')
    return errors


def validate_triangle_mapping_provenance(prefix: str, fixture: dict) -> list[str]:
    provenance = fixture.get('mapping_provenance')
    if (not isinstance(provenance, dict) or set(provenance) != {'arithmetic', 'draws_per_pair', 'sqrt_scope'}
            or not isinstance(provenance.get('arithmetic'), str) or not provenance['arithmetic'].strip()
            or not finite_canonical_integral(provenance.get('draws_per_pair'))
            or provenance['draws_per_pair'] != 0
            or not isinstance(provenance.get('sqrt_scope'), str) or not provenance['sqrt_scope'].strip()):
        return [f'{prefix}: explicit mapping provenance must declare arithmetic, zero draws_per_pair and sqrt_scope']
    return []


def validate_triangle_metadata(root: Path, prefix: str, operation: dict, fixture: dict) -> list[str]:
    seeded = operation.get('id') == TRIANGLE_SEEDED_ID
    required = {'operation', 'version', 'fixture_format', 'fixture_status', 'catalog_sha256',
                'generator', 'cases', 'cross_case_checks', 'native_only_cases',
                'native_ownership_access_requirements'}
    if seeded:
        required |= {'rng_provenance', 'seed_vectors'}
    else:
        required |= {'mapping_provenance'}
    errors: list[str] = []
    if set(fixture) != required:
        errors.append(f'{prefix}: triangle-point fixture top-level shape differs')
    if fixture.get('fixture_format') != TRIANGLE_POINTS_OUTPUT:
        errors.append(f'{prefix}: triangle-point fixture_format must be triangle-points-output')
    if not isinstance(fixture.get('fixture_status'), str) or not fixture['fixture_status'].strip():
        errors.append(f'{prefix}: triangle-point fixture_status must be nonempty neutral status')
    if not hex_digest(fixture.get('catalog_sha256')):
        errors.append(f'{prefix}: triangle-point fixture requires catalog_sha256')
    errors.extend(validate_triangle_generator(root, prefix, fixture))
    errors.extend(validate_triangle_native_metadata(prefix, fixture))
    if seeded:
        errors.extend(validate_triangle_seed_metadata(root, prefix, fixture))
    else:
        errors.extend(validate_triangle_mapping_provenance(prefix, fixture))
    return errors


def triangle_success_cases(fixture: dict) -> dict[str, dict]:
    cases = fixture.get('cases')
    if not isinstance(cases, list):
        return {}
    return {case['id']: case for case in cases if isinstance(case, dict)
            and isinstance(case.get('id'), str) and case.get('id').strip()
            and 'error' not in case}


def _same_point_bits(left: dict, right: dict) -> bool:
    return (left.get('output', {}).get('points') == right.get('output', {}).get('points')
            and left.get('points_bits_hex') == right.get('points_bits_hex'))


def validate_triangle_cross_checks(root: Path, prefix: str, operation: dict, fixture: dict) -> list[str]:
    """Resolve actual prefix/equivalence records; never calculate a point or RNG word."""
    errors: list[str] = []
    checks = fixture.get('cross_case_checks')
    if not isinstance(checks, list):
        return [f'{prefix}: triangle-point cross_case_checks must be a list']
    if operation.get('id') == TRIANGLE_MAPPED_ID:
        if checks:
            return [f'{prefix}: explicit mapping fixture must not carry cross_case_checks']
        return errors
    if not checks:
        return [f'{prefix}: seeded triangle fixture requires prefix and mapping-equivalence checks']
    cases = triangle_success_cases(fixture)
    kinds: set[str] = set()
    ids: list[str] = []
    for ordinal, item in enumerate(checks):
        label = f'{prefix}/cross_case_checks[{ordinal}]'
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not item['id'].strip():
            errors.append(f'{label}: check id must be nonempty')
            continue
        ids.append(item['id']); kind = item.get('kind'); kinds.add(kind if isinstance(kind, str) else '')
        if kind == 'raw-binary64-prefix':
            if set(item) != {'id', 'kind', 'prefix_case', 'extended_case'}:
                errors.append(f'{label}: raw-binary64-prefix shape differs'); continue
            short, longer = cases.get(item.get('prefix_case')), cases.get(item.get('extended_case'))
            if short is None or longer is None:
                errors.append(f'{label}: prefix references unknown successful case'); continue
            short_input, long_input = short.get('input'), longer.get('input')
            short_count, long_count = triangle_input_count(TRIANGLE_SEEDED_ID, short_input), triangle_input_count(TRIANGLE_SEEDED_ID, long_input)
            if short_count is None or long_count is None or short_count >= long_count:
                errors.append(f'{label}: prefix counts must increase'); continue
            if ({key: value for key, value in short_input.items() if key != 'count'}
                    != {key: value for key, value in long_input.items() if key != 'count'}):
                errors.append(f'{label}: prefix inputs must match except count')
            for field in ('generated_unit_coordinates', 'generated_unit_u32'):
                short_values, long_values = short.get(field), longer.get(field)
                if not isinstance(short_values, list) or not isinstance(long_values, list) or long_values[:short_count] != short_values:
                    errors.append(f'{label}: prefix generated unit coordinates must match by value')
            short_points = short.get('output', {}).get('points') if isinstance(short.get('output'), dict) else None
            long_points = longer.get('output', {}).get('points') if isinstance(longer.get('output'), dict) else None
            short_bits, long_bits = short.get('points_bits_hex'), longer.get('points_bits_hex')
            if not isinstance(short_points, list) or not isinstance(long_points, list) or long_points[:short_count] != short_points:
                errors.append(f'{label}: prefix output points must match by value')
            if not isinstance(short_bits, list) or not isinstance(long_bits, list) or long_bits[:short_count] != short_bits:
                errors.append(f'{label}: prefix output point bits must match')
        elif kind == 'seeded-output-equals-explicit-map':
            expected = {'id', 'kind', 'seeded_case', 'mapping_fixture', 'mapping_case'}
            if set(item) != expected:
                errors.append(f'{label}: seeded-output-equals-explicit-map shape differs'); continue
            seeded_case = cases.get(item.get('seeded_case'))
            target_path = fixture_source(root, item.get('mapping_fixture'))
            if seeded_case is None:
                errors.append(f'{label}: equivalence references unknown seeded successful case'); continue
            if target_path is None or not target_path.is_file():
                errors.append(f'{label}: equivalence mapping fixture is missing or outside repository'); continue
            try:
                mapping_fixture = load_ledger(target_path)
            except Exception:
                errors.append(f'{label}: equivalence mapping fixture is not readable JSON'); continue
            if mapping_fixture.get('operation') != TRIANGLE_MAPPED_ID:
                errors.append(f'{label}: equivalence mapping fixture has wrong operation')
            mapped_case = triangle_success_cases(mapping_fixture).get(item.get('mapping_case'))
            if mapped_case is None:
                errors.append(f'{label}: equivalence references unknown mapping successful case'); continue
            seeded_input, mapped_input = seeded_case.get('input'), mapped_case.get('input')
            generated = seeded_case.get('generated_unit_coordinates')
            if not isinstance(seeded_input, dict) or not isinstance(mapped_input, dict):
                errors.append(f'{label}: equivalence cases require object inputs')
            elif seeded_input.get('triangle') != mapped_input.get('triangle'):
                errors.append(f'{label}: equivalence triangle inputs must match')
            elif mapped_input.get('unitCoordinates') != generated:
                errors.append(f'{label}: equivalence explicit unitCoordinates must equal seeded generated units')
            if not _same_point_bits(seeded_case, mapped_case):
                errors.append(f'{label}: seeded/mapped outputs must be exactly equal by values and bits')
        else:
            errors.append(f'{label}: unknown triangle-point cross-case check kind')
    if len(ids) != len(checks) or len(set(ids)) != len(ids):
        errors.append(f'{prefix}: triangle-point cross_case_checks ids must be nonempty and unique')
    if not {'raw-binary64-prefix', 'seeded-output-equals-explicit-map'}.issubset(kinds):
        errors.append(f'{prefix}: seeded triangle fixture requires meaningful prefix and explicit-map equivalence checks')
    return errors


def fixture_source(root: Path, value: object) -> Path | None:
    if not isinstance(value, str) or not value.strip():
        return None
    candidate = (root / value).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def validate_materialized_extensions(root: Path, prefix: str, fixture: dict,
                                     input_validator: Draft202012Validator,
                                     success_cases: dict[str, dict]) -> list[str]:
    """Validate optional sparse long path records and cross-case raw-prefix metadata."""
    errors: list[str] = []
    has_long_extension = 'long_cases' in fixture or 'long_cases_source' in fixture
    if has_long_extension:
        source = fixture.get('long_cases_source')
        if not isinstance(source, dict):
            errors.append(f'{prefix}: long_cases requires long_cases_source object')
        else:
            source_path = fixture_source(root, source.get('path'))
            source_sha = source.get('sha256')
            if source_path is None or not source_path.is_file():
                errors.append(f'{prefix}: long_cases source path is missing or outside repository')
            elif not isinstance(source_sha, str) or hashlib.sha256(source_path.read_bytes()).hexdigest() != source_sha:
                errors.append(f'{prefix}: long_cases source sha256 is stale or invalid')
        long_cases = fixture.get('long_cases')
        if not isinstance(long_cases, list) or not long_cases:
            errors.append(f'{prefix}: long_cases must be a nonempty list when long_cases_source is present')
            long_cases = []
        ids = [case.get('id') for case in long_cases if isinstance(case, dict)]
        if (len(ids) != len(long_cases) or any(not isinstance(case_id, str) or not case_id.strip()
                                                for case_id in ids) or len(set(ids)) != len(ids)):
            errors.append(f'{prefix}: long case ids must be nonempty and unique')
        for ordinal, case in enumerate(long_cases):
            label = f'{prefix}/long[{ordinal}]'
            if not isinstance(case, dict):
                errors.append(f'{label}: long case must be an object')
                continue
            case_id = case.get('id')
            if isinstance(case_id, str) and case_id.strip():
                label = f'{prefix}/{case_id}'
            input_data = case.get('input')
            if not input_validator.is_valid(input_data):
                errors.append(f'{label}: long case input violates input schema')
                continue
            if not isinstance(input_data, dict):
                errors.append(f'{label}: long case input must be an object')
                continue
            steps = input_data.get('steps')
            start = input_data.get('start')
            if not finite_integral_number(steps) or int(steps) < 0:
                errors.append(f'{label}: long case steps must be a finite nonnegative integral number')
                continue
            count = int(steps)
            if not finite_position(start):
                errors.append(f'{label}: long case requires finite two-coordinate start')
                continue
            comparison = case.get('comparison')
            if not isinstance(comparison, dict):
                errors.append(f'{label}: long case requires comparison metadata')
            else:
                for key in ('positions_abs', 'headings_abs'):
                    if not finite_nonnegative_number(comparison.get(key)):
                        errors.append(f'{label}: invalid long comparison {key}')
            selected = case.get('selected')
            if not isinstance(selected, list) or not selected:
                errors.append(f'{label}: long case requires nonempty sparse selected records')
                continue
            point_indices: list[int] = []
            for selected_ordinal, record in enumerate(selected):
                selected_label = f'{label}: selected[{selected_ordinal}]'
                if not isinstance(record, dict):
                    errors.append(f'{selected_label} must be an object')
                    continue
                point_index = record.get('pointIndex')
                if not finite_integral_number(point_index):
                    errors.append(f'{selected_label}: pointIndex must be finite integral')
                    continue
                point_index = int(point_index)
                if point_index < 0 or point_index > count:
                    errors.append(f'{selected_label}: pointIndex outside 0..steps')
                point_indices.append(point_index)
                if not finite_position(record.get('position')):
                    errors.append(f'{selected_label}: position must be a finite coordinate pair')
                if point_index:
                    if record.get('headingIndex') != point_index - 1:
                        errors.append(f'{selected_label}: headingIndex must equal pointIndex-1')
                    if not finite_number(record.get('heading')):
                        errors.append(f'{selected_label}: noninitial sparse point requires finite heading')
            if point_indices:
                if point_indices != sorted(point_indices) or len(set(point_indices)) != len(point_indices):
                    errors.append(f'{label}: sparse pointIndex values must be strictly increasing')
                if point_indices[0] != 0:
                    errors.append(f'{label}: sparse records must begin at pointIndex 0')
                if point_indices[-1] != count:
                    errors.append(f'{label}: sparse records must end at pointIndex steps')
                initial = selected[0] if isinstance(selected[0], dict) else {}
                position = initial.get('position') if isinstance(initial, dict) else None
                if finite_position(position) and [canonical_zero(value) for value in position] != [canonical_zero(value) for value in start]:
                    errors.append(f'{label}: initial sparse position must equal canonical start')
                if count > 1 and not any(0 < point_index < count for point_index in point_indices):
                    errors.append(f'{label}: steps>1 requires an intermediate sparse point')
    if 'cross_case_checks' in fixture:
        checks = fixture.get('cross_case_checks')
        if not isinstance(checks, list):
            errors.append(f'{prefix}: cross_case_checks must be a list')
            checks = []
        check_ids = [item.get('id') for item in checks if isinstance(item, dict)]
        if (len(check_ids) != len(checks) or any(not isinstance(item_id, str) or not item_id.strip()
                                                 for item_id in check_ids) or len(set(check_ids)) != len(check_ids)):
            errors.append(f'{prefix}: cross_case check ids must be nonempty and unique')
        for ordinal, item in enumerate(checks):
            label = f'{prefix}/cross_case[{ordinal}]'
            if not isinstance(item, dict):
                errors.append(f'{label} must be an object')
                continue
            if isinstance(item.get('id'), str) and item['id'].strip():
                label = f'{prefix}/{item["id"]}'
            if item.get('kind') != 'raw-binary64-prefix':
                errors.append(f'{label}: unknown cross-case check kind')
                continue
            prefix_id = item.get('prefix_case')
            extended_id = item.get('extended_case')
            if not isinstance(prefix_id, str) or not isinstance(extended_id, str):
                errors.append(f'{label}: raw prefix check requires prefix_case and extended_case')
                continue
            prefix_case = success_cases.get(prefix_id)
            extended_case = success_cases.get(extended_id)
            if prefix_case is None or extended_case is None:
                errors.append(f'{label}: raw prefix check references unknown successful case')
                continue
            prefix_input = prefix_case.get('input')
            extended_input = extended_case.get('input')
            if not isinstance(prefix_input, dict) or not isinstance(extended_input, dict):
                errors.append(f'{label}: raw prefix cases require object inputs')
                continue
            prefix_steps = prefix_input.get('steps')
            extended_steps = extended_input.get('steps')
            if not finite_integral_number(prefix_steps) or not finite_integral_number(extended_steps) or int(prefix_steps) >= int(extended_steps):
                errors.append(f'{label}: raw prefix case counts must be increasing finite integers')
            without_steps = lambda value: {key: item for key, item in value.items() if key != 'steps'}
            if without_steps(prefix_input) != without_steps(extended_input):
                errors.append(f'{label}: raw prefix case inputs must match except steps')
    return errors


def reference(operations: list[dict], attestations: dict[str, dict]) -> str:
    lines = ['# Operation reference', '', '<!-- Generated by tools/check_catalog.py --write-reference; do not edit. -->', '',
             'Contracts describe intended behavior. Implementation and native/reproduction evidence are separate.', '']
    for op in operations:
        lines += [f"## {op['id']} ({op['version']})", '', op['description'], '', f"Contract status: {op['status']}.", '',
                  '```json', json.dumps(op['input_schema'], indent=2), '```', '',
                  '| parameter | unit | default | encouraged range | evidence |', '|---|---|---|---|---|']
        for name, value in op['parameters'].items():
            lines.append(f"| {name} | {value['unit']} | {json.dumps(value['default'])} | {json.dumps(value['encouraged_range'])} | {value['evidence']} |")
        if 'query_schema' in op:
            lines += ['', 'Query input (native call forms are specified in the contract):', '',
                      '```json', json.dumps(op['query_schema'], indent=2), '```', '',
                      'Query result:', '', '```json', json.dumps(op['query_output_schema'], indent=2), '```']
        lines += ['', '`null` means no default or encouraged range is approved.', '',
                  'Current implementation status comes from a separately reviewed attestation, not this immutable contract.', '',
                  '| target | core | native integration | technique | evidence scope |', '|---|---|---|---|---|']
        attestation = attestations.get(op['_file'])
        for target in op['targets']:
            dimensions = attestation['targets'][target] if attestation is not None else None
            displayed = [display_dimension(dimensions[dimension] if dimensions is not None else None)
                         for dimension in ('core', 'native', 'technique')]
            cells = [f"[{label}](../../{path})" if path is not None else label for label, path in displayed]
            scope_path = next((path for _, path in (displayed[1], displayed[2], displayed[0]) if path is not None), None)
            scope = f"[review](../../{scope_path})" if scope_path is not None else 'not attested'
            lines.append(f"| {target} | {cells[0]} | {cells[1]} | {cells[2]} | {scope} |")
        lines += ['', 'Motivating evidence:', '']
        for item in op['provenance']:
            lines.append(f"- [`{item['candidate_id']}`](../../{item['notes_path']})")
        lines += ['', f"Full behavioral contract: [catalog](../../catalog/operations/{op['_file']}).", '']
    return '\n'.join(lines)


def check(root: Path = ROOT, *, write_reference: bool = False) -> list[str]:
    errors = []
    if (root / 'catalog/drawing').is_dir():
        from tools.check_drawing_catalog import check as check_drawing
        errors.extend(check_drawing(root))
    ledger = load_ledger(root / 'design/phase2/cluster-decisions.json')
    operations = []
    identities = set()
    for path in sorted((root / 'catalog/operations').glob('*.json')):
        op = load_ledger(path)
        prefix = path.name
        required = {'id', 'version', 'status', 'role', 'decision_cluster', 'provenance', 'input_schema',
                    'output_schema', 'behavior', 'errors', 'parameters',
                    'targets', 'fixtures', 'reproduction', 'review', 'capability_decision', 'design_review', 'description'}
        if missing := required - op.keys():
            errors.append(f'{prefix}: missing contract fields {sorted(missing)}')
            continue
        if op['id'] in identities:
            errors.append(f"{prefix}: duplicate operation {op['id']}")
        identities.add(op['id'])
        if op['status'] != 'reviewed' or op['role'] not in {'generator', 'transform', 'sink'}:
            errors.append(f'{prefix}: requires reviewed contract and valid role')
        if not isinstance(op['targets'], dict) or set(op['targets']) != {'processing-java', 'p5js', 'py5', 'processing-android'}:
            errors.append(f'{prefix}: targets must use the four canonical platform identifiers')
            continue
        errors.extend(validate(ledger, root / 'data/corpus.sqlite', root / 'survey', contract_cluster=op['decision_cluster']))
        invalid_schema = False
        for key in ('input_schema', 'output_schema', 'access_schema', 'point_schema',
                    'query_schema', 'query_output_schema'):
            if key not in op:
                continue
            try:
                Draft202012Validator.check_schema(op[key])
            except Exception as exc:
                errors.append(f'{prefix}: invalid {key}: {exc}')
                invalid_schema = True
        if invalid_schema:
            continue
        for key in ('capability_decision', 'design_review'):
            if not (root / op[key]).is_file():
                errors.append(f'{prefix}: missing {key}')
        cluster = next((item for item in ledger.get('clusters', [])
                        if item.get('id') == op['decision_cluster']), None)
        if cluster is not None and cluster.get('admission_kind') == CAPABILITY_DEPENDENCY_ADMISSION:
            admission = cluster.get('dependency_admission', {})
            decision = admission.get('decision') if isinstance(admission, dict) else None
            if not isinstance(decision, str) or not (root / decision).is_file():
                errors.append(f'{prefix}: missing dependency admission decision {decision!r}')
            motivating = admission.get('motivating_candidates', []) if isinstance(admission, dict) else []
            declared = {}
            for item in motivating:
                if not isinstance(item, dict) or not isinstance(item.get('candidate_id'), str):
                    continue
                candidate_id = item['candidate_id']
                if candidate_id in declared:
                    errors.append(f'{prefix}: duplicate declared motivating candidate {candidate_id}')
                declared[candidate_id] = item
            provided = set()
            for item in op['provenance']:
                candidate_id = item.get('candidate_id') if isinstance(item, dict) else None
                if not isinstance(candidate_id, str):
                    errors.append(f'{prefix}: provenance candidate_id must be a string')
                    continue
                if candidate_id in provided:
                    errors.append(f'{prefix}: duplicate provenance candidate {candidate_id}')
                provided.add(candidate_id)
                candidate = ledger['records'].get(candidate_id, {})
                declaration = declared.get(candidate_id)
                if declaration is None:
                    errors.append(f'{prefix}: provenance is not declared motivating candidate: {candidate_id}')
                    continue
                if declaration.get('source_sha256') != candidate.get('source_sha256'):
                    errors.append(f'{prefix}: stale source for {candidate_id}')
                if declaration.get('evidence_sha256') != candidate.get('evidence_sha256'):
                    errors.append(f'{prefix}: stale declared evidence for {candidate_id}')
                note_path = item.get('notes_path')
                normalized_note_path = (note_path.removeprefix('survey/')
                                        if isinstance(note_path, str) else None)
                if normalized_note_path != candidate.get('notes_path'):
                    errors.append(f'{prefix}: provenance notes path differs for {candidate_id}')
                note = root / note_path if isinstance(note_path, str) else None
                if (note is None or not note.is_file()
                        or item.get('note_sha256') != candidate.get('source_sha256')
                        or hashlib.sha256(note.read_bytes()).hexdigest() != item.get('note_sha256')):
                    errors.append(f"{prefix}: stale note {note_path}")
                if item.get('evidence_sha256') != candidate.get('evidence_sha256'):
                    errors.append(f"{prefix}: stale evidence for {candidate_id}")
            if set(declared) != provided:
                errors.append(f'{prefix}: provenance must include every declared motivating candidate')
        else:
            for item in op['provenance']:
                candidate = ledger['records'].get(item['candidate_id'], {})
                if candidate.get('cluster_id') != op['decision_cluster'] or candidate.get('disposition') not in {'keep', 'merge'}:
                    errors.append(f"{prefix}: provenance is not accepted member: {item['candidate_id']}")
                note = root / item['notes_path']
                if not note.is_file() or hashlib.sha256(note.read_bytes()).hexdigest() != item['note_sha256']:
                    errors.append(f"{prefix}: stale note {item['notes_path']}")
                if item['evidence_sha256'] != candidate.get('evidence_sha256'):
                    errors.append(f"{prefix}: stale evidence for {item['candidate_id']}")
            accepted = {k for k, r in ledger['records'].items() if r.get('cluster_id') == op['decision_cluster'] and r['disposition'] in {'keep', 'merge'}}
            if accepted != {r['candidate_id'] for r in op['provenance']}:
                errors.append(f'{prefix}: provenance must include every accepted member')
        fixture_path = root / op['fixtures']
        if not fixture_path.is_file():
            errors.append(f'{prefix}: missing fixtures')
            continue
        fixture = load_ledger(fixture_path)
        if (fixture.get('operation'), fixture.get('version')) != (op['id'], op['version']):
            errors.append(f'{prefix}: fixture identity/version mismatch')
        if 'catalog_sha256' in fixture:
            expected_sha = fixture.get('catalog_sha256')
            actual_sha = hashlib.sha256(path.read_bytes()).hexdigest()
            if not isinstance(expected_sha, str) or expected_sha != actual_sha:
                errors.append(f'{prefix}: fixture catalog_sha256 is stale or invalid')
        cases = fixture.get('cases', [])
        if not isinstance(cases, list) or not cases:
            errors.append(f'{prefix}: empty fixtures')
            continue
        input_validator = Draft202012Validator(op['input_schema'])
        output_validator = Draft202012Validator(op['output_schema'])
        fixture_format = op.get('fixture_format')
        if fixture_format is not None and fixture_format not in {EXACT_JSON_OUTPUT, MATERIALIZED_OUTPUT, CIRCLE_PLACEMENT_OUTPUT, PARTITION_OUTPUT, TRIANGLE_POINTS_OUTPUT, BRANCH_TREE_OUTPUT, RADIAL_PROFILE_OUTPUT, ANNULAR_SOLID_OUTPUT, "segment-clipping-output", DELAUNAY_OUTPUT, SPRING_OUTPUT}:
            errors.append(f'{prefix}: unknown fixture_format {fixture_format!r}')
        if fixture_format == BRANCH_TREE_OUTPUT:
            from tools.check_branch_fixtures import validate as validate_branch_fixtures
            if op.get('id') != 'topology.seeded-endpoint-branches-2d':
                errors.append(f'{prefix}: branch-tree-output requires the endpoint-branch operation')
            errors.extend(validate_branch_fixtures(root, prefix, op, fixture))
        if fixture_format == RADIAL_PROFILE_OUTPUT:
            from tools.check_profile_fixtures import validate as validate_profile_fixtures
            errors.extend(validate_profile_fixtures(root, prefix, op, fixture))
        if fixture_format == "segment-clipping-output":
            from tools.check_segment_clipping_fixtures import validate as validate_segment_clipping
            errors.extend(validate_segment_clipping(root, prefix, op, fixture))
        if fixture_format == ANNULAR_SOLID_OUTPUT:
            from tools.check_annular_fixtures import validate as validate_annular_fixtures
            errors.extend(validate_annular_fixtures(root, prefix, op, fixture))
        if fixture_format == DELAUNAY_OUTPUT:
            from tools.check_delaunay_fixtures import validate as validate_delaunay_fixtures
            errors.extend(validate_delaunay_fixtures(root, prefix, op, fixture))
        if fixture_format == SPRING_OUTPUT:
            from tools.check_spring_fixtures import validate as validate_spring_fixtures
            errors.extend(validate_spring_fixtures(root, prefix, op, fixture))
        exact_json_output = fixture_format == EXACT_JSON_OUTPUT
        if exact_json_output and fixture.get("comparison") != "exact":
            errors.append(f"{prefix}: exact-json-output requires comparison=exact")
        materialized_output = fixture_format == MATERIALIZED_OUTPUT
        circle_placement_output = fixture_format == CIRCLE_PLACEMENT_OUTPUT
        partition_output = fixture_format == PARTITION_OUTPUT
        triangle_points_output = fixture_format == TRIANGLE_POINTS_OUTPUT
        if circle_placement_output:
            if op.get('id') not in CIRCLE_PLACEMENT_IDS:
                errors.append(f'{prefix}: circle-placement-output is only valid for the two CP3 placement contracts')
            errors.extend(validate_circle_shared_output(root, prefix, op))
            errors.extend(validate_circle_placement_metadata(root, prefix, op, fixture, input_validator))
        if partition_output:
            if op.get('id') != PARTITION_ID:
                errors.append(f'{prefix}: partition-output is only valid for {PARTITION_ID}')
            invariants = op.get('output_invariants')
            if not isinstance(invariants, str) or not invariants.strip():
                errors.append(f'{prefix}: partition-output requires output_invariants')
            errors.extend(validate_partition_metadata(root, prefix, fixture))
        if triangle_points_output:
            if op.get('id') not in TRIANGLE_POINT_IDS:
                errors.append(f'{prefix}: triangle-points-output is only valid for the two CP5 triangle-point contracts')
            invariants = op.get('output_invariants')
            if not isinstance(invariants, str) or not invariants.strip():
                errors.append(f'{prefix}: triangle-points-output requires output_invariants')
            errors.extend(validate_triangle_metadata(root, prefix, op, fixture))
        if materialized_output:
            invariants = op.get('output_invariants')
            if not isinstance(invariants, str) or not invariants.strip():
                errors.append(f'{prefix}: materialized-output requires output_invariants')
            if 'comparison' in fixture:
                errors.append(f'{prefix}: materialized-output comparison must be per successful case')
        point_validator = Draft202012Validator(op['point_schema']) if 'point_schema' in op else None
        query_schema = op.get('query_schema')
        query_output_schema = op.get('query_output_schema')
        if (query_schema is None) != (query_output_schema is None):
            errors.append(f'{prefix}: query_schema and query_output_schema must be declared together')
        query_validator = Draft202012Validator(query_schema) if query_schema is not None else None
        query_output_validator = (Draft202012Validator(query_output_schema)
                                  if query_output_schema is not None else None)
        case_ids = [case.get('id') for case in cases if isinstance(case, dict)]
        if (len(case_ids) != len(cases) or any(not isinstance(case_id, str) or not case_id.strip()
                                               for case_id in case_ids)
                or len(set(case_ids)) != len(case_ids)):
            errors.append(f'{prefix}: fixture case ids must be nonempty and unique')
        if materialized_output:
            successful_cases = {case['id']: case for case in cases
                                if isinstance(case, dict) and isinstance(case.get('id'), str)
                                and case.get('error') is None}
            errors.extend(validate_materialized_extensions(root, prefix, fixture,
                                                           input_validator, successful_cases))
        if partition_output:
            errors.extend(validate_partition_cross_checks(prefix, fixture))
        if triangle_points_output:
            errors.extend(validate_triangle_cross_checks(root, prefix, op, fixture))
        for case in cases:
            if fixture_format in {BRANCH_TREE_OUTPUT, RADIAL_PROFILE_OUTPUT, ANNULAR_SOLID_OUTPUT, "segment-clipping-output", DELAUNAY_OUTPUT, SPRING_OUTPUT}:
                # The dedicated validator handles complete cases and retained topology.
                continue
            if not isinstance(case, dict):
                errors.append(f'{prefix}: fixture case must be an object')
                continue
            if circle_placement_output:
                errors.extend(validate_circle_placement_case(prefix, op, case, input_validator, output_validator))
                continue
            if partition_output:
                errors.extend(validate_partition_output_case(prefix, op, case, input_validator, output_validator))
                if case.get('error') is None:
                    errors.extend(validate_partition_success_metadata(prefix, case))
                continue
            if triangle_points_output:
                errors.extend(validate_triangle_points_case(prefix, op, case, input_validator, output_validator))
                continue
            schema_errors = list(input_validator.iter_errors(case.get('input')))
            if case.get('error') == 'INVALID_INPUT':
                if not schema_errors and not exact_json_output:
                    errors.append(f"{prefix}/{case['id']}: expected invalid schema input")
            elif schema_errors:
                errors.append(f"{prefix}/{case['id']}: unexpected schema error")
            if case.get('error') and case['error'] not in op['errors']:
                errors.append(f"{prefix}/{case['id']}: unknown error")
            if exact_json_output:
                # INVALID_INPUT can express a cross-field/domain error that JSON
                # Schema cannot encode. This validates fixture structure, not its
                # expected computation; native conformance checks that separately.
                if 'error' in case:
                    if 'output' in case:
                        errors.append(f"{prefix}/{case['id']}: error case must omit output")
                elif ('output' not in case or not output_validator.is_valid(case['output'])
                      or not recursively_finite_numbers(case['output'])):
                    errors.append(f"{prefix}/{case['id']}: invalid exact JSON output")
                if 'comparison' in case:
                    errors.append(f"{prefix}/{case['id']}: exact JSON cases inherit the exact comparison")
            if materialized_output:
                if 'error' in case:
                    if 'output' in case:
                        errors.append(f"{prefix}/{case['id']}: error case must omit output")
                    if 'comparison' in case:
                        errors.append(f"{prefix}/{case['id']}: error case must omit comparison")
                else:
                    if 'output' not in case:
                        errors.append(f"{prefix}/{case['id']}: materialized-output requires output")
                    else:
                        output = case['output']
                        if not output_validator.is_valid(output):
                            errors.append(f"{prefix}/{case['id']}: invalid materialized output")
                        elif not finite_trace_output(output):
                            errors.append(f"{prefix}/{case['id']}: materialized output numbers must be finite")
                        elif isinstance(output, dict):
                            steps = case.get('input', {}).get('steps') if isinstance(case.get('input'), dict) else None
                            positions = output.get('positions')
                            headings = output.get('headings')
                            if finite_integral_number(steps):
                                count = int(steps)
                                if isinstance(positions, list) and len(positions) != count + 1:
                                    errors.append(f"{prefix}/{case['id']}: positions length must equal steps+1")
                                if isinstance(headings, list) and len(headings) != count:
                                    errors.append(f"{prefix}/{case['id']}: headings length must equal steps")
                    comparison = case.get('comparison')
                    if not isinstance(comparison, dict):
                        errors.append(f"{prefix}/{case['id']}: materialized-output requires comparison metadata")
                    else:
                        for key in ('positions_abs', 'headings_abs'):
                            if not finite_nonnegative_number(comparison.get(key)):
                                errors.append(f"{prefix}/{case['id']}: invalid comparison {key}")
            elif 'error' not in case and point_validator is not None:
                if len(case['indices']) != len(case['points']):
                    errors.append(f"{prefix}/{case['id']}: point/query count mismatch")
                for point in case['points']:
                    if not point_validator.is_valid(point):
                        errors.append(f"{prefix}/{case['id']}: invalid point output")
            if query_validator is not None and 'error' not in case:
                queries = case.get('queries')
                if not isinstance(queries, list) or not queries:
                    errors.append(f"{prefix}/{case['id']}: requires nonempty queries")
                else:
                    for ordinal, query in enumerate(queries):
                        query_prefix = f"{prefix}/{case['id']}: query[{ordinal}]"
                        if not isinstance(query, dict):
                            errors.append(f'{query_prefix} must be an object')
                            continue
                        if not query_validator.is_valid(query.get('input')):
                            errors.append(f'{query_prefix}: invalid query input')
                        if not query_output_validator.is_valid(query.get('output')):
                            errors.append(f'{query_prefix}: invalid query output')
                serialized = case.get('serialized')
                if not output_validator.is_valid(serialized):
                    errors.append(f"{prefix}/{case['id']}: invalid serialized descriptor")
        query_cases = fixture.get('query_cases', [])
        if query_cases and query_validator is None:
            errors.append(f'{prefix}: query_cases require query schemas')
        if query_validator is not None:
            if not isinstance(query_cases, list):
                errors.append(f'{prefix}: query_cases must be a list')
                query_cases = []
            query_case_ids = [case.get('id') for case in query_cases if isinstance(case, dict)]
            if (len(query_case_ids) != len(query_cases)
                    or any(not isinstance(case_id, str) or not case_id.strip() for case_id in query_case_ids)
                    or len(set(query_case_ids)) != len(query_case_ids)):
                errors.append(f'{prefix}: query fixture ids must be nonempty and unique')
            for query_case in query_cases:
                if not isinstance(query_case, dict):
                    errors.append(f'{prefix}: query fixture must be an object')
                    continue
                query_prefix = f"{prefix}/{query_case['id']}"
                schema_errors = list(query_validator.iter_errors(query_case.get('input')))
                if query_case.get('error') == 'INVALID_QUERY':
                    if not schema_errors:
                        errors.append(f'{query_prefix}: expected invalid query schema input')
                elif schema_errors:
                    errors.append(f'{query_prefix}: unexpected query schema error')
                if query_case.get('error') not in op['errors']:
                    errors.append(f'{query_prefix}: unknown query error')
        if not op['behavior'] or not op['review'].get('owner') or not op['review'].get('reviewer'):
            errors.append(f'{prefix}: missing semantic/review content')
        op['_file'] = path.name
        operations.append(op)
    if not operations:
        errors.append('no operations')
    attestation_errors, attestations = load_attestations(root, operations)
    errors.extend(attestation_errors)
    if errors:
        return errors
    expected = reference(operations, attestations)
    target = root / REFERENCE
    if write_reference:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(expected)
    elif not target.is_file() or target.read_text() != expected:
        errors.append('generated operation reference is missing or stale; run --write-reference')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-reference', action='store_true')
    args = parser.parse_args()
    errors = check(write_reference=args.write_reference)
    if errors:
        print('\n'.join(errors))
        return 1
    print('Catalog schemas, source bindings, fixtures and generated reference valid; runtime conformance is separate.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
