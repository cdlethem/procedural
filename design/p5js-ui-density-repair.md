# UI display-density repair

The initial UI attempt failed its base backing-dimensions assertion at device scale
factor 2. Local p5 2.3.2 source explains the cause: the main renderer constructor sets
its density from `window.devicePixelRatio`, while `pixelDensity(value)` changes the
existing renderer. Calling it before `createCanvas` configured the replaced renderer.

Move `pixelDensity(1)` immediately after main canvas creation and before painting.
The tested adapter already sets density after creating its offscreen buffer and needs
no change. Keep the exact 640×640 and CP1 pixel-hash assertions.

Register one corrective UI attempt of four compositions plus the PNG download check.
Preserve the initial failed report. No adapter pixel/lifecycle/CP1 suite is rerun.
