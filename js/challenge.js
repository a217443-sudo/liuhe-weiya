// 尾牙上台挑戰：每一關拿齊三樣東西後，老闆請你上台，五項全過才能開席吃尾牙
// runChallenge(關卡索引, 過關後要做的事)：失敗會讓你再挑戰一次，直到過關

// 廠歌（歌詞由使用者提供）：每句一個節拍
export const SONG = [
  '六和同仁快快奮起 喔！ 六和同仁快快奮起！',
  '放眼全世界 雄懷新台灣 勞動創造放光明',
  '齊開發無窮腦力 共展現無比活力',
  '真誠 團結 熱忱 奮鬥',
  '向前進 同仁們 向前進',
  '六和同仁快快奮起 喔！ 六和同仁快快奮起！',
  '放眼全世界 雄懷新台灣 勞動創造放光明',
  '齊開發無窮腦力 共展現無比活力',
  '真誠 團結 熱忱 奮鬥',
  '向前進 同仁們 向前進',
  '真誠 團結 熱忱 奮鬥',
  '向前進 同仁們 向前進',
];

const CSS = `
#chal{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%,#7a1410 0%,#3a0a0c 70%,#1a0506 100%);color:#fff5dc;font-family:inherit;touch-action:none;user-select:none;-webkit-user-select:none}
#chal.on{display:flex}
#chal .cb{width:min(94vw,560px);max-height:96vh;text-align:center;padding:14px 16px;box-sizing:border-box}
#chal h2{margin:0 0 6px;font-size:34px;color:#ffd24a;text-shadow:0 3px 0 #7a1410,0 0 18px rgba(255,200,60,.5)}
#chal .ctag{display:inline-block;font-size:18px;background:#ffd24a;color:#7a1410;border-radius:14px;padding:2px 12px;margin-bottom:6px;font-weight:700}
#chal p{margin:4px 0;font-size:20px;line-height:1.5}
#chal .area{position:relative;height:min(58vh,420px);margin:10px 0;border:3px solid #ffd24a;border-radius:14px;background:rgba(0,0,0,.08);overflow:hidden}
#chal .hud{display:flex;justify-content:space-between;font-size:22px;font-weight:700;color:#ffd24a}
#chal button{font:inherit;font-size:28px;font-weight:700;padding:10px 26px;border:0;border-radius:12px;background:#ffd24a;color:#7a1410;box-shadow:0 5px 0 #b27a10;cursor:pointer;margin:6px}
#chal button:active{transform:translateY(3px);box-shadow:0 2px 0 #b27a10}
#chal .big{font-size:40px;padding:14px 40px}
#chal .env{position:absolute;width:52px;height:70px;cursor:pointer;filter:drop-shadow(0 4px 4px rgba(0,0,0,.55))}
#chal .ball{position:absolute;width:48px;height:48px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#f3e3d0 60%,#d9b99a);border:2px solid #b9916a;touch-action:none;cursor:grab}
#chal .bowl{position:absolute;right:10px;bottom:10px;width:120px;height:80px;border-radius:0 0 70px 70px;background:#fff7e6;border:4px solid #d4a24a;display:flex;align-items:flex-end;justify-content:center;font-size:30px;color:#b71c1c;font-weight:700}
#chal .meter{height:26px;border-radius:13px;background:#2a0708;border:2px solid #ffd24a;overflow:hidden}
#chal .meter i{display:block;height:100%;background:linear-gradient(90deg,#ff7043,#ffd24a);width:100%}
#chal .lyric{font-size:24px;color:#ffd24a;min-height:80px;display:flex;align-items:center;justify-content:center;padding:6px;line-height:1.35}
#chal .ring{position:absolute;left:50%;top:36%;width:110px;height:110px;margin:-55px 0 0 -55px;border:6px solid #ffd24a;border-radius:50%;opacity:0}
#chal .core{position:absolute;left:50%;top:36%;width:110px;height:110px;margin:-55px 0 0 -55px;border:3px dashed #fff;border-radius:50%}
#chal .pop{position:absolute;left:0;right:0;top:14%;font-size:34px;font-weight:700;color:#fff;text-shadow:0 2px 6px #000}
#chal .gauge{position:absolute;left:6%;right:6%;top:40%;height:56px;border-radius:28px;background:#2a0708;border:3px solid #ffd24a}
#chal .zone{position:absolute;top:0;bottom:0;border-radius:24px;background:linear-gradient(#ffe27a,#e0a800);color:#7a1410;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center}
#chal .ptr{position:absolute;top:-14px;width:10px;height:84px;margin-left:-5px;border-radius:5px;background:#fff;box-shadow:0 0 10px #fff}
#chal .cb{background:rgba(22,5,8,.58);border:2px solid rgba(255,210,74,.45);border-radius:18px;backdrop-filter:blur(3px);box-shadow:0 10px 40px rgba(0,0,0,.5)}
#chal img{pointer-events:none;user-select:none;-webkit-user-drag:none}
#chal .area{box-shadow:0 0 26px rgba(0,0,0,.55),inset 0 0 40px rgba(0,0,0,.25)}
#chal .chimg{height:116px;margin:-6px 0 2px;filter:drop-shadow(0 6px 8px rgba(0,0,0,.5))}
#chal .chimg.win{animation:chwin .7s ease-in-out infinite alternate}
#chal .chimg.lose{filter:grayscale(.7) drop-shadow(0 6px 8px rgba(0,0,0,.5));transform:rotate(-8deg)}
@keyframes chwin{from{transform:translateY(0)}to{transform:translateY(-12px) rotate(3deg)}}
#chal .fxp{position:absolute;pointer-events:none;z-index:5}
#chal .ft{position:absolute;pointer-events:none;z-index:6;font-weight:700;font-size:22px;text-shadow:0 2px 4px #000,0 0 8px rgba(0,0,0,.6);white-space:nowrap}
`;
let ov = null;
function overlay() {
  if (ov) return ov;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  ov = document.createElement('div'); ov.id = 'chal'; document.body.appendChild(ov);
  return ov;
}
const el = (tag, html = '', cls = '') => { const e = document.createElement(tag); if (html) e.innerHTML = html; if (cls) e.className = cls; return e; };
const rnd = (a, b) => a + Math.random() * (b - a);
const AP = (n) => 'art/ch/' + n + '.webp?v=1';   // 挑戰用的圖片（場景背景、素材、角色）
const IMG = (n, css = '') => '<img src="' + AP(n) + '" style="' + css + '" draggable="false">';

// ---------- 特效：粒子、飄字、晃動、彩帶（用 Web Animations，跑完自動移除）----------
function part(host, css, frames, ms) {
  const d = document.createElement('div'); d.className = 'fxp'; d.style.cssText = css; host.appendChild(d);
  const a = d.animate(frames, { duration: ms, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }); a.onfinish = () => d.remove(); return d;
}
function fxCoins(area, x, y, n = 6) {
  for (let i = 0; i < n; i++) {
    const dx = rnd(-70, 70), up = rnd(40, 95);
    part(area, `left:${x - 7}px;top:${y - 7}px;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6c0,#ffc107 60%,#b27a10);box-shadow:0 0 6px #ffd24a`,
      [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.6}px,${-up}px) scale(1.1)`, opacity: 1, offset: 0.4 }, { transform: `translate(${dx}px,45px) scale(.6)`, opacity: 0 }], rnd(600, 950));
  }
}
function fxPaper(area, x, y, n = 8) {
  for (let i = 0; i < n; i++) {
    const dx = rnd(-60, 60), up = rnd(20, 70), rot = rnd(-240, 240);
    part(area, `left:${x - 6}px;top:${y - 4}px;width:12px;height:8px;background:#fff;border:1px solid #cfc7b8;box-shadow:0 1px 2px rgba(0,0,0,.4)`,
      [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx * 0.6}px,${-up}px) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.4 }, { transform: `translate(${dx}px,60px) rotate(${rot}deg)`, opacity: 0 }], rnd(700, 1100));
  }
}
function fxSplash(area, x, y, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = rnd(-Math.PI, 0), r = rnd(25, 70), s = rnd(5, 11);
    part(area, `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:#6d4c41`,
      [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px)`, opacity: 1, offset: 0.5 }, { transform: `translate(${Math.cos(a) * r * 1.2}px,${Math.sin(a) * r + 30}px)`, opacity: 0 }], rnd(500, 800));
  }
}
function fxStars(area, x, y, color = '#ffd24a', n = 8) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rnd(-0.2, 0.2), r = rnd(30, 70), s = rnd(8, 14);
    part(area, `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;background:${color};transform:rotate(45deg);box-shadow:0 0 8px ${color}`,
      [{ transform: 'translate(0,0) rotate(45deg) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) rotate(225deg) scale(.2)`, opacity: 0 }], rnd(450, 750));
  }
}
function fxSmoke(area, x, y, n = 7) {
  for (let i = 0; i < n; i++) {
    const s = rnd(16, 30), dx = rnd(-40, 40), up = rnd(30, 70);
    part(area, `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:radial-gradient(circle,rgba(210,210,210,.9),rgba(120,120,120,.5))`,
      [{ transform: 'translate(0,0) scale(.5)', opacity: 0.9 }, { transform: `translate(${dx}px,${-up}px) scale(1.8)`, opacity: 0 }], rnd(600, 900));
  }
}
function floatText(area, x, y, text, color = '#fff') {
  const d = document.createElement('div'); d.className = 'ft'; d.style.cssText = `left:${x}px;top:${y}px;color:${color};transform:translateX(-50%)`; d.textContent = text; area.appendChild(d);
  const a = d.animate([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-42px)', opacity: 0 }], { duration: 800, easing: 'ease-out', fill: 'forwards' }); a.onfinish = () => d.remove();
}
function shake(el) { el.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,2px)' }, { transform: 'translate(6px,-2px)' }, { transform: 'translate(-4px,1px)' }, { transform: 'translate(0,0)' }], { duration: 320 }); }
function confetti(host) {
  const cols = ['#ffd24a', '#ff5a4a', '#7dffc8', '#69b7ff', '#ff8ad8', '#fff'];
  for (let i = 0; i < 46; i++) {
    const x = rnd(0, 100), w = rnd(7, 13), rot = rnd(-540, 540), dx = rnd(-60, 60);
    part(host, `left:${x}%;top:-20px;width:${w}px;height:${w * 1.6}px;background:${cols[i % cols.length]};border-radius:2px`,
      [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px,${innerHeight + 40}px) rotate(${rot}deg)`, opacity: 1 }], rnd(1500, 2600));
  }
}

// ---------- 音效：每個挑戰自己的合成音效（不用音檔）----------
let AC = null, MG = null;
function ac() {
  if (!AC) { try { const C = window.AudioContext || window.webkitAudioContext; AC = new C(); MG = AC.createGain(); MG.gain.value = 0.7; MG.connect(AC.destination); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume(); return AC;
}
const muted = () => { try { return !!(window.SND && window.SND.muted && window.SND.muted()); } catch (e) { return false; } };
function tone(type, f, t, dur, vol, f2) {
  if (muted()) return; const c = ac(); if (!c) return; const T = c.currentTime + t, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, T); if (f2) o.frequency.exponentialRampToValueAtTime(f2, T + dur);
  g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
  o.connect(g); g.connect(MG); o.start(T); o.stop(T + dur + 0.05);
}
let NB = null;
function noise(t, dur, vol, type, f, f2) {
  if (muted()) return; const c = ac(); if (!c) return;
  if (!NB) { NB = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const T = c.currentTime + t, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = NB; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, T); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, T + dur);
  g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
  s.connect(fl); fl.connect(g); g.connect(MG); s.start(T, Math.random()); s.stop(T + dur + 0.05);
}
const S = {
  paper() { noise(0, 0.09, 0.14, 'bandpass', 3000); tone('triangle', 660, 0, 0.09, 0.07, 990); },
  splash() { noise(0, 0.3, 0.22, 'lowpass', 900, 300); tone('sawtooth', 180, 0, 0.22, 0.08, 80); },
  thud() { tone('sine', 140, 0, 0.12, 0.22, 60); },
  coin() { tone('square', 1319, 0, 0.06, 0.05); tone('square', 1976, 0.05, 0.14, 0.05); },
  coinBig() { [1047, 1319, 1568, 2093].forEach((f, i) => tone('square', f, i * 0.06, 0.14, 0.05)); },
  whoosh() { noise(0, 0.16, 0.1, 'bandpass', 800, 2400); },
  crash() { noise(0, 0.38, 0.3, 'lowpass', 1200, 200); tone('sawtooth', 110, 0, 0.3, 0.15, 40); },
  win() { [660, 880, 1320].forEach((f, i) => tone('triangle', f, i * 0.07, 0.16, 0.09)); },
  lose() { tone('sawtooth', 300, 0, 0.35, 0.1, 120); },
  reveal() { tone('square', 520, 0, 0.05, 0.05); },
  ball() { tone('sine', 900, 0, 0.06, 0.14, 500); tone('triangle', 1568, 0.08, 0.45, 0.08); tone('triangle', 2093, 0.1, 0.35, 0.05); },
  stamp() { tone('sine', 200, 0, 0.1, 0.25, 90); noise(0, 0.05, 0.1, 'bandpass', 1500); },
  buzz() { tone('square', 130, 0, 0.25, 0.1); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, i * 0.11, 0.3, 0.1)); [523, 659, 784].forEach((f) => tone('sine', f, 0.5, 0.7, 0.06)); },
  sad() { [392, 349, 311, 262].forEach((f, i) => tone('triangle', f, i * 0.18, 0.4, 0.09)); },
  glassUp() { tone('sine', 2400, 0, 0.2, 0.04, 2800); },
  clink() { tone('sine', 3136, 0, 0.5, 0.07); tone('sine', 4186, 0.01, 0.4, 0.05); },
  munch() { noise(0, 0.06, 0.12, 'bandpass', 1800); noise(0.12, 0.06, 0.12, 'bandpass', 1500); },
  tick() { tone('square', 880, 0, 0.05, 0.05); },
};
function engineStart() {   // 賽車引擎聲：低頻鋸齒波，速度越快音越高
  const c = ac(); if (!c || muted()) return { set() {}, stop() {} };
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 60; g.gain.value = 0.035; o.connect(g); g.connect(MG); o.start();
  return { set(sp) { try { o.frequency.setTargetAtTime(52 + sp * 45, c.currentTime, 0.1); } catch (e) {} }, stop() { try { o.stop(); } catch (e) {} } };
}
// 依目前挑戰把共用的音效名稱（gem、dead、tap…）換成該挑戰專屬的聲音
let CTX = '';
const MAP = {
  doc: { gem: S.paper, dead: S.splash, tap: S.thud },
  race: { tap: S.whoosh, dead: S.crash },
  packet: { gem: S.coin, big: S.coinBig, tap: S.tick },
  rps: { gem: S.win, tap: S.lose },
  bingo: { pick: S.ball, gem: S.stamp, dead: S.buzz },
  toast: { tap: S.glassUp, gem: S.clink, dead: S.splash, pick: S.munch },
  result: { clear: S.fanfare, dead: S.sad },
};
const SND = () => ({ play(n) { const f = (MAP[CTX] || {})[n]; if (f) f(); else if (window.SND) window.SND.play(n); } });


// ---------- 五項挑戰：每個回傳 { start(area, hud, end) }，end(true/false) 結束 ----------
const GAMES = [
  { title: '搶紅包！', sfx: 'packet', bgm: 'play', bg: 'bg-banquet', ch: 'c-rabbit', rule: '紅包雨來了！10 秒內點到 18 個紅包。', goal: 18,
    run(area, hud, end) {
      let n = 0, left = 10, alive = true, lastC = 99; const goal = this.goal;
      area.insertAdjacentHTML('afterbegin', IMG('c-rabbit', 'position:absolute;left:50%;top:-4px;height:92px;transform:translateX(-50%);opacity:.95'));
      const upd = () => { hud.innerHTML = `<span>紅包 ${n}/${goal}</span><span>${Math.ceil(left)} 秒</span>`; }; upd();
      const spawn = () => {
        if (!alive) return;
        const r0 = Math.random(), nm = r0 < 0.1 ? 's-env-big' : r0 < 0.4 ? 's-env-gold' : 's-env-red'; const e = el('div', IMG(nm, 'width:100%;height:100%;object-fit:contain'), 'env'); if (nm === 's-env-big') { e.style.width = '70px'; e.style.height = '70px'; } e.style.left = rnd(4, area.clientWidth - 74) + 'px'; e.style.top = '-80px';
        e.style.transition = `top ${rnd(1.6, 2.4)}s linear`; area.appendChild(e);
        requestAnimationFrame(() => requestAnimationFrame(() => { e.style.top = area.clientHeight + 'px'; }));
        const hit = (ev) => { ev.preventDefault(); if (!e.parentNode) return; const rc = area.getBoundingClientRect(), er = e.getBoundingClientRect(), cx = er.left - rc.left + er.width / 2, cy = er.top - rc.top + er.height / 2; const big = nm === 's-env-big'; fxCoins(area, cx, cy, big ? 12 : 6); floatText(area, cx, cy - 16, big ? '+2' : '+1', '#ffd24a'); n += big ? 2 : 1; SND().play(big ? 'big' : 'gem'); e.remove(); upd(); };
        e.addEventListener('pointerdown', hit); setTimeout(() => e.remove(), 2600);
      };
      const t1 = setInterval(spawn, 330);
      const t2 = setInterval(() => { left -= 0.1; const cc = Math.ceil(left); if (cc <= 3 && cc >= 1 && cc !== lastC) { lastC = cc; SND().play('tap'); } if (left <= 0) { stop(); end(n >= goal, `搶到 ${n} 個`); } else upd(); }, 100);
      const stop = () => { alive = false; clearInterval(t1); clearInterval(t2); };
      return stop;
    } },
  { title: '猜拳大賽', sfx: 'rps', bgm: 'play', bg: 'bg-stage', ch: 'c-worker', rule: (hard) => `尾牙划拳大賽！跟同事猜拳，對方出拳後，要趕快按下「會贏的拳」（剪刀贏布、布贏石頭、石頭贏剪刀）。10 局贏 ${hard ? 9 : 8} 局以上過關，越後面越快。`, goal: 8,
    run(area, hud, end, hard) {
      const G = ['s-hand-rock', 's-hand-scissors', 's-hand-paper'], NEED = hard ? 9 : 8, ROUNDS = 10;
      const WIN = [2, 0, 1];   // WIN[對方出的拳] = 會贏它的拳（✊→🖐️、✌️→✊、🖐️→✌️）
      let round = 0, wins = 0, opp = 0, t = 0, lim = 1.6, locked = true, stopped = false, iv = 0;
      area.innerHTML = '<div style="position:absolute;left:0;right:0;top:4%;font-size:20px;color:#ffd24a">同事出…</div>' + IMG('c-worker', 'position:absolute;left:3%;top:6%;height:112px') + '<div id="opp" style="position:absolute;left:0;right:0;top:14%;text-align:center">' + IMG('s-qmark', 'height:120px') + '</div><div class="pop" id="pop" style="top:62%"></div><div style="position:absolute;left:8%;right:8%;bottom:6%"><div class="meter" style="height:16px"><i id="tm"></i></div></div>';
      const oppEl = area.querySelector('#opp'), pop = area.querySelector('#pop'), tm = area.querySelector('#tm');
      const row = el('div', '', ''); row.style.cssText = 'display:flex;justify-content:center;gap:12px;margin-top:4px';
      G.forEach((g, i) => { const b = el('button', IMG(g, 'height:58px;vertical-align:middle'), ''); b.style.padding = '6px 18px'; b.addEventListener('pointerdown', (e) => { e.preventDefault(); pick(i); }); row.append(b); });
      area.parentNode.appendChild(row);
      const upd = () => { hud.innerHTML = `<span>贏 ${wins}/${NEED}</span><span>第 ${Math.min(round + 1, ROUNDS)}/${ROUNDS} 局</span>`; }; upd();
      const stop = () => { stopped = true; clearInterval(iv); row.remove(); };
      const finish = () => { stop(); end(wins >= NEED, wins >= NEED ? `${wins} 局全靠反應，猜拳王！` : `只贏了 ${wins} 局，要 ${NEED} 局`); };
      const nextRound = () => {
        if (stopped) return; if (round >= ROUNDS || wins >= NEED || (ROUNDS - round) < (NEED - wins)) return finish();
        opp = Math.floor(Math.random() * 3); oppEl.innerHTML = IMG('s-qmark', 'height:120px'); pop.textContent = ''; locked = true;
        setTimeout(() => { if (stopped) return; oppEl.innerHTML = IMG(G[opp], 'height:120px'); lim = Math.max(hard ? 0.7 : 0.9, (hard ? 1.3 : 1.6) - 0.09 * round); t = lim; locked = false; }, 350 + Math.random() * 350);
      };
      const result = (ok, msg) => { locked = true; { const oc = oppEl.getBoundingClientRect(), ar = area.getBoundingClientRect(); if (ok) fxStars(area, oc.left - ar.left + oc.width / 2, oc.top - ar.top + 60, '#ffd24a', 10); else shake(area); } if (ok) { wins++; SND().play('gem'); } else SND().play('tap'); pop.textContent = msg; round++; upd(); setTimeout(nextRound, 650); };
      const pick = (i) => { if (locked || stopped) return; result(i === WIN[opp], i === WIN[opp] ? '贏了！' : '輸了…'); };
      iv = setInterval(() => { if (stopped) return; if (!locked) { t -= 0.05; tm.style.width = Math.max(0, t / lim * 100) + '%'; if (t <= 0) result(false, '太慢了！'); } }, 50);
      setTimeout(nextRound, 400);
      return stop;
    } },
  { title: '老闆說幾句話就好', bg: 'bg-meeting', ch: 'c-boss', rule: '老闆講話…很長。一直點「鼓掌」撐住精神，別睡著！撐 20 秒就過關。', goal: 20,
    run(area, hud, end) {
      let sp = 100, t = 0; const lines = ['各位同仁，老闆說幾句話就好…', '今年公司辛苦大家了…', '明年訂單會更好…', '我再補充一點…', '最後說一句…', '真的最後一句…', '感謝各位，我說完了！'];
      area.innerHTML = '<div style="position:absolute;left:0;right:0;top:8%;font-size:64px">🎤</div><div class="lyric" id="bossline" style="position:absolute;left:0;right:0;top:34%"></div><div style="position:absolute;left:6%;right:6%;bottom:14%"><div style="font-size:20px;margin-bottom:4px">精神</div><div class="meter"><i id="spbar"></i></div></div>';
      const line = area.querySelector('#bossline'), bar = area.querySelector('#spbar');
      const btn = el('button', '👏 鼓掌！', 'big'); area.parentNode.appendChild(btn);
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); sp = Math.min(100, sp + 7); SND().play('tap'); });
      const tick = setInterval(() => {
        t += 0.1; sp -= (12 + 0.6 * t) * 0.1; bar.style.width = Math.max(0, sp) + '%';
        line.textContent = lines[Math.min(lines.length - 1, Math.floor(t / (this.goal / lines.length)))];
        hud.innerHTML = `<span>老闆講話中…</span><span>${Math.max(0, Math.ceil(this.goal - t))} 秒</span>`;
        if (sp <= 0) { stop(); end(false, '你睡著了…Zzz'); } else if (t >= this.goal) { stop(); end(true, '全程精神飽滿，老闆很欣慰'); }
      }, 100);
      const stop = () => { clearInterval(tick); btn.remove(); };
      return stop;
    } },
  { title: '唱廠歌', bg: 'bg-stage', ch: 'c-rabbit', rule: (hard) => `上台唱廠歌！用鍵盤 ↑↓（或手指在畫面上下滑）控制音高，讓亮點跟著金色音條走。唱走音，你會聽到自己的聲音變難聽，台下耐受度一直掉，歸零就被請下台。要唱完整首、準的時間超過 ${hard ? 60 : 50}% 才算過關。`, goal: 50,
    run(area, hud, end, hard) {
      // ----- 旋律：把歌詞每句依空格切成幾個音，音高在五聲音階上亂走（固定種子，每次一樣）-----
      const SCALE = [0, 2, 4, 7, 9, 12].map((n) => n / 12);   // 音高 0..1（一個八度，五聲音階）
      let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const notes = []; const lines = []; let T = 1.6, deg = 2;
      SONG.forEach((txt) => {
        const chunks = txt.split(/\s+/).filter(Boolean); const total = chunks.reduce((a, c) => a + c.length, 0), dur = Math.min(3.6, Math.max(2.2, 1.2 + total * 0.12));
        const t0 = T; let t = T;
        chunks.forEach((c) => {
          const d = Math.max(0.55, (dur - 0.3) * c.length / total); deg = Math.max(0, Math.min(5, deg + [-2, -1, -1, 1, 1, 2][Math.floor(rng() * 6)]));
          notes.push({ t0: t, t1: t + d - 0.08, h: SCALE[deg], txt: c }); t += d;
        });
        lines.push({ t0, t1: t, txt }); T = t + 0.55;
      });
      const END = T + 0.4, TOL1 = hard ? 0.07 : 0.1, TOL2 = hard ? 0.16 : 0.2;
      area.innerHTML = '';
      const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none'; area.appendChild(cv);
      const W = area.clientWidth, H = area.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
      const TOP = 78, BOT = H - 78, NOWX = W * 0.28, PXS = 130; const Y = (h) => BOT - h * (BOT - TOP);
      let dot = 0.5, tol = 100, inTune = 0, singT = 0, stopped = false, raf = 0, t0 = performance.now(), mood = '😄', clap = 0; const trail = []; const keys = {};
      // ----- 聲音：你的音高就是你唱出來的聲音（會聽到走音）-----
      let ac = null, osc = null, vg = null;
      try {
        const C = window.AudioContext || window.webkitAudioContext; ac = new C(); osc = ac.createOscillator(); vg = ac.createGain(); const lfo = ac.createOscillator(), lg = ac.createGain();
        osc.type = 'triangle'; lfo.frequency.value = 5.2; lg.gain.value = 5; lfo.connect(lg); lg.connect(osc.frequency); vg.gain.value = 0; osc.connect(vg); vg.connect(ac.destination); osc.start(); lfo.start();
      } catch (e) { ac = null; }
      const muted = () => { try { return window.SND && window.SND.muted && window.SND.muted(); } catch (e) { return false; } };
      const onKey = (e) => { const k = e.key; if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(k)) { e.preventDefault(); keys[k] = e.type === 'keydown'; } };
      window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
      const ptr = (e) => { const r = cv.getBoundingClientRect(); dot = Math.max(0, Math.min(1, 1 - ((e.clientY - r.top) - TOP) / (BOT - TOP))); };
      cv.addEventListener('pointermove', ptr); cv.addEventListener('pointerdown', ptr);
      window.__sing = { notes, get dot() { return dot; }, set dot(v) { dot = v; }, now: () => (performance.now() - t0) / 1000 };   // 測試用
      const stop = () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); try { osc && osc.stop(); ac && ac.close(); } catch (e) {} };
      const fin = (ok, msg) => { stop(); end(ok, msg); };
      const crowd = () => (tol > 70 ? '😄' : tol > 40 ? '😐' : tol > 15 ? '😣' : '🤮');
      let last = performance.now();
      const frame = (nowMs) => {
        if (stopped) return; const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs; const now = (nowMs - t0) / 1000;
        if (keys.ArrowUp || keys.w || keys.W) dot = Math.min(1, dot + 1.5 * dt); if (keys.ArrowDown || keys.s || keys.S) dot = Math.max(0, dot - 1.5 * dt);
        const cur = notes.find((n) => now >= n.t0 && now <= n.t1);
        if (cur) {
          const err = Math.abs(dot - cur.h); singT += dt;
          if (err <= TOL1) { inTune += dt; tol = Math.min(100, tol + 7 * dt); clap = Math.min(1, clap + dt * 3); }
          else if (err <= TOL2) { tol -= 9 * dt; clap = Math.max(0, clap - dt * 2); }
          else { tol -= 24 * dt; clap = 0; }
        }
        // 聲音
        if (ac && vg) { const f = 262 * Math.pow(2, dot); osc.frequency.setTargetAtTime(f, ac.currentTime, 0.03); vg.gain.setTargetAtTime(cur && !muted() ? 0.09 : 0, ac.currentTime, 0.04); }
        // 畫面
        g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; for (const h of SCALE) { g.beginPath(); g.moveTo(0, Y(h)); g.lineTo(W, Y(h)); g.stroke(); }
        for (const n of notes) {
          const x0 = NOWX + (n.t0 - now) * PXS, x1 = NOWX + (n.t1 - now) * PXS; if (x1 < 0 || x0 > W) continue; const act = n === cur;
          const hh = (TOL1 + 0.03) * (BOT - TOP); g.fillStyle = act ? '#ffe27a' : 'rgba(255,210,74,.55)'; g.beginPath(); g.roundRect ? g.roundRect(x0, Y(n.h) - hh, Math.max(4, x1 - x0), hh * 2, 10) : g.rect(x0, Y(n.h) - hh, Math.max(4, x1 - x0), hh * 2); g.fill();
        }
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(NOWX, TOP - 8); g.lineTo(NOWX, BOT + 8); g.stroke(); g.setLineDash([]);
        trail.push({ x: now, y: dot }); while (trail.length && now - trail[0].x > 1.6) trail.shift();
        g.strokeStyle = cur && Math.abs(dot - cur.h) > TOL2 ? '#ff5a4a' : '#7dffc8'; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath(); trail.forEach((p, i) => { const x = NOWX + (p.x - now) * PXS, y = Y(p.y); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
        g.fillStyle = cur && Math.abs(dot - cur.h) > TOL2 ? '#ff5a4a' : '#fff'; g.beginPath(); g.arc(NOWX, Y(dot), 9, 0, 6.29); g.fill();
        // 歌詞（卡拉OK：唱到哪、哪裡變金色）
        const ln = lines.find((l) => now >= l.t0 - 0.3 && now <= l.t1 + 0.4) || lines.find((l) => l.t0 > now);
        if (ln) {
          g.font = '700 22px "LXGW WenKai TC",system-ui,sans-serif'; g.textAlign = 'left'; const w = g.measureText(ln.txt).width, x = Math.max(6, (W - w) / 2), y = 34;
          g.fillStyle = '#fff'; g.fillText(ln.txt, x, y); const p = Math.max(0, Math.min(1, (now - ln.t0) / (ln.t1 - ln.t0)));
          g.save(); g.beginPath(); g.rect(x, 0, w * p, 60); g.clip(); g.fillStyle = '#ffd24a'; g.fillText(ln.txt, x, y); g.restore();
        }
        // 台下觀眾
        const m = crowd(); mood = m; g.textAlign = 'center'; g.font = '28px system-ui';
        for (let i = 0; i < 7; i++) { g.fillText(m, W * (0.08 + i * 0.14), H - 40 + Math.sin(now * 5 + i * 1.3) * (m === '😄' ? 5 : 2)); }
        if (clap > 0.6 && Math.floor(now * 4) % 2 === 0) { g.font = '22px system-ui'; g.fillText('👏', W * 0.5, H - 66); }
        g.fillStyle = '#2a0708'; g.fillRect(W * 0.1, H - 18, W * 0.8, 10); g.fillStyle = tol > 40 ? '#7dffc8' : tol > 15 ? '#ffd24a' : '#ff5a4a'; g.fillRect(W * 0.1, H - 18, W * 0.8 * Math.max(0, tol) / 100, 10);
        hud.innerHTML = `<span>台下耐受度 ${Math.max(0, Math.round(tol))}%</span><span>音準 ${singT ? Math.round(inTune / singT * 100) : 0}%</span>`;
        if (tol <= 0) return fin(false, '台下受不了了，老闆說：「先請你下台…」');
        if (now >= END) { const r = singT ? inTune / singT : 0; const need = (hard ? 60 : 50) / 100; return fin(r >= need, r >= need ? `音準 ${Math.round(r * 100)}%，台下起立鼓掌！` : `音準只有 ${Math.round(r * 100)}%，台下表情複雜（要 ${Math.round(need * 100)}%）`); }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return stop;
    } },
  { title: '特獎賓果大抽獎', sfx: 'bingo', bgm: 'title', bg: 'bg-lottery', ch: 'c-rabbit', rule: (hard) => `特獎要用賓果抽！主持人會一個一個念號碼，念到你卡片上有的號碼，趕快「點掉」它。在隔壁桌喊賓果之前（主持人念到第 ${hard ? 13 : 15} 個號碼），先連成一條線（橫、直、斜都可以）就拿特獎。別亂點還沒念到的號碼，會手滑被鎖住一下！`, goal: 1,
    run(area, hud, end, hard) {
      const LIMIT = hard ? 13 : 15, EVERY = hard ? 1.7 : 2.2, N = 40;
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const nums = shuffle(Array.from({ length: N }, (_, i) => i + 1)); const card = nums.slice(0, 25); card[12] = 0;   // 中央是免費格
      const LINES = []; for (let r = 0; r < 5; r++) LINES.push([0, 1, 2, 3, 4].map((c) => r * 5 + c)); for (let c = 0; c < 5; c++) LINES.push([0, 1, 2, 3, 4].map((r) => r * 5 + c)); LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
      // 呼叫順序：保證「一橫一直」兩條線的號碼，都會在隔壁桌喊賓果之前被念到，其餘是干擾號碼
      const A = LINES[Math.floor(Math.random() * 5)], B = LINES[5 + Math.floor(Math.random() * 5)];
      const need = [...new Set([...A, ...B])].filter((i) => i !== 12).map((i) => card[i]); const pool = nums.filter((n) => !need.includes(n));
      const total = LIMIT + 4, seq = new Array(total).fill(0); const slots = shuffle(Array.from({ length: LIMIT - 1 }, (_, i) => i)).slice(0, need.length);
      slots.forEach((sl, k) => { seq[sl] = need[k]; }); let pi = 0; for (let i = 0; i < total; i++) if (!seq[i]) seq[i] = pool[pi++ % pool.length];
      const called = new Set(), marked = new Set([12]); let idx = 0, lock = 0, stopped = false, timer = 0;
      const AH = area.clientHeight, CELL = Math.max(24, Math.min(46, Math.floor((AH - 116) / 5) - 5));   // 卡片依區域高度縮小，留空間給主持人
      area.innerHTML = '<div id="host" style="flex:none;height:92px;width:100%;text-align:center;padding-top:2px"><div style="font-size:14px;opacity:.85">🎤 主持人念號碼</div><div id="ball" style="display:inline-block;width:76px;height:76px;line-height:76px;text-align:center;background:url(art/ch/s-ball.webp?v=1) center/contain no-repeat;color:#7a1410;font-size:22px;font-weight:700;transition:transform .15s">準備…</div><div id="hist" style="font-size:13px;opacity:.85;min-height:18px"></div></div><div id="grid" style="flex:none;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;width:min(92%,300px);margin-top:2px"></div>';
      area.style.display = 'flex'; area.style.flexDirection = 'column'; area.style.alignItems = 'center';
      area.insertAdjacentHTML('afterbegin', IMG('c-rabbit', 'position:absolute;left:3%;top:2px;height:86px'));
      const grid = area.querySelector('#grid'), ball = area.querySelector('#ball'), hist = area.querySelector('#hist'); const cells = [];
      card.forEach((v, i) => {
        const b = el('button', i === 12 ? '★' : String(v), ''); b.style.cssText = `font-size:${Math.min(20, CELL - 14)}px;padding:0;height:${CELL}px;border-radius:8px;box-shadow:0 3px 0 #b27a10;background:#ffe9a8;color:#7a1410;touch-action:manipulation`;
        if (i === 12) { b.style.background = '#ff7043'; b.style.color = '#fff'; b.style.boxShadow = '0 3px 0 #b23a14'; }
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(i); }); grid.appendChild(b); cells.push(b);
      });
      const lineDone = () => LINES.find((L) => L.every((i) => marked.has(i)));
      let lastV = '—'; const upd = () => { const best = Math.max(...LINES.map((L) => L.filter((i) => marked.has(i)).length)); hud.innerHTML = `<span>念到：<b style="font-size:26px">${lastV}</b>（${idx}/${LIMIT}）</span><span>連線 ${best}/5</span>`; };
      const stop = () => { stopped = true; clearInterval(timer); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} };
      const shake = () => { grid.style.transform = 'rotate(-1.2deg)'; setTimeout(() => { grid.style.transform = ''; }, 120); };
      const tap = (i) => {
        if (stopped || marked.has(i)) return; if (performance.now() < lock) return;
        const v = card[i];
        if (!called.has(v)) { lock = performance.now() + 900; SND().play('dead'); cells[i].style.background = '#ef9a9a'; setTimeout(() => { if (!marked.has(i)) cells[i].style.background = '#ffe9a8'; }, 900); shake(); return; }
        marked.add(i); { const cr = cells[i].getBoundingClientRect(), ar2 = area.getBoundingClientRect(); fxStars(area, cr.left - ar2.left + cr.width / 2, cr.top - ar2.top + cr.height / 2, '#ff7043', 6); } cells[i].style.background = '#e53935'; cells[i].style.color = '#ffd24a'; cells[i].style.boxShadow = '0 1px 0 #7a1410'; SND().play('gem'); upd();
        const L = lineDone(); if (L) { stop(); L.forEach((k) => { cells[k].style.background = '#ffd24a'; cells[k].style.color = '#7a1410'; const cr = cells[k].getBoundingClientRect(), ar2 = area.getBoundingClientRect(); fxStars(area, cr.left - ar2.left + cr.width / 2, cr.top - ar2.top + cr.height / 2, '#ffe27a', 6); }); SND().play('clear'); setTimeout(() => end(true, '賓果！特獎大紅包是你的！'), 900); }
      };
      const callNext = () => {
        if (stopped) return;
        if (idx >= LIMIT) { stop(); return end(false, '隔壁桌喊賓果了！特獎被搶走…'); }
        const v = seq[idx++]; called.add(v); lastV = v; ball.textContent = v + ' 號'; fxStars(area, area.clientWidth / 2, 56, '#ffd24a', 8);
        try { if (window.speechSynthesis && !(window.SND && window.SND.muted && window.SND.muted())) { const u = new SpeechSynthesisUtterance(String(v)); u.lang = 'zh-TW'; u.rate = 1.1; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } } catch (e) {} ball.style.transform = 'scale(1.25)'; setTimeout(() => { ball.style.transform = 'scale(1)'; }, 160); SND().play('pick');
        hist.textContent = '前面念過：' + [...called].slice(-6, -1).reverse().join('、'); cells.forEach((c, i) => { if (!marked.has(i) && card[i] === v) { c.style.outline = '3px solid #ff7043'; setTimeout(() => { c.style.outline = ''; }, 700); } }); upd();
      };
      upd(); window.__bingo = { card, seq, tap, get called() { return called; } };   // 測試用
      setTimeout(() => { if (!stopped) { callNext(); timer = setInterval(callNext, EVERY * 1000); } }, 900);
      return stop;
    } },
  { title: '逐桌敬酒', sfx: 'toast', bgm: 'title', bg: 'bg-banquet', ch: 'c-worker',
    rule: (hard) => `在宴會廳裡走動，一桌一桌去敬酒！用鍵盤 ↑↓←→（或 WASD；手機用手指拖曳）走到桌子旁，按「空白鍵」舉杯，圓圈縮到桌子大小時再按一次空白鍵「碰杯」。共 ${hard ? 10 : 8} 桌（老闆桌要連敬兩杯）。喝太多會醉、走路會歪，記得去小菜台吃菜解酒。${hard ? 70 : 80} 秒內敬完、沒醉倒就過關。`, goal: 8,
    run(area, hud, end, hard) {
      const N = hard ? 10 : 8, LIMIT = hard ? 70 : 80, ADD = hard ? 18 : 16, EAT = hard ? 30 : 35, EATS = hard ? 4 : 5;
      const POS = hard ? [[.5, .115, 'boss'], [.2, .25], [.8, .25], [.5, .24], [.2, .47], [.8, .47], [.5, .42], [.2, .69], [.8, .69], [.5, .60]]
                       : [[.5, .115, 'boss'], [.2, .27], [.8, .27], [.2, .49], [.8, .49], [.2, .71], [.8, .71], [.5, .42]];
      area.innerHTML = ''; const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none'; area.appendChild(cv);
      const W = area.clientWidth, H = area.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
      const I = {}; for (const n of ['s-table', 's-table-boss', 's-snack', 'c-worker']) { const im = new Image(); im.src = AP(n); I[n] = im; } const carpet = new Image(); carpet.src = AP('t-carpet'); let carpetPat = null;
      const ok = (im) => im && im.complete && im.naturalWidth;
      const R = Math.max(18, Math.min(24, W * 0.065)); const tables = POS.slice(0, N).map(([x, y, k]) => ({ x: x * W, y: y * H, boss: k === 'boss', need: k === 'boss' ? 2 : 1, done: false, mood: '🙂' }));
      const snack = { x: W * 0.5, y: H * 0.9, left: EATS };
      const P = { x: W * 0.5, y: H * 0.8, vx: 0, vy: 0, face: 1 }; const keys = {}; let ptr = null, drunk = 0, t = LIMIT, stopped = false, raf = 0, last = performance.now(), msg = '', msgT = 0, toast = null, eatT = 0, lock = 0, spill = 0; let sway = 0;
      const say = (m) => { msg = m; msgT = 1.1; };
      const near = () => { let best = null, bd = 1e9; for (const tb of tables) { if (tb.done) continue; const d = Math.hypot(P.x - tb.x, P.y - tb.y); if (d < R + 30 && d < bd) { best = tb; bd = d; } } return best; };
      const nearSnack = () => Math.hypot(P.x - snack.x, P.y - snack.y) < 50 && snack.left > 0;
      const act = () => {
        if (stopped || eatT > 0 || performance.now() < lock) return;
        if (toast) {   // 第二次按：碰杯，看圓圈縮到哪
          const p = (performance.now() - toast.t0) / toast.dur, r = 2.6 - 1.7 * p;   // 圓圈半徑（相對桌子半徑）：2.6 → 0.9
          const lo = hard ? 1.0 : 0.95, hi = hard ? 1.3 : 1.45;
          if (r >= lo && r <= hi) { toast.tb.need--; drunk += ADD; SND().play('gem'); fxStars(area, toast.tb.x, toast.tb.y, '#ffe27a', 10); floatText(area, toast.tb.x, toast.tb.y - 26, toast.tb.need > 0 ? '再一杯！' : '乾！', '#fff'); say(toast.tb.need > 0 ? '再來一杯！' : ['乾！', '乾杯！', '海豐萬歲！', '尾牙快樂！'][Math.floor(Math.random() * 4)]); if (toast.tb.need <= 0) { toast.tb.done = true; toast.tb.mood = '🍻'; } }
          else { drunk += 6; spill = 0.6; SND().play('dead'); fxSplash(area, toast.tb.x, toast.tb.y); say('灑出來了！'); lock = performance.now() + 500; }
          toast = null; return;
        }
        const tb = near(); if (tb) { toast = { tb, t0: performance.now(), dur: hard ? 800 : 950 }; SND().play('tap'); return; }
        if (nearSnack()) { eatT = 1.2; snack.left--; SND().play('pick'); floatText(area, P.x, P.y - 34, '吃菜！', '#9ad17a'); say('吃口菜解解酒'); return; }
      };
      const onKey = (e) => { const k = e.key; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', ' ', 'Enter'].includes(k)) { e.preventDefault(); if (e.type === 'keydown') { if (k === ' ' || k === 'Enter') { if (!e.repeat) act(); } else keys[k.toLowerCase()] = true; } else keys[k.toLowerCase()] = false; } };
      window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
      const pm = (e) => { const r = cv.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener('pointerdown', (e) => { pm(e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); }); cv.addEventListener('pointermove', (e) => { if (ptr) pm(e); }); const pu = () => { ptr = null; }; cv.addEventListener('pointerup', pu); cv.addEventListener('pointercancel', pu);
      const btn = el('button', '🥂 舉杯／碰杯', 'big'); btn.style.fontSize = '24px'; btn.style.padding = '8px 22px'; area.parentNode.appendChild(btn);
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); act(); });
      window.__toastDbg = { P, tables, snack, act, get drunk() { return drunk; }, keys, get toast() { return toast; }, near, nearSnack };   // 測試用
      const stop = () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); btn.remove(); area.style.filter = ''; };
      const fin = (ok, m) => { stop(); end(ok, m); };
      const frame = (nowMs) => {
        if (stopped) return; const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs; t -= dt; drunk = Math.max(0, drunk - 0.8 * dt); msgT = Math.max(0, msgT - dt); spill = Math.max(0, spill - dt); sway += dt;
        if (eatT > 0) { eatT -= dt; if (eatT <= 0) drunk = Math.max(0, drunk - EAT); }
        // 移動（醉了會歪）
        let dx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0), dy = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
        if (ptr) { const ex = ptr.x - P.x, ey = ptr.y - P.y, d = Math.hypot(ex, ey); if (d > 10) { dx = ex / d; dy = ey / d; } }
        const lockMove = toast || eatT > 0; const m = Math.hypot(dx, dy); if (m > 0) { dx /= m; dy /= m; }
        const wob = Math.min(1, drunk / 100); dx += Math.sin(sway * 2.7) * wob * 0.9 * (m > 0 ? 1 : 0.3); dy += Math.cos(sway * 2.1) * wob * 0.9 * (m > 0 ? 1 : 0.3);
        const sp = lockMove ? 0 : (m > 0 ? 130 : 25 * wob); P.x += dx * sp * dt; P.y += dy * sp * dt; if (dx) P.face = dx > 0 ? 1 : -1;
        P.x = Math.max(14, Math.min(W - 14, P.x)); P.y = Math.max(14, Math.min(H - 14, P.y));
        for (const tb of tables) { const d = Math.hypot(P.x - tb.x, P.y - tb.y); if (d < R + 10) { P.x = tb.x + (P.x - tb.x) / d * (R + 10); P.y = tb.y + (P.y - tb.y) / d * (R + 10); } }   // 不能穿過桌子
        if (toast && performance.now() - toast.t0 > toast.dur * 1.25) { drunk += 6; spill = 0.6; SND().play('dead'); fxSplash(area, toast.tb.x, toast.tb.y); say('慢了，酒灑了！'); toast = null; lock = performance.now() + 400; }
        // 畫面
        g.clearRect(0, 0, W, H); if (!carpetPat && ok(carpet)) carpetPat = g.createPattern(carpet, 'repeat'); g.fillStyle = carpetPat || '#5a1414'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#7a1d18'; g.fillRect(W * 0.5 - 30, 0, 60, 8);
        for (const tb of tables) {
          const im = I[tb.boss ? 's-table-boss' : 's-table'], sz = (R + 18) * 2;
          if (ok(im)) { g.globalAlpha = tb.done ? 0.6 : 1; g.drawImage(im, tb.x - sz / 2, tb.y - sz / 2, sz, sz * im.naturalHeight / im.naturalWidth); g.globalAlpha = 1; }
          else { g.fillStyle = '#fff7e6'; g.beginPath(); g.arc(tb.x, tb.y, R, 0, 6.29); g.fill(); }
          if (tb.done) { g.fillStyle = '#43a047'; g.beginPath(); g.arc(tb.x, tb.y, 11, 0, 6.29); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(tb.x - 5, tb.y); g.lineTo(tb.x - 1, tb.y + 5); g.lineTo(tb.x + 6, tb.y - 5); g.stroke(); }
          if (tb.boss && !tb.done) { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 12px system-ui'; g.fillStyle = '#ffd24a'; g.fillText('老闆桌 ×' + tb.need, tb.x, tb.y - R - 16); }
        }
        { const si = I['s-snack']; if (ok(si)) { const sw = 104, shh = sw * si.naturalHeight / si.naturalWidth; g.globalAlpha = snack.left > 0 ? 1 : 0.45; g.drawImage(si, snack.x - sw / 2, snack.y - shh / 2, sw, shh); g.globalAlpha = 1; } else { g.fillStyle = '#9a6a2a'; g.fillRect(snack.x - 42, snack.y - 16, 84, 32); } g.font = '700 12px system-ui'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(snack.left > 0 ? '小菜台 ×' + snack.left : '（吃光了）', snack.x, snack.y + 28); }
        if (toast) { const p = (performance.now() - toast.t0) / toast.dur, r = (2.6 - 1.7 * p) * R, lo = (hard ? 1.0 : 0.95) * R, hi = (hard ? 1.3 : 1.45) * R; g.lineWidth = 3; g.strokeStyle = 'rgba(125,255,200,.7)'; g.beginPath(); g.arc(toast.tb.x, toast.tb.y, hi, 0, 6.29); g.stroke(); g.beginPath(); g.arc(toast.tb.x, toast.tb.y, lo, 0, 6.29); g.stroke(); g.lineWidth = 5; g.strokeStyle = r >= lo && r <= hi ? '#7dffc8' : '#ffd24a'; g.beginPath(); g.arc(toast.tb.x, toast.tb.y, Math.max(2, r), 0, 6.29); g.stroke(); }
        g.font = '30px system-ui'; g.save(); g.translate(P.x, P.y + 20); g.rotate(Math.sin(sway * 3) * wob * 0.35); g.scale(P.face, 1); const wk = I['c-worker']; if (ok(wk)) { const hh = 56, ww = hh * wk.naturalWidth / wk.naturalHeight; g.drawImage(wk, -ww / 2, -hh, ww, hh); } else g.fillText('🧑‍🔧', 0, -14); g.restore(); if (toast || eatT > 0) { g.font = '20px system-ui'; g.fillText(eatT > 0 ? '🍚' : '🥂', P.x + 16, P.y - 18); }
        // 提示
        g.font = '700 14px system-ui'; g.fillStyle = '#fff'; const nt = near(); if (!toast && eatT <= 0) { if (nt) g.fillText(nt.boss ? '按空白鍵：向老闆舉杯' : '按空白鍵：舉杯', P.x, P.y - 24); else if (nearSnack()) g.fillText('按空白鍵：吃菜解酒', P.x, P.y - 24); } else if (toast) g.fillText('圓圈縮到綠圈裡，再按空白鍵碰杯！', W / 2, H * 0.17 + 20);
        if (msgT > 0) { g.font = '700 22px system-ui'; g.fillStyle = spill > 0 ? '#ff8a80' : '#ffd24a'; g.fillText(msg, W / 2, H * 0.36 + 10); }
        // 醉意條
        g.fillStyle = '#2a0708'; g.fillRect(W * 0.08, H - 14, W * 0.84, 8); g.fillStyle = drunk < 50 ? '#7dffc8' : drunk < 80 ? '#ffd24a' : '#ff5a4a'; g.fillRect(W * 0.08, H - 14, W * 0.84 * Math.min(1, drunk / 100), 8); g.font = '12px system-ui'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('醉意 🥴', W * 0.08, H - 20);
        area.style.filter = drunk > 45 ? `blur(${((drunk - 45) / 28).toFixed(1)}px)` : '';
        const doneN = tables.filter((x) => x.done).length; hud.innerHTML = `<span>已敬 ${doneN}/${N} 桌</span><span>剩 ${Math.max(0, Math.ceil(t))} 秒</span>`;
        if (drunk >= 100) return fin(false, '醉倒了…被抬去休息室');
        if (doneN >= N) return fin(true, `${N} 桌全部敬完，還站得穩！`);
        if (t <= 0) return fin(false, `時間到，還有 ${N - doneN} 桌沒敬到…`);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return stop;
    } },
  { title: '老闆開會接公文', sfx: 'doc', bgm: 'title', bg: 'bg-meeting', ch: 'c-boss', rule: (hard) => `老闆在開會，公文一份一份丟過來！左右拖曳（或鍵盤 ← →）移動「公文籃」去接住公文，接 ${hard ? 18 : 15} 份過關。只要接「公文」，千萬別接到咖啡！漏接公文或接到咖啡累計 ${hard ? 5 : 6} 次就失敗。`, goal: 15,
    run(area, hud, end, hard) {
      const NEED = hard ? 18 : 15; let got = 0, miss = 0, stopped = false, last = performance.now(), raf = 0, spawnT = 0.4, bx = 0.5;
      area.innerHTML = '' + IMG('c-boss', 'position:absolute;left:50%;top:0;height:96px;transform:translateX(-50%)') + '<div id="say" class="lyric" style="position:absolute;left:0;right:0;top:16%;min-height:30px;font-size:20px"></div>' + IMG('s-basket', 'position:absolute;bottom:3%;width:96px;touch-action:none').replace('<img ', '<img id="basket" ') + '';
      const basket = area.querySelector('#basket'), say = area.querySelector('#say'); const items = []; const MAXMISS = hard ? 5 : 6, waveT0 = 7;
      let waveT = 1e9;   // 雜物雨已取消
      const BAD = [['s-coffee', 1, '咖啡！', '咖啡灑到公文了！', 38]];   // 只留咖啡一種雜物
      const GOOD = [['s-doc', 1, 1, 38, 1]];   // 只有公文
      const pick = (list, extra) => { let tot = 0; for (const t of list) tot += t[1] + (extra && t[0] === 's-coffee' ? extra : 0); let r = Math.random() * tot; for (const t of list) { r -= t[1] + (extra && t[0] === 's-coffee' ? extra : 0); if (r <= 0) return t; } return list[0]; };
      const spawn = (bad, xFixed) => {
        const t = bad ? pick(BAD, hard ? 8 : 0) : pick(GOOD);
        const w = t[bad ? 4 : 3], H0 = area.clientHeight;
        const e = el('div', IMG(t[0], 'width:100%'), ''); e.style.cssText = `position:absolute;top:22%;width:${w}px;line-height:0`; const x = xFixed ?? rnd(0.08, 0.92); e.style.left = `calc(${x * 100}% - ${w / 2}px)`; area.appendChild(e);
        items.push({ e, x, y: H0 * 0.22, bad, tp: t, val: bad ? 0 : t[2], v: ((hard ? 230 : 190) + got * 6) * (bad ? 1 : t[4]) });
      };
      const SAY = ['這份急件！', '馬上要簽！', '這份也要！', '還有一份！', '快接快接！', '老闆說幾句話就好…'];
      const place = () => { basket.style.left = `calc(${bx * 100}% - 48px)`; }; place();
      const move = (e) => { const r = area.getBoundingClientRect(); bx = Math.min(0.94, Math.max(0.06, (e.clientX - r.left) / r.width)); place(); };
      area.addEventListener('pointermove', move); area.addEventListener('pointerdown', move);
      const onKey = (e) => { if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); bx = Math.max(0.06, bx - 0.07); place(); } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); bx = Math.min(0.94, bx + 0.07); place(); } };
      window.addEventListener('keydown', onKey);
      const upd = () => { hud.innerHTML = `<span>接到 ${got}/${NEED}</span><span>失誤 ${miss}/${MAXMISS}</span>`; }; upd();
      const stop = () => { stopped = true; cancelAnimationFrame(raf); area.removeEventListener('pointermove', move); area.removeEventListener('pointerdown', move); window.removeEventListener('keydown', onKey); };
      const frame = (now) => {
        if (stopped) return; const dt = Math.min(0.1, (now - last) / 1000); last = now; const H = area.clientHeight, W = area.clientWidth;
        spawnT -= dt;
        waveT -= dt;
        if (waveT <= 0) {   // 雜物雨：同時掉下一排咖啡、茶、泡麵（要左右閃）
          waveT = hard ? 7 : 9; const n = hard ? 5 : 4; for (let i = 0; i < n; i++) spawn(true, 0.1 + (0.8 * i) / (n - 1) + (Math.random() - 0.5) * 0.06);
          say.textContent = '會議室的茶水間打翻了！'; floatText(area, area.clientWidth / 2, area.clientHeight * 0.3, '雜物雨！', '#ffb74d');
        }
        if (spawnT <= 0) {
          spawnT = Math.max(0.34, (hard ? 0.7 : 0.82) - got * 0.02); const bad = Math.random() < (hard ? 0.34 : 0.28);
          spawn(bad); say.textContent = SAY[Math.floor(Math.random() * SAY.length)];
        }
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i]; it.y += it.v * dt; it.e.style.top = it.y + 'px';
          const by = H * 0.97 - 46;
          if (it.y >= by - 24 && it.y <= by + 24 && Math.abs(it.x - bx) < (48 + 14) / W) {
            items.splice(i, 1); it.e.remove();
            if (it.bad) { miss++; SND().play('dead'); fxSplash(area, it.x * W, by); shake(area); floatText(area, it.x * W, by - 24, it.tp[2], '#ff8a80'); say.textContent = it.tp[3]; } else { got += it.val; SND().play('gem'); fxPaper(area, it.x * W, by); floatText(area, it.x * W, by - 24, '+' + it.val, it.val > 1 ? '#ffd54f' : '#fff'); }
            upd();
          } else if (it.y > H) { items.splice(i, 1); it.e.remove(); if (!it.bad) { miss++; SND().play('tap'); upd(); } }
        }
        if (miss >= MAXMISS) { stop(); return end(false, '公文漏太多、咖啡又接太多，老闆在冒煙…'); }
        if (got >= NEED) { stop(); return end(true, `接了 ${got} 份公文，一份都沒皺！`); }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return stop;
    } },
  { title: '賽車去尾牙', sfx: 'race', bgm: 'play', bg: 'bg-road', ch: 'c-worker', rule: (hard) => `開公司的車衝去海豐餐廳！用鍵盤 ← → 換車道（手機點畫面左半邊／右半邊），閃開路障、油桶和前車。撞 5 次才會失敗，${hard ? 24 : 20} 秒內到達終點過關。`, goal: 20,
    run(area, hud, end, hard) {
      const DUR = hard ? 24 : 20; let lane = 1, dist = 0, hits = 0, inv = 0, stun = 0, stopped = false, last = performance.now(), raf = 0, spawnT = 0.6, roadY = 0;
      area.style.background = '#2b2f36'; const eng = engineStart();
      area.innerHTML = '<div id="road" style="position:absolute;inset:0;background:repeating-linear-gradient(to bottom,rgba(255,255,255,.55) 0 28px,transparent 28px 64px) 33.3% 0/4px 100% no-repeat,repeating-linear-gradient(to bottom,rgba(255,255,255,.55) 0 28px,transparent 28px 64px) 66.6% 0/4px 100% no-repeat,url(art/ch/t-asphalt.webp?v=1) 0 0/128px"></div><div style="position:absolute;top:0;bottom:0;left:2%;width:3px;background:rgba(255,255,255,.55)"></div><div style="position:absolute;top:0;bottom:0;right:2%;width:3px;background:rgba(255,255,255,.55)"></div>' + IMG('s-car', 'position:absolute;bottom:6%;width:46px;transform:translateX(-50%)').replace('<img ', '<img id="car" ') + '<div id="fin" style="position:absolute;left:0;right:0;top:-80px;height:70px;background:repeating-conic-gradient(#fff 0 25%,#222 0 50%) 0 0/28px 28px;display:flex;align-items:center;justify-content:center;font-size:30px;color:#c62828;font-weight:700;text-shadow:0 0 6px #fff">海豐餐廳</div><div class="pop" id="pop" style="top:8%"></div>';
      const road = area.querySelector('#road'), car = area.querySelector('#car'), fin = area.querySelector('#fin'), pop = area.querySelector('#pop'); const obs = [];
      const laneX = (l) => (l * 2 + 1) / 6 * 100;   // 三條車道的中心（%）
      const showCar = () => { car.style.left = laneX(lane) + '%'; }; showCar();
      const go = (d) => { lane = Math.min(2, Math.max(0, lane + d)); showCar(); SND().play('tap'); fxStars(area, laneX(lane) / 100 * area.clientWidth, area.clientHeight * 0.9, '#ffd24a', 4); };
      const tap = (e) => { const r = area.getBoundingClientRect(); go(e.clientX < r.left + r.width / 2 ? -1 : 1); };
      area.addEventListener('pointerdown', tap);
      const onKey = (e) => { if (e.repeat) return; if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); go(-1); } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); go(1); } };
      window.addEventListener('keydown', onKey);
      const row = el('div', '', ''); row.style.cssText = 'display:flex;justify-content:center;gap:14px;margin-top:4px';
      const bL = el('button', '◀', ''), bR = el('button', '▶', ''); for (const b of [bL, bR]) { b.style.fontSize = '30px'; b.style.padding = '6px 34px'; }
      bL.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); go(-1); }); bR.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); go(1); });
      row.append(bL, bR); area.parentNode.appendChild(row);
      const upd = () => { hud.innerHTML = `<span>工廠 ➜ 海豐餐廳 ${Math.floor(dist)}%</span><span>撞擊 ${hits}/5</span>`; }; upd();
      const stop = () => { stopped = true; cancelAnimationFrame(raf); area.removeEventListener('pointerdown', tap); window.removeEventListener('keydown', onKey); row.remove(); area.style.background = ''; eng.stop(); };
      const frame = (now) => {
        if (stopped) return; const dt = Math.min(0.1, (now - last) / 1000); last = now; const H = area.clientHeight;
        inv = Math.max(0, inv - dt); stun = Math.max(0, stun - dt);
        const sp = stun > 0 ? 0.45 : 1; eng.set(sp); dist += (100 / DUR) * dt * sp; roadY += 360 * dt * sp; road.style.backgroundPositionY = roadY + 'px, ' + roadY + 'px, ' + roadY + 'px';
        spawnT -= dt * sp;
        if (spawnT <= 0 && dist < 92) {
          spawnT = rnd(0.55, 0.95) * (hard ? 0.8 : 1); const n = Math.random() < (hard ? 0.35 : 0.18) ? 2 : 1; const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, n);
          for (const l of lanes) { const ti = Math.floor(Math.random() * 3), nm = ['s-cone', 's-barrel', 's-truck'][ti], w = [40, 42, 48][ti]; const e = el('div', IMG(nm, 'width:100%'), ''); e.style.cssText = `position:absolute;left:${laneX(l)}%;top:-50px;width:${w}px;line-height:0;transform:translateX(-50%)`; area.appendChild(e); obs.push({ e, l, y: -50, v: ti === 2 ? 250 : 330 }); }
        }
        const carY = H * (1 - 0.06) - 44;
        for (let i = obs.length - 1; i >= 0; i--) {
          const o = obs[i]; o.y += o.v * dt * (0.9 + dist / 100 * 0.5) * sp; o.e.style.top = o.y + 'px';
          if (inv <= 0 && o.l === lane && Math.abs(o.y - carY) < 36) { hits++; inv = 1.1; stun = 0.7; SND().play('dead'); fxSmoke(area, laneX(lane) / 100 * area.clientWidth, carY + 20); shake(area); pop.textContent = '撞到了！'; setTimeout(() => { pop.textContent = ''; }, 700); car.style.opacity = 0.5; setTimeout(() => { car.style.opacity = 1; }, 900); upd(); }
          if (o.y > H + 40) { o.e.remove(); obs.splice(i, 1); }
        }
        fin.style.top = (dist >= 88 ? Math.min(H * 0.4, (dist - 88) / 12 * H * 0.9 - 80) : -80) + 'px';
        upd();
        if (hits >= 5) { stop(); return end(false, '車子撞壞了，趕不上尾牙…'); }
        if (dist >= 100) { stop(); return end(true, '準時抵達海豐餐廳！'); }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return stop;
    } },
];

// 每一關要過哪些挑戰：最後一關要連過兩項（特獎抽獎、逐桌敬酒）
const LEVEL_GAMES = [[6], [7], [0], [1], [5]];   // 前兩關工廠：接公文、丟煞車盤；後三關尾牙：搶紅包、唱廠歌、抽獎＋敬酒
export function runChallenge(li, done, hard = false) {
  const list = LEVEL_GAMES[Math.min(li, LEVEL_GAMES.length - 1)]; let k = 0;
  const next = () => { if (k >= list.length) return done(); runOne(list[k++], next, hard, li); };
  next();
}

export function runOne(i, done, hard = false, li = null) {
  CTX = '';
  const g = GAMES[i], o = overlay();
  o.style.background = g.bg ? `linear-gradient(rgba(12,2,4,.4),rgba(12,2,4,.62)),url(${AP(g.bg)}) center/cover no-repeat` : '';
  const chImg = (cls = '') => { if (!g.ch) return document.createTextNode(''); const im = document.createElement('img'); im.src = AP(g.ch); im.className = 'chimg ' + cls; return im; };
  const intro = () => {
    o.innerHTML = ''; o.classList.add('on');
    const box = el('div', '', 'cb');
    box.append(chImg(), el('div', li == null ? '挑戰' : `第 ${li + 1} 關挑戰`, "ctag"), el('h2', g.title), el('p', typeof g.rule === 'function' ? g.rule(hard) : g.rule));
    const go = el('button', '開始！', 'big'); go.onclick = () => { SND().play('tap'); play(); };
    box.append(go); o.append(box);
  };
  const play = () => {
    CTX = g.sfx || ''; try { if (window.SND && window.SND.music) window.SND.music(g.bgm || null); } catch (e) {}
    o.innerHTML = '';
    const box = el('div', '', 'cb'), hud = el('div', '', 'hud'), area = el('div', '', 'area');
    box.append(el('h2', g.title), hud, area); o.append(box);
    g.run(area, hud, (ok, msg) => {
      setTimeout(() => {
        o.innerHTML = '';
        const b = el('div', '', 'cb');
        b.append(chImg(ok ? 'win' : 'lose'), el('h2', ok ? '挑戰成功！' : '挑戰失敗'), el('p', msg || ''));
        const btn = el('button', ok ? '繼續' : '再挑戰一次', 'big');
        btn.onclick = () => { SND().play('tap'); if (ok) { o.classList.remove('on'); o.innerHTML = ''; done(); } else intro(); };
        CTX = 'result'; try { if (window.SND && window.SND.music) window.SND.music(null); } catch (e) {}
        b.append(btn); o.append(b); SND().play(ok ? 'clear' : 'dead'); if (ok) confetti(o); else shake(b);
      }, 500);
    }, hard);
  };
  intro();
}
