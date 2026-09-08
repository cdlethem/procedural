"""Editable retained ProfileMarks forms; settings are example choices, not presets."""
import math
from procedurals.radial_profile import RadialProfile3D

def create_profile_composition(slices, cap_start, cap_end):
    if type(slices) is not int or not 3 <= slices <= 715827881 or type(cap_start) is not bool or (type(cap_end) is not bool):
        raise ValueError('invalid example settings')
    meshes = []
    for shape in range(3):
        profile = []
        for point in range(17):
            fraction = point / 16.0
            radius = 60.0
            if shape == 1:
                radius -= 36.0 * math.cos((fraction - 0.5) * math.pi)
            if shape == 2:
                radius *= 1.0 - fraction
            profile.append([-160.0 + point * 20.0, radius])
        meshes.append(RadialProfile3D.generate({'profile': profile, 'slices': slices, 'capStart': cap_start, 'capEnd': cap_end, 'maxFaces': 10000}))
    return _Composition(tuple(meshes), slices)

class _Composition:
    __slots__ = ('_meshes', 'slices', 'size')

    def __init__(self, meshes, slices):
        self._meshes = meshes
        self.slices = slices
        self.size = 3

    def mesh_at(self, index):
        if type(index) is not int or not 0 <= index < 3:
            raise ValueError('invalid example shape')
        return self._meshes[index]
