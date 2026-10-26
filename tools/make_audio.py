#!/usr/bin/env python3
# 程序化合成三首 ambient / lofi demo 曲目（无版权问题，全部自己算出来的）
import numpy as np, subprocess, os, sys

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app/assets/audio")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20261026)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12.0)

def adsr(n, a=0.01, d=0.2, s=0.7, r=0.4):
    t = np.arange(n) / SR
    e = np.full(n, s, dtype=np.float64)
    ai = min(int(a * SR), n)
    if ai > 0: e[:ai] = np.linspace(0, 1, ai)
    di = min(int(d * SR), max(n - ai, 0))
    if di > 0: e[ai:ai + di] = np.linspace(1, s, di)
    ri = min(int(r * SR), n)
    if ri > 0: e[n - ri:] *= np.linspace(1, 0, ri)
    return e

def pad(f, dur, bright=0.6, atk=0.8, rel=1.4, det=0.004):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    harms = [1, 2, 3, 4, 5, 7]
    amps = [1, .42 * bright, .22 * bright, .12 * bright, .07 * bright, .04 * bright]
    for d in (-det, 0.0, det):
        ff = f * (1 + d)
        for h, a in zip(harms, amps):
            out += a * np.sin(2 * np.pi * ff * h * t + rng.uniform(0, 6.28))
    out /= 3 * sum(amps)
    return out * adsr(n, atk, .4, .82, rel)

def pluck(f, dur, decay=3.2, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for h, a in zip([1, 2, 3, 4.5, 6, 8], [1, .5 * bright, .26 * bright, .12, .08, .05]):
        out += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (decay + h * .9))
    return out / 1.9

def bass(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * f * 2 * t) + .12 * np.sin(2 * np.pi * f * 3 * t)
    return s * adsr(n, .01, .25, .55, .5) / 1.5

def kick(dur=.55):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 46 + 105 * np.exp(-t * 26)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 6.2)

def hat(dur=.09, tone=.5):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))  # 简易高通
    return x * np.exp(-np.arange(n) / SR * (55 + 40 * (1 - tone))) * .28

def snare(dur=.22):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 22) * .5
    return (x * np.exp(-t * 26) * .35 + body)

def vinyl(n):
    hiss = rng.standard_normal(n) * .012
    # 低频滚降
    for _ in range(3):
        hiss = np.convolve(hiss, np.ones(3) / 3, mode="same")
    pops = np.zeros(n)
    for _ in range(int(n / SR * 1.1)):
        i = rng.integers(0, n - 400)
        pops[i:i + 400] += rng.standard_normal(400) * np.exp(-np.arange(400) / 60) * rng.uniform(.02, .07)
    return hiss + pops

def place(buf, sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= len(buf[0]): return
    j = min(i + len(sig), len(buf[0]))
    seg = sig[:j - i] * gain
    # 轻等功率声像
    l = np.sqrt((1 - pan) / 2); r = np.sqrt((1 + pan) / 2)
    buf[0][i:j] += seg * l * 1.414
    buf[1][i:j] += seg * r * 1.414

def master(buf, peak=.92):
    x = np.tanh(buf * 1.08)
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    f = int(.05 * SR)
    x[:, :f] *= np.linspace(0, 1, f)
    x[:, -f:] *= np.linspace(1, 0, f)
    return x

def write(name, buf):
    p = os.path.join(OUT, name + ".wav")
    data = (np.clip(buf.T, -1, 1) * 32767).astype("<i2")
    import wave
    with wave.open(p, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())
    mp3 = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", p, "-codec:a", "libmp3lame",
                    "-b:a", "160k", mp3], check=True)
    os.remove(p)
    print("ok", mp3, round(os.path.getsize(mp3) / 1024), "KB")

CH = {
    "Am7": [57, 60, 64, 67], "Fmaj7": [53, 57, 60, 64], "Cmaj7": [48, 55, 59, 64],
    "G6": [55, 59, 62, 64], "Dm7": [50, 57, 60, 65], "Em7": [52, 59, 62, 67],
    "Bbmaj7": [46, 53, 57, 62], "Am9": [57, 60, 64, 71],
}

def build(bpm, bars, prog, arp_mode, drums, seedname, bright=.6, swing=0.0, arp_gain=.5):
    bar = 4 * 60 / bpm
    total = bars * bar + 3.2
    n = int(total * SR)
    buf = np.zeros((2, n))
    for b in range(bars):
        chord = CH[prog[b % len(prog)]]
        t0 = b * bar
        # 铺底 pad：每个和弦持续一小节
        for i, m in enumerate(chord):
            place(buf, pad(hz(m), min(bar * 1.15, total - t0), bright), t0, .30, pan=(i - 1.5) * .28)
        # 低音
        place(buf, bass(hz(chord[0] - 12), bar * .8), t0, .34)
        if b >= bars - 2: continue
        # 琶音
        if arp_mode:
            steps = [chord[0] + 12, chord[2] + 12, chord[1] + 12, chord[3] + 12,
                     chord[2] + 12, chord[0] + 24, chord[3] + 12, chord[1] + 12]
            for s in range(8):
                tt = t0 + s * bar / 8 + (swing if s % 2 else 0)
                place(buf, pluck(hz(steps[s % len(steps)]), bar / 3, 4.2, bright + .3),
                      tt, arp_gain, pan=(-1 if s % 2 else 1) * .22)
        # 鼓
        if drums:
            for k in (0, 2.5):
                place(buf, kick(), t0 + k * (bar / 4), .42)
            for s in range(8):
                place(buf, hat(.07, .6 if s % 2 == 0 else .9), t0 + s * bar / 8,
                      .16 if s % 2 == 0 else .09, pan=.3)
    buf += np.array([vinyl(n), vinyl(n)]) * .55
    return master(buf)

if __name__ == "__main__":
    tracks = [
        ("night-drive", 80, 32, ["Am7", "Fmaj7", "Cmaj7", "G6"], True,  True,  .55, 0.0,   .42),
        ("tide",        70, 28, ["Dm7", "Bbmaj7", "Fmaj7", "Cmaj7"], True, False, .75, 0.0, .30),
        ("neon",       100, 40, ["Am9", "Em7", "Fmaj7", "G6"], True,  True,  .95, .012,  .50),
        ("after",       76, 30, ["Cmaj7", "Am7", "Fmaj7", "G6"], True, False, .60, 0.0,  .36),
        ("silence",     64, 26, ["Am7", "Fmaj7", "Cmaj7", "Em7"], False, False, .50, 0.0, .30),
        ("slow-mo",     88, 34, ["Fmaj7", "Cmaj7", "Dm7", "Am7"], True, True, .60, 0.0,  .44),
        ("lightyear",   94, 36, ["Am7", "G6", "Fmaj7", "Cmaj7"], True,  True, .85, 0.0,  .46),
        ("fog",         72, 29, ["Dm7", "Am7", "Bbmaj7", "Fmaj7"], True, False, .65, 0.0, .34),
    ]
    for name, bpm, bars, prog, arp, drums, bright, swing, ag in tracks:
        print("->", name)
        write(name, build(bpm, bars, prog, arp, drums, name, bright=bright, swing=swing, arp_gain=ag))
