#!/usr/bin/env python3
"""Create a labelled, white-background PNG contact sheet from explicit image paths."""

import argparse
import math
import os
import tempfile
import warnings
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".work"
MAX_IMAGES = 64
MAX_COLUMNS = 8
MIN_CELL_SIZE = 64
MAX_CELL_SIZE = 512
MAX_OUTPUT_PIXELS = 20_000_000
MAX_INPUT_BYTES = 100 * 1024 * 1024
MAX_SOURCE_PIXELS = 32_000_000
SUPPORTED_FORMATS = {"PNG", "JPEG"}


def output_path(value):
    path = Path(value).resolve()
    if WORK.resolve() not in path.parents:
        raise argparse.ArgumentTypeError("--output must be below repository .work")
    if path.suffix.lower() != ".png":
        raise argparse.ArgumentTypeError("--output must be a PNG path")
    return path


def source_images(paths):
    """Validate each caller-ordered first frame before making output files."""
    images = []
    for path in paths:
        source = Path(path).resolve()
        if not source.is_file():
            raise ValueError("input is not a readable file: " + str(path))
        if source.stat().st_size > MAX_INPUT_BYTES:
            raise ValueError("input exceeds byte limit: " + str(path))
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(source) as opened:
                    if opened.format not in SUPPORTED_FORMATS:
                        raise ValueError("input must be PNG or JPEG: " + str(path))
                    opened.seek(0)
                    width, height = opened.size
                    if width < 1 or height < 1 or width * height > MAX_SOURCE_PIXELS:
                        raise ValueError("input dimensions exceed limit: " + str(path))
                    opened.verify()
                images.append((source, width, height))
        except (OSError, UnidentifiedImageError, Image.DecompressionBombWarning,
                Image.DecompressionBombError) as error:
            raise ValueError("cannot read image: " + str(path)) from error
    return images


def label_text(draw, font, text, width):
    """Keep a label within its cell without relying on an installed font."""
    if draw.textbbox((0, 0), text, font=font)[2] <= width:
        return text
    ellipsis = "..."
    while text and draw.textbbox((0, 0), text + ellipsis, font=font)[2] > width:
        text = text[:-1]
    return text + ellipsis if text else ellipsis


def compose(images, columns, cell_size):
    rows = math.ceil(len(images) / columns)
    width, height = columns * cell_size, rows * cell_size
    if width * height > MAX_OUTPUT_PIXELS:
        raise ValueError("contact sheet exceeds output pixel limit")
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    label_height = draw.textbbox((0, 0), "Ag", font=font)[3] + 4
    image_height = cell_size - label_height
    if image_height < 1:
        raise ValueError("cell size leaves no image area")

    for index, (path, _width, _height) in enumerate(images, start=1):
        column = (index - 1) % columns
        row = (index - 1) // columns
        x, y = column * cell_size, row * cell_size
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(path) as opened:
                    opened.seek(0)
                    width, height = opened.size
                    if width < 1 or height < 1 or width * height > MAX_SOURCE_PIXELS:
                        raise ValueError("input dimensions exceed limit: " + str(path))
                    thumbnail = opened.convert("RGBA")
                    thumbnail.thumbnail((cell_size, image_height), Image.Resampling.LANCZOS)
                    image_x = x + (cell_size - thumbnail.width) // 2
                    image_y = y + (image_height - thumbnail.height) // 2
                    white_thumbnail = Image.new("RGBA", thumbnail.size, "white")
                    white_thumbnail.alpha_composite(thumbnail)
                    sheet.paste(white_thumbnail.convert("RGB"), (image_x, image_y))
        except (OSError, UnidentifiedImageError, Image.DecompressionBombWarning,
                Image.DecompressionBombError) as error:
            raise ValueError("cannot read image: " + str(path)) from error
        label = label_text(draw, font, str(index) + ": " + path.name, cell_size - 4)
        draw.text((x + 2, y + image_height + 2), label, fill="black", font=font)
    return sheet


def publish(sheet, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise ValueError("output already exists: " + str(output))
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".png", delete=False) as handle:
            temporary = Path(handle.name)
        sheet.save(temporary, format="PNG")
        os.link(temporary, output)
    except FileExistsError as error:
        raise ValueError("output already exists: " + str(output)) from error
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="contact_sheet.py", description=__doc__)
    parser.add_argument("images", nargs="+", metavar="IMAGE")
    parser.add_argument("--output", required=True, type=output_path)
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--cell-size", type=int, default=240)
    args = parser.parse_args(argv)
    if len(args.images) > MAX_IMAGES:
        parser.error("at most 64 input images are allowed")
    if not 1 <= args.columns <= MAX_COLUMNS:
        parser.error("--columns must be from 1 through 8")
    if not MIN_CELL_SIZE <= args.cell_size <= MAX_CELL_SIZE:
        parser.error("--cell-size must be from 64 through 512")
    try:
        images = source_images(args.images)
        sheet = compose(images, args.columns, args.cell_size)
        publish(sheet, args.output)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(str(args.output) + " " + str(len(images)))


if __name__ == "__main__":
    main()
