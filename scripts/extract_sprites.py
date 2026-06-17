from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "assets" / "source"
OUT = ROOT / "public" / "assets" / "sprites"


@dataclass(frozen=True)
class SpriteSpec:
    name: str
    source: str
    box: tuple[int, int, int, int]
    key_rgb: tuple[int, int, int]
    threshold: int = 92


GREEN_KEY = (0, 255, 0)
MAGENTA_KEY = (255, 0, 255)


SPRITES = [
    SpriteSpec("corgi-run-1.png", "corgi-sprite-sheet-v2.png", (22, 54, 382, 414), GREEN_KEY),
    SpriteSpec("corgi-run-2.png", "corgi-sprite-sheet-v2.png", (402, 58, 792, 426), GREEN_KEY),
    SpriteSpec("corgi-run-3.png", "corgi-sprite-sheet-v2.png", (806, 58, 1132, 420), GREEN_KEY),
    SpriteSpec("corgi-run-4.png", "corgi-sprite-sheet-v2.png", (1174, 58, 1515, 414), GREEN_KEY),
    SpriteSpec("corgi-idle.png", "corgi-sprite-sheet-v2.png", (42, 560, 452, 968), GREEN_KEY),
    SpriteSpec("corgi-jump.png", "corgi-sprite-sheet-v2.png", (520, 554, 960, 910), GREEN_KEY),
    SpriteSpec("corgi-happy.png", "corgi-sprite-sheet-v2.png", (1032, 548, 1410, 970), GREEN_KEY),
    SpriteSpec("snack-taco.png", "prop-sprite-sheet-v2.png", (34, 136, 286, 412), MAGENTA_KEY),
    SpriteSpec("snack-churro.png", "prop-sprite-sheet-v2.png", (352, 122, 604, 424), MAGENTA_KEY),
    SpriteSpec("snack-bone.png", "prop-sprite-sheet-v2.png", (608, 150, 892, 406), MAGENTA_KEY),
    SpriteSpec("snack-cookie.png", "prop-sprite-sheet-v2.png", (896, 128, 1150, 412), MAGENTA_KEY),
    SpriteSpec("obstacle-fence.png", "prop-sprite-sheet-v2.png", (1170, 98, 1508, 438), MAGENTA_KEY),
    SpriteSpec("obstacle-bush.png", "prop-sprite-sheet-v2.png", (30, 548, 322, 858), MAGENTA_KEY),
    SpriteSpec("obstacle-cone.png", "prop-sprite-sheet-v2.png", (348, 548, 594, 874), MAGENTA_KEY),
    SpriteSpec("sombrero.png", "prop-sprite-sheet-v2.png", (600, 566, 902, 856), MAGENTA_KEY),
    SpriteSpec("confetti-burst.png", "prop-sprite-sheet-v2.png", (900, 526, 1175, 812), MAGENTA_KEY),
    SpriteSpec("heart-sparkle.png", "prop-sprite-sheet-v2.png", (1232, 532, 1512, 820), MAGENTA_KEY),
    SpriteSpec("bg-cloud.png", "background-sprite-sheet-v1.png", (0, 0, 384, 512), MAGENTA_KEY),
    SpriteSpec("bg-mountain-day.png", "background-sprite-sheet-v1.png", (384, 0, 768, 512), MAGENTA_KEY),
    SpriteSpec("bg-bush-mound.png", "background-sprite-sheet-v1.png", (768, 0, 1152, 512), MAGENTA_KEY),
    SpriteSpec("bg-grass-tuft.png", "background-sprite-sheet-v1.png", (1152, 0, 1536, 512), MAGENTA_KEY),
    SpriteSpec("bg-sun.png", "background-sprite-sheet-v1.png", (0, 512, 384, 1024), MAGENTA_KEY),
    SpriteSpec("bg-moon.png", "background-sprite-sheet-v1.png", (384, 512, 768, 1024), MAGENTA_KEY),
    SpriteSpec("bg-snow-cloud.png", "background-sprite-sheet-v1.png", (768, 512, 1152, 1024), MAGENTA_KEY),
    SpriteSpec("bg-mountain-night.png", "background-sprite-sheet-v1.png", (1152, 512, 1536, 1024), MAGENTA_KEY),
]


def is_key_like(pixel: tuple[int, int, int, int], key_rgb: tuple[int, int, int], threshold: int) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return True
    distance = abs(r - key_rgb[0]) + abs(g - key_rgb[1]) + abs(b - key_rgb[2])
    return distance <= threshold


def transparent_crop(source: Image.Image, spec: SpriteSpec) -> Image.Image:
    crop = source.crop(spec.box).convert("RGBA")
    pixels = crop.load()
    width, height = crop.size

    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()
    for x in range(width):
      queue.append((x, 0))
      queue.append((x, height - 1))
    for y in range(height):
      queue.append((0, y))
      queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height or (x, y) in visited:
            continue
        visited.add((x, y))

        if not is_key_like(pixels[x, y], spec.key_rgb, spec.threshold):
            continue

        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # Remove any isolated key-colored pixels left inside fence gaps or between legs.
    for y in range(height):
        for x in range(width):
            if is_key_like(pixels[x, y], spec.key_rgb, 44):
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)

    bbox = crop.getbbox()
    if bbox is None:
        return crop

    left, top, right, bottom = bbox
    pad = 8
    return crop.crop((
        max(0, left - pad),
        max(0, top - pad),
        min(width, right + pad),
        min(height, bottom + pad),
    ))


def normalize_corgi_frame(sprite: Image.Image) -> Image.Image:
    canvas_width = 420
    canvas_height = 360
    canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    x = (canvas_width - sprite.width) // 2
    y = canvas_height - sprite.height
    canvas.alpha_composite(sprite, (x, y))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sources: dict[str, Image.Image] = {}

    for spec in SPRITES:
        if spec.source not in sources:
            sources[spec.source] = Image.open(SOURCE_DIR / spec.source).convert("RGBA")
        sprite = transparent_crop(sources[spec.source], spec)
        if spec.name.startswith("corgi-"):
            sprite = normalize_corgi_frame(sprite)
        sprite.save(OUT / spec.name)
        print(f"{spec.name}: {sprite.size[0]}x{sprite.size[1]}")


if __name__ == "__main__":
    main()
