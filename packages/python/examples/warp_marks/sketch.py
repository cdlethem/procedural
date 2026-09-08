"""Editable py5 WarpMarks starter: W displacement, F field, P source pattern, 0 reset, S save."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import py5

from warp_marks import BACKGROUND_RGB, SIDE, create_warp_marks, dot_color_at, remap_source, stripe_color_at

OUTPUT = Path(__file__).resolve().parent / "output"


def _to_signed32(value: int) -> int:
    """Java int is signed 32-bit; py5/Processing pixel arrays hold packed ARGB as such."""
    value &= 0xFFFFFFFF
    return value - 0x100000000 if value >= 0x80000000 else value


def _to_unsigned32(value: int) -> int:
    return value & 0xFFFFFFFF


class WarpMarksSketch(py5.Sketch):
    """A bounded composition whose displacement/field/pattern edits recompute the raster."""

    def settings(self):
        self.size(SIDE, SIDE, self.JAVA2D)
        self.pixel_density(1)

    def reset_options(self):
        self.strength, self.alternate_field, self.stripes = 32, False, False

    def setup(self):
        self.no_loop()
        self.reset_options()
        self.shown_revision = 0
        self.model = create_warp_marks()
        self.source_graphics = None
        self.source_pixels = None
        self.displayed_frame = None
        self.capture_source()
        self.remap_and_paint()

    def capture_source(self):
        """Source-pattern drawing is renderer-owned content generation, matching the
        Java example's own approach: not part of the portable remap operation, only
        its input. py5's pixel array holds packed ARGB8 ints directly (same format as
        Java's PImage.pixels), so no channel repacking is needed here.
        """
        if self.source_graphics is None:
            self.source_graphics = self.create_graphics(SIDE, SIDE, self.JAVA2D)
        graphics = self.source_graphics
        graphics.begin_draw()
        graphics.background((BACKGROUND_RGB >> 16) & 255, (BACKGROUND_RGB >> 8) & 255, BACKGROUND_RGB & 255)
        graphics.no_stroke()
        if self.stripes:
            row = 0
            while row < SIDE:
                rgb = stripe_color_at(row)
                graphics.fill((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
                graphics.rect(0, row, SIDE, 16)
                row += 32
        else:
            y = 12
            while y < SIDE:
                x = 12
                while x < SIDE:
                    rgb = dot_color_at(self.model, x, y)
                    graphics.fill((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
                    graphics.circle(x, y, 12)
                    x += 24
                y += 24
        graphics.end_draw()
        graphics.load_pixels()
        self.source_pixels = [_to_unsigned32(int(v)) for v in graphics.pixels]

    def remap_and_paint(self):
        result = remap_source(self.source_pixels, self.model, self.strength, self.alternate_field)
        pixels = result.to_values()["pixels"]
        self.displayed_frame = self.create_image(SIDE, SIDE, self.ARGB)
        self.displayed_frame.load_pixels()
        for index, value in enumerate(pixels):
            self.displayed_frame.pixels[index] = _to_signed32(value)
        self.displayed_frame.update_pixels()
        self.paint_shown_composition()

    def paint_shown_composition(self):
        self.background((BACKGROUND_RGB >> 16) & 255, (BACKGROUND_RGB >> 8) & 255, BACKGROUND_RGB & 255)
        self.image(self.displayed_frame, 0, 0)
        self.shown_revision += 1
        self.get_surface().set_title(
            f"WarpMarks — strength {self.strength} · "
            f"{'paired-sine' if self.alternate_field else 'gradient-noise'} field · "
            f"{'stripes' if self.stripes else 'dots'} source · W F P 0 S")

    def save_shown_composition(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "warp-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            self.save_shown_composition()
            return
        if key == "w":
            self.strength = 32 if self.strength == 0 else 64 if self.strength == 32 else 0
            self.remap_and_paint()
        elif key == "f":
            self.alternate_field = not self.alternate_field
            self.remap_and_paint()
        elif key == "p":
            self.stripes = not self.stripes
            self.capture_source()
            self.remap_and_paint()
        elif key == "0":
            self.reset_options()
            self.capture_source()
            self.remap_and_paint()
        else:
            return


if __name__ == "__main__":
    WarpMarksSketch().run_sketch()
