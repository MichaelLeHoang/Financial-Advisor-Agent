#!/usr/bin/env python3
"""Replace a baked checkerboard with Quanfora's dark canvas.

The supplied H.264 clips contain checkerboard pixels rather than an alpha
channel. This script finds bright, nearly neutral checker regions connected to
the frame edge, includes large enclosed checker pockets, softens the boundary,
and composites the remaining artwork over #07080B.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

CANVAS_RGB = (7, 8, 11)
MAX_CHROMA = 10
MIN_LUMINANCE = 182
MIN_ENCLOSED_AREA = 400


def checkerboard_mask(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image, dtype=np.int16)
    luminance = pixels.mean(axis=2)
    chroma = pixels.max(axis=2) - pixels.min(axis=2)
    candidate = (chroma <= MAX_CHROMA) & (luminance >= MIN_LUMINANCE)

    labels, label_count = ndimage.label(candidate)
    selected = np.zeros(candidate.shape, dtype=bool)
    border_labels = np.unique(
        np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1]))
    )
    selected[np.isin(labels, border_labels[border_labels != 0])] = True

    component_slices = ndimage.find_objects(labels)
    for label_index in range(1, label_count + 1):
        component_slice = component_slices[label_index - 1]
        if component_slice is None:
            continue
        component = labels[component_slice] == label_index
        area = int(component.sum())
        if area < MIN_ENCLOSED_AREA:
            continue
        component_luminance = luminance[component_slice][component]
        has_gray_checks = np.mean(component_luminance < 225) > 0.18
        has_white_checks = np.mean(component_luminance > 238) > 0.18
        if has_gray_checks and has_white_checks:
            selected[component_slice] |= component

    mask = Image.fromarray((selected * 255).astype(np.uint8), mode="L")
    return mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6))


def composite_frame(source_path: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGB")
    background_mask = checkerboard_mask(source)
    foreground_alpha = Image.eval(background_mask, lambda value: 255 - value)
    foreground = source.convert("RGBA")
    foreground.putalpha(foreground_alpha)
    canvas = Image.new("RGBA", source.size, (*CANVAS_RGB, 255))
    canvas.alpha_composite(foreground)
    canvas.convert("RGB").save(output_path, optimize=True)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: composite-scroll-world-checkerboard.py INPUT_DIR OUTPUT_DIR")

    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    frames = sorted(input_dir.glob("frame-*.png"))
    if not frames:
        raise SystemExit(f"No PNG frames found in {input_dir}")

    for frame_index, source_path in enumerate(frames, start=1):
        composite_frame(source_path, output_dir / source_path.name)
        if frame_index % 24 == 0 or frame_index == len(frames):
            print(f"Composited {frame_index}/{len(frames)} frames from {input_dir.name}")


if __name__ == "__main__":
    main()
