# Make a field of flowing marks

Thousands of short strokes turn together across a surface. A seeded noise field chooses
their direction, length and color; a regular grid supplies their positions. Change the
palette, stroke length or mark shape while keeping the underlying arrangement.

## Controls

| Control | What changes on the canvas |
| --- | --- |
| Maximum length | Switch between short and long strokes. |
| Palette | Recolor the same marks. |
| Mark | Switch fine lines to broader bars. |
| Save PNG | Download the displayed artwork. |

## Make it your own

The studio adds editable seed, grid density and stroke length controls. Layer several
fields, or combine one with paths or separated shapes. A new seed changes the arrangement;
changing colors gives the same field another appearance.

The existing `createMarkField()` example composes a regular grid with three separate noise
samples for direction, length and color. `markCommands()` converts those attributes into
segments or quadrilaterals. These are example settings, not recommended operation ranges.
The composition is motivated by `2018/Generativos/pelines`.
