# Build a 3D form from its silhouette

ProfileMarks builds a form from circular rings at different heights. Try a straight
cylinder, a pinched waist or a pointed form, then change how smooth or faceted it looks.
The example uses Processing’s P3D renderer and lighting.

[Install the Java library](building-java-from-source.md), then open **ProfileMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **P** | Cycle between the cylinder, waist and pointed profiles. |
| **D** | Switch between 8 broad sides and 32 narrower sides. |
| **B** | Open or close the first end of the form. |
| **T** | Open or close the last end of the form. |
| **C** | Recolor the same shape. |
| **X** | Show all three forms side by side, or show the selected form alone. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Open `ProfileComposition.java` and change the list of `[height, radius]` pairs. A larger
radius makes the form wider at that height; several changes along the list create shoulders,
necks and bulges. Heights must increase. A radius of zero is allowed at an end to make a
point, but not between the ends.

`RadialProfile3D` connects the rings into triangles. Use Processing’s translate and rotate
calls to place the mesh, and change the PDE’s colors and lights to alter its appearance.
The mesh identifies height bands so you can color each band separately.

A cap toggle has no visible effect on an already pointed end. This operation makes forms
around one straight axis; for a washer-like form with a hole, use [AnnularMarks](annular-marks.md).
