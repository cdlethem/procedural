"""Editable py5 PlacementMarks starter: R seed, N budget, X source, G separation, I/O sizes, M motif, C palette, S save."""

from pathlib import Path
import sys

# Run directly from this repository checkout; packaged starters may omit this path.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import py5

from placement_marks import (ALTERNATE_PALETTE, BASE_PALETTE,
                             create_placement_composition, vertex_into)

OUTPUT = Path(__file__).resolve().parent / "output"


class PlacementMarksSketch(py5.Sketch):
    """A bounded CP3 composition whose style edits reuse retained placements."""

    def settings(self):
        self.size(640, 640, self.JAVA2D)
        self.pixel_density(1)

    def setup(self):
        self.no_loop()
        self.seed = 42
        self.attempts = 5_000
        self.minimum = 4.0
        self.maximum = 64.0
        self.separation = 1.0
        self.radial = False
        self.diamonds = False
        self.alternate = False
        self.shown_revision = 0
        self.rebuild()
        self.paint_shown_composition()

    def rebuild(self):
        """Proposal-source and exclusion controls call this; style controls do not."""
        self.composition = create_placement_composition(
            self.radial, self.seed, self.attempts, self.minimum, self.maximum, self.separation)

    def paint_shown_composition(self):
        """Draw the retained placements once; this does not regenerate them."""
        self.background(236, 231, 218)
        self.no_fill()
        self.stroke_weight(1)
        self.stroke_cap(self.ROUND)
        self.stroke_join(self.ROUND)
        placements = self.composition
        palette = ALTERNATE_PALETTE if self.alternate else BASE_PALETTE
        vertex = [0.0, 0.0]
        for index in range(placements.size):
            color = palette[placements.source_index_at(index) % len(palette)]
            self.stroke(color[0], color[1], color[2])
            self.begin_shape()
            for vertex_index in range(4 if self.diamonds else 64):
                vertex_into(placements, index, vertex_index, self.diamonds, vertex)
                self.vertex(vertex[0], vertex[1])
            self.end_shape(self.CLOSE)
        self.shown_revision += 1
        source = "radial" if self.radial else "seeded"
        self.get_surface().set_title(
            f"PlacementMarks — {placements.size} accepted of {placements.attempts} "
            f"proposals · {source} · R N X G I O M C S")
        print(f"{placements.size} accepted of {placements.attempts} proposals · {source}")

    def save_shown_composition(self):
        """Save the current canvas; this does not regenerate placements or repaint."""
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "placement-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            print(self.save_shown_composition())
            return
        if key == "m":
            self.diamonds = not self.diamonds
        elif key == "c":
            self.alternate = not self.alternate
        else:
            if key == "x":
                self.radial = not self.radial
            elif key == "g":
                self.separation = 1.2 if self.separation == 1.0 else 1.0
            elif not self.radial and key == "r":
                self.seed = (self.seed + 1) & 0xFFFFFFFF
            elif not self.radial and key == "n":
                self.attempts = 10_000 if self.attempts == 5_000 else 5_000
            elif not self.radial and key == "i":
                self.minimum = 8.0 if self.minimum == 4.0 else 4.0
            elif not self.radial and key == "o":
                self.maximum = 32.0 if self.maximum == 64.0 else 64.0
            else:
                return
            self.rebuild()
        self.paint_shown_composition()


if __name__ == "__main__":
    PlacementMarksSketch().run_sketch()
