/* ═══════════════════════════════════════════
   Tide · 音频引擎
   用 WebAudio 解码播放，好处是音效链全程可控；
   手机壳和电脑壳里都能跑（不依赖 <audio> 的跨域限制）
   ═══════════════════════════════════════════ */
window.Engine = (function () {
  let ctx = null, chain = null;
  let buffer = null, srcNode = null;
  let startedAt = 0, offset = 0, playing = false, duration = 0;
  let timer = 0, raf = 0;
  const listeners = { time: [], state: [], ended: [] };
  let volume = 0.9;
  let fx = { bass: 0, mid: 0, treble: 0, verb: 12, room: 30, soft: false, preset: 'flat' };

  function on(ev, fn) { (listeners[ev] ||= []).push(fn); }
  function emit(ev, ...a) { (listeners[ev] || []).forEach(f => { try { f(...a); } catch (e) { console.warn(e); } }); }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'playback' });

    const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 200;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1100; mid.Q.value = 0.9;
    const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 3200;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 20000; tone.Q.value = 0.4;
    const dry = ctx.createGain(); dry.gain.value = 0.88;
    const wet = ctx.createGain(); wet.gain.value = 0.12;
    const master = ctx.createGain(); master.gain.value = volume;
    const anal = ctx.createAnalyser(); anal.fftSize = 256; anal.smoothingTimeConstant = 0.82;

    // 合成一段房间混响脉冲，不需要外部文件
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 2.2, 2.6);

    low.connect(mid); mid.connect(high); high.connect(tone);
    tone.connect(dry); tone.connect(verb); verb.connect(wet);
    dry.connect(master); wet.connect(master); master.connect(anal); anal.connect(ctx.destination);

    chain = { low, mid, high, tone, dry, wet, master, verb, anal };
    applyFx();
    return ctx;
  }

  function makeImpulse(c, sec, decay) {
    const len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function applyFx() {
    if (!chain) return;
    chain.low.gain.value = fx.bass;
    chain.mid.gain.value = fx.mid;
    chain.high.gain.value = fx.treble;
    const wetAmt = (fx.verb / 100) * (0.5 + fx.room / 140);
    chain.wet.gain.value = wetAmt;
    chain.dry.gain.value = 1 - wetAmt * 0.45;
    chain.tone.frequency.value = fx.soft ? 7200 : 20000;
    chain.master.gain.value = volume;
  }

  const PRESETS = {
    flat:   { bass: 0, mid: 0, treble: 0, verb: 12, room: 30, soft: false },
    warm:   { bass: 5, mid: 1, treble: -3, verb: 20, room: 40, soft: true },
    bright: { bass: -2, mid: 2, treble: 6, verb: 8, room: 22, soft: false },
    club:   { bass: 8, mid: -2, treble: 2, verb: 30, room: 70, soft: false },
  };

  async function load(track) {
    ensureCtx();
    stopSrc();
    emit('state', 'loading');
    const res = await fetch(track.src);
    if (!res.ok) throw new Error('音频读取失败 ' + res.status);
    const ab = await res.arrayBuffer();
    buffer = await new Promise((ok, no) => {
      const p = ctx.decodeAudioData(ab, ok, no);
      if (p && p.then) p.then(ok, no);
    });
    duration = buffer.duration;
    offset = 0;
    emit('time', 0, duration);
    return duration;
  }

  function stopSrc() {
    if (srcNode) { try { srcNode.onended = null; srcNode.stop(); } catch (e) {} srcNode.disconnect(); srcNode = null; }
    playing = false;
  }

  function start(at) {
    if (!buffer) return;
    stopSrc();
    srcNode = ctx.createBufferSource();
    srcNode.buffer = buffer;
    srcNode.connect(chain.low);
    srcNode.onended = () => {
      if (!playing) return;
      playing = false;
      offset = duration;
      emit('state', 'ended');
      emit('ended');
    };
    srcNode.start(0, Math.max(0, Math.min(at, duration - 0.05)));
    startedAt = ctx.currentTime - at;
    playing = true;
    tick();
    emit('state', 'playing');
  }

  async function play() {
    ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    if (!buffer) return;
    if (playing) return;
    start(offset >= duration - 0.05 ? 0 : offset);
  }

  function pause() {
    if (!playing) return;
    offset = currentTime();
    stopSrc();
    cancelAnimationFrame(raf);
    emit('state', 'paused');
    emit('time', offset, duration);
  }

  function toggle() { playing ? pause() : play(); }

  function seek(t) {
    t = Math.max(0, Math.min(t, duration));
    offset = t;
    if (playing) start(t); else emit('time', t, duration);
  }

  function currentTime() {
    if (!playing || !ctx) return offset;
    return Math.min(ctx.currentTime - startedAt, duration);
  }

  function tick() {
    cancelAnimationFrame(raf);
    const loop = () => {
      if (!playing) return;
      emit('time', currentTime(), duration);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function spectrum() {
    if (!chain) return new Uint8Array(0);
    const arr = new Uint8Array(chain.anal.length);
    chain.anal.getByteFrequencyData(arr);
    return arr;
  }

  function setFx(patch) { Object.assign(fx, patch); applyFx(); return fx; }
  function setPreset(name) { const p = PRESETS[name]; if (p) { fx = { ...p, preset: name }; applyFx(); } return fx; }
  function setVolume(v) { volume = v; if (chain) chain.master.gain.value = v; }

  return {
    on, load, play, pause, toggle, seek, currentTime, spectrum,
    setFx, setPreset, setVolume,
    get playing() { return playing; },
    get duration() { return duration; },
    get fx() { return { ...fx }; },
  };
})();
