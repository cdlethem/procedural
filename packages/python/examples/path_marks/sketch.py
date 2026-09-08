"""Editable py5 PathMarks starter: M mode, L mark length, C palette, N count, D distance, S save."""

from pathlib import Path
import sys

# Run directly from this repository checkout; packaged starters may omit this path.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import py5

from procedurals._py5_frame import Py5Frame
from path_marks import (ALTERNATE_PALETTE, BASE_PALETTE, create_path_marks,
                        visible_path_mark_commands)

PALETTES = (BASE_PALETTE, ALTERNATE_PALETTE)
OUTPUT = Path(__file__).resolve().parent / "output"


class PathMarksSketch(py5.Sketch):
    """A bounded CP2 composition whose style edits reuse retained movement."""

    def settings(self):
        self.size(640, 640, self.JAVA2D)
        self.pixel_density(1)

    def setup(self):
        self.no_loop()
        self.steps = 2_000
        self.distance = 0.4
        self.mark_length = 12.0
        self.palette_index = 0
        self.trace = False
        self.model = create_path_marks(steps=self.steps, distance=self.distance)
        self.shown_revision = 0
        self.paint_shown_composition()

    def regenerate_paths(self):
        """Movement controls call this; style controls intentionally do not."""
        self.model = create_path_marks(steps=self.steps, distance=self.distance)

    def paint_shown_composition(self):
        """Consume a bounded generator into a fresh frame, then display it once."""
        frame = Py5Frame(self)
        completed = None
        try:
            frame.begin({"width": 640, "height": 640, "density": 1,
                         "background": 0xECE7DA})
            batch = []
            for command in visible_path_mark_commands(
                    self.model, trace=self.trace, mark_length=self.mark_length,
                    colors=PALETTES[self.palette_index]):
                batch.append(command)
                if len(batch) == 4096:
                    frame.batch(batch)
                    batch = []
            frame.batch(batch)
            completed = frame.end()
            self.image(completed, 0, 0)
            self.shown_revision += 1
            mode = "trace" if self.trace else "marks"
            self.get_surface().set_title(
                f"PathMarks — M {mode} · L {self.mark_length:g} · "
                f"C palette {self.palette_index + 1} · N {self.steps} · "
                f"D {self.distance:g} · S save")
        finally:
            if completed is not None:
                Py5Frame.release_completed(completed)
            elif frame.state != "completed":
                frame.abort()

    def save_shown_composition(self):
        """Save the current canvas; this does not regenerate paths or repaint."""
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "path-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            print(self.save_shown_composition())
            return
        if key == "m":
            self.trace = not self.trace
        elif key == "l":
            self.mark_length = 24.0 if self.mark_length == 12.0 else 12.0
        elif key == "c":
            self.palette_index = 1 - self.palette_index
        elif key == "n":
            self.steps = 2_001 if self.steps == 2_000 else 2_000
            self.regenerate_paths()
        elif key == "d":
            self.distance = 0.8 if self.distance == 0.4 else 0.4
            self.regenerate_paths()
        else:
            return
        self.paint_shown_composition()


if __name__ == "__main__":
    PathMarksSketch().run_sketch()
