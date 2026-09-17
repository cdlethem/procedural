#!/usr/bin/env python3
"""Fetch explicitly selected reference images and build a local, attributed study gallery.

No crawling, model training, artwork generation or support acceptance is performed.
Original bytes, receipts and gallery stay under ignored .work/.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import html
import io
import json
import os
import re
import threading
import time
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET
from urllib.parse import quote, urlsplit

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / 'evidence/external-art/2026-09/corpus.json'
OUTPUT = ROOT / '.work/external-art-corpus'
MAX_BYTES = 32 * 1024 * 1024
HOST_LOCKS = defaultdict(threading.Lock)
HOST_NEXT = defaultdict(float)


def read_image(url):
    """Space requests per source host and respect rate-limit responses."""
    host = urlsplit(url).netloc
    for attempt in range(3):
        with HOST_LOCKS[host]:
            time.sleep(max(0, HOST_NEXT[host] - time.monotonic()))
            HOST_NEXT[host] = time.monotonic() + 0.6
        with requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=30, stream=True) as response:
            if response.status_code == 429 and attempt < 2:
                retry = response.headers.get('Retry-After', '')
                delay = max(5 * (attempt + 1), float(retry) if retry.isdigit() else 0)
                with HOST_LOCKS[host]:
                    HOST_NEXT[host] = max(HOST_NEXT[host], time.monotonic() + delay)
                continue
            response.raise_for_status()
            chunks, size = [], 0
            for chunk in response.iter_content(65536):
                chunks.append(chunk)
                size += len(chunk)
                if size > MAX_BYTES:
                    break
            return b''.join(chunks), response.url, response.headers.get('Content-Type')
    raise ValueError('Source rate limit persisted')


def collect(item, previous):
    key, url = item
    old = previous.get(key)
    if old and old.get('status') == 'downloaded':
        path = ROOT / old['path']
        if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == old['sha256']:
            return key, old
        if path.exists():
            return key, dict(old, status='failed', error='Existing bytes differ; preserve and investigate')
    result = {'url': url, 'retrieved_at': datetime.now(timezone.utc).isoformat()}
    try:
        blob, final_url, content_type = read_image(url)
        result.update(final_url=final_url, content_type=content_type)
        if not blob:
            raise ValueError('Source returned an empty image response')
        if len(blob) > MAX_BYTES:
            raise ValueError('Image exceeds 32 MiB collection bound')
        if 'image/svg+xml' in (result['content_type'] or '') or url.split('?')[0].lower().endswith('.svg'):
            svg = ET.fromstring(blob)
            if svg.tag.rsplit('}', 1)[-1] != 'svg':
                raise ValueError('Expected an SVG root')
            viewbox = re.split(r'[\s,]+', svg.get('viewBox', '').strip())
            def dimension(name, index):
                match = re.fullmatch(r'([0-9.]+)(?:px)?', svg.get(name, ''))
                return float(match[1]) if match else float(viewbox[index])
            width, height = dimension('width', 2), dimension('height', 3)
            frames, extension = 1, '.svg'
        else:
            with Image.open(io.BytesIO(blob)) as im:
                im.verify()
            with Image.open(io.BytesIO(blob)) as im:
                width, height = im.size
                frames = getattr(im, 'n_frames', 1)
                extension = {'JPEG': '.jpg', 'PNG': '.png', 'GIF': '.gif', 'WEBP': '.webp', 'AVIF': '.avif'}.get(im.format)
                if not extension:
                    raise ValueError('Unsupported reference image format: ' + str(im.format))
        if min(width, height) < 64:
            raise ValueError('Image too small for visual study')
        digest = hashlib.sha256(blob).hexdigest()
        path = OUTPUT / 'images' / (digest + extension)
        if path.exists() and path.read_bytes() != blob:
            raise ValueError('Preserve conflicting content-addressed asset')
        if not path.exists():
            path.write_bytes(blob)
        result.update(status='downloaded', path=str(path.relative_to(ROOT)), sha256=digest,
                      bytes=len(blob), width=width, height=height, frames=frames)
    except Exception as error:
        result.update(status='failed', error=str(error))
    return key, result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=DEFAULT)
    parser.add_argument('--fetch', action='store_true', help='Download selected URLs; otherwise build offline')
    parser.add_argument('--defer-host', action='append', default=[], help='Preserve receipts without requests to a rate-limited host; repeatable')
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    works = manifest['works']
    ids = [work['id'] for work in works]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate work identifiers')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'images').mkdir(exist_ok=True)
    receipt_path = OUTPUT / 'receipts.json'
    previous = json.loads(receipt_path.read_text()) if receipt_path.exists() else {}
    selections = {hashlib.sha256(url.encode()).hexdigest(): url for work in works for url in work['image_urls']}
    if args.fetch:
        with ThreadPoolExecutor(max_workers=6) as pool:
            pending = {key: url for key, url in selections.items() if urlsplit(url).netloc not in args.defer_host}
            futures = [pool.submit(collect, item, previous) for item in pending.items()]
            for done, future in enumerate(as_completed(futures), 1):
                key, result = future.result()
                previous[key] = result
                if done % 100 == 0:
                    temporary = receipt_path.with_suffix('.json.tmp')
                    temporary.write_text(json.dumps(previous, indent=2, ensure_ascii=False) + '\n')
                    temporary.replace(receipt_path)
                    print(f'Fetched or verified {done}/{len(pending)} references', flush=True)
        receipt_path.write_text(json.dumps(previous, indent=2, ensure_ascii=False) + '\n')
    esc = lambda value: html.escape(str(value), quote=True)
    (OUTPUT / 'thumbnails').mkdir(exist_ok=True)
    cards, assets, failures = [], set(), []
    downloaded_urls, represented, complete = set(), 0, 0
    thumbnail_index = {}
    for work in works:
        figures = []
        successes = 0
        for url in work['image_urls']:
            receipt = previous.get(hashlib.sha256(url.encode()).hexdigest(), {})
            path = ROOT / receipt.get('path', '.work/missing')
            valid = (receipt.get('status') == 'downloaded' and path.is_file()
                     and hashlib.sha256(path.read_bytes()).hexdigest() == receipt.get('sha256'))
            if valid:
                assets.add(receipt['sha256'])
                downloaded_urls.add(url)
                successes += 1
                src = quote(os.path.relpath(path, OUTPUT))
                frame = round((receipt.get('frames', 1) - 1) * 0.75)
                suffix = f'-frame-{frame}' if frame else ''
                thumbnail = OUTPUT / 'thumbnails' / (receipt['sha256'] + suffix + '.jpg')
                if path.suffix == '.svg':
                    thumbnail = path
                elif not thumbnail.exists():
                    with Image.open(path) as im:
                        im.seek(frame)
                        preview = im.convert('RGB')
                        preview.thumbnail((640, 640))
                        preview.save(thumbnail, quality=86)
                thumbnail_index[receipt['sha256']] = {'source': receipt['path'], 'preview': str(thumbnail.relative_to(ROOT)), 'frame_index': frame, 'source_frames': receipt.get('frames', 1), 'method': '75-percent frame for animation; first frame for static images; SVG displayed directly'}
                preview_url = quote(os.path.relpath(thumbnail, OUTPUT))
                figures.append(f'<a href="{src}"><img loading="lazy" src="{preview_url}" alt="{esc(work["artist"])} — {esc(work["title"])}"></a>')
            else:
                failures.append({'id': work['id'], 'url': url, 'error': receipt.get('error', 'Missing or changed local asset')})
                figures.append('<p class="missing">Reference unavailable locally; see linked source.</p>')
        represented += int(successes > 0)
        complete += int(successes == len(work['image_urls']))
        families = ', '.join(work['families'])
        status = work.get('coverage_status', 'unassessed')
        collection = work.get('collection_title', work['title'])
        search = ' '.join([work['artist'], work['title'], collection, families, status]).lower()
        cards.append(f'''<article id="{esc(work['id'])}" data-search="{esc(search)}" data-status="{esc(status)}" data-artist="{esc(work['artist'])}">
<div class="images">{''.join(figures)}</div><div class="body"><small>{esc(work['id'])} · {esc(status)}</small>
<h2>{esc(work['title'])}</h2><p class="artist">{esc(work['artist'])}</p><p>{esc(collection)} · {len(figures)} images</p><p>{esc(families)}</p>
<p>{esc(work['technique_evidence'])}</p><p class="muted">Evidence: {esc(work['evidence_kind'])}. {esc(work['limitations'])}</p>
<p class="muted">{esc(work.get('selection_rationale', ''))}</p>
<p>{esc(work.get('package_comparison', 'Package comparison pending.'))}</p>
<a href="{esc(work['page_url'])}" target="_blank" rel="noopener">Artist / project source ↗</a></div></article>''')
    counts = {'works': len(works), 'artists': len({w['artist'] for w in works}),
              'selected_urls': len(selections), 'selected_image_references': sum(len(w['image_urls']) for w in works),
              'downloaded_urls': len(downloaded_urls), 'unique_downloaded_images': len(assets),
              'unavailable_urls': len(selections) - len(downloaded_urls),
              'records_with_images': represented, 'fully_collected_records': complete,
              'unavailable_selections': len(failures), 'failures': failures}
    (OUTPUT / 'thumbnail-index.json').write_text(json.dumps(thumbnail_index, indent=2) + '\n')
    (OUTPUT / 'summary.json').write_text(json.dumps(counts, indent=2) + '\n')
    document = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Procedurals · External art study</title><style>
*{box-sizing:border-box}body{margin:0;background:#141718;color:#edf0e9;font:16px/1.5 system-ui,sans-serif}header{padding:40px max(24px,5vw);background:#222927}h1{font-size:clamp(30px,5vw,58px);line-height:1.08;margin:0 0 20px}header p{max-width:950px}a{color:#b9dfb6}input,select{font:inherit;padding:12px;border:1px solid #6b7d71;background:#111;color:white;border-radius:4px}input{width:100%;min-width:0}select{max-width:100%;min-width:0}nav label{display:grid;gap:4px;flex:1 1 220px;min-width:0}nav{position:sticky;top:0;background:#222e;backdrop-filter:blur(8px);padding:16px 5vw;z-index:2;display:flex;gap:12px;flex-wrap:wrap}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:24px;padding:24px 5vw}article{background:#222927;border:1px solid #39473f;align-self:start;scroll-margin-top:100px}.images{display:grid;grid-template-columns:repeat(2,1fr);background:#101212;gap:2px}.images a:only-child{grid-column:1/-1}.images img{width:100%;height:260px;object-fit:contain;display:block}.body{padding:20px;overflow-wrap:anywhere}h2{font-size:23px;line-height:1.2;margin:8px 0}.artist{color:#cbe9aa;font-weight:650}.muted,small{color:#acb7b0}.missing{color:#f4bb97;padding:20px}[hidden]{display:none!important}footer{padding:30px 5vw}</style>
<header><p>PROCEDURALS / VISUAL RESEARCH / SEPTEMBER 2026</p><h1>New ways to make images</h1>
<p>COUNT_SUMMARY. A deliberately diverse reference selection, not a census of generative art. Images remain the artists’ copyrighted work. This local gallery is for reference study; it is not a redistribution or training license.</p>
<p>Technique claims distinguish artist descriptions from visual inference. Static images do not establish motion, interaction or exact algorithms. None of these external artworks is a demonstrated package recreation.</p>
<p><a href="../../docs/external-art-p5-expansion-plan.md">Read the capability comparison and p5.js plan</a></p></header>
<nav><label>Find <input id="search" type="search" placeholder="Artist, technique, work…"></label><label>Artist <select id="artist"><option value="">All artists</option>ARTIST_OPTIONS</select></label><label>Coverage <select id="status"><option value="">All</option><option>unsupported</option><option>plausibly-supported</option><option>unassessed</option></select></label><span id="count" aria-live="polite"></span></nav>
<main>CARDS</main><footer>Downloaded originals and review derivatives stay in .work/. Source links, evidence and future-work decisions are tracked separately.</footer>
<script>const cards=[...document.querySelectorAll('article')];function filter(){const q=document.querySelector('#search').value.toLowerCase().trim(),s=document.querySelector('#status').value,a=document.querySelector('#artist').value;let n=0;for(const c of cards){c.hidden=!q.split(/\\s+/).every(x=>c.dataset.search.includes(x))||(s&&c.dataset.status!==s)||(a&&c.dataset.artist!==a);if(!c.hidden)n++}document.querySelector('#count').textContent=n+' works shown'}document.querySelector('#search').addEventListener('input',filter);document.querySelector('#status').addEventListener('change',filter);document.querySelector('#artist').addEventListener('change',filter);filter()</script></html>'''
    document = document.replace('ARTIST_OPTIONS', ''.join(f'<option>{esc(a)}</option>' for a in sorted({w['artist'] for w in works})))
    document = document.replace('COUNT_SUMMARY', f'{len(works)} work records · {counts["artists"]} artists/studios · {len(assets)} unique images')
    (OUTPUT / 'index.html').write_text(document.replace('CARDS', ''.join(cards)))
    print(json.dumps({k: v for k, v in counts.items() if k != 'failures'}, indent=2))


if __name__ == '__main__':
    main()
