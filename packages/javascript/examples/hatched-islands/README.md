# Hatched islands

This editable p5 study clips two differently angled hatch fields to an irregular island with two holes. `A` rotates both directions; `D` tightens their independent spacings. `T` substitutes a different island outline and two holes while retaining the hatch controls. `C` changes ink without changing the retained paths. `0` restores the initial state, `S` saves the displayed PNG and `V` downloads all clipped fragments as an exact millimetre SVG with one path per pen lift.

Edit the `regions` arrays and the direction/spacing pairs in `sketch.js` to reuse the same clipping and SVG operations with another drawing. The SVG follows the retained path order: all first-field fragments, then all second-field fragments.
