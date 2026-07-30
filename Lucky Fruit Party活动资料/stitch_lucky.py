from pathlib import Path
import sys
import numpy as np
from PIL import Image


def image_array(path, width=360):
    im = Image.open(path).convert("RGB")
    h = round(im.height * width / im.width)
    return np.asarray(im.resize((width, h), Image.Resampling.BILINEAR), dtype=np.float32)


def best_offset(prev, curr):
    # Find where the next phone viewport begins in the previous viewport.
    # Ignore the status/navigation bars, which change between captures.
    ph, ch = prev.shape[0], curr.shape[0]
    best = None
    for off in range(90, max(91, ph - 70), 3):
        n = min(ph - off, ch)
        if n < 180:
            continue
        a = prev[off:off+n]
        b = curr[:n]
        lo, hi = 10, max(10, n - 12)
        d = np.abs(a[lo:hi] - b[lo:hi]).mean()
        if best is None or d < best[0]:
            best = (d, off)
    return best


def stitch(paths, out_path):
    images = [Image.open(p).convert("RGB") for p in paths]
    arrays = [image_array(p) for p in paths]
    offsets = []
    for i in range(1, len(paths)):
        score, off = best_offset(arrays[i-1], arrays[i])
        scale = images[i-1].height / arrays[i-1].shape[0]
        off_px = round(off * scale)
        offsets.append(off_px)
        print(f"{Path(paths[i-1]).name} -> {Path(paths[i]).name}: offset={off_px}, score={score:.2f}")

    canvas = images[0].copy()
    ypos = 0
    for im, off in zip(images[1:], offsets):
        # Use the matched page coordinate; the last few pixels are clipped only
        # when the scroll moved farther than one viewport.
        crop = im.crop((0, 0, im.width, im.height))
        ypos += off
        canvas.paste(crop, (0, ypos))
        # Extend the canvas with the non-overlapping bottom portion.
        if canvas.height < ypos + crop.height:
            grown = Image.new("RGB", (canvas.width, ypos + crop.height), "white")
            grown.paste(canvas, (0, 0))
            grown.paste(crop, (0, ypos))
            canvas = grown
    canvas.save(out_path, quality=95, optimize=True)
    print(f"saved {out_path} ({canvas.width}x{canvas.height})")


if __name__ == "__main__":
    out = sys.argv[1]
    stitch(sys.argv[2:], out)
