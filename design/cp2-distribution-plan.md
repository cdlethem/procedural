# PathMarks 0.2 distribution

Root decision: add a versioned 0.2.0 package lane for the reviewed path capability.
The operation contract remains version 0.1.0; package and operation versions describe
different surfaces. Historical I1 0.1.0 artifacts and evidence stay unchanged.

Build from the same source operations used by the accepted native examples. Stage
release metadata as 0.2.0, recording exact transformations rather than mutating source
files bound by native evidence. Outputs belong under `.work/dist/cp2/`; new consumer
reports belong under `evidence/distribution/cp2-*.json`. Include licenses and notices.
Fail on occupied output/evidence destinations rather than overwrite an accepted build.

For each target, the new lane must produce an installable core and an editable PathMarks
starter. Processing must include its separate adapter and all three sketch sources;
browser and Python starters must import installed package contents without checkout
path injection; Android must compile an extracted project with external runtime/SDK
dependencies and the new core. Preserve the existing operations in the new core.

Consumer checks establish package assembly and import/class origin, then execute a
named shared gradient-path fixture and compile or load the actual extracted starter.
Desktop also preprocesses the PDE through the pinned official preprocessor and checks
its binary64 distance configuration. These checks do not launch new native renders.
The accepted native reviews establish behavior of the byte-bound source examples;
consumer evidence records every necessary staging transformation. Packaging success
does not extend the supported renderer/runtime scope.

Android's original run failed a concrete-versus-base renderer string guard. Its
read-only recovery is a separate prerequisite for Android capability acceptance.
Do not describe CP2 as accepted on all four targets until the recovery and images
are reviewed. Registry publication, human installation studies and full-corpus pixel
reproduction are outside this local release's evidence.

The teaching entry is `docs/path-marks.md`; add concrete installation commands after
each artifact and consumer check exists. The piece must expose where to change starting
positions, field mapping and mark construction, and distinguish style retention from
movement recomputation. Test constants do not become recommended parameter ranges.
