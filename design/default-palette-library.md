# Default palette library

Root boundary decision, 2026-09-17. User requested a default palette library inspired by the external-art corpus, with short evocative names describing colors rather than artists or artworks.

This is authored color data and product integration, not a new computational operation or a source-art recreation. It adds no RNG, noise, time, rendering or asset dependency to the numeric package.

- Canonical browser-compatible ES module: `packages/javascript/src/default-palettes.js`; public named export `defaultPalettes` re-exported from the package index after root review.
- Data schema: an array of `{id, name, colors, description, tags}`. IDs are stable lowercase hyphenated slugs. Names are short color descriptions. Colors are ordered lowercase six-digit RGB hex strings, 2–12 per palette. Description and tags describe colors/useful tonal character, never source authorship.
- Freeze the array, each record, and nested arrays. Consumers copy selected colors before editing. No mutation of shared defaults or persisted user palettes. Preserve order; do not assign universal background/accent semantics because current sketches use positions differently.
- The web PaletteLibrary displays built-in defaults alongside saved user palettes, searchable by name/color tags. A built-in can be applied with a detached `{name, colors}` snapshot or opened as a new editable draft via “Customize”. Saving that draft uses existing POST/create semantics. Built-ins cannot be edited/deleted in place and are not automatically written into the palette store.
- Use the existing PalettePicker in Gallery, Studio and prompts. Built-ins remain available if the saved-palette service is empty or unavailable. Existing user CRUD, revision checks, palette order, undo/redo and prompt semantics remain unchanged.
- Corpus image/source hashes and extraction/curation decisions belong in separate research evidence, not product-facing palette names or UI copy. This is inspiration, not an assertion of exact artist palettes or preferred color proportions.
- Acceptance: root visual inspection of swatches and representative colored studies; validate identifiers/names/colors and distinctness; existing palette tests plus focused checks for frozen defaults, detached apply/customize, no automatic storage writes, browser search/apply/customize, and a mobile layout check. Verify offline package includes/imports data. No deployment or registry publication is part of this slice.
