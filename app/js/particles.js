/* ═══════════════════════════════════════════
   Tide · 粒子歌词
   把一句歌词采样成点云，逐字飞散、再聚合成下一句
   物理与帧率无关（dt 秒），低帧率也不会卡在半路
   ═══════════════════════════════════════════ */
window.Particles = (function () {
  let cv, cx, W = 0, H = 0, dpr = 1;
  let pts = [], raf = 0, running = false;
  let text = '', target = [], accent = '#7fe8d4';
  let color = [127, 232, 212];
  let lastT = 0;

  function init(canvas) {
    cv = canvas; cx = cv.getContext('2d', { alpha: true });
    resize();
    window.addEventListener('resize', () => { if (cv.offsetParent) resize(); });
  }

  function resize() {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    target = sample(text);
    sync(false);
    paintOnce();
  }

  function fontFor(t) {
    const n = [...t].length || 1;
    const byW = (W * 0.88) / n / 0.94;
    return Math.max(22, Math.min(byW, H * 0.15, 108));
  }

  function sample(t) {
    if (!t || W < 10) return [];
    const fs = fontFor(t);
    const oc = document.createElement('canvas');
    oc.width = Math.round(W); oc.height = Math.round(H);
    const ox = oc.getContext('2d');
    ox.fillStyle = '#fff';
    ox.textAlign = 'center';
    ox.textBaseline = 'middle';
    ox.font = `600 ${fs}px -apple-system,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif`;
    ox.fillText(t, W / 2, H * 0.44);
    const img = ox.getImageData(0, 0, Math.round(W), Math.round(H)).data;
    const iw = Math.round(W);
    const gap = fs > 70 ? 3 : 2;
    const out = [];
    for (let y = 0; y < H; y += gap) {
      for (let x = 0; x < iw; x += gap) {
        if (img[(y * iw + x) * 4 + 3] > 140) out.push([x, y]);
      }
    }
    if (out.length > 2400) {
      const k = out.length / 2400, th = [];
      for (let i = 0; i < out.length; i += k) th.push(out[Math.floor(i)]);
      return th;
    }
    return out;
  }

  function sync(burst) {
    const n = target.length;
    while (pts.length < n) {
      pts.push({
        x: W / 2 + (Math.random() - .5) * W * 0.9,
        y: H * 0.44 + (Math.random() - .5) * H * 0.6,
        vx: (Math.random() - .5) * (burst ? 900 : 60),
        vy: (Math.random() - .5) * (burst ? 900 : 60),
        tx: 0, ty: 0, s: Math.random() * 1.1 + 0.7, d: Math.random() * 0.85 + 0.45,
      });
    }
    if (pts.length > n) pts.length = n;
    for (let i = 0; i < n; i++) {
      pts[i].tx = target[i][0]; pts[i].ty = target[i][1];
      if (burst) { pts[i].vx += (Math.random() - .5) * 800; pts[i].vy += (Math.random() - .5) * 800; }
    }
  }

  function frame(dt) {
    const damp = Math.exp(-7 * dt);
    const k = 46;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.vx += (p.tx - p.x) * k * p.d * dt;
      p.vy += (p.ty - p.y) * k * p.d * dt;
      p.vx *= damp; p.vy *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  function paintOnce() {
    if (!cx) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const sp = Math.min(1, (Math.abs(p.vx) + Math.abs(p.vy)) / 260);
      const a = 0.55 + sp * 0.45;
      const sz = p.s * (1 + sp * 0.7);
      cx.globalAlpha = a;
      cx.fillStyle = sp > 0.38 ? accent : `rgb(${color[0]},${color[1]},${color[2]})`;
      cx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
    cx.globalAlpha = 1;
  }

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - (lastT || now)) / 1000));
    lastT = now;
    frame(dt);
    paintOnce();
    raf = requestAnimationFrame(loop);
  }

  function setText(t) {
    if (t === text) return;
    text = t;
    target = sample(t);
    sync(true);
    if (!running && pts.length) start();
  }

  function start() { if (running) return; running = true; lastT = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function setTint(hex) {
    const h = hex.replace('#', '');
    const raw = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    const lift = (c, w) => Math.round(c + (255 - c) * w);
    color = raw.map(c => lift(c, 0.62));   // 提亮，否则暗色封面在暗背景上看不见
    accent = 'rgb(232,255,249)';
  }
  function burst() { sync(true); }

  /* 测试用：把物理直接推进 seconds 秒，不依赖 rAF */
  function settle(seconds = 2) {
    const steps = Math.ceil(seconds / (1 / 60));
    for (let i = 0; i < steps; i++) frame(1 / 60);
    paintOnce();
    return pts.length;
  }

  return { init, resize, setText, start, stop, setTint, burst, settle,
    get active() { return running; }, get count() { return pts.length; } };
})();
