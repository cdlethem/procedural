#!/usr/bin/env python3
"""Extract a small deterministic palette from the first frame of one image."""
import argparse
import hashlib
from io import BytesIO
import json
import os
import tempfile
from pathlib import Path

from PIL import Image, __version__ as PILLOW_VERSION

try:
    from tools.contact_sheet import MAX_INPUT_BYTES, WORK, source_images
except ModuleNotFoundError:  # direct execution from the repository's tools directory
    from contact_sheet import MAX_INPUT_BYTES, WORK, source_images


def output_path(value):
    path = Path(value).resolve()
    if WORK.resolve() not in path.parents or path.suffix.lower() != ".json":
        raise argparse.ArgumentTypeError("--output must be a JSON path below repository .work")
    return path


def matte_value(value):
    if len(value) != 6 or any(c not in "0123456789abcdefABCDEF" for c in value):
        raise argparse.ArgumentTypeError("--matte must be six hexadecimal RGB digits without #")
    return int(value, 16)


def extract(source, requested, matte):
    images = source_images([source])
    source_path, width, height = images[0]
    with source_path.open("rb") as handle:
        source_before = handle.read(MAX_INPUT_BYTES + 1)
    if len(source_before) > MAX_INPUT_BYTES:
        raise ValueError("input exceeds byte limit: " + str(source_path))
    with Image.open(BytesIO(source_before)) as opened:
        opened.seek(0)
        frame = opened.convert("RGBA")
    if frame.getchannel("A").getextrema() != (255, 255):
        if matte is None:
            raise ValueError("input contains transparency; supply --matte RRGGBB")
        background = Image.new("RGBA", frame.size, ((matte >> 16) & 255, (matte >> 8) & 255, matte & 255, 255))
        background.alpha_composite(frame)
        frame = background.convert("RGB")
    else:
        frame = frame.convert("RGB")
    frame.thumbnail((256, 256), Image.Resampling.BOX)
    sample_width, sample_height = frame.size
    quantized = frame.quantize(colors=requested, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = quantized.getpalette()
    entries = quantized.getcolors(maxcolors=sample_width * sample_height)
    entries.sort(key=lambda item: (-item[0], ((palette[item[1] * 3] << 16) | (palette[item[1] * 3 + 1] << 8) | palette[item[1] * 3 + 2])))
    colors = [((palette[index * 3] << 16) | (palette[index * 3 + 1] << 8) | palette[index * 3 + 2]) for _count, index in entries]
    counts = [count for count, _index in entries]
    digest = hashlib.sha256()
    with source_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.digest() != hashlib.sha256(source_before).digest():
        raise ValueError("input changed during extraction: " + str(source_path))
    return {
        "format": "procedurals-palette-v1",
        "source_path": str(source_path),
        "source_sha256": digest.hexdigest(),
        "pillow_version": PILLOW_VERSION,
        "method": "Pillow MEDIANCUT dither NONE",
        "sample_dimensions": [sample_width, sample_height],
        "matte": None if matte is None else matte,
        "requested_colors": requested,
        "colors": colors,
        "counts": counts,
    }


def publish(data, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise ValueError("output already exists: " + str(output))
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".json", delete=False, mode="w", encoding="utf-8") as handle:
            temporary = Path(handle.name)
            json.dump(data, handle, indent=2)
            handle.write("\n")
        os.link(temporary, output)
    except FileExistsError as error:
        raise ValueError("output already exists: " + str(output)) from error
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="extract_palette.py", description=__doc__)
    parser.add_argument("image")
    parser.add_argument("--colors", required=True, type=int)
    parser.add_argument("--output", required=True, type=output_path)
    parser.add_argument("--matte", type=matte_value)
    args = parser.parse_args(argv)
    if not 1 <= args.colors <= 32:
        parser.error("--colors must be from 1 through 32")
    try:
        data = extract(args.image, args.colors, args.matte)
        publish(data, args.output)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print("int[] colors = {" + ", ".join("0x%06X" % color for color in data["colors"]) + "};")


if __name__ == "__main__":
    main()
