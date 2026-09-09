# Depth marks in the browser

This source-checkout starter samples a 3D gradient-noise field (`field.gradient-noise-3d-01`)
at one depth slice, drawn either as a planar 60×60 dot field (noise-driven angle,
length, and palette phase) or transferred onto a retained rounded-profile mesh
(`mesh.radial-profile-surface-3d`) sampled at each face centre and lit with per-face
normals.

Platform note: Processing's P3D renderer keeps `(0,0)` at the canvas's top-left
corner, matching its 2D renderer. p5's WEBGL renderer centres the origin instead, so
the planar mode re-applies a top-left translate and the mesh mode's Java recentring
translate is dropped; p5's `normal()` supplies the same explicit per-face lighting
normals the Java sketch computes from the mesh.

This starter is not a browser-native conformance or reproduction claim; it is a
scoped port of the accepted DepthMarks composition's mechanism to p5.js.
