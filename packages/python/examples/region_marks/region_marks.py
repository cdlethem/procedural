"""Editable RegionMarks cells, matching the project-owned Java composition.

Motivated by mosaic02 and chinasseForms. Canvas and content settings describe this
example, not operation defaults. Authored grid replacement remains ordinary art code.
"""
from dataclasses import dataclass
from procedurals.quadrant_partition import seeded_quadrant_partition_2d
from procedurals.layout import regular_grid


def create_seeded_regions(seed, replacements, selection_fraction):
    return _Composition(seeded_quadrant_partition_2d({
        "seed": seed, "replacements": replacements, "origin": [0, 0],
        "extent": [640, 640], "selectionFraction": selection_fraction,
    }), None, _marks())


def create_authored_regions():
    cells = [[0.0, 0.0, 640.0, 640.0, 0]]
    _replace_grid(cells, 0, 2, 3, 1)
    _replace_grid(cells, 3, 2, 3, 7)
    return _Composition(None, cells, _marks())


def _marks():
    return regular_grid({"origin": [1 / 6, 1 / 6], "spacing": [1 / 3, 1 / 3],
                         "columns": 3, "rows": 3})


def _replace_grid(cells, identity, columns, rows, next_id):
    selected = next(i for i, cell in enumerate(cells) if cell[4] == identity)
    parent = cells.pop(selected)
    width, height = parent[2] - parent[0], parent[3] - parent[1]
    for row in range(rows):
        for column in range(columns):
            cells.append([
                parent[0] + width * column / columns,
                parent[1] + height * row / rows,
                parent[2] if column + 1 == columns else parent[0] + width * (column + 1) / columns,
                parent[3] if row + 1 == rows else parent[1] + height * (row + 1) / rows,
                next_id,
            ])
            next_id += 1


@dataclass(frozen=True)
class _Composition:
    partition: object
    _cells: object
    _marks: object

    @property
    def size(self):
        return len(self._cells) if self.partition is None else self.partition.size

    def id_at(self, index):
        return self._cells[index][4] if self.partition is None else self.partition.id_at(index)

    def bounds_into(self, index, out):
        if self.partition is not None:
            self.partition.bounds_into(index, out)
        else:
            for slot in range(4):
                out[slot] = self._cells[index][slot]

    def mark_into(self, index, bounds, out):
        self._marks.point_into(index, out)
        out[0] = bounds[0] + (bounds[2] - bounds[0]) * out[0]
        out[1] = bounds[1] + (bounds[3] - bounds[1]) * out[1]
