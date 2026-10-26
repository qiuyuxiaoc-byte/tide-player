#!/usr/bin/env python3
# 生成 app/js/data.js：曲目元数据、时长、主色、带时间轴的歌词
import os, json, subprocess, colorsys
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "app/assets")

META = {
 "night-drive": dict(title="夜行", en="Night Drive", album="Side A", bpm=80, aspect=0.8,
   lrc=["路灯把影子拉得很长","这条高架没有尽头","我把车窗摇下来一半","风里有一点你的味道",
        "后视镜里的城市在退后","红灯一直亮着不走","电台换成下一个频道","还是那首我们听过的歌",
        "再开远一点吧","远到没有人认识我","天亮之前","我不想回头"]),
 "tide": dict(title="潮汐", en="Tide", album="Side A", bpm=70, aspect=1.0,
   lrc=["潮水漫过我的脚踝","你没有说要来","海面上一层薄薄的光","像那天你说的谎",
        "我数着退潮的节拍","一遍一遍地等","风停下来的时候","我才听见自己",
        "潮汐带走了所有","只剩一片沙滩","和一句没说出口的话"]),
 "neon": dict(title="霓虹", en="Neon Rain", album="Side A", bpm=100, aspect=0.75,
   lrc=["霓虹落在雨里的街","伞下的人都走得很急","我站在原地数红绿灯","数到第七次才动",
        "你说的那句话","我到现在还在拆","拆到最后剩下一个空壳","在夜里嗡嗡作响",
        "雨停了","霓虹还在闪","像谁忘了关掉的梦"]),
 "after": dict(title="之后", en="After Glow", album="Side B", bpm=76, aspect=0.8,
   lrc=["那天之后","我把所有的照片调成了黑白","以为这样就不疼了","其实只是更安静",
        "余温还在杯口","你走的时候没关门","我听了很久的风声","才起身去关",
        "之后的日子","都像黄昏","亮着","却照不到人"]),
 "silence": dict(title="无声", en="Silence In Room", album="Side B", bpm=64, aspect=1.0,
   lrc=["房间里没有一点声音","冰箱在嗡嗡地转","我喝了一口冷水","听见喉咙里的回响",
        "你说你要走了","我点了点头","不是不难过","是已经没有力气",
        "无声的那几秒","比任何争吵都长"]),
 "slow-mo": dict(title="慢速", en="Slow Motion", album="Side B", bpm=88, aspect=0.8,
   lrc=["把时间调到最慢","看清你转身的每一帧","头发扫过肩膀","嘴角有一点笑",
        "这一秒钟我看了很久","久到灰尘落下来","慢速的世界里","我来不及难过",
        "只看清了你","原来真的要走了"]),
 "lightyear": dict(title="光年", en="Light Year", album="Side C", bpm=94, aspect=0.75,
   lrc=["你离我一光年","光要走很多年","我在这里站着","以为很快就能到",
        "星星其实早就灭了","我们看到的只是过去","就像你看我的时候","我已经不在那里",
        "一光年的距离","够我把你忘掉","也够我","再想一遍"]),
 "fog": dict(title="雾", en="Fog Session", album="Side C", bpm=72, aspect=1.0,
   lrc=["雾从江面升起来","把桥对面吞了","我在雾里找你","找了很久",
        "其实知道你在哪儿","只是不敢走过去","雾散的时候","你已经走了",
        "原来最远的距离","是一场雾"]),
}

def dur(p):
    o = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],
                       capture_output=True, text=True).stdout.strip()
    return round(float(o), 2)

def tint(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    im = im.crop((int(w*.15), int(h*.15), int(w*.85), int(h*.85))).resize((40, 50))
    arr = np.asarray(im).reshape(-1, 3).astype(float) / 255.0
    r, g, b = arr.mean(axis=0)
    h_, l_, s_ = colorsys.rgb_to_hls(r, g, b)
    l_ = min(max(l_, 0.30), 0.52)
    s_ = min(max(s_ * 1.35, 0.25), 0.72)
    r, g, b = colorsys.hls_to_rgb(h_, l_, s_)
    return "#%02x%02x%02x" % (int(r*255), int(g*255), int(b*255))

out = []
for name, m in META.items():
    mp3 = os.path.join(A, "audio", name + ".mp3")
    jpg = os.path.join(A, "covers", name + ".jpg")
    d = dur(mp3)
    lines = m["lrc"]
    lead = 5.0
    step = min(2 * 240.0 / m["bpm"], (d - lead - 10) / max(len(lines) - 1, 1))
    lrc = [[round(lead + i * step, 2), s] for i, s in enumerate(lines)]
    out.append(dict(id=name, title=m["title"], en=m["en"], artist="Tide Ensemble",
                    album=m["album"], dur=d, bpm=m["bpm"], aspect=m["aspect"],
                    tint=tint(jpg), src=f"assets/audio/{name}.mp3",
                    cover=f"assets/covers/{name}.jpg", lrc=lrc))

js = "// 自动生成，勿手改（tools/make_data.py）\nwindow.TRACKS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
p = os.path.join(ROOT, "app/js/data.js")
open(p, "w").write(js)
print("wrote", p, len(js), "bytes")
for t in out: print(t["id"], t["dur"], t["tint"], len(t["lrc"]))
