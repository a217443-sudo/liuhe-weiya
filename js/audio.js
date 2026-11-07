// 配樂：程式合成的原創喜慶尾牙曲（C 大調五聲音階，嗩吶＋揚琴＋大鼓＋鑼鈸）；音效也是程式合成
// iPhone 要在觸控事件裡解鎖；iOS 17+ 設 audioSession=playback；跳出遊戲聲音整個停
(function () {
  let ac = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('liuhe-weiya-mute') === '1'; } catch (e) {}
  const lastAt = {};
  let want = null, cur = null, urgent = 0;
  // 歌：用 <audio> 播（不用整首解碼進記憶體），接進 WebAudio 才吃得到靜音與音量
  const song = new Audio(); song.loop = true;   // 不使用外部音檔；配樂全部由下面程式合成
  let songOk = false, songNode = null, songBus = null;
  song.addEventListener('error', () => { songOk = false; if (cur === 'song') { cur = null; startMusic('song'); } });

  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ac.destination);
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(comp);
      musicBus = ac.createGain(); musicBus.gain.value = 0.34; musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.75; sfxBus.connect(master);
      songBus = ac.createGain(); songBus.gain.value = 0.55; songBus.connect(master);
      try { songNode = ac.createMediaElementSource(song); songNode.connect(songBus); } catch (e) { songNode = null; }
      const n = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      if (want) startMusic(want);
    }
    if (ac.state === 'suspended' && !away) ac.resume();
  }
  ['touchstart', 'touchend', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  let away = false;
  function awayChange(h) {
    away = h;
    if (h) song.pause(); else if (cur === 'song' && songOk) song.play().catch(() => {});
    if (!ac) return; if (h) ac.suspend(); else ac.resume();
  }
  document.addEventListener('visibilitychange', () => awayChange(document.hidden));
  window.addEventListener('pagehide', () => awayChange(true));
  window.addEventListener('pageshow', () => awayChange(document.hidden));

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, f, t, a, d, vol, out, f2) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    o.connect(g); g.connect(out); env(g, t, a, d, vol); o.start(t); o.stop(t + a + d + 0.05); return o;
  }
  function noise(t, dur, out, { type = 'bandpass', f = 1000, q = 1, vol = 0.2, a = 0.002, f2 } = {}) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + dur);
    s.connect(fl); fl.connect(g); g.connect(out); env(g, t, a, dur, vol);
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  }
  const limit = (key, ms) => { const now = performance.now(); if (lastAt[key] && now - lastAt[key] < ms) return false; lastAt[key] = now; return true; };

  // ---------- 樂器 ----------
  function harpsi(m, t, dur, vol = 0.12) {   // 撥弦大鍵琴：方波＋低通，衰減快
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(900, t + dur); f.connect(musicBus);
    tone('square', mtof(m), t, 0.003, dur, vol, f);
    tone('sawtooth', mtof(m + 12), t, 0.003, dur * 0.5, vol * 0.25, f);
  }
  function pluckBass(m, t, vol = 0.32) { tone('triangle', mtof(m), t, 0.005, 0.22, vol, musicBus); tone('sine', mtof(m - 12), t, 0.005, 0.18, vol * 0.5, musicBus); }
  function organ(ms, t, dur, vol = 0.035) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500; f.connect(musicBus);
    for (const m of ms) { tone('sawtooth', mtof(m), t, 0.08, dur, vol, f); tone('sine', mtof(m + 12), t, 0.08, dur, vol * 0.8, f); }
  }
  function celesta(m, t, vol = 0.08) { tone('sine', mtof(m), t, 0.002, 0.9, vol, musicBus); tone('sine', mtof(m + 24), t, 0.002, 0.25, vol * 0.3, musicBus); }
  function kick(t, v = 0.5) { tone('sine', 140, t, 0.002, 0.16, v, musicBus, 45); }
  function snare(t, v = 0.12) { noise(t, 0.12, musicBus, { type: 'bandpass', f: 1800, q: 0.8, vol: v }); }
  function hat(t, v = 0.05) { noise(t, 0.03, musicBus, { type: 'highpass', f: 7000, vol: v }); }

  // ---------- 喜慶尾牙配樂（原創，C 大調五聲音階；嗩吶風格主旋律＋揚琴＋大鼓＋鑼鈸）----------
  function suona(m, t, dur, vol = 0.07) {   // 嗩吶：鋸齒波過鼻音帶通濾波，加一點顫音
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.1; f.connect(musicBus);
    const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(m), t);
    l.frequency.value = 5.5; lg.gain.value = 7; l.connect(lg); lg.connect(o.detune);
    o.connect(g); g.connect(f); env(g, t, 0.02, dur, vol); o.start(t); l.start(t); o.stop(t + dur + 0.08); l.stop(t + dur + 0.08);
  }
  function yangqin(m, t, vol = 0.06) { tone('triangle', mtof(m), t, 0.002, 0.32, vol, musicBus); tone('sine', mtof(m + 12), t, 0.002, 0.14, vol * 0.5, musicBus); }
  function gong(t, vol = 0.16) {
    tone('sine', 196, t, 0.004, 2.2, vol, musicBus); tone('sine', 196 * 2.76, t, 0.004, 1.1, vol * 0.4, musicBus); tone('sine', 196 * 5.4, t, 0.004, 0.5, vol * 0.2, musicBus);
  }
  function cymbal(t, vol = 0.06) { noise(t, 0.22, musicBus, { type: 'highpass', f: 6000, vol }); noise(t, 0.12, musicBus, { type: 'bandpass', f: 9500, q: 1.5, vol: vol * 0.7 }); }
  function drum(t, v = 0.4) { tone('sine', 120, t, 0.002, 0.2, v, musicBus, 55); noise(t, 0.05, musicBus, { type: 'lowpass', f: 500, vol: v * 0.3 }); }
  function wood(t, v = 0.05) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 4; f.connect(musicBus); tone('square', 1100, t, 0.001, 0.05, v, f); }

  // 16 分音符一格；每小節 16 格，8 小節循環。和弦 C – Am – F – G，兩輪
  const CH = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  const ROOT = [48, 45, 41, 43];
  const MEL = [
    76, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0,
    81, 0, 0, 79, 81, 0, 84, 0, 81, 0, 79, 0, 76, 0, 0, 0,
    81, 0, 79, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74, 0,
    74, 0, 76, 0, 79, 0, 0, 0, 76, 0, 74, 0, 72, 0, 0, 0,
    84, 0, 84, 0, 81, 0, 79, 0, 81, 0, 84, 0, 79, 0, 76, 0,
    81, 0, 81, 0, 79, 0, 76, 0, 79, 0, 81, 0, 76, 0, 0, 0,
    79, 0, 81, 0, 84, 0, 81, 0, 79, 0, 76, 0, 74, 0, 76, 0,
    79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 72, 0, 0, 0,
  ];
  const SONGS = {
    title: { bpm: 100, step(i, t, sp) {
      const bar = (i >> 4) & 3, s = i & 15, b8 = (i >> 4) & 7, m = MEL[b8 * 16 + s];
      if (m) suona(m, t, sp * 1.8, 0.05);
      if (s % 2 === 0) yangqin(CH[bar][(s >> 1) % 3] + 12, t, 0.045);
      if (s === 0) { gong(t, 0.12); pluckBass(ROOT[bar], t, 0.2); }
      if (s === 8) pluckBass(ROOT[bar] + 7, t, 0.16);
    } },
    play: { bpm: 126, step(i, t, sp) {
      const bar = (i >> 4) & 3, s = i & 15, b8 = (i >> 4) & 7, m = MEL[b8 * 16 + s];
      if (m) suona(m, t, sp * 1.9, 0.072);
      if (s % 2 === 0) yangqin(CH[bar][(s >> 1) % 3] + 12, t, 0.05);        // 揚琴琶音
      if (s % 4 === 2) wood(t, 0.04);                                         // 木魚
      if (s === 0 || s === 4 || s === 8 || s === 12 || (urgent && s % 2 === 0)) pluckBass(ROOT[bar] + (s === 8 ? 7 : 0), t, 0.24);
      if (s === 0) { drum(t, 0.5); if (bar === 0 && (i >> 6) % 2 === 0) gong(t, 0.15); }   // 每 8 小節一次鑼
      if (s === 4 || s === 10 || s === 12) drum(t, 0.3);                      // 咚 咚咚
      if (s === 2 || s === 6 || s === 14) cymbal(t, 0.05);                    // 鏘
      if (b8 === 7 && s >= 12) drum(t, 0.35);                                  // 結尾過門
    } },
    // Boss 戰：D 小調、148 BPM、重鼓點加銅管風主旋律（原創）
    boss: { bpm: 148, step(i, t, sp) {
      const BCH = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [50, 53, 57]], BROOT = [38, 34, 36, 38];
      const MB = [
        74, 0, 74, 77, 0, 81, 0, 77, 74, 0, 0, 0, 76, 0, 77, 0,
        82, 0, 82, 81, 0, 77, 0, 74, 77, 0, 0, 0, 74, 0, 70, 0,
        79, 0, 79, 81, 0, 84, 0, 81, 79, 0, 0, 0, 76, 0, 79, 0,
        81, 0, 77, 0, 74, 0, 77, 81, 86, 0, 0, 0, 0, 0, 0, 0,
        81, 0, 81, 84, 0, 86, 0, 84, 81, 0, 0, 0, 79, 0, 81, 0,
        82, 0, 82, 86, 0, 89, 0, 86, 82, 0, 0, 0, 81, 0, 82, 0,
        84, 0, 84, 88, 0, 91, 0, 88, 84, 0, 0, 0, 79, 0, 84, 0,
        86, 0, 84, 0, 81, 0, 77, 0, 74, 0, 77, 0, 81, 0, 0, 0,
      ];
      const bar = (i >> 4) & 3, s = i & 15, b8 = (i >> 4) & 7, m = MB[b8 * 16 + s];
      if (m) suona(m, t, sp * 1.7, 0.085);
      if (s % 2 === 0) pluckBass(BROOT[bar] + (s % 4 === 2 ? 12 : 0), t, 0.3);          // 低音八分音符推進
      if (s === 0 || s === 6 || s === 10) organ(BCH[bar], t, sp * 3, 0.034);              // 和弦重音
      if (s % 4 === 0) drum(t, 0.55);                                                      // 四拍大鼓
      if (s === 10) drum(t, 0.35);
      if (s === 4 || s === 12) { noise(t, 0.12, musicBus, { type: 'bandpass', f: 1800, q: 0.8, vol: 0.16 }); drum(t, 0.3); }   // 軍鼓
      if (s === 2 || s === 6 || s === 10 || s === 14) cymbal(t, 0.05);
      if (s === 0 && bar === 0 && (i >> 6) % 2 === 0) gong(t, 0.2);
      if (b8 === 7 && s >= 12) drum(t, 0.4 + (s - 12) * 0.06);                             // 每 8 小節結尾的鼓點滾奏
    } },
  };
  let seqI = 0, seqT = 0, timerId = null;
  function startMusic(name, opt = {}) {
    want = name;
    if (name !== 'song') song.pause();
    if (name === 'song' && songOk) {   // 歌（從頭播或接著播）
      if (timerId) { clearInterval(timerId); timerId = null; }
      if (opt.restart) song.currentTime = 0;
      if (!songNode) song.volume = muted ? 0 : 0.55;
      cur = 'song';
      if (!away) song.play().catch(() => {});
      return;
    }
    if (name === 'song') name = 'play';   // 歌載不到：用合成的
    if (!ac) return;
    if (cur === name) return;
    cur = name; seqI = 0; seqT = ac.currentTime + 0.08;
    if (timerId) clearInterval(timerId);
    if (!name) return;
    timerId = setInterval(() => {
      if (!ac || ac.state !== 'running') return;
      const sg = SONGS[cur]; if (!sg) return;
      const sp = 60 / (sg.bpm * (urgent ? 1.08 : 1)) / 4;
      if (seqT < ac.currentTime - 0.3) seqT = ac.currentTime + 0.05;
      while (seqT < ac.currentTime + 0.15) { sg.step(seqI, seqT, sp); seqI++; seqT += sp; }
    }, 40);
  }

  // ---------- 音效 ----------
  const FX = {
    throw() { if (!limit('throw', 90)) return; const t = ac.currentTime; tone('triangle', 900, t, 0.002, 0.06, 0.08, sfxBus, 1500); },
    hit() { if (!limit('hit', 45)) return; const t = ac.currentTime; noise(t, 0.04, sfxBus, { type: 'bandpass', f: 2400, q: 2, vol: 0.06 }); },
    die() { if (!limit('die', 60)) return; const t = ac.currentTime; tone('sine', 420 + Math.random() * 160, t, 0.002, 0.09, 0.09, sfxBus, 160); noise(t, 0.06, sfxBus, { type: 'lowpass', f: 900, vol: 0.06 }); },
    boom() { if (!limit('boom', 80)) return; const t = ac.currentTime; tone('sine', 180, t, 0.002, 0.18, 0.35, sfxBus, 60); noise(t, 0.08, sfxBus, { type: 'bandpass', f: 600, q: 1, vol: 0.2 }); },   // 躲避球砸地：砰
    thunder() { const t = ac.currentTime; noise(t, 0.3, sfxBus, { type: 'bandpass', f: 900, f2: 2800, q: 2, vol: 0.12 }); noise(t + 0.22, 0.08, sfxBus, { type: 'highpass', f: 2500, vol: 0.12 }); },   // 紙飛機咻～
    flash() { const t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(); o.type = 'sine'; o.frequency.value = 2900; l.frequency.value = 38; lg.gain.value = 160; l.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(sfxBus); env(g, t, 0.01, 0.45, 0.07); o.start(t); l.start(t); o.stop(t + 0.5); l.stop(t + 0.5); },   // 哨子嗶～（顫音）
    beam() { const t = ac.currentTime; noise(t, 0.35, sfxBus, { type: 'bandpass', f: 1800, f2: 600, q: 0.8, vol: 0.14 }); },   // 掃把唰
    gem() { if (!limit('gem', 35)) return; const t = ac.currentTime; const k = Math.min(12, (FX.gemN = ((performance.now() - (FX.gemAt || 0)) < 400 ? (FX.gemN || 0) + 1 : 0))); FX.gemAt = performance.now(); tone('sine', mtof(84 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][k]), t, 0.002, 0.08, 0.05, sfxBus); },
    lvup() { const t = ac.currentTime; [74, 78, 81, 86].forEach((m, i) => tone('square', mtof(m), t + i * 0.07, 0.003, 0.18, 0.05, sfxBus)); },
    pick() { const t = ac.currentTime; tone('triangle', mtof(81), t, 0.003, 0.12, 0.1, sfxBus); tone('triangle', mtof(88), t + 0.08, 0.003, 0.2, 0.1, sfxBus); },
    item() { const t = ac.currentTime; [81, 85, 88, 93].forEach((m, i) => { tone('sine', mtof(m), t + i * 0.09, 0.003, 0.5, 0.09, sfxBus); }); },
    search() { if (!limit('search', 300)) return; const t = ac.currentTime; noise(t, 0.12, sfxBus, { type: 'bandpass', f: 1200, q: 3, vol: 0.06 }); },
    chest() { const t = ac.currentTime; noise(t, 0.15, sfxBus, { type: 'lowpass', f: 700, vol: 0.12 }); [76, 81, 85, 88, 93].forEach((m, i) => tone('triangle', mtof(m), t + 0.1 + i * 0.06, 0.003, 0.3, 0.07, sfxBus)); },
    hurt() { if (!limit('hurt', 120)) return; const t = ac.currentTime; tone('square', 180, t, 0.002, 0.12, 0.08, sfxBus, 90); },
    block() { const t = ac.currentTime; tone('triangle', 1300, t, 0.002, 0.25, 0.1, sfxBus, 1100); },
    horde() { const t = ac.currentTime; [50, 49].forEach((m, i) => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(sfxBus); tone('sawtooth', mtof(m - 12), t + i * 0.35, 0.05, 0.5, 0.1, f); }); },
    boss() { const t = ac.currentTime; [38, 37, 38, 41].forEach((m, i) => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.connect(sfxBus); tone('sawtooth', mtof(m), t + i * 0.3, 0.04, 0.4, 0.14, f); }); },
    exit() { const t = ac.currentTime; [74, 81, 86].forEach((m, i) => tone('sine', mtof(m), t + i * 0.12, 0.003, 0.7, 0.09, sfxBus)); },
    clear() { const t = ac.currentTime; [74, 78, 81, 86, 81, 86, 90].forEach((m, i) => tone('square', mtof(m), t + i * 0.11, 0.003, i === 6 ? 0.8 : 0.16, 0.06, sfxBus)); },
    dead() { const t = ac.currentTime; [69, 68, 67, 62].forEach((m, i) => tone('triangle', mtof(m), t + i * 0.22, 0.003, i === 3 ? 0.8 : 0.24, 0.1, sfxBus)); },
    bounce() { if (!limit('bounce', 70)) return; const t = ac.currentTime; tone('sine', 220, t, 0.002, 0.12, 0.2, sfxBus, 110); },
    flute() { const t = ac.currentTime; [79, 83, 86].forEach((m, i) => tone('triangle', mtof(m), t + i * 0.06, 0.02, 0.16, 0.06, sfxBus)); },
    dust() { const t = ac.currentTime; noise(t, 0.3, sfxBus, { type: 'lowpass', f: 1200, f2: 400, vol: 0.14 }); },
    summon() { const t = ac.currentTime; tone('sine', 300, t, 0.05, 0.5, 0.08, sfxBus, 600); },
    poof() { const t = ac.currentTime; noise(t, 0.25, sfxBus, { type: 'lowpass', f: 1600, f2: 300, vol: 0.15 }); },
    transform() { const t = ac.currentTime; [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => tone('square', mtof(m), t + i * 0.05, 0.003, 0.12, 0.05, sfxBus)); noise(t + 0.35, 0.4, sfxBus, { type: 'highpass', f: 2000, vol: 0.12 }); },
    tap() { const t = ac.currentTime; tone('triangle', 660, t, 0.002, 0.05, 0.06, sfxBus); },
    talk() { if (!limit('talk', 70)) return; const t = ac.currentTime; tone('triangle', 520 + Math.random() * 120, t, 0.002, 0.035, 0.03, sfxBus); },
  };

  window.SND = {
    play(name) { if (!ac || muted || ac.state !== 'running') return; const f = FX[name]; if (f) f(); },
    music(name, opt) { startMusic(name, opt); },
    songTime: () => song.currentTime,
    unlock,
    urgent(v) { urgent = v ? 1 : 0; },
    muted: () => muted,
    setMuted(v) { muted = v; try { localStorage.setItem('liuhe-weiya-mute', v ? '1' : '0'); } catch (e) {} if (master) master.gain.value = v ? 0 : 0.8; if (!songNode) song.volume = v ? 0 : 0.55; },
  };
})();
