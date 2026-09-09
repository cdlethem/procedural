# Draw tapered bodies along a field

BodyMarks draws curved, tapered forms that move through a field. Each form has a leading
point and a curved spine extending behind it. Show just the spines to see the paths that
shape the bodies. The sketch starts paused.

[Install the Java library](building-java-from-source.md), then open **BodyMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **Space** | Run or pause movement. |
| **.** | Advance one movement step while paused. |
| **M** | Switch filled tapered bodies to their centerlines. |
| **W** | Switch the taper exponent from 0.7 to 2: the larger value narrows the body more quickly behind its head. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit the starting points and field settings in `BodyMarks.pde` to change the movement.
The sketch follows the field forward for the head and traces backward to build a spine.
It then draws a strip along that spine, reducing its width toward the tail.

| Setting | Visible effect |
| --- | --- |
| Starting points | Places the bodies at the beginning of the animation. |
| Movement distance | Changes how far each head moves per step. |
| Spine length | Changes how far the body extends behind its head. |
| Width | Makes bodies broader or slimmer. |
| Taper exponent | Controls how quickly each body narrows toward its tail. |

The body is built from a fresh curved spine, not a stored trail of every past head position.
Tight turns can make a wide strip fold over itself. The example’s drawing code is the place
to change that treatment or attach a different shape to each spine.
