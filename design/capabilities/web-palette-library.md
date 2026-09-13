App palette library contract (root, 2026-09-13)
Artist task: define an ordered color collection once and reuse it across sketches/layers.
Computation removed: repeated color entry and prompt formatting, not a new art algorithm.
Alternative: existing per-layer color inputs; retained for independent adjustments.
Output: named snapshots of 2–12 opaque RGB hex colors, matching existing workflow bounds.
Edits: color picking/hex, ordering, add/remove, rename, duplicate, delete; prompt output is an editable unsaved draft.
Transfer: shared server collection across Studio, technique previews, and prompt generation in Studio/Explorations.
Application copies colors into workflow documents (undoable); editing/deleting library entries never changes existing sketches. Source layers use explicit prompt revisions with exact selected colors, preserving the existing candidate/apply flow; no pretend direct recoloring of arbitrary source.
Storage: atomic JSON in harness/palettes with optimistic revisions, path-validated ids, strict request validation, same-origin mutation guard. No source execution for palette creation.
Prompt: existing configured model, one bounded JSON response, timeout/cancellation, validate name/color count/hex; failure preserves draft. User reviews and saves explicitly.
Evidence: new app design, no corpus recreation or portable operation support claim. Validate persistence/conflicts/bad input, native application/undo/export, responsive editing and prompt payload; separately observe real model output.
