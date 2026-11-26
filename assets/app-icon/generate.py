#!/usr/bin/env python3
"""
管事 · 应用图标生成器（定稿：白卡 + 对勾）

朱砂渐变底 + 暖白圆角卡片 + 朱砂对勾。
卡片是「一件事」，对勾是「办妥」，单色块与粗线保证 48dp 下依然清晰。

用法：python3 generate.py
"""

from PIL import Image, ImageDraw, ImageOps
import os

BASE = os.path.dirname(os.path.abspath(__file__))

# 朱砂渐变
C_TOP = (201, 82, 42)
C_BOTTOM = (148, 44, 15)
PAPER = (255, 252, 248)
INK = (150, 46, 17)

CARD = 0.60          # 白卡占画布比例
CARD_RADIUS = 0.24   # 卡片圆角（相对卡片边长）
CHECK = 0.105        # 对勾线宽（相对卡片边长）


# ---------- 基础 ----------

def gradient(size):
    col = Image.new("RGB", (1, size))
    px = col.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        px[0, y] = tuple(int(C_TOP[i] + (C_BOTTOM[i] - C_TOP[i]) * t) for i in range(3))
    img = col.resize((size, size), Image.BILINEAR)

    top_light = ImageOps.invert(Image.linear_gradient("L").resize((size, size), Image.BILINEAR))
    mask = top_light.point(lambda v: int(v * 0.07))
    return Image.composite(Image.new("RGB", (size, size), (255, 255, 255)), img, mask)


def rounded_mask(size, radius_ratio=0.225):
    m = Image.new("L", (size * 2, size * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, size * 2 - 1, size * 2 - 1], radius=size * 2 * radius_ratio, fill=255
    )
    return m.resize((size, size), Image.LANCZOS)


def circle_mask(size):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    return m.resize((size, size), Image.LANCZOS)


# ---------- 图形 ----------

def mark_layer(size, scale=1.0):
    """暖白卡片 + 朱砂对勾，整体按 scale 缩放并居中"""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    card = size * CARD * scale
    x0 = (size - card) / 2
    y0 = (size - card) / 2
    d.rounded_rectangle(
        [x0, y0, x0 + card, y0 + card], radius=card * CARD_RADIUS, fill=PAPER + (255,)
    )

    w = max(3, int(card * CHECK))
    pts = [
        (x0 + card * 0.28, y0 + card * 0.52),
        (x0 + card * 0.44, y0 + card * 0.68),
        (x0 + card * 0.74, y0 + card * 0.34),
    ]
    d.line(pts, fill=INK + (255,), width=w, joint="curve")
    for p in (pts[0], pts[2]):
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=INK + (255,))
    return layer


def compose(size, shape="square", scale=1.0):
    ss = max(size * 2, 1024)
    img = gradient(ss).convert("RGBA")
    img.alpha_composite(mark_layer(ss, scale))
    img = img.resize((size, size), Image.LANCZOS)
    if shape == "rounded":
        img.putalpha(rounded_mask(size))
    elif shape == "circle":
        img.putalpha(circle_mask(size))
    return img


def adaptive_bg(size):
    return gradient(size).convert("RGB")


def adaptive_fg(size):
    ss = size * 4
    layer = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    inner = mark_layer(int(ss * 0.62))
    layer.alpha_composite(inner, (int((ss - inner.width) / 2), int((ss - inner.height) / 2)))
    return layer.resize((size, size), Image.LANCZOS)


def notification(size):
    """通知栏：纯白对勾剪影"""
    ss = size * 6
    layer = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w = int(ss * 0.135)
    pts = [(ss * 0.20, ss * 0.52), (ss * 0.41, ss * 0.73), (ss * 0.81, ss * 0.25)]
    d.line(pts, fill=(255, 255, 255, 255), width=w, joint="curve")
    for p in (pts[0], pts[2]):
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2],
                  fill=(255, 255, 255, 255))
    return layer.resize((size, size), Image.LANCZOS)


def save(img, rel):
    path = os.path.join(BASE, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print("  ✓", rel, img.size)


if __name__ == "__main__":
    print("管事 · 生成图标（白卡 + 对勾）")
    save(compose(1024, "square"), "guanshi-icon-1024.png")
    save(compose(512, "square"), "play-store-512.png")

    for folder, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
        save(compose(size, "rounded"), f"mipmap-{folder}/ic_launcher.png")
        save(compose(size, "circle"), f"mipmap-{folder}/ic_launcher_round.png")

    save(adaptive_bg(432), "adaptive/ic_launcher_background-432.png")
    save(adaptive_fg(432), "adaptive/ic_launcher_foreground-432.png")
    save(notification(96), "notification/ic_notification-96.png")
    print("完成")
