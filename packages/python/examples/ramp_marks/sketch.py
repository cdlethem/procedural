"""Editable py5 RampMarks starter: T shift a stop, C palette, F linear/radial, 0 reset, S save."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import py5

from ramp_marks import BACKGROUND_RGB, DOT_DIAMETER, create_ramp_marks, ramp_grid_dots

OUTPUT = Path(__file__).resolve().parent / "output"


class RampMarksSketch(py5.Sketch):
    """A bounded composition whose style edits reuse the retained ramp."""

    def settings(self):
        self.size(640, 640, self.JAVA2D)
        self.pixel_density(1)

    def reset_options(self):
        self.shifted = self.alternate = self.radial = False

    def setup(self):
        self.no_loop()
        self.reset_options()
        self.shown_revision = 0
        self.model = create_ramp_marks(self.shifted, self.alternate)
        self.paint_shown_composition()

    def rebuild(self):
        """T and C call this; F (draw-only) intentionally does not."""
        self.model = create_ramp_marks(self.shifted, self.alternate)

    def paint_shown_composition(self):
        """Dots are drawn directly with py5's native circle primitive: the shared
        fresh-raster-2d vocabulary (segment2/quad2) has no round-fill primitive, and
        an approximating square would visibly change this composition's dot shape.
        """
        rgb = BACKGROUND_RGB
        self.background((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
        self.no_stroke()
        dot_count = 0
        for dot in ramp_grid_dots(self.model, self.radial):
            color = dot["rgb"]
            self.fill((color >> 16) & 255, (color >> 8) & 255, color & 255)
            self.circle(dot["x"], dot["y"], DOT_DIAMETER)
            dot_count += 1
        self.shown_revision += 1
        self.get_surface().set_title(
            f"RampMarks — {dot_count} dots · "
            f"{'radial' if self.radial else 'linear'} coordinate · "
            f"{'shifted' if self.shifted else 'base'} stops · "
            f"{'alternate' if self.alternate else 'base'} palette · T C F 0 S")

    def save_shown_composition(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "ramp-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            self.save_shown_composition()
            return
        if key == "t":
            self.shifted = not self.shifted
            self.rebuild()
        elif key == "c":
            self.alternate = not self.alternate
            self.rebuild()
        elif key == "f":
            self.radial = not self.radial
        elif key == "0":
            self.reset_options()
            self.rebuild()
        else:
            return
        self.paint_shown_composition()


if __name__ == "__main__":
    RampMarksSketch().run_sketch()
