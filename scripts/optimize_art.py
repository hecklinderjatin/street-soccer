"""Write the release art the game ships (public-release/art) as WebP.

Inputs: the ball sheets in public/art and the player atlases baked by
`npm run art:bake` into art-baked/ (run both with `npm run art:release`).
The big editable player sheets in public/art are never shipped: the game
loads only the baked atlases. Stale release files are removed.
"""

from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "art"
BAKED = ROOT / "art-baked"
RELEASE = ROOT / "public-release"
TARGET = RELEASE / "art"
TARGET.mkdir(parents=True, exist_ok=True)
# Kit atlases: reduced to a 256-colour palette (no dithering), then stored
# lossless. Lossy WebP shifts colours visibly on these small, detailed
# frames (chroma subsampling); the palette keeps the error low and the
# files about a quarter of the lossless size.
KIT_COLOURS = 256
MAX_MEAN_CHANNEL_ERROR = 5.0

baked = sorted(BAKED.glob("player-*.png"))
# 11 outfield kits + 2 keeper kits + the skin and hair layers.
if len(baked) != 15:
    raise SystemExit("Run `npm run art:bake` first (expected 15 atlases in art-baked/)")
inputs = sorted(SOURCE.glob("ball-*.png")) + baked

written = set()
total = 0
for source in inputs:
    output = TARGET / f"{source.stem}.webp"
    # Balls and the grey look layers stay lossless (they are small and the
    # look layers are tinted, so every grey step shows).
    lossless = source.stem.startswith("ball-") or source.stem in (
        "player-skin",
        "player-hair",
    )
    with Image.open(source) as image:
        rgba = image.convert("RGBA")
        if lossless:
            rgba.save(output, "WEBP", lossless=True, method=6)
        else:
            # Colours only: the alpha (soft shadow, edges) is kept exactly.
            reduced = (
                rgba.convert("RGB")
                .quantize(
                    colors=KIT_COLOURS,
                    method=Image.Quantize.FASTOCTREE,
                    dither=Image.Dither.NONE,
                )
                .convert("RGBA")
            )
            reduced.putalpha(rgba.getchannel("A"))
            reduced.save(output, "WEBP", lossless=True, method=6)
        with Image.open(output) as saved:
            decoded = saved.convert("RGBA")
            alpha = rgba.getchannel("A")
            if ImageChops.difference(alpha, decoded.getchannel("A")).getbbox():
                raise ValueError(f"Alpha changed in {source.name}")
            difference = ImageChops.difference(rgba, decoded).convert("RGB")
            if lossless:
                visible = Image.composite(difference, Image.new("RGB", rgba.size), alpha)
                if visible.getbbox():
                    raise ValueError(f"Colors changed in {source.name}")
            else:
                mean_error = ImageStat.Stat(difference, mask=alpha).mean
                if max(mean_error) > MAX_MEAN_CHANNEL_ERROR:
                    raise ValueError(f"Visible color error is too high in {source.name}")
    written.add(output.name)
    total += output.stat().st_size
    print(f"{output.name} {output.stat().st_size / 1024:.0f} KiB")

for stale in TARGET.glob("*.webp"):
    if stale.name not in written:
        stale.unlink()
        print(f"removed {stale.name}")

copyfile(ROOT / "public" / "ball.svg", RELEASE / "ball.svg")
print(f"{len(written)} release images, {total / 1048576:.2f} MiB")
