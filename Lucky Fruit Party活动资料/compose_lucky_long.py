from PIL import Image
from pathlib import Path

root = Path(__file__).parent
parts = [
    ("00-当前页面.png", 0, 1210),
    ("01-DailyTask上半段.png", 40, 1360),
    ("02-DailyTask中段.png", 180, 1470),
    ("03-DailyTask下段.png", 360, 1120),
    ("04-DailyTask底部.png", 690, 1450),
]

imgs = []
for name, y1, y2 in parts:
    im = Image.open(root / name).convert("RGB")
    imgs.append(im.crop((0, y1, im.width, min(y2, im.height))))

width = imgs[0].width
canvas = Image.new("RGB", (width, sum(im.height for im in imgs)), (188, 0, 218))
y = 0
for im in imgs:
    canvas.paste(im, (0, y))
    y += im.height

out = root / "Lucky Fruit Party-活动长图-单张.png"
canvas.save(out, optimize=True)
print(f"saved {out} ({canvas.width}x{canvas.height})")
