import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'packages/python'))
from procedurals.fields import gradient_noise_2d_01

mode, seed_text, x_text, y_text, coordinate_scale_text, base_text, scale_or_heading_text, step_text, count_text = sys.argv[1:]
seed = int(seed_text); coordinate_scale = float(coordinate_scale_text); base = float(base_text)
angle_scale_or_heading = float(scale_or_heading_text); step = float(step_text); count = int(count_text)
def bits(value): return struct.pack('>d', value).hex()
field = gradient_noise_2d_01({'seed': seed}) if mode == 'field' else None
x = float(x_text); y = float(y_text)
for index in range(count):
    sample = 0.0
    if field is not None:
        query_x = x * coordinate_scale
        query_y = y * coordinate_scale
        sample = field.sample(query_x, query_y)
        mapped = angle_scale_or_heading * sample
        heading = base + mapped
    else:
        heading = angle_scale_or_heading
    dx = step * math.cos(heading)
    dy = step * math.sin(heading)
    next_x = x + dx
    next_y = y + dy
    print(index, bits(sample), bits(heading), bits(dx), bits(dy), bits(next_x), bits(next_y), sep='\t')
    x, y = next_x, next_y
