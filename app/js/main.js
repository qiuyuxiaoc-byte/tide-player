/* ═══════════════════════════════════════════
   Tide · 主逻辑
   ═══════════════════════════════════════════ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = s => {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

const S = {
  tracks: [], cur: -1, mode: 'lyrics', layout: 'grid', nav: 'all',
  fav: new Set(JSON.parse(localStorage.getItem('tide:fav') || '[]')),
  playing: false, loading: false, ready: false,
};

const el = {
  wall: $('#wall'), empty: $('#empty'), bg: $('#bg'),
  player: $('#player'), backdrop: $('#pBackdrop'),
  disc: $('#disc'), discArt: $('#discArt'), discWrap: $('#discWrap'),
  pTitle: $('#pTitle'), pAlbum: $('#pAlbum'), pNowTitle: $('#pNowTitle'), pNowArtist: $('#pNowArtist'),
  lyrics: $('#pLyrics'), bubbles: $('#pBubbles'), particles: $('#pParticles'),
  seek: $('#seek'), seekFill: $('#seekFill'), seekKnob: $('#seekKnob'), tCur: $('#tCur'), tDur: $('#tDur'),
  playIcon: $('#playIcon'), mini: $('#mini'), miniCover: $('#miniCover'),
  miniTitle: $('#miniTitle'), miniArtist: $('#miniArtist'), miniTime: $('#miniTime'), miniBar: $('#miniBar'),
  fxPanel: $('#fxPanel'),
};

/* ══════ 卡片 ══════ */
function makeCard(t, i) {
  const c = document.createElement('article');
  c.className = 'card';
  c.dataset.id = t.id;
  c.style.setProperty('--ar', t.aspect || 0.8);
  c.innerHTML = `
    <div class="cov"><img src="${t.cover}" alt="" loading="lazy" draggable="false">
      <div class="eqb"><div class="eqbars"><i></i><i></i><i></i><i></i></div></div>
    </div>
    <div class="ttl"></div>
    <div class="art"></div>
    <div class="foot">
      <div class="meta"><b>${t.album || ''}</b><i>${fmt(t.dur)}</i></div>
      <button class="add" title="加入播放列表">＋</button>
    </div>`;
  $('.ttl', c).textContent = t.title;
  $('.art', c).textContent = t.artist;
  c.addEventListener('click', e => {
    if (e.target.closest('.add')) { e.stopPropagation(); toast('已加入播放列表'); return; }
    openTrack(i, c);
  });
  return c;
}

function renderWall() {
  const list = S.nav === 'fav' ? S.tracks.filter(t => S.fav.has(t.id)) : S.tracks;
  el.wall.innerHTML = '';
  el.wall.className = 'wall' + (S.layout === 'list' ? ' list' : '');
  list.forEach(t => {
    const i = S.tracks.indexOf(t);
    const c = makeCard(t, i);
    if (i === S.cur) c.classList.add('playing');
    el.wall.appendChild(c);
  });
  el.empty.hidden = list.length > 0;
  el.empty.querySelector('p').innerHTML = S.nav === 'fav'
    ? '还没有喜欢的歌<br><span>点播放页的「♡ 喜欢」收藏</span>'
    : '还没有音乐<br><span>点右上角「导入」或把文件拖进来</span>';
  $('#pageSub').textContent = `Tide Ensemble · 3 张专辑 · ${S.tracks.length} 首`;
}

/* ══════ 播放 ══════ */
async function openTrack(i, cardEl) {
  if (i < 0 || i >= S.tracks.length) return;
  const t = S.tracks[i];
  const first = cardEl ? $('.cov img', cardEl) : null;
  if (S.cur === i && el.player.classList.contains('open')) return;

  S.cur = i;
  applyTrackUI(t);
  el.player.classList.add('open');
  if (first) flyToDisc(first);

  try {
    S.loading = true; setPlayIcon('…');
    await Engine.load(t);
    Lyrics.build(t, Engine.duration);
    Particles.setText('');
    S.loading = false;
    await Engine.play();
  } catch (err) {
    console.error(err);
    S.loading = false;
    setPlayIcon('▶');
    toast('这首歌放不了：' + (err.message || err));
  }
  markPlayingCard();
  saveLast();
}

function applyTrackUI(t) {
  el.discArt.style.opacity = '1';
  document.documentElement.style.setProperty('--tint', t.tint || '#1b5e7d');
  el.backdrop.style.backgroundImage = `url("${t.cover}")`;
  el.discArt.src = t.cover;
  el.pTitle.textContent = t.en || t.title;
  el.pAlbum.textContent = t.album || '';
  el.pNowTitle.textContent = t.title;
  el.pNowArtist.textContent = t.artist;
  el.miniCover.src = t.cover;
  el.miniTitle.textContent = t.title;
  el.miniArtist.textContent = t.artist;
  el.mini.classList.add('show');
  Particles.setTint(t.tint || '#7fe8d4');
  el.tDur.textContent = fmt(t.dur);
  Lyrics.reset();
  $('#btnFav').classList.toggle('on', S.fav.has(t.id));
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist, album: t.album || 'Tide',
        artwork: [{ src: t.cover, sizes: '512x512', type: 'image/jpeg' }],
      });
    } catch (e) {}
  }
}

function flyToDisc(img) {
  const a = img.getBoundingClientRect();
  const b = el.discArt.getBoundingClientRect();
  if (!a.width || !b.width) return;
  el.discArt.style.opacity = '0';
  const fly = document.createElement('img');
  fly.src = img.currentSrc || img.src;
  fly.style.cssText = `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;
    border-radius:18px;object-fit:cover;z-index:60;pointer-events:none;will-change:transform`;
  document.body.appendChild(fly);
  const anim = fly.animate([
    { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', borderRadius: '18px', opacity: 1 },
    { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', borderRadius: '50%', opacity: .96 },
  ], { duration: 560, easing: 'cubic-bezier(.22,.72,.24,1)' });
  const done = () => { fly.remove(); el.discArt.style.opacity = '1'; };
  anim.onfinish = done;
  setTimeout(done, 900); // 兜底：动画被打断也一定显示封面
}

function closePlayer() {
  el.player.classList.remove('open');
  Particles.stop();
}

function markPlayingCard() {
  const id = (S.tracks[S.cur] || {}).id;
  $$('.card').forEach(c => c.classList.toggle('playing', c.dataset.id === id));
}

/* ══════ 时间与状态 ══════ */
function setPlayIcon(txt) { el.playIcon.textContent = txt; }

Engine.on('time', (cur, dur) => {
  const p = dur ? cur / dur : 0;
  el.seekFill.style.width = (p * 100) + '%';
  el.seekKnob.style.left = (p * 100) + '%';
  el.tCur.textContent = fmt(cur);
  el.miniBar.style.width = (p * 100) + '%';
  el.miniTime.textContent = fmt(cur) + ' / ' + fmt(dur);
  Lyrics.update(cur);
});

Engine.on('state', st => {
  S.playing = st === 'playing';
  el.disc.classList.toggle('spin', S.playing);
  setPlayIcon(S.playing ? '❚❚' : '▶');
  $('#miniPlay').textContent = S.playing ? '❚❚' : '▶';
  if (st === 'paused') Particles.stop();
  if (st === 'playing' && S.mode === 'particle') Particles.start();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = S.playing ? 'playing' : 'paused';
});

Engine.on('ended', () => next(true));

/* ══════ 拖进度 ══════ */
(function seekBar() {
  let drag = false;
  const pos = e => {
    const r = el.seek.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return Math.max(0, Math.min(1, x / r.width)) * (Engine.duration || 0);
  };
  const handle = e => {
    const r = el.seek.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const p = Math.max(0, Math.min(1, x / r.width));
    el.seekFill.style.width = (p * 100) + '%';
    el.seekKnob.style.left = (p * 100) + '%';
    el.tCur.textContent = fmt(p * (Engine.duration || 0));
  };
  el.seek.addEventListener('pointerdown', e => { drag = true; el.seek.setPointerCapture(e.pointerId); handle(e); });
  el.seek.addEventListener('pointermove', e => { if (drag) handle(e); });
  el.seek.addEventListener('pointerup', e => { if (!drag) return; drag = false; Engine.seek(pos(e)); });
  el.seek.addEventListener('pointercancel', () => { drag = false; });
})();

/* ══════ 队列 ══════ */
function next(auto) {
  if (!S.tracks.length) return;
  const i = (S.cur + (S.shuffle ? 1 + Math.floor(Math.random() * (S.tracks.length - 1)) : 1)) % S.tracks.length;
  openTrack(i, $(`.card[data-id="${S.tracks[i].id}"]`));
}
function prev() {
  if (!S.tracks.length) return;
  if (Engine.currentTime() > 4) { Engine.seek(0); return; }
  const i = (S.cur - 1 + S.tracks.length) % S.tracks.length;
  openTrack(i, $(`.card[data-id="${S.tracks[i].id}"]`));
}

/* ══════ 模式切换 ══════ */
function setMode(m) {
  S.mode = m;
  document.body.dataset.mode = m;
  el.player.dataset.mode = m;
  $$('#pModes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  el.lyrics.style.display = m === 'lyrics' ? '' : 'none';
  el.bubbles.style.display = m === 'bubble' ? '' : 'none';
  el.particles.style.display = m === 'particle' ? '' : 'none';
  if (m === 'particle') {
    requestAnimationFrame(() => Particles.resize());
    const cur = Engine.currentTime();
    const lines = Lyrics.lines;
    let t = ''; for (const l of lines) if (cur >= l.t - 0.12) t = l.s;
    Particles.setText(t);
    if (S.playing) Particles.start();
  } else Particles.stop();
  localStorage.setItem('tide:mode', m);
}

/* ══════ 提示 ══════ */
let toastTimer = 0;
function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `position:fixed;left:50%;bottom:150px;transform:translateX(-50%) translateY(10px);
      padding:10px 18px;border-radius:999px;background:rgba(30,30,36,.92);border:1px solid rgba(255,255,255,.12);
      color:#f2f2f4;font-size:13px;z-index:99;opacity:0;transition:.3s cubic-bezier(.22,.7,.25,1);
      backdrop-filter:blur(20px);pointer-events:none;white-space:nowrap`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; }, 1900);
}

/* ══════ 本地导入 ══════ */
const PALETTE = ['#1b5e7d', '#831580', '#7d461b', '#456137', '#8d2d16', '#5f568f', '#25626a', '#6b2c3f'];
function coverFor(name, seed) {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 750;
  const x = c.getContext('2d');
  const col = PALETTE[seed % PALETTE.length];
  const g = x.createLinearGradient(0, 0, 600, 750);
  g.addColorStop(0, '#121216'); g.addColorStop(.55, col); g.addColorStop(1, '#0d0d10');
  x.fillStyle = g; x.fillRect(0, 0, 600, 750);
  const rg = x.createRadialGradient(300, 260, 20, 300, 260, 380);
  rg.addColorStop(0, 'rgba(255,255,255,.22)'); rg.addColorStop(1, 'transparent');
  x.fillStyle = rg; x.fillRect(0, 0, 600, 750);
  x.fillStyle = 'rgba(255,255,255,.92)';
  x.font = '600 150px -apple-system,"PingFang SC",sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText([...name][0] || '♪', 300, 500);
  return c.toDataURL('image/jpeg', .82);
}

function addLocalFiles(files) {
  const audio = [...files].filter(f => /audio|mp3|flac|wav|m4a|aac|ogg/i.test(f.type + f.name));
  if (!audio.length) return toast('没找到音频文件');
  const added = [];
  audio.forEach((f, k) => {
    const title = f.name.replace(/\.[^.]+$/, '');
    const t = {
      id: 'loc-' + Date.now() + '-' + k,
      title, en: title, artist: '本地文件', album: '本地音乐',
      dur: 0, aspect: k % 3 === 0 ? 1 : .8,
      tint: PALETTE[(S.tracks.length + k) % PALETTE.length],
      src: URL.createObjectURL(f), cover: coverFor(title, S.tracks.length + k), lrc: [],
    };
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = t.src;
    probe.onloadedmetadata = () => { t.dur = probe.duration || 0; };
    S.tracks.unshift(t);
    added.push(t);
  });
  renderWall();
  toast(`已导入 ${added.length} 首`);
  setTimeout(() => openTrack(0, $('.card')), 200);
}

/* ══════ 启动 ══════ */
function boot() {
  S.tracks = (window.TRACKS || []).slice();
  renderWall();
  Particles.init(el.particles);

  // 布局 / 导航
  $('#btnLayout').onclick = () => {
    S.layout = S.layout === 'grid' ? 'list' : 'grid';
    localStorage.setItem('tide:layout', S.layout);
    renderWall();
  };
  $$('.nav-item').forEach(a => a.onclick = () => {
    $$('.nav-item').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    S.nav = a.dataset.nav;
    renderWall();
  });
  $$('.pl-item').forEach(a => a.onclick = () => {
    $$('.pl-item').forEach(x => x.classList.remove('on'));
    a.classList.add('on');
    const al = a.dataset.playlist;
    S.nav = 'all'; S.albumFilter = al;
    renderWall();
  });

  // 播放页开关
  $('#pClose').onclick = closePlayer;
  $('#miniOpen').onclick = () => {
    if (S.cur < 0 && S.tracks.length) return openTrack(0, $('.card'));
    el.player.classList.add('open');
  };
  $('#miniPlay').onclick = e => { e.stopPropagation(); Engine.toggle(); };
  $('#miniNext').onclick = e => { e.stopPropagation(); next(); };
  $('#btnPlay').onclick = () => Engine.toggle();
  $('#btnNext').onclick = () => next();
  $('#btnPrev').onclick = () => prev();
  $('#btnShuffle').onclick = e => {
    S.shuffle = !S.shuffle; e.currentTarget.classList.toggle('on', S.shuffle);
    toast(S.shuffle ? '随机播放开' : '顺序播放');
  };
  $('#btnRepeat').onclick = e => {
    S.repeat = !S.repeat; e.currentTarget.classList.toggle('on', S.repeat);
    toast(S.repeat ? '单曲循环' : '列表循环');
  };
  $('#btnFav').onclick = () => {
    const t = S.tracks[S.cur]; if (!t) return;
    S.fav.has(t.id) ? S.fav.delete(t.id) : S.fav.add(t.id);
    localStorage.setItem('tide:fav', JSON.stringify([...S.fav]));
    $('#btnFav').classList.toggle('on', S.fav.has(t.id));
    toast(S.fav.has(t.id) ? '已喜欢' : '已取消');
  };

  // 模式
  $$('#pModes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  setMode(localStorage.getItem('tide:mode') || 'lyrics');

  // 音效面板
  $('#btnFx').onclick = () => { el.fxPanel.hidden = !el.fxPanel.hidden; };
  $('#fxClose').onclick = () => el.fxPanel.hidden = true;
  const ids = [['eqBass', 'bass'], ['eqMid', 'mid'], ['eqTreble', 'treble'], ['eqVerb', 'verb'], ['eqRoom', 'room']];
  ids.forEach(([id, key]) => {
    const inp = $('#' + id), out = $('#' + id + 'V');
    inp.value = key === 'verb' ? 12 : key === 'room' ? 30 : 0;
    out.textContent = inp.value;
    inp.oninput = () => {
      out.textContent = inp.value;
      Engine.setFx({ [key]: +inp.value });
      $$('#fxPresets button').forEach(b => b.classList.remove('on'));
      saveFx();
    };
  });
  $$('#fxPresets button').forEach(b => b.onclick = () => {
    const f = Engine.setPreset(b.dataset.preset);
    $$('#fxPresets button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $('#eqBass').value = f.bass; $('#eqBassV').textContent = f.bass;
    $('#eqMid').value = f.mid; $('#eqMidV').textContent = f.mid;
    $('#eqTreble').value = f.treble; $('#eqTrebleV').textContent = f.treble;
    $('#eqVerb').value = f.verb; $('#eqVerbV').textContent = f.verb;
    $('#eqRoom').value = f.room; $('#eqRoomV').textContent = f.room;
    $('#fxSoft').classList.toggle('on', !!f.soft);
    saveFx();
  });
  $('#fxSoft').onclick = e => {
    const on = !e.currentTarget.classList.contains('on');
    e.currentTarget.classList.toggle('on', on);
    Engine.setFx({ soft: on });
    saveFx();
  };

  // 导入
  const fin = $('#fileIn');
  const pick = () => fin.click();
  $('#btnImport').onclick = pick;
  $('#btnImport2').onclick = pick;
  fin.onchange = () => { addLocalFiles(fin.files); fin.value = ''; };
  ['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => {
    e.preventDefault();
    if (ev === 'drop' && e.dataTransfer?.files?.length) addLocalFiles(e.dataTransfer.files);
  }));

  // 键盘
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); Engine.toggle(); }
    if (e.code === 'ArrowRight') Engine.seek(Engine.currentTime() + 5);
    if (e.code === 'ArrowLeft') Engine.seek(Engine.currentTime() - 5);
    if (e.code === 'Escape') closePlayer();
  });

  // 系统媒体控制（锁屏 / 耳机键 / 车机）
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => Engine.play());
      ms.setActionHandler('pause', () => Engine.pause());
      ms.setActionHandler('previoustrack', prev);
      ms.setActionHandler('nexttrack', next);
      ms.setActionHandler('seekto', d => Engine.seek(d.seekTime));
    } catch (e) {}
  }

  // 恢复上次设置
  S.layout = localStorage.getItem('tide:layout') || 'grid';
  const fxSaved = JSON.parse(localStorage.getItem('tide:fx') || 'null');
  if (fxSaved) {
    Engine.setFx(fxSaved);
    ['eqBass', 'eqMid', 'eqTreble', 'eqVerb', 'eqRoom'].forEach(id => {
      const key = id.replace('eq', '').toLowerCase();
      if (fxSaved[key] !== undefined) { $('#' + id).value = fxSaved[key]; $('#' + id + 'V').textContent = fxSaved[key]; }
    });
    $('#fxSoft').classList.toggle('on', !!fxSaved.soft);
  }
  window.__tide = { S, Engine, Lyrics, Particles, toast };
}

function saveFx() {
  const f = Engine.fx;
  localStorage.setItem('tide:fx', JSON.stringify({ bass: f.bass, mid: f.mid, treble: f.treble, verb: f.verb, room: f.room, soft: f.soft }));
}
function saveLast() { localStorage.setItem('tide:last', String(S.cur)); }

document.addEventListener('DOMContentLoaded', boot);
