# External generative-art reference corpus

This reference collection preserves representative images from most eligible collections in the
**24 selected artist/studio source indexes**, with each index’s boundaries stated below. It does
not establish coverage of every artist in the discovery thread, every work made by these artists,
or every generative-art technique. Research date: **17 September 2026**.

The [manifest](../evidence/external-art/2026-09/corpus.json) contains **2,023 selection records**
and **6,898 unique selected image URLs**. There are **7,006 image-reference slots** because
some images appear in more than one selected group. The
[collection census](../evidence/external-art/2026-09/collection-census.json) contains **2,297 rows**,
including selections, parent collections, exclusions and access gaps. These are selection and
inventory counts, not successful-download counts or counts of distinct finished artworks.

**Collected locally: 6,497 distinct images (6.88 GB), representing 1,988 of the 2,023 selected
records.** These correspond to 6,515 successfully retrieved URLs; different URLs sometimes
contain identical bytes. Of the selected records, 1,970 have every selected view collected.
The [download summary](../evidence/external-art/2026-09/download-summary.json) gives per-artist
counts; [receipts](../evidence/external-art/2026-09/download-receipts.json) preserve hashes,
dimensions, retrieval times, redirects and failures. Every collected file was checked against its
recorded SHA-256 and byte count.

**The remaining gap is explicit:** 382 Flickr URLs remain unavailable after rate limiting persisted
through a ten-minute cooldown and a single recovery probe. This leaves 31 McCabe albums and four
GenerateMe collections without a selected local image. McCabe has local images for 49 of 80
selected groups (278 distinct images); GenerateMe has 118 of 122 (543 distinct images). One
Nervous System source returns an empty response, but that project has seven other collected views
and all 119 selected Nervous System records have local images. Every other selected artist group
has images for all selected records. These failures remain in the manifest and gallery, ready for
later retry; selection does not masquerade as successful collection.

The local collection is built by [the collector](../tools/collect_external_art.py), with its
browseable output under `.work/external-art-corpus/`. Images stay outside Git. The
[capability comparison and expansion plan](external-art-p5-expansion-plan.md) addresses what
the toolkit might learn from these references; inclusion here does not accept a recreation,
algorithm implementation or target-platform capability.

## Reading the counts

A **selection record** can represent an individual artwork, a project, a series, an album,
a technical tutorial or an artist-defined tag collection. Its images can show separate outputs,
frames, details, process stages or an installation. Neither one record nor one image reliably
means one independent artwork or one independent technique.

The table’s URL counts are calculated directly from each group’s `image_urls` in the final
manifest, deduplicated within that group. They sum to the global 6,898: this manifest has no
selected URL shared between different artist groups. Downloaded bytes can still reveal
identical content at different URLs; the collector’s receipts, rather than this table, determine
asset-level retrieval and deduplication results. Earlier worker summary fields such as
`selected_images` may precede final source screening and must not replace these manifest counts.

| Artist or studio group | Selected records | Unique selected image URLs | Source denominator and disposition |
|---|---:|---:|---|
| Anders Hoff (inconvergent) | 44 | 148 | 59 project/article/archive entries: 44 selected, 8 excluded, 7 static-image/access gaps |
| Andy Lomas | 16 | 68 | 18 artwork/collaboration entries: 16 selected, 1 video-only gap, 1 consultancy excluded |
| Ben Fry | 37 | 55 | 51 project pages: 37 selected, 14 inadequate-thumbnail gaps |
| Benjamin Bardou | 98 | 287 | 98 work tiles: all selected; series navigation is an overlapping grouping |
| Casey Reas | 554 | 584 | 554 indexed artworks across all 10 catalogue categories: all selected |
| Deskriptiv | 9 | 70 | 9 named portfolio projects: all selected |
| Golan Levin | 68 | 115 | 74 top-level entries + 4 child projects: 68 selected, 10 parent/event/non-output exclusions |
| Inigo Quilez | 80 | 200 | 54 productions selected; 26 of 33 supplementary articles selected; 1 separate Shadertoy gap |
| Jonathan McCabe | 80 | 621 | 78 Flickr albums + 3 site collections: 80 selected, 1 travel album excluded |
| Joshua Davis | 216 | 908 | 218 named portfolio projects: 216 selected, 2 without attributable stills |
| LIA | 82 | 457 | 84 public project/post entries: 82 selected, 2 video-only gaps |
| Nervous System | 119 | 766 | 137 rows: 119 selected child galleries + 14 selected parent hubs + 4 inspiration exclusions |
| Quayola | 51 | 365 | 51 projects across 4 thematic indexes: all selected |
| Raven Kwok | 89 | 249 | 89 Works posts over 9 archive pages: all selected |
| Robert Hodgin | 22 | 145 | 22 named portfolio projects: all selected |
| Scott Draves | 10 | 32 | 19 deduplicated current/historical entries: 10 visual collections selected, 9 exclusions |
| Sighack / Manohar Vanga | 26 | 166 | 35 indexed articles: 26 visual study/tutorial collections selected, 9 utilities/introductions excluded |
| Takahiro Kurashima | 59 | 243 | 73 expanded project/page/publication entries: 59 selected, 14 exclusions |
| Tim Rodenbroeker | 19 | 19 | 29 project cards across 2 populated pages: 19 selected, 10 article/tool-cover/community exclusions |
| Tomasz Sulej (GenerateMe) | 122 | 583 | 242 tutorial/tag/photoset/album/remainder rows: 122 selected, 118 excluded, 2 no-image tags |
| Tyler Hobbs | 127 | 396 | 149 canonical projects, including 80 source-labelled series: 127 selected, 22 excluded |
| Vera Molnar | 17 | 49 | 17 named DAM series/period galleries: all selected |
| Watabou | 34 | 88 | 47 creator project cards: 34 generators/visual examples selected, 13 games/textual simulations excluded |
| onformative | 44 | 284 | 49 portfolio/static-site entries: 44 selected, 5 exclusions |
| **Total** | **2,023** | **6,898** | **24 groups; mixed source units, not a single completion denominator** |

## Selection and representative variation

The first step was to enumerate named collections or project pages from the artist’s own index,
then follow those pages to their attached images. The census retains excluded and inaccessible
entries individually. An image appearing somewhere on an artist’s home page is insufficient
attribution: source-page placement, title, caption or an exact project-card link must connect
it to the selected work.

Large galleries are sampled across their published sequence rather than represented only by
the first image. Depending on the source, records retain one canonical image, several distinct
outputs, or up to eight representative views; specific sequences can retain more. The manifest’s
`selection_rationale`, image roles and available-image counts explain those choices. Sampling
by source order broadens the visible range, but it is not a statistical sample of all possible
outputs of a generator. Repeated angles, physical documentation and animation frames do not
prove equivalent algorithmic variation.

Source screening removed unrelated site logos, portraits, generic cover graphics, navigation,
commerce assets, many exhibition posters, reference inputs and mismatched index images.
Some intentional portraits, photographic inputs transformed into artworks, application views,
and physical installation photographs remain: their relevance comes from the documented work,
not from a rule that every retained image must be an abstract flat print. Physical, hand-executed
and rule-based design is labelled without assuming that a computer generated it.

Root reviewed the first available raster representative for 422 graphic-group records, including
all 127 selected Hobbs projects, and later-frame previews for all 141 retained animated assets.
One Hoff record has only SVG imagery and is outside that raster overview. These inspections
overlap earlier worker reviews; their counts must not be added as distinct images.

The manifest records the review stage. Most entries have source attribution plus representative
visual review; the other variants were not all inspected individually at full resolution. Root additionally inspected a first representative for all 80 Quilez entries, removed an input
animation-reference diagram, and inspected its retained generated-process replacement. Retrieval,
image decoding, visual attribution, algorithm understanding and native reproduction are separate
checks. A successful image download satisfies only part of that chain.

## Artist and studio scope

**Joshua Davis.** The [current portfolio](https://joshuadavis.com/) exposes 218 named project
pages. The selection covers 216, taking representative views across each project’s sequence;
long galleries retain additional images. Recurring bodies such as *the V01D*, Club Nomadic and
workshop/print projects remain grouped in metadata, without collapsing all their pages into one
hero image. *Wazey* and *Kaleidoscope Thai Warriors* have reachable pages but expose no attributable
still in this pass. Legacy interactive or video media were not reconstructed to fill those gaps.

**Casey Reas.** All 554 artworks in the [public artwork index](https://index.reas.com/) are
represented. Its ten categories are Atomism, In Silico, CENTURY, Caesuras, Compressed Cinema,
Ultraconcentrated, Process, MicroImage, Videos for Music and FRESH. The normal unit is a catalogue
artwork with its canonical artist-selected image; some entries include additional published views,
giving 584 URLs. This is complete for that accessible index, not a claim that the index contains
all historical installations, editions, software states or other Reas websites.

**Tyler Hobbs.** The [works portfolio](https://www.tylerxhobbs.com/works) supplied 149 canonical
project pages, including 80 explicitly labelled series and 69 single-work projects. The 127
selected records cover the computationally identified projects; 22 works list hand media without
a computational-design claim on their pages and remain explicit exclusions. Captions and embedded
public gallery data distinguish full outputs from details and process views. All ten credited
responses in *Please Respond* were retained. Series coverage does not mean every edition or
minted output is included, and collaborator authorship is preserved.

**Tomasz Sulej / GenerateMe.** This audit combines the eight
[WordPress tutorials](https://generateme.wordpress.com/), 407 GenerateMe Tumblr posts, 455 Folds2d
Tumblr posts and seven Flickr albums. Fully paginated post inventories support a collection-led
selection of technique tags, named photosets, script series and albums. The resulting 242 census
rows are overlapping groups and remainder decisions, not 242 independent collections or 862
selected posts. The 122 selected records contain 583 unique URLs; repeated membership across
source tags explains why image-reference slots exceed that total. Generic software/person/topic
tags and ungrouped post remainders are explicitly adjudicated. The `generative audio` and
`morphing` tags lack usable still-image output. A thematic DeepDream album was excluded as
redundant with the retained learned-image-synthesis references. The complete post inventory is
embedded in the census, so unselected posts are not silently treated as nonexistent.

**Jonathan McCabe.** The [artist’s Flickr album index](https://www.flickr.com/photos/jonathanmccabe/albums)
contains 78 albums; three current primary-site collections add separate groups. All 77 art albums
and all three site collections have selection records; local retrieval remains incomplete as
detailed above. *Europe July-August 2010* is explicitly described
as travel photography and excluded. Album contents were enumerated before samples were spread
across their ordering, retaining up to eight views per collection. The 80 records and 621 URLs
span those source groupings; overlapping albums do not establish independent techniques.

**Anders Hoff / inconvergent.** The [home index](https://inconvergent.net/), generative-algorithm
chapters, plotter project groups and linked plot archive yield 59 adjudicated entries. The 44
selected projects/tutorials retain artwork variants and relevant construction stages. Eight
programming/game-development or reflective entries are excluded. *Error Prints* and *Drift Prints*
remain readable but their artwork files return 404. *Spurious Splines*, *Shepherding Random Growth*,
*Shepherding Random Grids* and *Shepherding Random Numbers* require live Canvas execution and
have no attributable source raster/poster in this pass. The separate genlog host is unavailable.
Those seven gaps do not imply missing algorithms or unimportant work.

**Sighack / Manohar Vanga.** All 35 articles in the [public home index](https://sighack.com/)
were assessed. Twenty-six tutorial/sketch collections contribute 166 unique image URLs, preserving
contrasting output variants and meaningful construction stages. Nine introductions or export,
conversion, audio-analysis and boilerplate utilities are excluded as independent visual collections.
The corpus distinguishes illustrative intermediate images from final examples rather than treating
all tutorial figures as completed artworks.

**Takahiro Kurashima.** The [portfolio](https://takahirokurashima.com/), publication, exhibition,
lithograph and kinetic-sculpture indexes were reconciled with all 34 published page records and
four posts. Expanding named home-only projects, animation sequences and publication remainders
produces 73 census entries; 59 selections preserve dedicated works, book/series views, physical
kinetic objects and installation contexts. Fourteen navigation, commerce, generic multi-artist
book-cover or duplicate-edition entries are excluded. *The Art of Curiosity* and *Banzai 7* expose
no attributable Kurashima spread; *Poemotion Flipbook* lacks a separate attributable image, and
the first edition is not counted again as a new series. Rule-based optical design does not by
itself establish an unpublished computer algorithm.

**Robert Hodgin.** All 22 named projects in the [accessible portfolio](https://roberthodgin.com/)
are represented by 145 URLs. Distributed samples retain differences between simulation outputs,
scene states, print results and applications, including *River Scars*, *Meander*, *Murmuration*,
*Fish Tornado* and *Magnetosphere*. This denominator is the current named portfolio, not a census
of the artist’s entire historical sketch archive, every animation frame or every experiment.

**Andy Lomas.** The [artworks](https://andylomas.com/artworks.html) and collaboration indexes
supply 18 entries. Sixteen selections span growth/form series and documented collaborative outputs,
with multiple forms and presentation views where available. *The Realm* has an embedded YouTube
video but no artist-page still, so remains a specific gap. The Zaha Hadid VR entry describes
consultancy rather than authorship of the generative imagery and is excluded. Sixty-eight URLs
illustrate the selected series without enumerating all generated individuals.

**Nervous System.** The [projects archive](https://n-e-r-v-o-u-s.com/projects/) was traversed
through project sets, category pages and child galleries. Its 137 census rows include 119 selected
child galleries, 14 selected parent hubs and four excluded inspiration groups. The hubs point to
child selections and contribute no extra manifest record; consequently **133 selected census rows
mean 119 selected records**, not a discrepancy to repair by inventing projects. The records span
18 collection labels and 766 URLs, including variants, computational process, fabrication and
application views. Natural-reference imagery for Floraform, Xylem/Hyphae, dendrite puzzles and
Reaction is excluded from generated output. Products and fabrication photographs do not establish
that every pictured form can be recreated by a portable core operation.

**onformative.** The [work index](https://onformative.com/work/) and the site’s published static
manifest identify 49 entries. Forty-four projects contribute 284 URLs, covering distinct states,
applications and installations. The five exclusions are an earlier duplicate AT&T teaser, a test
placeholder, the Infiniti navigation-device project, the *Generative Gestaltung* instructional
book, and *Traffic*, whose page describes recorded footage without a generative transformation.
The accessible project inventory is broader than the initial visible home-page cards, but does
not enumerate every commercial deliverable or unreleased study.

**Quayola.** Four primary indexes—[landscape paintings](https://quayola.com/landscape-paintings/),
[classical iconography](https://quayola.com/classical-iconography/),
[unfinished sculptures](https://quayola.com/unfinished-sculptures/) and
[form/sound](https://quayola.com/form-sound/)—supply 51 named projects, all represented. The 365
URLs sample artwork, process, detail and installation views across reachable project galleries.
A photographed sculpture, source-derived image and rendered animation frame are different evidence
roles; none alone recovers the original reconstruction, robotic fabrication or simulation system.

**Deskriptiv.** All nine named projects on the [portfolio](https://deskriptiv.com/) are included,
with 70 URLs spanning the work-page sequences. They include Vespers Series II, Rottlace, Wanderers,
Living Mushtari, Captives, SimpSymm, DoubleMesh, NIKE Flyknit and Wiener Symphoniker. Collaborative
and client attribution remains relevant, particularly where a page documents a contribution to
another artist’s or studio’s project. Nine project groups do not mean nine complete production
pipelines or a comprehensive archive of the studio’s experiments.

**LIA.** The [artist site’s public post inventory](https://www.liaworks.com/) exposes 84 relevant
project/post entries, including series, commissions, installations and exhibition presentations.
Eighty-two contribute 457 URLs sampled across available artwork and presentation images. *A2P*
and *Resistance* are video-only: Vimeo’s metadata response denied the relevant domain and supplied
no attributable thumbnail, so the census retains both gaps. Related exhibition posts can revisit
an existing body of work; post counts are not a count of independent algorithms.

**Golan Levin.** The [FLoNG Projects index](https://www.flong.com/archive/projects/index.html)
contains 74 named top-level entries; expanding *Interval Projects* adds Rotuni, Flyphabet, Mouther
and MediaCalc. The 78-row census selects 68 projects and excludes the parent hub plus nine
curatorial/event or non-output entries. The 115 URLs come from each project’s own output or
installation documentation, replacing an invalid earlier global-index association. Credits include
Levin’s collaborators. Some references document interactive systems, physical devices or information
design rather than a reusable image-generation algorithm.

**Ben Fry.** Of 51 named projects in the [project index](https://www.benfry.com/projects/), 37
have useful attributed imagery in this pass. Their 55 URLs cover visualizations, computational
graphics and design; source footage and explanatory formulas were removed from output selections.
Fourteen legacy applet/Canvas projects have only 36–72-pixel public thumbnails below the selection
threshold: *Specious*, *Salary vs. Performance*, *Deconstructulator*, *Bagel*, *Microarray Clustering
with CAST*, *N-Dimensional Goodness*, *Tendril*, *Immiscible Fluid Mixing*, *Zipdecode*, *Fugpaint*,
*Color Spinner*, *Natural/Unnatural*, *Directional Paint* and *Amplifying the Background*. They remain
named gaps. No upscaling or unrelated imagery was used to make their coverage appear complete.

**Benjamin Bardou.** All 98 work tiles in the [current catalogue](https://benjaminbardou.com/)
are represented by 287 URLs. Nine series navigation groups organize overlapping work pages;
the manifest’s additional collection labels include works outside those groups and must not be
read as newly discovered series. Actual named film frames were preferred to exhibition posters
and event documentation. Some digital works reinterpret historic artworks, film imagery or AI
outputs. *Collective Memories* specifically credits Florian Zumbrunn’s generative compositions
alongside Bardou’s integration and animation; depicted source artists are not reassigned to Bardou.

**Raven Kwok.** The full [Works archive](https://ravenkwok.com/category/works/) has nine pages:
eight pages of ten posts and a final page of nine. All 89 named works contribute 249 URLs,
extending well beyond the first three Generative-category pages. The selection includes generative
systems, installations, animation, physical realizations and collaborations. Biological reference
inputs, setup diagrams, event graphics, hardware-only views and input previews were screened out
where distinguishable; video-only pages can use their exact work-card image. Direct HTTP failed
for some artist-hosted media, but browser retrieval recovered it. This archive denominator is
not a claim to include every social-media sketch or source-code experiment.

**Watabou.** All 47 creator-owned cards in the [itch.io portfolio](https://watabou.itch.io/)
were assessed. Thirty-four selections contribute 88 URLs, principally dedicated generators for
maps, settlements, architecture, ornaments and other visual forms. They include easily missed
smaller generators such as Tiny Pubs, The Haunting of…, Terrarium/Aquarium, Stick Figures and
Winter Mansion. *Pixel Dungeon* is explicitly retained as a procedural dungeon-layout example
using gameplay rather than its title screen. Thirteen other games or textual simulations are
excluded from this visual-generator slice; that choice does not deny their procedural mechanics.
These are creator-published examples, not newly executed generator outputs.

**Scott Draves.** The [current portfolio](https://scottdraves.com/portfolio) supplies twelve
slots: eight visual collections and four resource/documentation/product exclusions. The
[historical portfolio](https://draves.org/art.html) adds Arabesques Dub and Kunstformen Dub plus
five further exclusions after shared collections are deduplicated. Ten visual groups therefore
contribute 32 URLs across 19 census entries. Flame, Electric Sheep, Bomb, Fuse, Dreams in High
Fidelity, prints, Clade, clothing and the two Dub groups remain distinct presentation/computation
contexts. Raw Haeckel plates are identified as inputs and excluded; the DVD packaging is not
counted again as an artwork. The Google Photos documentation archive and the evolving Electric
Sheep population are not individually enumerated.

**Vera Molnar.** All seventeen named series/period links in the
[Digital Art Museum artist presentation](https://dam.org/museum/artists_ui/artists/molnar-vera/)
are covered, giving 49 artwork reproductions. Sampling spans each linked gallery rather than
repeating a few mixed-artist exhibition highlights. The grouping includes early plotter drawings,
Interruptions, (Des)Ordres, Hypertransformations, Saccades, Int/Cont, Sainte Victoire, Albers,
Interstices and homages. Paintings, hand-executed systems and computer drawings remain distinct
media. Seventeen of seventeen applies to this institutional presentation, not all museum holdings,
every historic series or the artist’s lifetime oeuvre.

**Tim Rodenbroeker.** The [My Projects archive](https://trcc.timrodenbroeker.de/category/projects/)
has 18 cards on the first page and 11 on the second. Although the second page’s HTML title says
“of 6”, linked pagination stops there and directly checked pages three through six contain no
cards. Nineteen projects retain their exact attached visual preview, giving 19 URLs. Ten essays,
community/directory sites, challenge announcements or tool-interface covers lacked an appropriate
representative artwork and were excluded. Some implementation material is member-only, so a
public project preview establishes identity without opening all construction details.

**Inigo Quilez.** The selection contains 54 named demoscene productions and 26 supplementary
technical-reference articles, for 80 records and 200 URLs. The production and technical-article
units remain separate: an explanatory distance-field plate is not a named finished production.
The 33 assessed article candidates include seven gaps—noise, voronoiborders, ftraps, orbittraps,
juliasets, function2009 and proceduralgfx—marked unavailable or without usable raster evidence.
The [Shadertoy profile](https://www.shadertoy.com/user/iq) is a separate inaccessible portfolio
boundary. The 88 census rows do not establish a census of every shader or every article on the
artist’s site, and root’s representative overview does not amount to reviewing every variant or executing the shaders.

## Discovery breadth and access limits

The [discovery-source screen](../evidence/external-art/2026-09/source-screen.json) preserves
83 outbound references from the [original discussion](https://www.reddit.com/r/generative/comments/9opi59/cool_generative_artists_and_their_websites/),
including reconstructed domain references labelled as such. These are links, not 83 unique artists:
a person may have several sites, and repositories, galleries and tools also appear.

At screen time, 22 references were associated with the selected deep audits; 30 were screened
without a deep collection census; 13 returned public shells; 16 were assessed as access failures;
one was parked/replaced and one was under construction. A total of 66 returned HTTP 200, which
is plainly insufficient evidence of usable collection access. These screen classifications are
about the specific link, not permanent judgments about an artist or a claim that no alternate
source exists. Molnar’s institutional source, for example, is usable even though an older
commercial-gallery link in the discovery material is blocked.

The unexpanded breadth includes named references such as Corina Lipavsky, Biosrhythm,
Fragmentarism, Quasimondo, p5aholic, Payton Turnage, Andrew Heumann, Variable, FIELD, Binaura,
Patrik Hübner, Ian Cheng, Sojamo, MESO, Frank Force and several code or Tumblr archives. The
screen records their exact links; this document does not recast them as completed artist research.
Access failures include the old Fleen and Grant Stewart pages, Manoloide’s original domain,
Feltron, some OpenProcessing/CodePen references, epimorphism, seni.app, Ren Yuan and the linked
Zach Lieberman Medium article. Repositories or successor sites may still contain useful work.

Within the selected groups, artist-index completeness and usable-image coverage must also remain
separate. A reachable page with a missing image, a live Canvas piece without a poster, a blocked
video thumbnail and an unavailable external archive are different gaps. None establishes absence
of the artwork or its technique. The named exclusions and inaccessible records should travel
with any exported selection or later coverage claim.

## Provenance and reuse

Stable record IDs connect selections to their census rows. Source URLs, evidence URLs, available
image counts where supplied, selection rationales, image roles, review stages and limitations
preserve the path from artist index to representative image. Sources may change after the research
date; stored hashes and retrieval receipts support an audit of the actual collected material.
Parent hubs and overlapping tags must be resolved through their referenced work IDs rather than
added to child totals. Historical extraction summaries are retained as context, not as a competing
count authority over the final manifest.

Copyright and collaborator credits remain with the named creators. Local access is for reference
study; collection inclusion grants no redistribution, artwork-reuse or model-training permission.
The assets are not package examples and should not be copied into runtime tests or distributable
samples. A later implementation proposal needs its own algorithmic evidence, public boundary,
independently specified behavior and scoped reproduction review. These reference selections
provide visible targets and source leads; they do not perform that admission work.

## Reopen or recollect

Open the [local searchable gallery](../.work/external-art-corpus/index.html). It filters by artist,
technique/title and coverage status, and each image opens its original downloaded bytes. Animated thumbnails use the frame at
75% of the frame sequence so initial empty growth states do not dominate navigation; full
animations remain available. This is a preview heuristic, not temporal-behavior validation. Missing
views link back to their attributed source. The gallery’s source images are local; artist links
require network access.

```sh
# Rebuild the gallery from existing receipts and hash-verified local images.
python3 tools/collect_external_art.py

# Fetch selected URLs, preserving existing valid originals.
python3 tools/collect_external_art.py --fetch

# Defer a rate-limited host while retrieving other selections.
python3 tools/collect_external_art.py --fetch --defer-host live.staticflickr.com
```

The collector uses Python, requests and Pillow, validates raster decoding or SVG XML/dimensions,
rejects files over 32 MiB and images below 64 pixels on either side, and stores originals by
content hash. It spaces host requests and honors numeric Retry-After cooldowns. Do not repeatedly
rerun a blocked host. A source-published smaller image can be selected explicitly with provenance;
the collector does not silently substitute another work. Reas’s signed image links can expire,
so refresh those from the stable catalogue page when recollecting.

The [root research review](../evidence/external-art/2026-09/root-review.json) separates actual
visual inspection, worker source audits, technical comparison and future implementation claims.
The [default palette guide](default-palettes.md) provides the additional reusable color library.
