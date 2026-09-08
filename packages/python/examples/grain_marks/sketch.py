"""GrainMarks: R seed, N density, B distribution, X cells, M marks, C palette, 0 reset, S save."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import py5
from jpype.types import JFloat
from grain_marks import create_grain_composition

OUTPUT = Path(__file__).resolve().parent / "output"
PALETTES = ((0x173F5F, 0x9B342F, 0x176B60, 0x634779, 0x805515),
            (0xBA402F, 0x344E75, 0x6B4672, 0x426D35, 0x8C5221))


class GrainMarksSketch(py5.Sketch):
    """Retain triangle samples independently of their palette and mark treatment."""
    def settings(self):
        self.size(640, 640, self.JAVA2D)
        self.pixel_density(1)

    def reset_options(self):
        self.seed, self.density, self.distribution = 42, 0.1, 0
        self.strokes = self.alternate = self.cells = False

    def setup(self):
        self.no_loop()
        self.reset_options()
        self.shown_revision = 0
        self.rebuild()
        self.paint_shown_composition()

    def rebuild(self):
        self.composition = create_grain_composition(
            self.seed, self.density, self.distribution, self.cells)

    def paint_shown_composition(self):
        self.background(243, 240, 232)
        self.stroke_weight(1)
        colors = PALETTES[1 if self.alternate else 0]
        position = [0.0, 0.0]
        for region in range(self.composition.size):
            points = self.composition.region_at(region)
            rgb = colors[region % len(colors)]
            self.stroke((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 150)
            for index in range(points.size):
                points.point_into(index, position)
                # Explicit float transport matches the Java example before mark offsets.
                x, y = float(JFloat(position[0])), float(JFloat(position[1]))
                if self.strokes:
                    self.line(JFloat(x - 2), JFloat(y), JFloat(x + 2), JFloat(y))
                else:
                    self.point(JFloat(x), JFloat(y))
        self.shown_revision += 1
        self.get_surface().set_title(
            f"GrainMarks — {self.composition.total_points} points · R N B M C X 0 S")

    def save_shown_composition(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "grain-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            self.save_shown_composition()
            return
        if key == "m":
            self.strokes = not self.strokes
        elif key == "c":
            self.alternate = not self.alternate
        else:
            if key == "0":
                self.reset_options()
            elif key == "r":
                self.seed = (self.seed + 1) & 0xFFFFFFFF
            elif key == "n":
                self.density = 0.2 if self.density == 0.1 else 0.1
            elif key == "b":
                self.distribution = (self.distribution + 1) % 3
            elif key == "x":
                self.cells = not self.cells
            else:
                return
            self.rebuild()
        self.paint_shown_composition()


if __name__ == "__main__":
    GrainMarksSketch().run_sketch()
