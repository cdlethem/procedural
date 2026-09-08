"""BranchMarks: retained endpoint trees with editable growth and mark treatment."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import py5
from jpype.types import JFloat
from branch_composition import create_branch_composition

OUTPUT = Path(__file__).resolve().parent / "output"
PALETTES = ((0x183E4A, 0x225B60, 0x347969, 0xAF5441),
            (0x443D65, 0x765075, 0xA96962, 0xBB793E))


class BranchMarksSketch(py5.Sketch):
    """Keep retained tree geometry separate from taper and palette edits."""
    def settings(self):
        self.size(640, 640, self.JAVA2D)
        self.pixel_density(1)

    def reset_options(self):
        self.seed = 42
        self.more = self.narrowing = self.binary = self.wider = self.forest = False
        self.taper, self.alternate = True, False

    def setup(self):
        self.no_loop()
        self.reset_options()
        self.shown_revision = self.drawn_segments = self.drawn_tips = 0
        self.rebuild()
        self.paint_shown_composition()

    def rebuild(self):
        self.composition = create_branch_composition(self.seed, self.more, self.narrowing,
                                                      self.binary, self.wider, self.forest)

    def paint_shown_composition(self):
        self.background(243, 240, 232)
        colors, segment = PALETTES[1 if self.alternate else 0], [0.0] * 4
        self.drawn_segments = self.drawn_tips = 0
        for root in range(self.composition.size):
            tree = self.composition.tree_at(root)
            for index in range(tree.size):
                tree.segment_into(index, segment)
                rgb = colors[min(len(colors) - 1, tree.generation_at(index) // 2)]
                self.stroke((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
                # JFloat is the Java example's explicit renderer-boundary narrowing.
                self.stroke_weight(JFloat(max(.65, tree.length_at(index) * .035)) if self.taper else JFloat(1.0))
                self.line(JFloat(segment[0]), JFloat(segment[1]), JFloat(segment[2]), JFloat(segment[3]))
                self.drawn_segments += 1
            if self.taper:
                self.no_stroke()
                rgb = colors[-1]
                self.fill((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
                for index in range(tree.size):
                    if tree.child_count_at(index) != 0:
                        continue
                    tree.segment_into(index, segment)
                    self.ellipse(JFloat(segment[2]), JFloat(segment[3]), 4, 4)
                    self.drawn_tips += 1
        self.shown_revision += 1
        self.get_surface().set_title(f"BranchMarks — {self.composition.total_segments} segments · R N G W B X M C 0 S")

    def save_shown_composition(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "branch-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

    def current_snapshot(self):
        return {"composition": self.composition, "shown_revision": self.shown_revision,
                "drawn_segments": self.drawn_segments, "drawn_tips": self.drawn_tips,
                "settings": {"seed": self.seed, "more": self.more, "narrowing": self.narrowing,
                             "binary": self.binary, "wider": self.wider, "forest": self.forest,
                             "taper": self.taper, "alternate": self.alternate}}

    def key_pressed(self):
        key = str(self.key).lower()
        if key == "s":
            self.save_shown_composition()
            return
        if key == "m": self.taper = not self.taper
        elif key == "c": self.alternate = not self.alternate
        else:
            if key == "0": self.reset_options()
            elif key == "r": self.seed = (self.seed + 1) & 0xffffffff
            elif key == "n": self.more = not self.more
            elif key == "g": self.narrowing = not self.narrowing
            elif key == "w": self.wider = not self.wider
            elif key == "b": self.binary = not self.binary
            elif key == "x": self.forest = not self.forest
            else: return  # Includes Q: no stop/close path in the editable workflow.
            self.rebuild()
        self.paint_shown_composition()


if __name__ == "__main__":
    BranchMarksSketch().run_sketch()
