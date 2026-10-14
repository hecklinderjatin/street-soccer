"""Regenerate compact release art from the editable PNG sheets in public/art."""

from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "art"
RELEASE = ROOT / "public-release"
TARGET = RELEASE / "art"
TARGET.mkdir(parents=True, exist_ok=True)
PLAYER_QUALITY = 98
MAX_MEAN_CHANNEL_ERROR = 5.0

original = optimized = 0
for source in sorted(SOURCE.glob("*.png")):
    output = TARGET / f"{source.stem}.webp"
    with Image.open(source) as image:
        rgba = image.convert("RGBA")
        is_ball = source.stem.startswith("ball-")
        if is_ball:
            rgba.save(output, "WEBP", lossless=True, method=4)
        else:
            rgba.save(output, "WEBP", quality=PLAYER_QUALITY, method=4)
        with Image.open(output) as saved:
            decoded = saved.convert("RGBA")
            alpha = rgba.getchannel("A")
            if ImageChops.difference(alpha, decoded.getchannel("A")).getbbox():
                raise ValueError(f"Alpha changed in {source.name}")
            difference = ImageChops.difference(rgba, decoded).convert("RGB")
            if is_ball:
                visible_difference = Image.composite(
                    difference, Image.new("RGB", rgba.size), alpha
                )
                if visible_difference.getbbox():
                    raise ValueError(f"Ball colors changed in {source.name}")
            else:
                mean_error = ImageStat.Stat(difference, mask=alpha).mean
                if max(mean_error) > MAX_MEAN_CHANNEL_ERROR:
                    raise ValueError(f"Visible color error is too high in {source.name}")
    original += source.stat().st_size
    optimized += output.stat().st_size

copyfile(ROOT / "public" / "ball.svg", RELEASE / "ball.svg")
print(
    f"{len(list(SOURCE.glob('*.png')))} sheets: "
    f"{original / 1048576:.2f} -> {optimized / 1048576:.2f} MiB "
    f"({(1 - optimized / original) * 100:.1f}% smaller)"
)
