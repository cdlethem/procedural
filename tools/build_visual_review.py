#!/usr/bin/env python3
"""Build the local visual-review gallery from curated existing renders; copy no originals."""
from __future__ import annotations
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.contact_sheet import compose, publish, source_images

MANIFEST = ROOT / 'docs/visual-review.json'
OUTPUT = ROOT / '.work/visual-review'


def escaped(value):
    return html.escape(str(value), quote=True)


def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def main():
    manifest = json.loads(MANIFEST.read_text())
    OUTPUT.mkdir(parents=True, exist_ok=True)
    links = OUTPUT / 'images'
    links.mkdir(exist_ok=True)
    sections, overview, problems = [], [], []
    image_count = 0
    emitted_links = set()
    for group in manifest['groups']:
        cards, seen = [], set()
        for item in group['images']:
            source = (ROOT / item['path']).resolve()
            label = item['label']
            if not source.is_relative_to((ROOT / '.work').resolve()):
                raise ValueError('gallery images must stay within repository .work')
            problem = None
            if not source.is_file():
                problem = 'Image not available locally'
            elif hashlib.sha256(source.read_bytes()).hexdigest() != item['sha256']:
                problem = 'Image changed since it was registered'
            if problem:
                problems.append({'group': group['title'], 'path': item['path'], 'problem': problem})
                cards.append('<article class="missing"><p>' + escaped(label) + '</p><p>' + problem + '</p></article>')
                continue
            if item['sha256'] in seen:
                continue
            seen.add(item['sha256'])
            _, width, height = source_images([source])[0]
            link = links / (slug(group['id']) + '--' + slug(label) + source.suffix.lower())
            if link.name in emitted_links:
                raise ValueError("duplicate gallery image label: " + link.name)
            emitted_links.add(link.name)
            if link.is_symlink():
                link.unlink()
            elif link.exists():
                raise ValueError('preserve non-gallery file: ' + str(link))
            link.symlink_to(os.path.relpath(source, links))
            url = quote('images/' + link.name)
            cards.append('<article><a href="' + url + '" target="_blank" rel="noopener">'
                         '<img src="' + url + '" alt="' + escaped(group['title'] + ': ' + label)
                         + '" loading="lazy" width="' + str(width) + '" height="' + str(height) + '"></a>'
                         '<div class="caption"><strong>' + escaped(label) + '</strong><span>'
                         + str(width) + ' × ' + str(height) + '</span></div></article>')
            if label == group.get("cover", group["images"][0]["label"]):
                # A separate descriptive alias lets the established contact-sheet helper label it.
                cover = links / (slug(group['title']) + source.suffix.lower())
                if cover.is_symlink():
                    cover.unlink()
                elif cover.exists():
                    raise ValueError('preserve non-gallery file: ' + str(cover))
                cover.symlink_to(os.path.relpath(source, links))
                overview.append((cover, width, height))
            image_count += 1
        evidence = ROOT / group['evidence']
        if not evidence.is_file():
            raise ValueError('missing group evidence: ' + group['evidence'])
        evidence_url = quote(os.path.relpath(evidence, OUTPUT))
        search = group['title'] + ' ' + group['description'] + ' ' + group['category']
        sections.append('<section id="' + escaped(group['id']) + '" data-category="'
                        + escaped(group['category']) + '" data-search="' + escaped(search.lower()) + '">'
                        '<div class="section-title"><h2>' + escaped(group['title']) + '</h2><span class="badge">'
                        + escaped(group['category']) + '</span></div><p>' + escaped(group['description'])
                        + ' <a class="evidence" href="' + evidence_url + '">Review record</a></p>'
                        '<div class="grid">' + ''.join(cards) + '</div></section>')
    if overview:
        with tempfile.TemporaryDirectory(prefix='overview-', dir=OUTPUT) as temporary:
            fresh = Path(temporary) / 'overview.png'
            publish(compose(overview, min(5, len(overview)), 240), fresh)
            fresh.replace(OUTPUT / 'overview.png')
    categories = sorted({group['category'] for group in manifest['groups']})
    options = ''.join('<option>' + escaped(category) + '</option>' for category in categories)
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Procedurals · Visual review</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f2ef;color:#222;font:16px/1.5 system-ui,sans-serif}
header,main{max-width:1440px;margin:auto;padding:28px}h1{font-size:38px;letter-spacing:-1.3px;margin:0}header p{color:#555;max-width:850px}
a{color:#225f77}nav{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:24px}input,select{font:inherit;padding:10px 14px;border:1px solid #ccc;border-radius:6px;background:white}input{flex:1;min-width:210px}section{margin-bottom:48px;scroll-margin-top:20px}.section-title{display:flex;align-items:center;gap:16px;flex-wrap:wrap}h2{font-size:24px;margin:0}.badge{font-size:12px;text-transform:uppercase;letter-spacing:.04em;background:#e4e0da;padding:5px 9px;border-radius:4px}section>p{color:#555;margin:8px 0 18px}.evidence{font-size:13px;white-space:nowrap}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}article{background:white;border-radius:7px;overflow:hidden;border:1px solid #dfdcd6}img{display:block;width:100%;height:280px;object-fit:contain;background:#e8e6e2}.caption{padding:12px;display:flex;justify-content:space-between;gap:12px;font-size:14px}.caption span{color:#777;font-size:12px;white-space:nowrap}.missing{padding:20px;color:#8c361e}.count{font-size:14px;color:#666}#empty{display:none}footer{padding:24px 0;color:#666;font-size:13px}[hidden]{display:none!important}
</style><header><h1>Visual review</h1><p>Actual images from the Java buildout, grouped by what you can make. Compare the baseline with structural edits and alternate drawing styles. Click any image for its full-size original.</p>
<p class="count">COUNTS OVERVIEW</p><nav><input id="search" type="search" aria-label="Find a capability" placeholder="Find a capability, e.g. branches, color, packing…"><select id="category" aria-label="Filter by review stage"><option value="">All stages</option>OPTIONS</select></nav></header><main>SECTIONS<p id="empty">No matching capabilities.</p><footer>Private studies are experiments, not shipped features. Review records define each accepted result’s scope. Images remain in their original locations; this gallery links them without copying them. The gallery is refreshed as visual milestones are added.</footer></main>
<script>
const search=document.querySelector('#search'),category=document.querySelector('#category'),sections=[...document.querySelectorAll('section')];
function filter(){let visible=0;const term=search.value.trim().toLowerCase();for(const section of sections){const show=(!category.value||section.dataset.category===category.value)&&section.dataset.search.includes(term);section.hidden=!show;if(show)visible++;}document.querySelector('#empty').style.display=visible?'none':'block';}
search.addEventListener('input',filter);category.addEventListener('change',filter);
</script></html>'''.replace('COUNTS', str(image_count) + ' distinct images · ' + str(len(sections)) + ' groups').replace('OVERVIEW', ' · <a href="overview.png">Open the contact sheet</a>' if overview else '').replace('OPTIONS', options).replace('SECTIONS', ''.join(sections))
    temporary = OUTPUT / 'index.html.tmp'
    temporary.write_text(page)
    temporary.replace(OUTPUT / 'index.html')
    summary = {'groups':len(sections), 'images':image_count, 'problems':problems, 'index':str(OUTPUT/'index.html')}
    (OUTPUT / 'build.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
