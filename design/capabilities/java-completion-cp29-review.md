# Java completion reconciliation after CP29

Root review of pushed Java0.32.0 baseline
`40fb809aea694eda3cab31bf9fd1b829eeb6a27f`. The five requirements in
`docs/java-completion-plan.md` remain the acceptance criteria. This review records
current evidence and concrete remaining work; it does not declare feature completeness.

| Requirement | Current authoritative evidence | Conclusion and remaining work |
| --- | --- | --- |
| Install and edit an extracted distribution | `evidence/distribution/cp29-java-review.json` and consumer record:34 extracted PDEs compile; actual installed-JAR ClipMarks edit/reset/save sequence passes | Installation/execution evidence is present. Entry-guide audit found stale README counts and an ambiguous archive extraction step; corrections are authored and local links resolve. Review those changes together with the next documentation checkpoint. |
| Major idioms with explicit family boundaries | `docs/choosing-java-workflow.md`, `java-rare-family-review.md`, CP27 family review, operation catalogs | Named entry points cover the implemented families. Symbolic grammars, nearest-site Voronoi cells, glyph outlines/shaping and arbitrary solid modeling remain explicitly unsupported, with bounded source reasoning. The clipping investigation is now implemented; plasma007 nearest-hit ray-web construction remains a distinct known gap, not covered by polygon clipping. No corpus-wide absence claim follows. |
| Reviewed operations and representative native workflows | Root ran the existing attestation loader on current catalogs:30 conformant Java cores,30 scoped native attestations, no binding errors | Scoped implementation evidence is present. Public entry-point documentation remains incomplete: RegularGrid and GradientPath2D lack complete parameter/accessor documentation. A bounded documentation-only batch is underway, preserving executable code. |
| Composability and assessed originals | Region/image callbacks, masks, image placement/sampling/filtering, retained clipping; `recreation-cohort-01.md` and its native reviews | Existing evidence demonstrates substitution and retained composition; the deliberately selected three-original cohort is demonstrated at its declared structural fidelity. Existing project records report a fourth recreation separately. Do not extrapolate to826 reports or901 target originals. Four operations have no technique attestation: blur, disc projection, annular solid and clipping. Native workflow acceptance does not fill that gap. |
| Coherent documentation/tooling/licensing/performance | CP29 extracted source/license/font/reference checks; existing renderer/sweep tooling; new `docs/java-performance.md` links scoped measurements | Packaging evidence is present. The performance guide connects reuse and budgets but is not a uniform measurement of every current operation.689 Javadoc warnings remain in the accepted archive. Further documentation review must distinguish missing essential semantics from mechanical warning counts. |

## Next integration batch

1. Finish and review the authored install/README/performance guidance. Verify instructions
   against the actual archive, rather than rerender unchanged implementations.
2. Improve the two central grid/path public references. Preserve every executable token;
   verify class equivalence and Javadoc output. Root reviews semantic descriptions against
   the catalog and code before carrying support forward.
3. Update the current planning documents to this reconciliation. Keep historical source
   reviews intact. After this bounded batch, audit remaining public entry points for missing
   artist-critical semantics and resolve any concrete gaps before completion acceptance.

No new algorithm is admitted by this review. Ray-web trimming is a known distinct gap;
its source-dependent order and degeneracy behavior require a separate capability decision
if pursued. General callback composition is already available for rectangular regions,
while irregular masks control pixels and polygon clipping returns segment geometry. These
capabilities should keep their different output types and promises.
