"""ProfileMarks: P form, D slices, B/T caps, C palette, X trio, 0 reset, S save."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import py5
from jpype.types import JFloat
from procedurals.colors import cyclic_palette
from profile_composition import create_profile_composition
OUTPUT = Path(__file__).resolve().parent / 'output'
PALETTES = (cyclic_palette({'colors': [15448152, 15640769, 13683651, 8894148, 15352128, 5920647]}), cyclic_palette({'colors': [2374483, 4099219, 15320170, 15167313]}))

class ProfileMarksSketch(py5.Sketch):

    def settings(self):
        self.size(640, 640, self.P3D)
        self.pixel_density(1)

    def reset_options(self):
        self.profile, self.slices, self.cap_start, self.cap_end, self.alternate, self.trio = (0, 32, True, True, False, False)

    def setup(self):
        self.no_loop()
        self.reset_options()
        self.shown_revision = 0
        self.rebuild()
        self.displayed_frame = None

    def draw(self):
        self.paint_shown_composition()

    def rebuild(self):
        self.composition = create_profile_composition(self.slices, self.cap_start, self.cap_end)

    def paint_shown_composition(self):
        self.background(243, 240, 232)
        self.lights()
        self.ortho()
        self.no_stroke()
        self.drawn_faces = 0
        if self.trio:
            self.draw_mesh(self.composition.mesh_at(0), 140, 0.45)
            self.draw_mesh(self.composition.mesh_at(1), 320, 0.45)
            self.draw_mesh(self.composition.mesh_at(2), 500, 0.45)
        else:
            self.draw_mesh(self.composition.mesh_at(self.profile), 320, 1.0)
        self.displayed_frame = self.get_pixels()
        self.shown_revision += 1

    def draw_mesh(self, mesh, x, scale):
        vertex = [0.0, 0.0, 0.0]
        normal = [0.0, 0.0, 0.0]
        triangle = [0, 0, 0]
        palette = PALETTES[1 if self.alternate else 0]
        self.push_matrix()
        self.translate(x, 320)
        self.rotate_x(1.0)
        self.rotate_y(0.35)
        self.scale(scale)
        self.begin_shape(self.TRIANGLES)
        for face in range(mesh.face_count()):
            band = mesh.band_at(face)
            phase = 0.15 if band < 0 and mesh.face_kind_at(face) == 'start-cap' else 0.65 if band < 0 else band / 8.0 + mesh.cell_at(face) / (self.composition.slices * 8.0)
            rgb = palette.sample(phase)
            self.fill(rgb >> 16 & 255, rgb >> 8 & 255, rgb & 255)
            mesh.normal_into(face, normal)
            self.normal(JFloat(normal[0]), JFloat(normal[1]), JFloat(normal[2]))
            mesh.triangle_into(face, triangle)
            for corner in triangle:
                mesh.vertex_into(corner, vertex)
                self.vertex(JFloat(vertex[0]), JFloat(vertex[1]), JFloat(vertex[2]))
            self.drawn_faces += 1
        self.end_shape()
        self.pop_matrix()

    def save_shown_composition(self):
        if self.displayed_frame is not None:
            OUTPUT.mkdir(parents=True, exist_ok=True)
            self.displayed_frame.save(str(OUTPUT / 'profile-marks.png'))

    def key_pressed(self):
        key = str(self.key).lower()
        if key == 's':
            self.save_shown_composition()
            return
        if key == 'p':
            self.profile = (self.profile + 1) % 3
        elif key == 'c':
            self.alternate = not self.alternate
        elif key == 'x':
            self.trio = not self.trio
        else:
            if key == 'd':
                self.slices = 8 if self.slices == 32 else 32
            elif key == 'b':
                self.cap_start = not self.cap_start
            elif key == 't':
                self.cap_end = not self.cap_end
            elif key == '0':
                self.reset_options()
            else:
                return
            self.rebuild()
        self.redraw()
if __name__ == '__main__':
    ProfileMarksSketch().run_sketch()
