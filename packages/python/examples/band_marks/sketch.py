"""Editable py5 BandMarks starter: T tolerance, C palette, M path/marks, 0 reset, S save."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import py5

from procedurals._py5_frame import Py5Frame
from band_marks import BACKGROUND_RGB, band_path_commands, create_band_marks

OUTPUT = Path(__file__).resolve().parent / "output"


class BandMarksSketch(py5.Sketch):
    """A bounded composition whose style edits reuse retained noise-band paths."""

    def settings(self):
        self.size(640, 640, self.JAVA2D)
        self.pixel_density(1)

    def reset_options(self):
        self.wider = self.alternate = self.marks = False

    def setup(self):
        self.no_loop()
        self.reset_options()
        self.shown_revision = 0
        self.model = create_band_marks(self.wider)
        self.paint_shown_composition()

    def rebuild(self):
        """T calls this; style controls (C, M) intentionally do not."""
        self.model = create_band_marks(self.wider)

    def paint_shown_composition(self):
        """Consume a bounded generator into a fresh frame, then display it once."""
        frame = Py5Frame(self)
        completed = None
        try:
            frame.begin({"width": 640, "height": 640, "density": 1, "background": BACKGROUND_RGB})
            batch = []
            command_count = 0
            for command in band_path_commands(self.model, self.alternate, self.marks):
                batch.append(command)
                command_count += 1
                if len(batch) == 4096:
                    frame.batch(batch)
                    batch = []
            frame.batch(batch)
            completed = frame.end()
            self.image(completed, 0, 0)
            self.shown_revision += 1
            self.get_surface().set_title(
                f"BandMarks — {command_count} {'tick marks' if self.marks else 'path segments'} · "
                f"{'wide' if self.wider else 'narrow'} tolerance · "
                f"{'alternate' if self.alternate else 'base'} palette · T C M 0 S")
        finally:
            if completed is not None:
                Py5Frame.release_completed(completed)
            elif frame.state != "completed":
                frame.abort()

    def save_shown_composition(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "band-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            self.save_shown_composition()
            return
        if key == "t":
            self.wider = not self.wider
            self.rebuild()
        elif key == "c":
            self.alternate = not self.alternate
        elif key == "m":
            self.marks = not self.marks
        elif key == "0":
            self.reset_options()
            self.rebuild()
        else:
            return
        self.paint_shown_composition()


if __name__ == "__main__":
    BandMarksSketch().run_sketch()
