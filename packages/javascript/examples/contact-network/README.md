# Contact Network

Let nearby points pull together and make room for one another. Change the sensing distance to redraw the network, or retain the same positions and change its marks.

Run from the repository with `node tools/serve_survey_coverage_studies.mjs`, then open
`http://127.0.0.1:8789/packages/javascript/examples/contact-network/index.html`. The server uses the existing pinned p5 2.3.2 runtime. In another static server, provide p5 2.3.2 at `/p5.js` and preserve the relative package paths.

The two proximity studies share private `../contact-network/study.js`. Both use the public `radiusPairs2D` and `pairForceStep2D` exports. Canvas2D, density1, 720×720; explicit initial state; no host RNG; one time unit per logical tick; up to240 ticks.

See [the artist guide](../../../../docs/proximity-interactions.md) for controls and the computation. These are original studies; no external artwork recreation or persistent contact state is claimed.
