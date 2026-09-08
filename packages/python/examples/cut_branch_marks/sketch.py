"""Editable py5 CutBranchMarks starter: C colour, A angle, W work, T seed stroke, R seed, 0 reset, S save."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import py5

from procedurals._py5_frame import Py5Frame
from cut_branch_marks import BACKGROUND_RGB, COLORS, create_cut_branch_marks, cut_branch_commands

OUTPUT = Path(__file__).resolve().parent / "output"


class CutBranchMarksSketch(py5.Sketch):
    """A bounded composition whose colour edit reuses the retained pool."""

    def settings(self):
        self.size(960, 960, self.JAVA2D)
        self.pixel_density(1)

    def reset_options(self):
        self.seed, self.narrow, self.sparse, self.alternate, self.color_index = 42, False, False, False, 0

    def setup(self):
        self.no_loop()
        self.reset_options()
        self.shown_revision = 0
        self.model = create_cut_branch_marks(self.seed, self.narrow, self.sparse, self.alternate)
        self.paint_shown_composition()

    def rebuild(self):
        """A, W, T, and R call this; C (colour cycle) intentionally does not."""
        self.model = create_cut_branch_marks(self.seed, self.narrow, self.sparse, self.alternate)

    def paint_shown_composition(self):
        """Consume a bounded generator into a fresh frame, then display it once."""
        frame = Py5Frame(self)
        completed = None
        try:
            frame.begin({"width": 960, "height": 960, "density": 1, "background": BACKGROUND_RGB})
            batch = []
            command_count = 0
            for command in cut_branch_commands(self.model, self.color_index):
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
                f"CutBranchMarks — {command_count} cuts · seed {self.seed} · "
                f"{'narrow' if self.narrow else 'wide'} angle · "
                f"{'sparse' if self.sparse else 'dense'} work · "
                f"{'alternate' if self.alternate else 'base'} stroke · C A W T R 0 S")
        finally:
            if completed is not None:
                Py5Frame.release_completed(completed)
            elif frame.state != "completed":
                frame.abort()

    def save_shown_composition(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "cut-branch-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            self.save_shown_composition()
            return
        if key == "c":
            self.color_index = (self.color_index + 1) % len(COLORS)
        elif key == "a":
            self.narrow = not self.narrow
            self.rebuild()
        elif key == "w":
            self.sparse = not self.sparse
            self.rebuild()
        elif key == "t":
            self.alternate = not self.alternate
            self.rebuild()
        elif key == "r":
            self.seed = (self.seed + 1) & 0xFFFFFFFF
            self.rebuild()
        elif key == "0":
            self.reset_options()
            self.rebuild()
        else:
            return
        self.paint_shown_composition()


if __name__ == "__main__":
    CutBranchMarksSketch().run_sketch()
