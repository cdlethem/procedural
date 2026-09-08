#!/usr/bin/env python3
"""CP6 shared fixture oracle; imports no public target implementation.

The frozen CP5 fixture helper supplies the deliberately identical scalar interpolation
and stream law. Its source is bound in the output. Tree traversal is specified here.
Default output stays private to make canonical fixture replacement an explicit command.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.generate_triangle_points_fixtures import (  # noqa: E402
    Xoshiro128StarStar11, scalar_lerp, shared_seed_vectors,
)

MAX_SEGMENTS = 357_913_941


class BranchError(ValueError):
    def __init__(self, code, detail=None, trace=None):
        super().__init__(code)
        self.code, self.detail, self.trace = code, detail, trace


def canonical(value):
    return 0.0 if value == 0 else value


def number(value):
    if type(value) not in (int, float):
        raise BranchError('INVALID_INPUT')
    try:
        result = float(value)
    except OverflowError:
        raise BranchError('INVALID_INPUT') from None
    if not math.isfinite(result):
        raise BranchError('INVALID_INPUT')
    return canonical(result)


def record(value, keys):
    if type(value) is not dict or set(value) != set(keys.split()):
        raise BranchError('INVALID_INPUT')


def sequence(value):
    if type(value) is not list:
        raise BranchError('INVALID_INPUT')
    return value


def pair(value, interval=False, nonnegative=False):
    if len(sequence(value)) != 2:
        raise BranchError('INVALID_INPUT')
    a, b = number(value[0]), number(value[1])
    if (interval and a > b) or (nonnegative and a < 0):
        raise BranchError('INVALID_INPUT')
    return a, b


def integer(value, low, high):
    result = number(value)
    if not result.is_integer() or not low <= result <= high:
        raise BranchError('INVALID_INPUT')
    return int(result)


def validate(value):
    record(value, 'seed root rules maxSegments')
    seed = integer(value['seed'], 0, 0xffffffff)
    root = value['root']
    record(root, 'origin heading length')
    origin = pair(root['origin'])
    heading, length = number(root['heading']), number(root['length'])
    if length < 0:
        raise BranchError('INVALID_INPUT')
    rules = []
    for rule in sequence(value['rules']):
        record(rule, 'lengthScale slots')
        scale = pair(rule['lengthScale'], interval=True, nonnegative=True)
        slots = []
        for slot in sequence(rule['slots']):
            record(slot, 'probability turn')
            probability = number(slot['probability'])
            if not 0 <= probability <= 1:
                raise BranchError('INVALID_INPUT')
            slots.append((probability, pair(slot['turn'], interval=True)))
        rules.append((scale, slots))
    limit = integer(value['maxSegments'], 1, MAX_SEGMENTS)
    return seed, origin, heading, length, rules, limit


def grow(value):
    seed, origin, heading, length, rules, limit = validate(value)
    stream = Xoshiro128StarStar11(seed)
    trace = []
    out = {key: [] for key in ('segments', 'headings', 'lengths', 'parents',
                               'generations', 'childCounts')}

    def unit(parent, slot, role):
        word, result = stream.unit()
        trace.append({'parentIndex': parent, 'slotIndex': slot, 'role': role,
                      'word': word, 'state': list(stream.words)})
        return result

    def finite(result, parent, slot, stage):
        if not math.isfinite(result):
            raise BranchError('BRANCH_ARITHMETIC_INVALID',
                              {'parentIndex': parent, 'slotIndex': slot, 'stage': stage}, trace)
        return canonical(result)

    def append(start, angle, size, parent, slot, generation):
        dx = finite(math.cos(angle) * size, parent, slot, 'delta_x')
        dy = finite(math.sin(angle) * size, parent, slot, 'delta_y')
        x = finite(start[0] + dx, parent, slot, 'position_x')
        y = finite(start[1] + dy, parent, slot, 'position_y')
        out['segments'].append([*start, x, y])
        for key, item in (('headings', angle), ('lengths', size), ('parents', parent),
                          ('generations', generation), ('childCounts', 0)):
            out[key].append(item)

    append(origin, heading, length, -1, -1, 0)
    parent = 0
    while parent < len(out['segments']):
        generation = out['generations'][parent]
        if generation < len(rules):
            scale_range, slots = rules[generation]
            scale = scalar_lerp(*scale_range, unit(parent, -1, 'scale'))
            for slot, (probability, turn_range) in enumerate(slots):
                if unit(parent, slot, 'gate') >= probability:
                    continue
                if len(out['segments']) >= limit:
                    raise BranchError('SEGMENT_LIMIT_EXCEEDED',
                                      {'parentIndex': parent, 'slotIndex': slot}, trace)
                turn = scalar_lerp(*turn_range, unit(parent, slot, 'turn'))
                child_length = finite(out['lengths'][parent] * scale, parent, slot, 'length')
                child_heading = finite(out['headings'][parent] + turn, parent, slot, 'heading')
                append(out['segments'][parent][2:], child_heading, child_length,
                       parent, slot, generation + 1)
                out['childCounts'][parent] += 1
        parent += 1
    return out, trace


def rule(probabilities=(0.7, 0.7, 0.4), spread=0.5):
    intervals = [(-spread, -0.5 * spread), (0.5 * spread, spread),
                 (-0.2 * spread, 0.2 * spread)]
    return {'lengthScale': [0.65, 0.85], 'slots': [
        {'probability': p, 'turn': list(intervals[i])} for i, p in enumerate(probabilities)]}


def config(depth=3, **overrides):
    value = {'seed': 42, 'root': {'origin': [0., 0.], 'heading': 0., 'length': 16.},
             'rules': [rule() for _ in range(depth)], 'maxSegments': 10000}
    value.update(overrides)
    return value


def bit_hex(value):
    return struct.pack('>d', value).hex()


def coordinate_comparison(output):
    """Per-coordinate fixture allowances, not an arbitrary-input trig guarantee.

    Surround each nonzero-heading reference trig value by two adjacent binary64
    values each way, then propagate outward rounding through multiply and add.
    Parent endpoint uncertainty is carried into its children. Zero-heading-only
    cases need no trig allowance and retain exact-bit comparison.
    """
    if all(h == 0 for h in output['headings']) or all(v == 0 for v in output['lengths']):
        return {'mode': 'binary64-exact'}
    intervals, tolerances = [], []

    def outward(value, direction):
        return math.nextafter(value, direction)

    for i, (segment, heading, length, parent) in enumerate(zip(
            output['segments'], output['headings'], output['lengths'], output['parents'])):
        starts = [(v, v) for v in segment[:2]] if parent == -1 else intervals[parent][2:]
        ends = []
        for axis, fn in enumerate((math.cos, math.sin)):
            trig = fn(heading)
            lo = hi = trig
            if heading != 0:
                for _ in range(2):
                    lo = outward(lo, -math.inf)
                    hi = outward(hi, math.inf)
                lo, hi = max(-1., lo), min(1., hi)
            if length == 0:
                delta = (0., 0.)
            else:
                delta = (outward(lo * length, -math.inf), outward(hi * length, math.inf))
            ends.append((outward(starts[axis][0] + delta[0], -math.inf),
                         outward(starts[axis][1] + delta[1], math.inf)))
        row = [*starts, *ends]
        assert all(math.isfinite(v) for interval in row for v in interval), i
        intervals.append(row)
        tolerances.append([outward(max(abs(v - lo), abs(hi - v)), math.inf)
                           if lo != hi else 0. for v, (lo, hi) in zip(segment, row)])
    return {'mode': 'bounded-trig', 'segments_abs': tolerances,
            'rationale': 'Per-case engineering allowance: two adjacent binary64 values around each reference sine/cosine, clipped to [-1,1], with outward-rounded multiplication/addition and propagated parent endpoint intervals. Exact topology/attributes and endpoint ancestry are checked separately. This is not a universal host-trig accuracy claim.'}


def case(name, value):
    result = {'id': name, 'input': value}
    try:
        output, trace = grow(value)
    except BranchError as error:
        result['error'] = error.code
        if error.detail is not None:
            result['error_detail'] = error.detail
        if error.trace is not None:
            result['rng_trace'] = error.trace
        return result
    result.update(output=output, rng_trace=trace)
    result['exact_attribute_bits'] = {key: [bit_hex(v) for v in output[key]]
                                      for key in ('headings', 'lengths')}
    result['comparison'] = coordinate_comparison(output)
    return result


def build():
    cases = [case('root-only', config(0)), case('root-only-at-cap', config(0, maxSegments=1))]
    for seed in (0, 1, 42, 2147483648, 4294967295):
        cases.append(case(f'branch-seed-{seed}', config(seed=seed)))
    for depth in (5, 7, 8):
        cases.append(case(f'prefix-rules-{depth}', config(depth)))
    later = config(8)
    later['rules'][-1] = rule(spread=0.9)
    cases.append(case('late-spread', later))
    for name, rules in (
        ('empty-slots', [{'lengthScale': [1., 1.], 'slots': []}]),
        ('all-gates-fail', [rule((0., 0., 0.))]),
        ('all-gates-succeed', [rule((1., 1., 1.))] * 3),
        ('constant-interval-chain', [{'lengthScale': [0.5, 0.5],
                                     'slots': [{'probability': 1., 'turn': [0., 0.]}]}] * 5),
    ):
        cases.append(case(name, config(rules=rules)))
    collapsed = config()
    collapsed['root']['length'] = 0.
    cases.append(case('collapsed-root', collapsed))
    cases.append(case('zero-gate-before-probabilistic-slot', config(rules=[rule((0., 0.7))] * 3)))
    constant_scale = rule()
    constant_scale['lengthScale'] = [0.8, 0.8]
    cases.append(case('constant-scale-before-probabilistic-slots', config(rules=[constant_scale] * 3)))
    constant_turn = rule()
    for slot in constant_turn['slots']:
        slot['turn'] = [0., 0.]
    cases.append(case('constant-turn-before-later-gates', config(rules=[constant_turn] * 3)))
    cases.append(case('translated-rotated-root', config(root={
        'origin': [-3.5, 7.25], 'heading': -0.7, 'length': 16.})))
    lengthening = {'lengthScale': [1.1, 1.1], 'slots': [{'probability': 1., 'turn': [0., 0.]}]}
    cases.append(case('lengthening-chain-exact-capacity', config(rules=[lengthening] * 5, maxSegments=6)))
    cases.append(case('failed-gates-at-capacity', config(rules=[rule((0., 0., 0.))], maxSegments=1)))
    cases.append(case('invalid-positive-reversed-scale', config(rules=[{
        'lengthScale': [0.9, 0.1], 'slots': []}])))
    cases.append(case('invalid-positive-reversed-turn', config(rules=[{
        'lengthScale': [1., 1.], 'slots': [{'probability': 0., 'turn': [0.9, 0.1]}]}])))
    cases.append(case('capacity-before-child', config(rules=[rule((1.,))], maxSegments=1)))
    invalid_later = config(0, rules=[rule((0.,)), {'lengthScale': [1., -1.], 'slots': []}])
    cases.append(case('invalid-unreachable-rule', invalid_later))
    for name, field, value in (('invalid-seed', 'seed', True),
                               ('invalid-limit-zero', 'maxSegments', 0),
                               ('invalid-limit-large', 'maxSegments', MAX_SEGMENTS + 1)):
        bad = config(); bad[field] = value
        cases.append(case(name, bad))
    numeric_path = ROOT / 'evidence/investigations/cp6-numeric-cases.json'
    numeric = json.loads(numeric_path.read_text())
    stage_names = {'dx': 'delta_x', 'dy': 'delta_y', 'end_x': 'position_x', 'end_y': 'position_y'}
    for witness in numeric['results']:
        source = witness['input']
        root = source['root']
        value = config(root={'origin': [root['origin_x'], root['origin_y']],
                             'heading': root['heading'], 'length': root['length']},
                       seed=source['seed'], maxSegments=source['maxSegments'],
                       rules=[{'lengthScale': source['lengthScale'], 'slots': source['slots']}])
        result = case(witness['id'], value)
        outcome = witness['outcome']
        if outcome['status'] == 'success':
            assert 'output' in result
            children = witness['children_appended']
            assert len(result['output']['segments']) == len(children) + 1
            for index, child in enumerate(children, 1):
                for field, actual in zip(('x0', 'y0', 'x1', 'y1'), result['output']['segments'][index]):
                    assert bit_hex(actual) == child[field]['bits_hex']
                for key, field in (('headings', 'heading'), ('lengths', 'length')):
                    assert bit_hex(result['output'][key][index]) == child[field]['bits_hex']
        else:
            assert result['error'] == outcome['status']
            expected = {k: outcome[k] for k in ('parentIndex', 'slotIndex')}
            if 'stage' in outcome:
                expected['stage'] = stage_names.get(outcome['stage'], outcome['stage'])
            assert result['error_detail'] == expected
        assert [r['word'] for r in result['rng_trace']] == [r['word_u32'] for r in witness['rng_trace']]
        result['numeric_witness'] = witness['id']
        cases.append(result)
    largest = float.fromhex('0x1.fffffffffffffp+1023')
    for name, origin, heading in (
            ('root-position-x-overflow', [largest, 0.], 0.),
            ('root-position-y-overflow', [0., largest], math.pi / 2)):
        value = config(0, root={'origin': origin, 'heading': heading, 'length': largest})
        cases.append(case(name, value))
        invalid = copy.deepcopy(value)
        invalid['rules'] = [{'lengthScale': [-1., 0.], 'slots': []}]
        cases.append(case(name + '-static-invalid-wins', invalid))
    successful = {c['id']: c['output'] for c in cases if 'output' in c}
    for a, b in ((5, 7), (7, 8)):
        shorter, longer = successful[f'prefix-rules-{a}'], successful[f'prefix-rules-{b}']
        for key in ('segments', 'headings', 'lengths', 'parents', 'generations'):
            assert shorter[key] == longer[key][:len(shorter[key])], (a, b, key)
        assert len(longer['segments']) > len(shorter['segments'])
        assert any(x != y for x, y in zip(shorter['childCounts'], longer['childCounts']))
    before, after = successful['prefix-rules-8'], successful['late-spread']
    assert before['parents'] == after['parents']
    assert before['childCounts'] == after['childCounts']
    assert before['generations'] == after['generations']
    for index, generation in enumerate(before['generations']):
        if generation <= 7:
            for key in ('segments', 'headings', 'lengths'):
                assert before[key][index] == after[key][index]
    assert any(a != b for a, b in zip(before['segments'], after['segments']))
    files = [Path(__file__).resolve(), ROOT / 'tools/generate_triangle_points_fixtures.py', numeric_path]
    catalog = ROOT / 'catalog/operations/seeded-endpoint-branches.json'
    if not catalog.exists():
        catalog = ROOT / '.work/cp6-contracts/seeded-endpoint-branches.json'
    return {'operation': 'topology.seeded-endpoint-branches-2d', 'version': '0.1.0',
            'fixture_format': 'branch-tree-output', 'fixture_status': 'reviewed',
            'catalog_sha256': hashlib.sha256(catalog.read_bytes()).hexdigest(),
            'source_bindings': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                                for p in files},
            'seed_vectors': shared_seed_vectors(), 'cases': cases,
            'native_only_cases': [
                {'id': 'nonfinite-input', 'requirement': 'NaN and both infinities in root, intervals, probability, seed and capacity reject as INVALID_INPUT before computation.'},
                {'id': 'numeric-carriers', 'requirement': 'Reject booleans, strings and unsupported numeric subclasses; accept ordinary integral floating seed/capacity carriers before narrowing.'},
                {'id': 'container-carriers', 'requirement': 'Reject arrays/PVector input aliases and malformed passive records/lists; validate unreachable rules.'},
                {'id': 'negative-zero', 'requirement': 'Accept negative zero where zero is in domain, then expose only canonical positive-zero geometry and attributes.'},
                {'id': 'access-domains', 'requirement': 'All indexed accessors distinguish INVALID_INDEX from INDEX_OUT_OF_RANGE, including large safe integer and huge integer carriers.'},
                {'id': 'atomic-segment-into', 'requirement': 'Index domain then bounds precede output/offset validation. Failed writes preserve all sentinels; successful offset writes touch exactly four slots.'},
                {'id': 'detached-input', 'requirement': 'Mutating supplied root/rules/slots after construction cannot change retained values.'},
                {'id': 'detached-output', 'requirement': 'Mutating segmentAt/toValues outputs cannot change retained values or another materialization.'},
                {'id': 'capacity-without-preallocation', 'requirement': 'Root-only call with maximum representable capacity completes with small retained storage; capacity is not upfront allocation size.'},
                {'id': 'iterative-chain', 'requirement': 'A bounded long one-slot chain constructs and traverses without host recursion or per-node objects.'},
            ],
            'limitations': ['Shared fixture oracle, not a public target implementation.',
                            'Case-specific trig allowances are engineering margins requiring native verification, not universal accuracy guarantees.',
                            'Native-only obligations are specified but not yet executed.']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / '.work/cp6-contracts/branch-fixtures-draft.json')
    args = parser.parse_args()
    data = build()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=2, allow_nan=False) + '\n')
    print(f"Wrote {len(data['cases'])} shared cases to {args.output}")
