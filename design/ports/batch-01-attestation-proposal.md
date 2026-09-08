# Port batch 01 — proposed attestation updates (pending root review)

Porting-agent proposal for the two circle-placement operations after the
p5.js, py5 and Processing-for-Android slices. Root owns these files; this
document is the reviewable diff, not an applied change. Nothing here is
accepted: the `acceptance_review` fields are placeholders and the rows must
not be published until root creates acceptance records and fills them in.

## Binding

- Baseline commit: `5de3c712` (porting baseline; see batch-01-checkpoint.md)
- Branch: `porting/batch-01`
- Slice commits:
  - `99110da5` — JavaScript core export (filter + placement)
  - `688670b8` — p5 browser acceptance harness + evidence
  - `e04c165e` — Python core + py5 PlacementMarks workflow
  - `a8681d8a` — Android example + native acceptance evidence
- Contracts (unchanged by this batch):
  - `sampling.ordered-circle-filter-2d` v0.1.0, catalog `catalog/operations/ordered-circle-filter.json`
    sha256 `d4e93aa0dc219b0730af1e3eecad5cb9a8be3030e9f0761b9b23d0886f6c2083`
  - `sampling.seeded-circle-placement-2d` v0.1.0, catalog `catalog/operations/seeded-circle-placement.json`
    sha256 `04de90b19cbd39a5aa4840dfd1ee80cbeb96b69b9981af95b176be7bc0480267`

## Evidence files added by this batch (checked in)

| File | sha256 |
|---|---|
| `evidence/conformance/circle-placement-javascript.json` | `643ce9b3ac057f45e67180a6a80a87fdb13bac6edaedd2c9a85ffcffe9438cec` |
| `evidence/conformance/circle-placement-python.json` | `2165668bdec4f64973765869e1b4b33382988490e64b8e6141925bde5a49e174` |
| `evidence/conformance/p5js-placement-marks.json` | `70284ed473e74409a3d115f4ffefd31ec92e0ae2af117279f2a75bb6bb8e4818` |
| `evidence/conformance/py5-placement-marks.json` | `c100f0aa2d4b71ac9b4ae41072238d52174b1be1b156574b31edbe0290d7b008` |
| `evidence/reproductions/placement-marks-android/result.json` | `b46910af5b00f170061e123e3dd476dcf67713ecd281ca23003da7c49e2b7180` |
| `evidence/reproductions/placement-marks-android/plan.json` | `88c1244c873279bb8e12a709ee96d6d95d7b3c8e451a981da0d659d0f3482539` |

Existing accepted evidence reused for the Android core row:
`evidence/conformance/circle-placement-java.json`
sha256 `0d9c43fa6bea71335b1e9d2808b819f1e38585ab73da1ee1a315484b1eb34258`
(same file already bound by the accepted `processing-java` core row).

Fixture files (unchanged, re-bound per row):
- `fixtures/operations/ordered-circle-filter.json` `b5fb3743676b6a268b3cfa8467e727a2e713482feff2fa44ac08c71d976f103b`
- `fixtures/operations/seeded-circle-placement.json` `c625d372435be9ae25e721407458ba4c189cfae48c09e4cd530ebfa6e8240699`

## Implementation files and hashes

| File | sha256 | Used by |
|---|---|---|
| `packages/javascript/src/circle-placements.js` | `1d4c1896f99fc9213d225caf488b22053f854951b4ee281f1cdf9887dab4e567` | p5js core/native/technique |
| `packages/javascript/examples/placement-marks/README.md` | `2308b7daad9221fa16a1745f922f101603258ab185c5640cf52d0decb764ecf1` | p5js native/technique |
| `packages/javascript/examples/placement-marks/index.html` | `c86ceefc040d7cc80f6009bc517e1194e145d24ae677c499bcde6ed400a18318` | p5js native/technique |
| `packages/javascript/examples/placement-marks/placement-marks.js` | `17e7081a5c3e6a3353082e5b537ba71fd82b17d875c977744b2ad7bc7a063382` | p5js native/technique |
| `packages/javascript/examples/placement-marks/sketch.js` | `96a2c8e20c552dcdeac1e26a07150d9b116e01cdb568ade419028001b462375c` | p5js native/technique |
| `packages/python/procedurals/placements.py` | `d5cad0c7174eb2927f1e49f9f8228b529bf3737ef86a93252f3c55286af7244d` | py5 core/native/technique |
| `packages/python/examples/placement_marks/README.md` | `a37dfb3383eabfa9a3aed507a8779e9cdbed11717f495dbbe55ab3c8b2f55ba1` | py5 native/technique |
| `packages/python/examples/placement_marks/placement_marks.py` | `a50aaa217801422b90d9146ac2670e0a612d62ffc081228ad23f0f6962ea36d0` | py5 native/technique |
| `packages/python/examples/placement_marks/sketch.py` | `dc51f15358a1ed3ba8342aff3ebd994d24ac3ebd6e751a43f8cb0a43bb9ace7b` | py5 native/technique |
| `packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java` | `2df9fcf8cd89d8a82b4c9b25628e841a478e8e4e01b0e1e904538c7a2408baac` | processing-android all rows (shared core) |
| `packages/java-android/examples/PlacementMarks/AndroidManifest.xml` | `5b508021536f85b637fae1ee7c64788ebf009434dd735f9f49a83fa5ce655c01` | Android native/technique |
| `packages/java-android/examples/PlacementMarks/PlacementMarksActivity.java` | `e7fee124da66464cb6240780c9f9fa73872d6f11ba653d7e5330b5342d96c050` | Android native/technique |
| `packages/java-android/examples/PlacementMarks/PlacementMarksRenderer.java` | `c4b6d9780da7c7dae0a6b5d1d9e4d4a69b44d8e641d36ecc85d2914a84905f2a` | Android native/technique |
| `packages/java-android/examples/PlacementMarks/README.md` | `dbbe20e5f2a2ebd510e54df874f147f950a3de5dd8fe0267b4d4a07352f48425` | Android native/technique |
| `tests/native/android-placement-marks/PlacementMarksProbeActivity.java` | `f24e11d9c4fcd1653c060eb31f8ccfb5fb16c8b144fee2394498ac7ce9a7a2f8` | Android native/technique |

## Proposed rows

The `acceptance_review` blocks are intentionally invalid placeholders
(`<pending…>`); the catalog checker must reject them until root replaces them
with a real accepted review record (path + sha256), as done for the accepted
`processing-java` rows (`evidence/distribution/cp3-review.json`).

### `catalog/validation/ordered-circle-filter.json`

#### p5js

```json
{
  "core": {
    "status": "conformant",
    "implementation_sha256": {
      "packages/javascript/src/circle-placements.js": "1d4c1896f99fc9213d225caf488b22053f854951b4ee281f1cdf9887dab4e567"
    },
    "evidence_sha256": {
      "evidence/conformance/circle-placement-javascript.json": "643ce9b3ac057f45e67180a6a80a87fdb13bac6edaedd2c9a85ffcffe9438cec",
      "fixtures/operations/ordered-circle-filter.json": "b5fb3743676b6a268b3cfa8467e727a2e713482feff2fa44ac08c71d976f103b"
    },
    "evidence_predicates": [
      { "path": "evidence/conformance/circle-placement-javascript.json", "pointer": "/status", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-javascript.json", "pointer": "/host_access_ownership", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-javascript.json", "pointer": "/fixtures/ordered_cases", "equals": 37 },
      { "path": "evidence/conformance/circle-placement-javascript.json", "pointer": "/fixtures/ordered_native_only_cases", "equals": 3 }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "Node.js v22.22.1; JavaScript 2023 semantics (Number.isFinite, Math.fround)",
      "scope": "JavaScript pure ordered-filter fixtures, host ownership/access and malformed-input checks; no renderer claim."
    }
  },
  "native": {
    "status": "validated-scoped",
    "implementation_sha256": {
      "packages/javascript/src/circle-placements.js": "1d4c1896f99fc9213d225caf488b22053f854951b4ee281f1cdf9887dab4e567",
      "packages/javascript/examples/placement-marks/README.md": "2308b7daad9221fa16a1745f922f101603258ab185c5640cf52d0decb764ecf1",
      "packages/javascript/examples/placement-marks/index.html": "c86ceefc040d7cc80f6009bc517e1194e145d24ae677c499bcde6ed400a18318",
      "packages/javascript/examples/placement-marks/placement-marks.js": "17e7081a5c3e6a3353082e5b537ba71fd82b17d875c977744b2ad7bc7a063382",
      "packages/javascript/examples/placement-marks/sketch.js": "96a2c8e20c552dcdeac1e26a07150d9b116e01cdb568ade419028001b462375c"
    },
    "evidence_sha256": {
      "evidence/conformance/p5js-placement-marks.json": "70284ed473e74409a3d115f4ffefd31ec92e0ae2af117279f2a75bb6bb8e4818"
    },
    "evidence_predicates": [
      { "path": "evidence/conformance/p5js-placement-marks.json", "pointer": "/status", "equals": "passed" },
      { "path": "evidence/conformance/p5js-placement-marks.json", "pointer": "/native/model/passed", "equals": true },
      { "path": "evidence/conformance/p5js-placement-marks.json", "pointer": "/native/model/counts/baseline", "equals": 424 },
      { "path": "evidence/conformance/p5js-placement-marks.json", "pointer": "/native/save_png/matches_current_canvas", "equals": true }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "Chromium 153.0.8010.12 (p5.js 1.x browser build); canvas 2D at 640x640",
      "scope": "Browser-loaded PlacementMarks module: 21 rendered states, seed/budget/source edits, cached Save PNG equal to the displayed canvas, keyboard-triggered palette edit. No cross-host pixel-identity claim."
    }
  },
  "technique": {
    "status": "validated-scoped",
    "implementation_sha256": {
      "packages/javascript/src/circle-placements.js": "1d4c1896f99fc9213d225caf488b22053f854951b4ee281f1cdf9887dab4e567",
      "packages/javascript/examples/placement-marks/README.md": "2308b7daad9221fa16a1745f922f101603258ab185c5640cf52d0decb764ecf1",
      "packages/javascript/examples/placement-marks/index.html": "c86ceefc040d7cc80f6009bc517e1194e145d24ae677c499bcde6ed400a18318",
      "packages/javascript/examples/placement-marks/placement-marks.js": "17e7081a5c3e6a3353082e5b537ba71fd82b17d875c977744b2ad7bc7a063382",
      "packages/javascript/examples/placement-marks/sketch.js": "96a2c8e20c552dcdeac1e26a07150d9b116e01cdb568ade419028001b462375c"
    },
    "evidence_sha256": {
      "evidence/conformance/p5js-placement-marks.json": "70284ed473e74409a3d115f4ffefd31ec92e0ae2af117279f2a75bb6bb8e4818"
    },
    "evidence_predicates": [
      { "path": "evidence/conformance/p5js-placement-marks.json", "pointer": "/native/radial_transfer/matches_java_count", "equals": true },
      { "path": "evidence/conformance/p5js-placement-marks.json", "pointer": "/native/radial_transfer/accepted", "equals": 111 },
      { "path": "evidence/conformance/p5js-placement-marks.json", "pointer": "/native/model/prefix5000Of10000", "equals": true },
      { "path": "evidence/conformance/p5js-placement-marks.json", "pointer": "/native/keyboard_edit/composition", "equals": "palette" }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "Chromium 153.0.8010.12 (p5.js 1.x browser build); canvas 2D at 640x640",
      "scope": "Root-inspectable p5 PlacementMarks technique: authored radial transfer (111 of 160, matching accepted Java count), budget extension retaining the accepted prefix, retained motif/palette edits, ignored edits while radial. Radial host trigonometry recorded, not asserted. No upstream-pixel or full-corpus claim."
    }
  }
}
```

#### py5

```json
{
  "core": {
    "status": "conformant",
    "implementation_sha256": {
      "packages/python/procedurals/placements.py": "d5cad0c7174eb2927f1e49f9f8228b529bf3737ef86a93252f3c55286af7244d"
    },
    "evidence_sha256": {
      "evidence/conformance/circle-placement-python.json": "2165668bdec4f64973765869e1b4b33382988490e64b8e6141925bde5a49e174",
      "fixtures/operations/ordered-circle-filter.json": "b5fb3743676b6a268b3cfa8467e727a2e713482feff2fa44ac08c71d976f103b"
    },
    "evidence_predicates": [
      { "path": "evidence/conformance/circle-placement-python.json", "pointer": "/status", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-python.json", "pointer": "/host_access_ownership", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-python.json", "pointer": "/fixtures/ordered_cases", "equals": 37 },
      { "path": "evidence/conformance/circle-placement-python.json", "pointer": "/fixtures/ordered_native_only_cases", "equals": 3 }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "CPython 3.14.4",
      "scope": "Python pure ordered-filter fixtures, host ownership/access, malformed-input and native invariants; no py5 renderer claim."
    }
  },
  "native": {
    "status": "validated-scoped",
    "implementation_sha256": {
      "packages/python/procedurals/placements.py": "d5cad0c7174eb2927f1e49f9f8228b529bf3737ef86a93252f3c55286af7244d",
      "packages/python/examples/placement_marks/README.md": "a37dfb3383eabfa9a3aed507a8779e9cdbed11717f495dbbe55ab3c8b2f55ba1",
      "packages/python/examples/placement_marks/placement_marks.py": "a50aaa217801422b90d9146ac2670e0a612d62ffc081228ad23f0f6962ea36d0",
      "packages/python/examples/placement_marks/sketch.py": "dc51f15358a1ed3ba8342aff3ebd994d24ac3ebd6e751a43f8cb0a43bb9ace7b"
    },
    "evidence_sha256": {
      "evidence/conformance/py5-placement-marks.json": "c100f0aa2d4b71ac9b4ae41072238d52174b1be1b156574b31edbe0290d7b008"
    },
    "evidence_predicates": [
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/status", "equals": "passed" },
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/native/passed", "equals": true },
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/native/compositions", "equals": 17 },
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/native/save_png/matches_current_canvas", "equals": true }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "py5 0.10.11a0 on CPython 3.14.4, PyGDI offscreen at 640x640",
      "scope": "Actual py5 PlacementMarks starter: 17 registered compositions, setup/key_pressed callback lifecycle, cached save equal to the displayed canvas, 300ms quiet observation. No cross-host pixel-identity claim."
    }
  },
  "technique": {
    "status": "validated-scoped",
    "implementation_sha256": {
      "packages/python/procedurals/placements.py": "d5cad0c7174eb2927f1e49f9f8228b529bf3737ef86a93252f3c55286af7244d",
      "packages/python/examples/placement_marks/README.md": "a37dfb3383eabfa9a3aed507a8779e9cdbed11717f495dbbe55ab3c8b2f55ba1",
      "packages/python/examples/placement_marks/placement_marks.py": "a50aaa217801422b90d9146ac2670e0a612d62ffc081228ad23f0f6962ea36d0",
      "packages/python/examples/placement_marks/sketch.py": "dc51f15358a1ed3ba8342aff3ebd994d24ac3ebd6e751a43f8cb0a43bb9ace7b"
    },
    "evidence_sha256": {
      "evidence/conformance/py5-placement-marks.json": "c100f0aa2d4b71ac9b4ae41072238d52174b1be1b156574b31edbe0290d7b008"
    },
    "evidence_predicates": [
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/native/radial_transfer/matches_java_count", "equals": true },
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/native/retained_style_edits", "equals": true },
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/native/rebuild_replaced", "equals": true },
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/native/extended_accepted_prefix", "equals": true },
      { "path": "evidence/conformance/py5-placement-marks.json", "pointer": "/native/ignored_while_radial", "equals": true }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "py5 0.10.11a0 on CPython 3.14.4, PyGDI offscreen at 640x640",
      "scope": "Root-inspectable py5 PlacementMarks technique: authored radial transfer (111 of 160, matching accepted Java count), retained motif/palette edits, rebuild replacement on geometry edits, budget extension retaining the accepted prefix, ignored edits while radial, keyboard-triggered palette edit. Radial host trigonometry recorded, not asserted. No upstream-pixel or full-corpus claim."
    }
  }
}
```

#### processing-android

```json
{
  "core": {
    "status": "conformant",
    "implementation_sha256": {
      "packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java": "2df9fcf8cd89d8a82b4c9b25628e841a478e8e4e01b0e1e904538c7a2408baac"
    },
    "evidence_sha256": {
      "evidence/conformance/circle-placement-java.json": "0d9c43fa6bea71335b1e9d2808b819f1e38585ab73da1ee1a315484b1eb34258",
      "fixtures/operations/ordered-circle-filter.json": "b5fb3743676b6a268b3cfa8467e727a2e713482feff2fa44ac08c71d976f103b"
    },
    "evidence_predicates": [
      { "path": "evidence/conformance/circle-placement-java.json", "pointer": "/vectors/status", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-java.json", "pointer": "/vectors/fixture_cases", "equals": 68 },
      { "path": "evidence/conformance/circle-placement-java.json", "pointer": "/native/status", "equals": "passed" }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "OpenJDK 17.0.20.1; shared Java core tested on the host JVM",
      "scope": "Shared Java implementation identical to the accepted processing-java core row; host JVM test only, does not imply every fixture ran on ART. The Android APK embedded the same core for the native rows below."
    }
  },
  "native": {
    "status": "validated-scoped",
    "implementation_sha256": {
      "packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java": "2df9fcf8cd89d8a82b4c9b25628e841a478e8e4e01b0e1e904538c7a2408baac",
      "packages/java-android/examples/PlacementMarks/AndroidManifest.xml": "5b508021536f85b637fae1ee7c64788ebf009434dd735f9f49a83fa5ce655c01",
      "packages/java-android/examples/PlacementMarks/PlacementMarksActivity.java": "e7fee124da66464cb6240780c9f9fa73872d6f11ba653d7e5330b5342d96c050",
      "packages/java-android/examples/PlacementMarks/PlacementMarksRenderer.java": "c4b6d9780da7c7dae0a6b5d1d9e4d4a69b44d8e641d36ecc85d2914a84905f2a",
      "packages/java-android/examples/PlacementMarks/README.md": "dbbe20e5f2a2ebd510e54df874f147f950a3de5dd8fe0267b4d4a07352f48425",
      "tests/native/android-placement-marks/PlacementMarksProbeActivity.java": "f24e11d9c4fcd1653c060eb31f8ccfb5fb16c8b144fee2394498ac7ce9a7a2f8"
    },
    "evidence_sha256": {
      "evidence/reproductions/placement-marks-android/result.json": "b46910af5b00f170061e123e3dd476dcf67713ecd281ca23003da7c49e2b7180",
      "evidence/reproductions/placement-marks-android/plan.json": "88c1244c873279bb8e12a709ee96d6d95d7b3c8e451a981da0d659d0f3482539"
    },
    "evidence_predicates": [
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/status", "equals": "passed" },
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/native/composition_count", "equals": 17 },
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/native/completed_frame_count", "equals": 18 },
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/saved/bytes_equal_frame_17", "equals": true }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "Android 13 (API 33) x86_64 emulator (emulator-5580), Android2D, 640x640 density 1",
      "scope": "Isolated probe APK on the pinned AVD: 17 registered compositions with Java-matching counts, retained style edits, budget extension retaining the accepted prefix, four ignored taps while radial producing no frame, restoration frames pixel-identical, cached save bytes equal to the displayed frame and published to MediaStore, 300ms quiet observation. Motif outlines are round-capped segment2 sequences (no closed outline command in the Android2D vocabulary); no cross-host pixel-identity claim."
    }
  },
  "technique": {
    "status": "validated-scoped",
    "implementation_sha256": {
      "packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java": "2df9fcf8cd89d8a82b4c9b25628e841a478e8e4e01b0e1e904538c7a2408baac",
      "packages/java-android/examples/PlacementMarks/AndroidManifest.xml": "5b508021536f85b637fae1ee7c64788ebf009434dd735f9f49a83fa5ce655c01",
      "packages/java-android/examples/PlacementMarks/PlacementMarksActivity.java": "e7fee124da66464cb6240780c9f9fa73872d6f11ba653d7e5330b5342d96c050",
      "packages/java-android/examples/PlacementMarks/PlacementMarksRenderer.java": "c4b6d9780da7c7dae0a6b5d1d9e4d4a69b44d8e641d36ecc85d2914a84905f2a",
      "packages/java-android/examples/PlacementMarks/README.md": "dbbe20e5f2a2ebd510e54df874f147f950a3de5dd8fe0267b4d4a07352f48425",
      "tests/native/android-placement-marks/PlacementMarksProbeActivity.java": "f24e11d9c4fcd1653c060eb31f8ccfb5fb16c8b144fee2394498ac7ce9a7a2f8"
    },
    "evidence_sha256": {
      "evidence/reproductions/placement-marks-android/result.json": "b46910af5b00f170061e123e3dd476dcf67713ecd281ca23003da7c49e2b7180"
    },
    "evidence_predicates": [
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/ignored_while_radial/result_present", "equals": false },
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/ignored_while_radial/frame_16_present", "equals": false },
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/native/frames/14/accepted", "equals": 111 },
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/native/frames/14/proposals", "equals": 160 },
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/native/frames/1/retained_identity", "equals": true },
      { "path": "evidence/reproductions/placement-marks-android/result.json", "pointer": "/native/frames/11/prefix_checked", "equals": true }
    ],
    "acceptance_review": { "path": "<pending root acceptance record for port batch 01>", "sha256": "<pending>" },
    "runtime_profile": {
      "name": "Android 13 (API 33) x86_64 emulator (emulator-5580), Android2D, 640x640 density 1",
      "scope": "Root-inspectable Android PlacementMarks technique: authored radial transfer (111 of 160, matching accepted Java count and JVM-dumped band structure), motif/palette substitution retaining the composition, seed/budget edits rebuilding it, ignored edits while radial, cached save round-trip through MediaStore. Radial band structure verified against a JVM dump of the same PlacementComposition. No upstream-pixel or full-corpus claim."
    }
  }
}
```

### `catalog/validation/seeded-circle-placement.json`

Same shape; the only differences from the filter rows are the seeded-side
evidence counts and fixtures. Proposed rows:

- **p5js core** — same implementation and evidence as the filter p5js core
  row, with the seeded-side predicates:

```json
    "evidence_predicates": [
      { "path": "evidence/conformance/circle-placement-javascript.json", "pointer": "/status", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-javascript.json", "pointer": "/host_access_ownership", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-javascript.json", "pointer": "/fixtures/seeded_cases", "equals": 31 },
      { "path": "evidence/conformance/circle-placement-javascript.json", "pointer": "/fixtures/seeded_native_only_cases", "equals": 4 }
    ],
```

  and `fixtures/operations/seeded-circle-placement.json`
  `c625d372435be9ae25e721407458ba4c189cfae48c09e4cd530ebfa6e8240699` in
  `evidence_sha256`. `acceptance_review` and `runtime_profile` identical to
  the filter p5js core row.

- **p5js native / technique** — byte-identical rows to the filter p5js
  native/technique rows (same implementation, same evidence file, same
  predicates): the p5 acceptance run exercises the seeded placement
  composition in every one of its 21 rendered states.

- **py5 core** — same implementation and evidence as the filter py5 core row,
  with the seeded-side predicates:

```json
    "evidence_predicates": [
      { "path": "evidence/conformance/circle-placement-python.json", "pointer": "/status", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-python.json", "pointer": "/host_access_ownership", "equals": "passed" },
      { "path": "evidence/conformance/circle-placement-python.json", "pointer": "/fixtures/seeded_cases", "equals": 31 },
      { "path": "evidence/conformance/circle-placement-python.json", "pointer": "/fixtures/seeded_native_only_cases", "equals": 4 }
    ],
```

  and the seeded fixture binding in `evidence_sha256`.
  `acceptance_review` and `runtime_profile` identical to the filter py5 core
  row.

- **py5 native / technique** — byte-identical rows to the filter py5
  native/technique rows.

- **processing-android core** — same row as the filter processing-android core
  row, with the seeded fixture binding replacing the filter fixture binding in
  `evidence_sha256`.

- **processing-android native / technique** — byte-identical rows to the
  filter processing-android native/technique rows (the probe APK and its
  17-composition sequence exercise the seeded placement in every state).

## What root must do to apply

1. Review the evidence files, the two acceptance documents
   (`design/capabilities/placement-marks-p5-acceptance.md`, the py5 and
   Android evidence above) and the rendered images referenced by them.
2. Create the batch acceptance record (e.g.
   `evidence/distribution/port-batch-01-review.json`, mirroring
   `cp3-review.json`) and record its sha256.
3. Replace every `<pending…>` `acceptance_review` block with that record.
4. Apply the rows to the two attestation files, then regenerate the
   generated reference through the catalog checker and run the unit tests.
5. If any row is rejected, the corresponding target rows stay
   `unvalidated`; the evidence files remain valid for a corrected proposal.

## Known platform differences (already documented in example READMEs)

- p5.js: canvas 2D rasterizer; no cross-host pixel identity with Java/Python.
- py5: PyGDI offscreen rasterizer; save via `save()` decoded and compared.
- Android: Android2D has no closed stroked outline command; motif outlines
  are submitted as round-capped `segment2` sequences (accepted PathMarks
  polyline convention). Save round-trips through MediaStore; density 1.
  Host JVM success was never claimed for ART; all native claims above are
  from the pinned emulator session under the shared machine render lease.
- Radial composition trigonometry is host-side in every non-Java target and
  is recorded, not asserted, as exact core semantics; accepted counts match
  the accepted Java evidence (111 of 160).
