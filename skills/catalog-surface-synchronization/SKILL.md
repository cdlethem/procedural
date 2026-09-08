---
name: catalog-surface-synchronization
description: Generate or validate documentation, schemas and target metadata derived from the operation catalog without creating conflicting behavioral authorities.
---

# Catalog surface synchronization

`catalog/operations/*.json` is the operation authority; `catalog/drawing/*.json` holds
shared drawing values and adapter profiles. Draft entries remain design work, not frozen
contracts. Source candidate decisions remain
in the authored Phase 2 ledger. Derived references, validation schemas, target metadata and
later MCP/web/export surfaces must name the operation ID/version and derive their metadata
from the catalog. Do not create another hand-maintained defaults/ranges/support table.

Before adding a consumer:

1. Identify the catalog fields it reads and whether it transforms, omits or presents them.
   Do not silently invent defaults, weaken validation or advertise an unvalidated target.
2. Generate mirrored files deterministically. Supply a check mode that compares generated
   content with the current file and fails on drift, missing entries and stale versions.
3. Validate catalog schemas, motivating note/evidence hashes, reviewed decision membership,
   fixture references and declared target states. A status field alone is not test evidence.
4. Run the shared contract fixtures through each native implementation. Generated metadata
   does not prove code obeys it; implementation algorithms need independent conformance tests.
5. If the catalog changes behavior, update version, fixtures and every affected consumer in
   the same integration step. Report consumers or targets that remain unvalidated.

Generate artist-facing references from the catalog, but keep conceptual tutorials and
capability decisions authored. Generated reference text must preserve the distinction between
example configuration, mathematical validity, artistic recommendations and measured ranges.
Do not generate a recipe executor, MCP schema or web control before its own lifecycle gate.
