#!/usr/bin/env python3
# 程序化生成专辑封面：渐变 + 柔光斑 + 颗粒 + 排版，全部本地算出来
import os, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 1500
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app/assets/covers")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

F_BOLD = "/usr/share/fonts/dejavu/DejaVuSansCondensed-Bold.ttf"
F_MONO = "/usr/share/fonts/dejavu/DejaVuSansMono.ttf"
CJK = "/usr/share/fonts/noto/NotoSansCJK-Bold.ttc"

def grad(stops, angle=100):
    a = np.deg2rad(angle)
    ys, xs = np.mgrid[0:H, 0:W]
    t = (np.cos(a) * xs / W + np.sin(a) * ys / H)
    t = (t - t.min()) / (t.max() - t.min())
    pos = np.array([s[0] for s in stops]); cols = np.array([s[1] for s in stops], dtype=float)
    out = np.zeros((H, W, 3))
    for c in range(3):
        out[..., c] = np.interp(t, pos, cols[:, c])
    return out

def blob(img, cx, cy, r, color, strength=1.0, power=2.2):
    ys, xs = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xs - cx * W) / r) ** 2 + ((ys - cy * H) / r) ** 2)
    f = np.clip(1 - d, 0, 1) ** power
    for c in range(3):
        img[..., c] = img[..., c] * (1 - f * strength) + color[c] * f * strength
    return img

def streak(img, cx, cy, w, h, angle, color, strength=.5):
    layer = np.zeros((H, W))
    ys, xs = np.mgrid[0:H, 0:W]
    a = np.deg2rad(angle)
    xr = (xs - cx * W) * np.cos(a) + (ys - cy * H) * np.sin(a)
    yr = -(xs - cx * W) * np.sin(a) + (ys - cy * H) * np.cos(a)
    d = (xr / w) ** 2 + (yr / h) ** 2
    layer = np.clip(1 - d, 0, 1) ** 1.4
    for c in range(3):
        img[..., c] = img[..., c] * (1 - layer * strength) + color[c] * layer * strength
    return img

def grain(img, amt=.028):
    n = rng.standard_normal((H, W, 1))
    n = np.repeat(n, 3, axis=2)
    return np.clip(img + n * amt * 255, 0, 255)

def vignette(img, k=.55):
    ys, xs = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xs - W / 2) / (W * .78)) ** 2 + ((ys - H / 2) / (H * .78)) ** 2)
    v = np.clip(1 - k * r ** 2.4, 0, 1)[..., None]
    return img * v

def spaced(draw, xy, text, font, fill, spacing=14, anchor_left=True):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + spacing
    return x

def finish(arr, name, title, sub, tiny, align="bottom", mono=True, cjk=None, fg=(255, 255, 255)):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img, "RGBA")
    R, G, B = fg
    d.text((90, 78), "TIDE  RECORDS", font=ImageFont.truetype(F_MONO, 26), fill=(R, G, B, 120))
    d.line((90, 126, 1110, 126), fill=(R, G, B, 45), width=2)
    ft = ImageFont.truetype(F_BOLD, 96)
    lines = title.split("|")
    block_h = len(lines) * 104
    ty = H - 108 - block_h            # 标题块底对齐
    for i, line in enumerate(lines):
        spaced(d, (88, ty + i * 104), line, ft, (R, G, B, 235), 8)
    sub_y = ty + block_h + 6
    d.text((92, sub_y), sub.upper(), font=ImageFont.truetype(F_MONO, 30), fill=(R, G, B, 150))
    # 角落小字放在标题块上方，绝不与标题重叠
    d.text((92, ty - 52), tiny.upper(), font=ImageFont.truetype(F_MONO, 24), fill=(R, G, B, 115))
    if cjk:
        d.text((92, 96), cjk, font=ImageFont.truetype(CJK, 74), fill=(R, G, B, 215))
    p = os.path.join(OUT, name + ".jpg")
    img.save(p, quality=88, optimize=True)
    print("ok", p, os.path.getsize(p) // 1024, "KB")

def base(stops, angle=100):
    return grad(stops, angle)

# 01 夜行
H = 1500
W = 1200
a = base([(0, (10, 18, 30)), (.45, (18, 42, 60)), (.72, (34, 84, 92)), (1, (7, 12, 20))], 108)
a = blob(a, .18, .34, .95, (46, 120, 128), .55)
a = blob(a, .86, .12, .55, (120, 190, 190), .22)
a = streak(a, .5, .62, .95, .05, 8, (150, 220, 215), .28)
a = vignette(grain(a), .6)
finish(a, "night-drive", "NIGHT|DRIVE", "tide ensemble  ·  80 bpm", "side a / 01", cjk="夜 行")

# 02 潮汐
H = 1200
W = 1200
a = base([(0, (208, 224, 226)), (.35, (150, 186, 196)), (.7, (74, 112, 130)), (1, (26, 44, 58))], 95)
a = blob(a, .5, .58, 1.15, (238, 248, 250), .45)
a = streak(a, .5, .46, 1.1, .035, -6, (255, 255, 255), .45)
a = vignette(grain(a, .022), .5)
finish(a, "tide", "TIDE", "tide ensemble  ·  70 bpm", "side a / 02", cjk="潮 汐", fg=(255, 255, 255))

# 03 霓虹
H = 1600
W = 1200
a = base([(0, (12, 6, 24)), (.4, (58, 16, 74)), (.68, (150, 32, 120)), (1, (18, 6, 26))], 118)
a = blob(a, .72, .5, .8, (236, 74, 160), .5)
a = blob(a, .22, .22, .6, (96, 92, 240), .38)
a = streak(a, .5, .5, .16, 1.2, 72, (255, 190, 240), .22)
a = vignette(grain(a), .58)
finish(a, "neon", "NEON|RAIN", "tide ensemble  ·  100 bpm", "side a / 03", cjk="霓 虹")

# 04 之后
H = 1500
W = 1200
a = base([(0, (24, 16, 14)), (.42, (86, 52, 32)), (.66, (196, 126, 62)), (1, (30, 18, 14))], 84)
a = blob(a, .5, .42, .5, (255, 206, 140), .55)
a = streak(a, .5, .42, .62, .02, 0, (255, 236, 200), .5)
a = blob(a, .2, .82, .7, (60, 32, 24), .5)
a = vignette(grain(a), .62)
finish(a, "after", "AFTER|GLOW", "tide ensemble  ·  76 bpm", "side b / 01", cjk="之 后")

# 05 无声
H = 1200
W = 1200
a = base([(0, (14, 14, 16)), (.45, (58, 58, 62)), (.72, (140, 142, 148)), (1, (18, 18, 20))], 100)
a = blob(a, .3, .3, .8, (200, 202, 208), .3)
a = blob(a, .8, .7, .6, (30, 30, 34), .55)
a = vignette(grain(a, .04), .6)
finish(a, "silence", "SILENCE|IN ROOM", "tide ensemble  ·  64 bpm", "side b / 02", cjk="无 声")

# 06 慢速
H = 1500
W = 1200
a = base([(0, (14, 20, 14)), (.4, (44, 60, 40)), (.7, (104, 130, 84)), (1, (12, 16, 12))], 92)
a = blob(a, .62, .38, .72, (176, 204, 140), .3)
a = streak(a, .4, .62, .9, .04, -14, (208, 232, 180), .25)
a = vignette(grain(a), .58)
finish(a, "slow-mo", "SLOW|MOTION", "tide ensemble  ·  88 bpm", "side b / 03", cjk="慢 速")

# 07 光年
H = 1600
W = 1200
a = base([(0, (16, 8, 10)), (.38, (94, 22, 26)), (.62, (222, 96, 44)), (1, (40, 12, 12))], 78)
a = blob(a, .5, .3, .62, (255, 176, 110), .5)
a = blob(a, .5, .3, .3, (255, 232, 200), .6)
a = vignette(grain(a), .64)
finish(a, "lightyear", "LIGHT|YEAR", "tide ensemble  ·  94 bpm", "side c / 01", cjk="光 年")

# 08 雾
H = 1200
W = 1200
a = base([(0, (196, 196, 206)), (.3, (150, 148, 164)), (.62, (92, 90, 108)), (1, (34, 34, 44))], 102)
a = blob(a, .2, .5, 1.0, (226, 226, 234), .45)
a = blob(a, .9, .2, .7, (60, 58, 74), .4)
a = streak(a, .5, .68, 1.0, .06, 4, (240, 240, 248), .3)
a = vignette(grain(a, .03), .52)
finish(a, "fog", "FOG|SESSION", "tide ensemble  ·  72 bpm", "side c / 02", cjk="雾")
