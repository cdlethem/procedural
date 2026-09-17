#!/usr/bin/env python3
"""Apply reviewed, per-sketch coverage corrections to the preserved assessment.

This does not classify sketches. The reconciliation is authored evidence; unchanged
assessments are copied verbatim from its pinned Git baseline.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


ALLOWED_BATCH_FAMILIES = {'post.pixel-grain', 'field.noise-displace', 'field.fbm'}


def _apply_revisions(ledger, revisions, inventory, evidence_path):
    """Apply one authored revision set to an already validated ledger."""
    seen = set()
    for assessment in ledger['assessments']:
        revision = revisions.get(assessment['sketch'])
        if revision is None:
            continue
        seen.add(assessment['sketch'])
        assert assessment['note_sha256'] == revision['note_sha256']
        assert hashlib.sha256((ROOT / revision['note_path']).read_bytes()).hexdigest() == revision['note_sha256']
        old = assessment['blocking_gaps']
        assert set(revision['closed_gaps']) <= {g['family'] for g in old}
        assessment['blocking_gaps'] = [g for g in old if g['family'] not in revision['closed_gaps']]
        assessment['blocking_gaps'].extend(revision['additional_gaps'])
        for family, correction in revision['closed_gaps'].items():
            assessment['resolved_or_glue'].append({
                'family': family, 'kind': 'reviewed-operation-composition',
                'reason': correction['reason'], 'evidence': evidence_path,
            })
            for operation in correction['operations']:
                assert operation in inventory
                if operation not in assessment['current_operations']:
                    assessment['current_operations'].append(operation)
        gaps = assessment['blocking_gaps']
        assessment['status'] = ('unsupported' if any(g['central'] for g in gaps)
                                else 'core-supported-secondary-gap' if gaps
                                else 'plausibly-supported')
        assessment['operation_led'] = True
        assessment['reconciliation'] = evidence_path
    assert seen == set(revisions)


def _recompute(ledger):
    assessed = [a for a in ledger['assessments'] if 'blocking_gaps' in a]
    supported = [a for a in assessed if not a['blocking_gaps']]
    counts = {
        'plausibly_supported': len(supported),
        'operation_led_plausibly_supported': sum(a['operation_led'] for a in supported),
        'core_supported_secondary_gap': sum(a['status'] == 'core-supported-secondary-gap' for a in assessed),
        'unsupported': sum(a['status'] == 'unsupported' for a in assessed),
    }
    return assessed, supported, counts


def _validate_batch(batch, ledger, inventory):
    assert batch['status'] == 'accepted'
    assert batch['owner'] == 'root' and batch['reviewer'] == 'root'
    assert isinstance(batch['date'], str) and batch['date']
    assert isinstance(batch['operations'], list) and batch['operations']
    catalog_stems = {p.stem for p in (ROOT / 'catalog/operations').glob('*.json')}
    reviewed_stems = set(inventory) | {'seeded-pixel-grain', 'field-displace-2d', 'octave-gradient-noise'}
    assert len(batch['operations']) == len(reviewed_stems)
    assert set(batch['operations']) == reviewed_stems
    assert reviewed_stems <= catalog_stems
    assert {f['family'] for f in batch['families']} == ALLOWED_BATCH_FAMILIES
    assert len(batch['families']) == len(ALLOWED_BATCH_FAMILIES)
    for family in batch['families']:
        assert family['family'] in ALLOWED_BATCH_FAMILIES
        assert family['verdict'] in {'closed', 'partial', 'live'}
        assert isinstance(family['catalog_evidence'], list) and family['catalog_evidence']
        for citation in family['catalog_evidence']:
            assert (ROOT / citation['path']).is_file()
            assert isinstance(citation['pointer'], str) and citation['pointer']
        assert isinstance(family['limits'], list)
    for revision in batch['sketch_revisions']:
        assert set(revision['closed_gaps']) <= ALLOWED_BATCH_FAMILIES
        assert all(g['family'] in ALLOWED_BATCH_FAMILIES for g in revision['additional_gaps'])
    assert len({r['sketch'] for r in batch['sketch_revisions']}) == len(batch['sketch_revisions'])
    required = {'assessed', 'snapshot', 'target', 'plausibly_supported',
                'operation_led_plausibly_supported', 'core_supported_secondary_gap',
                'unsupported', 'unassessed_snapshot', 'outside_snapshot',
                'demonstrated_originals', 'newly_demonstrated',
                'delta_plausible_vs_439', 'delta_operation_led_vs_346'}
    assert required <= set(batch['summary'])


def build(reconciliation_path, batch_review_path=None, reproduction_review_path=None):
    review = json.loads((ROOT / reconciliation_path).read_text())
    baseline = review['baseline']

    def original(path, expected):
        data = subprocess.check_output(
            ['git', 'show', f"{baseline['commit']}:{path}"], cwd=ROOT)
        assert hashlib.sha256(data).hexdigest() == expected, path
        return data.decode()

    ledger = json.loads(original(baseline['ledger_path'], baseline['ledger_sha256']))
    report = original(baseline['report_path'], baseline['report_sha256'])
    revisions = {r['sketch']: r for r in review['sketch_revisions']}
    inventory = {Path(o['path']).stem: o for o in review['inventory']}
    _apply_revisions(ledger, revisions, inventory, reconciliation_path)
    assessed, supported, counts = _recompute(ledger)
    assert counts['plausibly_supported'] == review['summary']['plausibly_supported']
    assert counts['operation_led_plausibly_supported'] == review['summary']['operation_led_plausibly_supported']

    active_review = review
    if batch_review_path:
        batch = json.loads((ROOT / batch_review_path).read_text())
        _validate_batch(batch, ledger, inventory)
        inventory = {stem: {'path': f'catalog/operations/{stem}.json'} for stem in batch['operations']}
        batch_revisions = {r['sketch']: r for r in batch['sketch_revisions']}
        _apply_revisions(ledger, batch_revisions, inventory, batch_review_path)
        assessed, supported, counts = _recompute(ledger)
        for key, value in counts.items():
            assert batch['summary'][key] == value, (key, batch['summary'][key], value)
        assert batch['summary']['assessed'] == len(assessed)
        assert batch['summary']['demonstrated_originals'] == 4
        assert batch['summary']['newly_demonstrated'] == 0
        assert batch['summary']['delta_plausible_vs_439'] == counts['plausibly_supported'] - 439
        assert batch['summary']['delta_operation_led_vs_346'] == counts['operation_led_plausibly_supported'] - 346
        assert batch['summary']['snapshot'] == review['summary']['snapshot']
        assert batch['summary']['target'] == review['summary']['target']
        assert batch['summary']['unassessed_snapshot'] == review['summary']['unassessed_snapshot']
        assert batch['summary']['outside_snapshot'] == review['summary']['outside_snapshot']
        families = []
        overrides = {f['family']: f for f in batch['families']}
        for original_family in review['families']:
            family = overrides.get(original_family['family'], original_family)
            records = [a for a in assessed if any(g['family'] == family['family'] for g in a['blocking_gaps'])]
            family = dict(family)
            family['revised_affected'] = len(records)
            family['revised_sole_gap'] = sum(len(a['blocking_gaps']) == 1 for a in records)
            families.append(family)
        active_review = dict(review)
        active_review['summary'] = batch['summary']
        active_review['families'] = families
        active_review['date'] = batch['date']
        ledger['batch_review'] = batch_review_path
        ledger['scope']['catalog_operation_count'] = len(batch['operations'])
    for family in ledger['gap_summary']:
        records = [a for a in assessed if any(g['family'] == family['family'] for g in a['blocking_gaps'])]
        family['affected_sketches'] = len(records)
        family['sole_remaining_gap'] = sum(len(a['blocking_gaps']) == 1 for a in records)
        family['central_in'] = sum(any(g['family'] == family['family'] and g['central'] for g in a['blocking_gaps']) for a in records)
        family['examples'] = [a['sketch'] for a in records[:5]]
    for key in ['plausibly_supported', 'operation_led_plausibly_supported', 'core_supported_secondary_gap', 'unsupported']:
        ledger['summary'][key] = active_review['summary'][key]
    ledger['scope']['catalog_operation_count'] = len(inventory)
    ledger['scope']['catalog_inventory'] = batch_review_path or reconciliation_path
    ledger['scope']['baseline_catalog_digest_sha256'] = ledger['scope'].pop('catalog_digest_sha256')
    ledger['scope']['assessment_baseline_commit'] = baseline['commit']
    ledger['reconciled_at'] = active_review['date']
    ledger['reconciliation'] = reconciliation_path
    ledger['ranked_projection'] = review['sequence_projection']
    if batch_review_path:
        ledger['ranked_projection_scope'] = 'Historical step-0 broad-family upper bounds; not measured batch gains.'

    new_demonstrated = 0
    if reproduction_review_path:
        reproduction = json.loads((ROOT / reproduction_review_path).read_text())
        assert reproduction['status'] == 'accepted'
        assert reproduction['owner'] == reproduction['reviewer'] == 'root'
        assert reproduction['results']['status'] == 'passed'
        for group in ('implementation_sha256', 'evidence_sha256'):
            for path, expected in reproduction[group].items():
                assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, path
        additions = reproduction['newly_demonstrated']
        assert len({a['sketch'] for a in additions}) == len(additions)
        for addition in additions:
            assessment = next(a for a in assessed if a['sketch'] == addition['sketch'])
            assert not assessment['blocking_gaps']
            assert assessment['note_sha256'] == addition['note_sha256']
            assert hashlib.sha256((ROOT / addition['note_path']).read_bytes()).hexdigest() == addition['note_sha256']
            assert 'demonstrated_recreation' not in assessment
            assessment['demonstrated_recreation'] = {**addition, 'review': reproduction_review_path}
        new_demonstrated = len(additions)
        ledger['summary']['demonstrated_originals'] += new_demonstrated
        ledger['reproduction_review'] = reproduction_review_path

    summary = active_review['summary']
    intro = [
        '# Genart survey recreation coverage and missing operations', '',
        '## Current reconciliation — 2026-09-17', '',
        f"The [reviewed reconciliation](../{reconciliation_path}) compared the **64 pre-batch contracts**",
        'with all 69 blocking families. It corrects only named affected sketches; it does not',
        'repeat or certify the full 800-sketch classification. The original report and ledger are',
        f"preserved unchanged in Git commit `{baseline['commit']}`. All 826 note hashes still match.", '',
        '| Scope | Plausibly supported | Operation-led subset |',
        '|---|---:|---:|',
    ]
    for denominator, label in [(800, 'Assessed'), (826, 'Snapshot'), (901, 'Target')]:
        n, m = summary['plausibly_supported'], summary['operation_led_plausibly_supported']
        intro.append(f'| {label} | {n}/{denominator} ({n/denominator:.1%}) | {m}/{denominator} ({m/denominator:.1%}) |')
    batch_statement = (
        [f'Batch 1 adds **three p5 capabilities**, bringing the catalog to **67**: seeded pixel grain,',
         'sampled-field displacement and octave gradient noise. Each has core fixtures and an',
         'editable native study with checked edits, reset/reload and save. Other targets are deferred.',
         f"The [batch review](../{batch_review_path}) adds **+{summary['plausibly_supported']-459} plausible**",
         f"and **+{summary['operation_led_plausibly_supported']-366} operation-led** sketches after the 459/366 reconciliation.",
         f'Newly demonstrated originals: **{new_demonstrated}**. The first grain candidate failed its SSIM gate',
         '**0.674 < 0.7** and remains a recorded failure. Displacement and octave studies demonstrate components only.',
         'Transfers are source/contract walkthroughs, not rendered recreations.',
         '[Grain evidence](../evidence/coverage/batch1/seeded-pixel-grain/root-review.json),',
         '[displacement evidence](../evidence/coverage/batch1/field-displace-2d/root-review.json),',
         '[octave evidence](../evidence/coverage/batch1/octave-gradient-noise/root-review.json).']
        if batch_review_path else
        ['Batch 1 remains exactly pixel grain, field-driven coordinate displacement, then octave',
         'accumulation, p5.js first. **None of these three additions is implemented or accepted yet.**']
    )
    intro += [
        '', f"This is **+{summary['delta_plausible_vs_439']} plausible sketches** versus 439, and",
        f"**+{summary['delta_operation_led_vs_346']} operation-led sketches** versus 346. There are now",
        f"**{ledger['summary']['demonstrated_originals']} demonstrated originals**; reconciliation itself adds no executed recreation.", '',
        'The most consequential correction is that `gradient-path` already implements affine',
        'scalar-noise-to-heading tracing. Source inspection also shows `mountain3` and `mountain4`',
        'choose speed once per path. Simplex, nonlinear/summed fields, step-index noise and 3D',
        'walks retain their gaps. Name-only Poisson, spline, offset and edge-detection matches fail.',
        'The full catalog inventory distinguishes frozen pending/draft prose from current bound',
        f"validation attestations, which accept {len(inventory)} p5 cores and scoped native workflows.", '',
    ]
    intro += batch_statement
    if reproduction_review_path:
        intro += [
            '', f'[The grain replay successor](../{reproduction_review_path}) restores source-layout RNG',
            'from the recorded seed42 and passes the unchanged benchmark: SSIM0.995341 and',
            'score96.959. Root inspected the original and corrected images; controls/reset/reload/save',
            'pass. This adds one demonstrated structural recreation, with no change to plausible totals.',
            'The portable grain RNG and byte rounding remain explicit source differences.', '',
        ]
    intro += [
        'The historical step-0 broad-family upper bounds (488, 516 and 536) are not measured',
        'gains. Random-grey blending, saturation grain, per-fragment shader scheduling, 3D',
        'displacement, simplex/value noise and nonlinear multifractals remain outside the',
        'three contracts. Cases without a verified complete mapping retain their gaps.', '',
        '### Current family dispositions', '',
        'Closed means every assessed instance maps; partial means only some instances or a',
        'component maps. A partial overlap earns no gain unless a named sketch mapping closes',
        'its gap. Citations link to the governing catalog clause; detailed mappings and limits',
        'are in the reconciliation JSON. Counts are residual affected / sole remaining gap.', '',
        '| Family | Verdict | Residual affected / sole gap | Catalog evidence |',
        '|---|---|---:|---|',
    ]
    for family in active_review['families']:
        citation = family['catalog_evidence'][0]
        label = Path(citation['path']).stem + citation['pointer']
        intro.append(f"| `{family['family']}` | {family['verdict']} | {family['revised_affected']} / {family['revised_sole_gap']} | [{label}](../{citation['path']}) |")
    intro += ['', '## Historical assessment — 2026-09-13', '',
              '**All counts and “current” references below describe the original 34-operation',
              'assessment, not current support. The current correction is above.**', '']
    historical = report.split('\n', 1)[1]
    return {baseline['ledger_path']: json.dumps(ledger, indent=2, ensure_ascii=False) + '\n',
            baseline['report_path']: '\n'.join(intro) + historical}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reconciliation', default='evidence/coverage/reconciliation-2026-09-17.json')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--batch-review', default=None,
                        help='Optional authored batch review applied after immutable reconciliation.')
    parser.add_argument('--reproduction-review', default=None,
                        help='Optional accepted reproduction successor; preserves authored batch counts.')
    args = parser.parse_args()
    batch_path = args.batch_review
    if batch_path is None:
        default_batch = ROOT / 'evidence/coverage/batch1/coverage-review.json'
        batch_path = str(default_batch.relative_to(ROOT)) if default_batch.exists() else None
    reproduction_path = args.reproduction_review
    if reproduction_path is None:
        default_reproduction = ROOT / 'evidence/reproductions/survey-coverage-batch1/grain-replay/root-review.json'
        reproduction_path = str(default_reproduction.relative_to(ROOT)) if default_reproduction.exists() else None
    for path, content in build(args.reconciliation, batch_path, reproduction_path).items():
        if args.check:
            assert (ROOT / path).read_text() == content, f'Stale coverage output: {path}'
        else:
            (ROOT / path).write_text(content)
    print('Reviewed coverage corrections ' + ('verified.' if args.check else 'applied.'))


if __name__ == '__main__':
    main()
