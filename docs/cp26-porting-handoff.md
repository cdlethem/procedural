# CP26 Java0.29 handoff (historical milestone)

For a new assignment, use [the current port handoff](porting-resume.md). Counts and
artifact identifiers below describe this historical milestone, not current main.

Root remains final integration owner; port workers must not write root acceptance records.

This checkpoint adds raster.separable-blur-2d (normalized independent kernels, premultiplied
encoded color, final-only byte rounding, explicit work budget). The authoritative contract
and20 shared fixtures are tracked; Java object conversion also checks LinkedList parity.
ProcessingImageField snapshots images and samples ARGB/alpha/maxRGB through the existing
remap kernel. ProcessingImageFilters transports completed RGB/ARGB images to the blur core.
New workflows: ImageFieldMarks and BlurMarks, both with seven-state native/extracted checks.
Total accepted Java inventory:27 operations and31 workflows. No other target is newly
attested by this milestone; complete original shader recreation is not claimed.

Remaining: port these semantics/adapters/workflows after existing backlog as directed;
validate representative native output and shared vectors before requesting root integration.
Use the machine-wide tools/with_native_render_lock.py lease for native renders across
checkouts. Preserve original provenance and keep all images/builds/assets outside Git.
Later Java completion is recorded in [the completion review](../evidence/distribution/java-completion-review.json).
