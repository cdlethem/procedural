# ProfileMarks JavaScript package

JavaScript0.7.0 adds retained radial-profile meshes and the ProfileMarks browser starter
to the ten previously packaged operations. This is a reviewed local distribution, not an
npm registry release. Android support for ProfileMarks remains pending.

Build from source with Node/npm and the repository's accepted evidence present:

```sh
node tools/build_profile_marks_javascript.mjs --output .work/dist/cp7/javascript-profile-new
```

The output directory must be fresh. The command creates a package tarball and a starter
ZIP, installs the package, and checks the complete geometry from the installed and
extracted starter. It does not launch a browser or render.

Extract `procedurals-profile-marks-browser-0.7.0.zip`, enter the extracted directory,
run `npm ci`, then `npm start`. Open the printed localhost URL. The starter installs its
bundled package tarball and pins p5 to2.3.2. Node/npm and access to the pinned p5 dependency
are required; toolchains and installed dependencies are not bundled.

Use P to choose a form, D to change subdivisions, B/T to toggle caps, C for palette,
X for the three-form arrangement, 0 to reset and S to save the displayed image.
Edit `profile-marks.js` to supply your own increasing axial/radius pairs; edit `sketch.js`
to change placement, lighting or triangle treatment. These example settings are not
measured parameter recommendations.

The package root exports `RadialProfile3D` and `RadialProfileError`. The operation returns
retained indexed triangles, flat face normals and band/cell/kind metadata. Profile selection,
palette and arrangement reuse geometry; subdivision and closure changes regenerate it.
See the [operation reference](reference/operations.md) and
[workflow boundary](../design/capabilities/profile-marks-port-boundary.md).

Acceptance is recorded in `evidence/distribution/profile-javascript-review.json`.
The native WEBGL evidence is separate from the archive/installed-consumer checks; neither
claims cross-renderer pixel identity or a recreation of an original sketch.
