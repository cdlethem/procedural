# Phase 2 evidence inventory

Evidence revision: `b64fadf8cc484025f58a112b95630a7b0c420ea3`. Candidate dossiers are keyed by sketch path and source ordinal; this artifact does not cluster or choose public API signatures.

## Target/report coverage

| measure | count |
|---|---:|
| index targets | 901 |
| duplicate index lines | 0 |
| reports present | 826 |
| missing reports | 75 |
| extra report files | 0 |
| stub reports | 26 |
| candidate dossiers | 1934 |
| stale database hashes | 0 |
| snapshot count mismatches | 0 |

Missing and extra identities are listed in `evidence.json`; stubs remain report identities but are flagged as unusable visual evidence.

## Technique-family coverage

| family | sketches | candidate records |
|---|---:|---:|
| 3d-mesh | 95 | 227 |
| 3d-pointcloud | 41 | 84 |
| agents | 14 | 31 |
| blend-modes | 64 | 170 |
| curves | 89 | 231 |
| distortion | 134 | 314 |
| dots-stippling | 208 | 567 |
| flow-field | 38 | 91 |
| grid | 430 | 1091 |
| image-source | 33 | 73 |
| l-system | 1 | 1 |
| lines-hatching | 147 | 369 |
| noise-field | 345 | 868 |
| packing | 85 | 227 |
| particles | 110 | 273 |
| physics | 1 | 3 |
| pixel-ops | 28 | 80 |
| polar | 172 | 448 |
| recursion | 27 | 63 |
| shader | 50 | 141 |
| spiral | 13 | 29 |
| subdivision | 144 | 382 |
| symmetry | 71 | 175 |
| typography | 15 | 44 |
| voronoi-delaunay | 54 | 176 |

## Existing diagnostics

| diagnostic | count |
|---|---:|
| error:index_parse | 0 |
| warning:empty_parameter | 1 |
| warning:frontmatter | 53 |

## Reconciliation

Compared with: `none`.

| change | count |
|---|---:|
| snapshot changed | false |
| candidates added | 0 |
| candidates changed | 0 |
| candidates removed | 0 |
| ordinal drift after note change | 0 |
| note records added | 0 |
| note records changed | 0 |
| note records removed | 0 |

See `evidence.json` for complete dossiers, raw candidate records, provenance hashes, sketch-level parameter/variant context, and warnings.
