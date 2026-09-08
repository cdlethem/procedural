"""Editable py5 LoopMarks starter: T move-a-control, C palette, M tiles/fans, 0 reset, S save."""
from pathlib import Path
import sys

# Run directly from this repository checkout; packaged starters may omit this path.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import py5

from procedurals._py5_frame import Py5Frame
from loop_marks import BACKGROUND_RGB, create_loop_marks, loop_fan_triangles, loop_tile_commands

OUTPUT = Path(__file__).resolve().parent / "output"


class LoopMarksSketch(py5.Sketch):
    """A bounded CP16 composition whose style edits reuse retained curves."""

    def settings(self):
        self.size(640, 640, self.JAVA2D)
        self.pixel_density(1)

    def reset_options(self):
        self.moved = self.alternate = self.fans = False

    def setup(self):
        self.no_loop()
        self.reset_options()
        self.shown_revision = 0
        self.model = create_loop_marks(self.moved)
        self.paint_shown_composition()

    def rebuild(self):
        """T calls this; style controls (C, M) intentionally do not."""
        self.model = create_loop_marks(self.moved)

    def paint_tiles(self):
        """Consume a bounded generator through the shared 2D frame adapter."""
        frame = Py5Frame(self)
        completed = None
        try:
            frame.begin({"width": 640, "height": 640, "density": 1, "background": BACKGROUND_RGB})
            batch = []
            command_count = 0
            for command in loop_tile_commands(self.model, self.alternate):
                batch.append(command)
                command_count += 1
                if len(batch) == 4096:
                    frame.batch(batch)
                    batch = []
            frame.batch(batch)
            completed = frame.end()
            self.image(completed, 0, 0)
            return command_count
        finally:
            if completed is not None:
                Py5Frame.release_completed(completed)
            elif frame.state != "completed":
                frame.abort()

    def paint_fans(self):
        """Fan drawing is an artistic use of the selected outline, not polygon
        triangulation, and is outside the shared fresh-raster-2d command vocabulary
        (segment2/quad2 only, no triangle primitive). It draws directly on the main
        canvas, matching the established ProfileMarks precedent for content outside
        that shared vocabulary.
        """
        rgb = BACKGROUND_RGB
        self.background((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
        self.no_stroke()
        command_count = 0
        for triangle in loop_fan_triangles(self.model, self.alternate):
            color = triangle["rgb"]
            self.fill((color >> 16) & 255, (color >> 8) & 255, color & 255, triangle["opacity8"])
            self.triangle(triangle["cx"], triangle["cy"], triangle["x1"], triangle["y1"],
                          triangle["x2"], triangle["y2"])
            command_count += 1
        return command_count

    def paint_shown_composition(self):
        command_count = self.paint_fans() if self.fans else self.paint_tiles()
        self.shown_revision += 1
        mode = "fans" if self.fans else "tiles"
        self.get_surface().set_title(
            f"LoopMarks — {mode} · {command_count} shapes · "
            f"{'moved' if self.moved else 'baseline'} · "
            f"{'alternate' if self.alternate else 'base'} palette · T C M 0 S")

    def save_shown_composition(self):
        """Save the current canvas; this does not regenerate curves or repaint."""
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "loop-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            self.save_shown_composition()
            return
        if key == "t":
            self.moved = not self.moved
            self.rebuild()
        elif key == "c":
            self.alternate = not self.alternate
        elif key == "m":
            self.fans = not self.fans
        elif key == "0":
            self.reset_options()
            self.rebuild()
        else:
            return
        self.paint_shown_composition()


if __name__ == "__main__":
    LoopMarksSketch().run_sketch()
