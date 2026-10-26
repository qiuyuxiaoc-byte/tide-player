/* ═══════════════════════════════════════════
   Tide · 歌词引擎
   三种呈现：逐字高亮 / 聊天气泡 / 粒子拆解
   ═══════════════════════════════════════════ */
window.Lyrics = (function () {
  const list = document.getElementById('pLyrics');
  const bubBox = document.getElementById('pBubbles');
  let track = null, lines = [], els = [], bubIdx = -1;
  let active = -1, lastText = '';
  const onLine = [];

  function parse(lrc, dur) {
    if (!lrc || !lrc.length) return [[0, '纯音乐，请欣赏']];
    return lrc.map(([t, s], i) => ({ t, s: String(s).trim(), e: i + 1 < lrc.length ? lrc[i + 1][0] : dur }))
      .filter(l => l.s.length);
  }

  function build(tr, dur) {
    track = tr;
    lines = parse(tr.lrc, dur || tr.dur);
    active = -1; bubIdx = -1; lastText = '';
    list.innerHTML = '';
    bubBox.innerHTML = '';
    els = lines.map(l => {
      const el = document.createElement('p');
      el.className = 'line';
      const frag = document.createDocumentFragment();
      [...l.s].forEach(ch => {
        const sp = document.createElement('span');
        sp.className = 'ch';
        sp.textContent = ch;
        frag.appendChild(sp);
      });
      el.appendChild(frag);
      list.appendChild(el);
      return el;
    });
    list.scrollTop = 0;
    if (window.Particles) window.Particles.setText('');
  }

  function indexAt(t) {
    let i = -1;
    for (let k = 0; k < lines.length; k++) if (t >= lines[k].t - 0.12) i = k; else break;
    return i;
  }

  function bubbleFor(i) {
    const l = lines[i];
    const el = document.createElement('div');
    el.className = 'bub ' + (i % 2 ? 'r' : 'l');
    const who = document.createElement('div');
    who.className = 'who';
    if (track) who.style.backgroundImage = `url("${track.cover}")`;
    el.appendChild(who);
    const span = document.createElement('span');
    el.textContent = '';
    span.textContent = l.s;
    el.appendChild(span);
    bubBox.appendChild(el);
    requestAnimationFrame(() => {
      bubBox.scrollTo({ top: bubBox.scrollHeight, behavior: 'smooth' });
    });
  }

  function update(t) {
    if (!lines.length) return;
    const i = indexAt(t);
    if (i !== active) {
      if (active >= 0 && els[active]) els[active].classList.remove('on'), els[active].classList.add('past');
      active = i;
      const el = els[i];
      if (el) {
        el.classList.remove('past');
        el.classList.add('on');
        const top = el.offsetTop - list.clientHeight * 0.40;
        list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        const l = lines[i];
        if (l.s !== lastText) {
          lastText = l.s;
          onLine.forEach(f => f(l.s, i));
          if (window.Particles && document.body.dataset.mode === 'particle') window.Particles.setText(l.s);
        }
      }
      if (i > bubIdx) { for (let k = bubIdx + 1; k <= i; k++) bubbleFor(k); bubIdx = i; }
    }
    // 逐字进度
    if (active >= 0 && els[active]) {
      const l = lines[active];
      const span = Math.max(0.7, l.e - l.t);
      const p = Math.min(1, Math.max(0, (t - l.t) / span));
      const chs = els[active].children;
      const n = chs.length;
      const upto = Math.floor(p * n);
      for (let k = 0; k < n; k++) {
        const c = chs[k];
        const hit = k < upto, now = k === upto;
        if (c._hit !== hit) { c.classList.toggle('hit', hit); c._hit = hit; }
        if (c._now !== now) { c.classList.toggle('now', now); c._now = now; }
      }
    }
  }

  function reset() {
    list.querySelectorAll('.line').forEach(e => e.classList.remove('on', 'past'));
    list.scrollTop = 0;
    bubBox.innerHTML = ''; bubIdx = -1; active = -1; lastText = '';
  }

  return { build, update, reset, onLine: fn => onLine.push(fn), get lines() { return lines; } };
})();
