# ClipMarks native validation plan

Candidate only. Compile the actual PDE with the official Processing preprocessor and
production SegmentClip2D; never validate this example using the private study as a stand-in.
Reuse the existing JAVA2D probe/runner, one machine render lease and retained-save checks.

Queue actual key events after completed frames: H,H,N,N,T,C,M,O,0,S. Capture baseline
plus each visual key result (ten states). Expected clipCalls across those states:
1,2,3,4,5,6,6,6,6,7. Save must not trigger clipping and must match the cached final pixels.
Geometry identity must stay unchanged through C/M/O; changing T must retain the original
supplied-stroke list. N must reuse the same source list. Restored H and N frames and final
reset must match baseline pixels exactly in the pinned native environment.

Hash retained coordinates, source indices and parameter intervals, not only segment count.
Compare output against independent exact clipping for the actual source/region data.
Source IDs for both pieces crossing the notch must match. With overlay off, no line segment
may bridge the notch; the outline and endpoint marks are intentional drawing and may cross
its edge by their half-width. Count broad visible differences only alongside actual output
geometry and the requested edit, never as a replacement for geometric checks.

Root inspects baseline, sparse, shallow-notch, supplied-source and changed appearance views.
Register candidate images in the centralized gallery with honest status. Before acceptance,
verify source and runtime hashes, native renderer/density, stderr, cached save and result
ownership; confirm the bundle consumer loads the extracted core. No other target or source
reproduction follows from these results.
