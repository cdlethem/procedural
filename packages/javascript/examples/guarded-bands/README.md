# Guarded bands

This editable p5 study builds eight tapered, bending ribbon candidates, then selects them in input order by exact filled-region clearance. Solid bands are retained; dashed centerlines show rejected candidates, including an intentional crossing. `W` scales their different per-vertex width profiles; `G` raises the required gap from 10 to 32 canvas units so neighboring echoes drop out. `T` substitutes steeper centerline routes while retaining the width and gap settings. `C` changes only the ink, leaving the retained geometry intact. `0` restores the initial state and `S` saves the displayed PNG.

Edit the `source` point and width arrays or `transferSlope` in `sketch.js` to make a different composition. Candidate order is meaningful: later strips are checked against earlier retained ones. The returned visible rings, resolved joins, rejection reasons, and witnesses are plain values, separate from the p5 drawing calls.
