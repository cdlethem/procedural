# Make a pointer-responsive arrangement

`PointerMarks.pde` is a self-contained Processing Java workflow that composes a `RegularGrid`,
`TargetSprings2D`, and one `Delaunay2D` mesh. It starts paused on a 7 by 7 grid at origin
`(128,128)` with spacing `64` in a 640 by 640 JAVA2D canvas.

Press **Space** to run or pause. Press **.** for one tick while paused. Press **M** to switch
between dots and the fixed wire, **T** to show target guides, **0** to restore the exact
initial state and clear the pointer, and **S** to save the cached displayed frame. A mouse
press or drag captures an integer canvas coordinate and holds it as the next tick’s pointer;
releasing the mouse clears the held state.

The Processing display loop stays active. Paused clean callbacks do no drawing or stepping;
paused edits redraw on the next callback. This also makes reset during animation visible
without relying on a redraw request inside an event callback.

Each logical tick reads the stored pointer once. It first moves every target 4% toward its
initial grid site. For a held pointer, each returned target within 180 pixels then moves toward
that pointer by `0.12 * (1 - distance / 180)`. The completed target array is passed once to
the spring batch, then the targets and tick counter commit. `stepWithInput(boolean,double,double)`
exposes the same one-tick path for deterministic scripted replay. The sketch neither reads a
clock nor records an input stream.

The fixed wire deforms the connectivity triangulated from the initial grid. It maps each
canonical Delaunay vertex through `sourceIndexAt` before reading the spring body. It does not
retriangulate current positions and makes no non-crossing guarantee.

The 7 by 7 layout, strength `0.025`, retention `0.7`, 4% return, 180-pixel radius, 0.12
pointer coefficient, palette, and drawing style are authored settings. They are not corpus
useful ranges or library defaults. The target-return then pointer-interpolation ordering is
informed by [`2018/Generativos/araniaaas`](../survey/out/2018/Generativos/araniaaas/notes.md),
but this workflow does not recreate that sketch’s random sites, P2D web, per-frame randomness,
or drawing.

The [native review](../evidence/workflows/pointer-marks/root-review.json) validates supplied-input
replay, retained topology, style transfer, actual run/pause and cached save. Mouse callbacks
and replay inputs are supplied directly; keyboard events are posted. This workflow is included in the Java0.25 source bundle; consult its separate distribution
review for archive acceptance. Other-target support and source reproduction remain unclaimed.
