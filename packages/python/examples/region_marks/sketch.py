"""Editable RegionMarks: R seed, N splits, G selection, M motif, C palette, X source, S save."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import py5
from region_marks import create_seeded_regions, create_authored_regions

OUTPUT = Path(__file__).resolve().parent / "output"
PALETTES = ((0x173F5F, 0x20639B, 0x3CAEA3, 0xF6D55C, 0xED553B),
            (0x264653, 0x2A9D8F, 0xE9C46A, 0xF4A261, 0xE76F51))


class RegionMarksSketch(py5.Sketch):
    """Retain cells while independently editing their palette and interior content."""
    def settings(self):
        self.size(640, 640, self.JAVA2D)
        self.pixel_density(1)

    def setup(self):
        self.no_loop()
        self.seed, self.replacements, self.fraction = 42, 100, 0.5
        self.grid_marks = self.alternate = self.authored = False
        self.shown_revision = 0
        self.rebuild()
        self.paint_shown_composition()

    def rebuild(self):
        self.composition = create_authored_regions() if self.authored else create_seeded_regions(
            self.seed, self.replacements, self.fraction)

    def paint_shown_composition(self):
        self.background(243, 240, 232)
        self.no_stroke()
        colors = PALETTES[1 if self.alternate else 0]
        bounds, point = [0.0] * 4, [0.0] * 2
        for index in range(self.composition.size):
            self.composition.bounds_into(index, bounds)
            width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
            inset = min(1.0, min(width, height) * 0.05)
            rgb = colors[self.composition.id_at(index) % len(colors)]
            self.fill((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 190)
            self.rect(bounds[0] + inset, bounds[1] + inset, width - 2 * inset, height - 2 * inset)
            self.fill(255, 245)
            if self.grid_marks:
                diameter = min(width, height) / 12
                for mark in range(9):
                    self.composition.mark_into(mark, bounds, point)
                    self.ellipse(point[0], point[1], diameter, diameter)
            else:
                diameter = min(width, height) * 0.28
                self.ellipse(bounds[0] + width * 0.5, bounds[1] + height * 0.5, diameter, diameter)
        self.shown_revision += 1
        self.get_surface().set_title(f"RegionMarks — {self.composition.size} cells · R N G M C X S")

    def save_shown_composition(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "region-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            self.save_shown_composition()
            return
        if key == "m":
            self.grid_marks = not self.grid_marks
        elif key == "c":
            self.alternate = not self.alternate
        else:
            if key == "x":
                self.authored = not self.authored
            elif not self.authored and key == "r":
                self.seed = (self.seed + 1) & 0xFFFFFFFF
            elif not self.authored and key == "n":
                self.replacements = 200 if self.replacements == 100 else 100
            elif not self.authored and key == "g":
                self.fraction = 1.0 if self.fraction == 0.5 else 0.5
            else:
                return
            self.rebuild()
        self.paint_shown_composition()


if __name__ == "__main__":
    RegionMarksSketch().run_sketch()
