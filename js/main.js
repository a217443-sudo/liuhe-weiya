// 主程式：畫面切換、搖桿、遊戲迴圈、上方資訊、升級卡、劇情對話、存檔
import * as HERO from './hero.js?v=67';
import * as R from './render.js?v=22';
import { runChallenge } from './challenge.js?v=120';

const CORE = window.CORE, D = window.DATA, SND = window.SND;
// 建立一關：先依該關的場景（工廠／尾牙）換武器名稱與圖示
const mk = (i, o) => { D.applySkin(D.LEVELS[i].skin || ''); return CORE.create(i, o); };
const $ = (id) => document.getElementById(id);
const ui = $('ui'), cv = $('cv');
let S = null, mode = 'loading', li = 0, last = performance.now(), acc = 0, T = 0;
let talkQ = [], talkI = 0, talkDone = null, typeT = 0, cardsAt = 0, tipT = 0, story = false;
let view = { w: 720, h: 1280 }, uiScale = 1;
const joy = { id: null, bx: 0, by: 0, x: 0, y: 0, on: false };
const keys = new Set();
const BOT_ON = /[?&]bot/.test(location.search);   // 測試：自動玩、自動選卡
if (BOT_ON) { const sc = document.createElement('script'); sc.src = 'js/bot.js'; document.head.appendChild(sc); }

// ---------- 存檔 ----------
const SAVE_KEY = 'liuhe-weiya';
let save = { open: 1, best: {}, bestH: {}, hard: false, gender: 'm' };   // best：一般版最快、bestH：困難版最快
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.open) save = { ...save, ...s, bestH: s.bestH || {} }; } catch (e) {}
const bestOf = () => (save.hard ? save.bestH : save.best);
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
// 打到一半的存檔：每 5 秒、暫停、跳出遊戲時存；過關、失敗、重來就清掉
const RUN_KEY = 'liuhe-weiya-run';
let lastRunSave = 0;
function saveRun() {
  if (!S || story || !['play', 'pick', 'pause'].includes(mode) || S.state === 'dead' || S.state === 'clear') return;
  try { localStorage.setItem(RUN_KEY, JSON.stringify(CORE.serialize(S))); lastRunSave = S.t; } catch (e) {}
}
const clearRun = () => { try { localStorage.removeItem(RUN_KEY); } catch (e) {} };
function loadRun() { try { const o = JSON.parse(localStorage.getItem(RUN_KEY)); return o && o.v === 1 && D.LEVELS[o.li] ? o : null; } catch (e) { return null; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveRun(); if (mode === 'play') pause(true); } });
addEventListener('pagehide', saveRun);

// ---------- 擋縮放、選取、長按 ----------
const stop = (e) => e.preventDefault();
['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu', 'selectstart', 'dragstart'].forEach((ev) => document.addEventListener(ev, stop, { passive: false }));
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !e.target.closest('#select')) e.preventDefault(); }, { passive: false });
let lastTouch = 0;
document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouch < 320) e.preventDefault(); lastTouch = now; }, { passive: false });
window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });

// ---------- 版面 ----------
const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);pointer-events:none'; document.body.appendChild(probe);
function layout() {
  view = R.resize();
  const w = innerWidth, h = innerHeight;
  uiScale = Math.min(w / 720, h / 1100);
  if (h / w >= 1.45) uiScale = w / 720;
  ui.style.transform = `translateX(${(w - 720 * uiScale) / 2}px) scale(${uiScale})`;
  const vh = h / uiScale;
  ui.style.height = vh + 'px';
  document.documentElement.style.setProperty('--vh', vh + 'px');
  document.documentElement.style.setProperty('--sat', (probe.offsetHeight / uiScale) + 'px');
  if (S) { S.view.w = view.w; S.view.h = view.h; }
}
addEventListener('resize', layout);

// ---------- 輸入：按住畫面任何地方就是搖桿 ----------
cv.addEventListener('pointerdown', (e) => {
  if (mode === 'talk') { nextTalk(); return; }
  if (mode !== 'play' || joy.id != null) return;
  joy.id = e.pointerId; joy.bx = joy.x = e.clientX; joy.by = joy.y = e.clientY; joy.on = true;
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joy.id) return;
  const R0 = 54; let dx = e.clientX - joy.bx, dy = e.clientY - joy.by; const d = Math.hypot(dx, dy);
  if (d > R0 * 1.6) { joy.bx += dx / d * (d - R0 * 1.6); joy.by += dy / d * (d - R0 * 1.6); dx = e.clientX - joy.bx; dy = e.clientY - joy.by; }   // 手指拖太遠，底座跟著走
  joy.x = e.clientX; joy.y = e.clientY;
});
const endJoy = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.on = false; } };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (mode === 'talk' && (e.key === ' ' || e.key === 'Enter')) nextTalk();
  if (mode === 'pick' && ['1', '2', '3'].includes(e.key)) { const b = $('cardRow').children[+e.key - 1]; if (b) b.click(); }
  if (e.key === 'Escape' && mode === 'play') pause(true);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function readInput() {
  if (window.BOT && BOT_ON) return window.BOT(S);
  let x = 0, y = 0;
  if (joy.on) {
    const dx = joy.x - joy.bx, dy = joy.y - joy.by, d = Math.hypot(dx, dy), m = Math.min(1, d / 54);
    if (d > 6) { x = dx / d * m; y = dy / d * m; }
  }
  if (keys.has('a') || keys.has('arrowleft')) x = -1;
  if (keys.has('d') || keys.has('arrowright')) x = 1;
  if (keys.has('w') || keys.has('arrowup')) y = -1;
  if (keys.has('s') || keys.has('arrowdown')) y = 1;
  return { x, y };
}

// ---------- 畫面切換 ----------
const SCREENS = ['op', 'loading', 'title', 'select', 'hud', 'cards', 'talk', 'pause', 'result', 'wait', 'tip', 'ending'];
function show(...ids) { for (const s of SCREENS) $(s).classList.toggle('hide', !ids.includes(s)); }

function goTitle() {
  mode = 'title'; story = true;
  S = mk(2, { seed: 7, vw: view.w, vh: view.h });
  S.p.x = 1.5 * D.ROOM.W; S.camDy = view.h * 0.14; CORE.updCam(S, 1);
  show('title'); SND.music('song'); syncDiff(); syncGender();
  const run = loadRun(), bc = $('bContinue');
  bc.classList.toggle('hide', !run);
  if (run) bc.innerHTML = `繼續<small>第 ${run.li + 1} 關${run.hard ? '・困難' : ''}・${fmt(run.t)}</small>`;
  $('bStart').textContent = run ? '重新開始' : '開始';
  $('bStart').classList.toggle('big', !run);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone;
  $('iosTip').classList.toggle('hide', !ios);
}
function goSelect() {
  mode = 'select'; show('select'); syncDiff(); syncGender();
  const box = $('levels'); box.innerHTML = '';
  D.LEVELS.forEach((L, i) => {
    const best0 = bestOf()[i];
    const b = document.createElement('button'); b.className = 'lvc' + (best0 != null ? ' done' : '');
    b.style.setProperty('--r', ((i % 2 ? 1 : -1) * 0.6) + 'deg');
    const its = L.items.map(([k]) => `<i style="${itemPos(D.ITEMS[k].icon)}"></i>`).join('');
    const best = best0 != null ? `<span class="best">${save.hard ? '困難' : ''}過關・最快 ${fmt(best0)}</span>` : '';
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t"><b>${L.name}</b><span>${L.sub}</span></span><span class="its">${its}</span>${best}`;
    b.onclick = () => { SND.play('tap'); startLevel(i); };
    box.appendChild(b);
  });
}
let HERO_ICON = '';   // 打怪超人的卡片圖示：載入後用 3D 模型拍一張
// 難度切換（標題、選關都有，選了就記住）
const DIFF_NOTE = () => `一般：怪物少約 ${Math.round((1 - D.EASY.spawn) * 100)}%、升級比較快，輕鬆玩；困難：怪物數量和升級速度是標準挑戰版`;
function syncDiff() {
  for (const id of ['diffT', 'diffS']) for (const b of $(id).querySelectorAll('button')) b.classList.toggle('on', (b.dataset.h === '1') === !!save.hard);
  $('diffNote').textContent = DIFF_NOTE();
}
for (const id of ['diffT', 'diffS']) for (const b of $(id).querySelectorAll('button')) b.onclick = () => {
  save.hard = b.dataset.h === '1'; persist(); SND.play('tap'); syncDiff(); syncGender();
  if (mode === 'select') goSelect();
};
// 角色（男生／女生）：標題畫面選，選了就記住
function syncGender() { for (const b of $('genderT').querySelectorAll('button')) b.classList.toggle('on', b.dataset.g === (save.gender || 'm')); HERO.setPlayer(save.gender || 'm'); }
for (const b of $('genderT').querySelectorAll('button')) b.onclick = () => { save.gender = b.dataset.g; persist(); SND.play('tap'); syncGender(); };
const SKF = () => D.skin === 'f';
// 任務道具圖示（items 圖；200 以上是工廠道具 items2）
const itemPos = (i) => i >= 200 ? `background-image:url(art/items2.webp?v=70);background-position:${((i - 200) % 4) * 33.333}% ${((i - 200) >> 2) * 33.333}%` : `background-position:${(i % 4) * 33.333}% ${(i >> 2) * 33.333}%`;
const iconPos = (i) => i >= 200 ? `background-image:url(art/items2.webp?v=70);background-position:${((i - 200) % 4) * 33.333}% ${((i - 200) >> 2) * 33.333}%`
  : i === 'hero' ? `background-image:url(${HERO_ICON});background-size:contain;background-position:center`
  : i >= 100 ? `background-image:url(art/skills2${SKF() ? 'f' : ''}.webp?v=70);background-position:${((i - 100) % 4) * 33.333}% ${((i - 100) >> 2) * 33.333}%`
  : `${SKF() ? 'background-image:url(art/skillsf.webp?v=70);' : ''}background-position:${(i % 4) * 33.333}% ${(i >> 2) * 33.333}%`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function fullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen && !/iPhone|iPad|iPod/.test(navigator.userAgent)) el.requestFullscreen().catch(() => {});
}

// ---------- 片頭：約 6 秒，跟歌對拍（1.6 秒南瓜仔衝出來、3.24 秒片名砸下來），點一下或「跳過」直接到標題 ----------
const OP = { hit: 1.58, slam: 3.24, sub: 3.9, end: 6.4 };
let opT = 0, opCam = null, opStep = 0;
function startOP() {
  mode = 'op'; story = true; opT = 0; opStep = 0;
  S = mk(2, { seed: 7, vw: view.w, vh: view.h });
  S.p.x = 1.5 * D.ROOM.W; S.camDy = view.h * 0.14; CORE.updCam(S, 1);
  opCam = { x: S.cam.x, y: S.cam.y };
  $('op').className = 'screen';
  show('op');
  SND.music('song', { restart: true });
}
function stepOP(dt) {
  const st = SND.songTime();
  opT = st > 0.05 && Math.abs(st - opT) < 1 ? st : opT + dt;   // 有聲音就跟歌的時間走
  const k = Math.min(1, opT / 3.0), e = 1 - Math.pow(1 - k, 3);
  S.cam.x = opCam.x; S.cam.y = opCam.y - 1100 * (1 - e);   // 從夜空往下搖到校舍
  const op = $('op');
  if (opStep === 0 && opT > 0.25) { opStep = 1; op.classList.add('line'); }
  if (opStep === 1 && opT >= OP.hit) {   // 南瓜仔、蝙蝠衝過去
    opStep = 2; R.events(S, [{ k: 'flash' }]);
    const M = D.MONS;
    for (let i = 0; i < 12; i++) S.mons.push({ id: -i - 1, k: 'pumpkin', d: M.pumpkin, r: M.pumpkin.r, x: opCam.x - view.w / 2 - 60 - i * 52, y: -M.pumpkin.r - (i % 3) * 18, f: 0, face: 1, ph: i * 1.7, cl: null, stun: 0, flash: 0, hp: 1, max: 1, vx: 260 + (i % 4) * 20 });
    for (let i = 0; i < 6; i++) S.mons.push({ id: -100 - i, k: 'bat', d: M.bat, r: M.bat.r, x: opCam.x + view.w / 2 + 60 + i * 70, y: -560 - (i % 3) * 70, f: 1, face: -1, ph: i, cl: null, stun: 0, flash: 0, hp: 1, max: 1, vx: -320 });
  }
  for (const m of S.mons) m.x += m.vx * dt;
  if (opStep === 2 && opT >= OP.slam) { opStep = 3; op.classList.add('slam'); R.events(S, [{ k: 'boom' }, { k: 'flash' }]); }
  if (opStep === 3 && opT >= OP.sub) { opStep = 4; op.classList.add('sub'); }
  if (opT >= OP.end) endOP();
}
function endOP() { if (mode !== 'op') return; S.mons.length = 0; goTitle(); }
$('opSkip').addEventListener('click', (e) => { e.stopPropagation(); endOP(); });
$('op').addEventListener('pointerdown', (e) => { if (e.target.id !== 'opSkip' && opT > 0.4) endOP(); });

// ---------- 開始一關 ----------
function startLevel(i) {
  li = i; fullscreen(); clearRun();
  S = mk(i, { vw: view.w, vh: view.h, hard: !!save.hard });
  $('modeTag').classList.toggle('hide', !S.hard);
  acc = 0; joy.id = null; joy.on = false;
  // 槽位
  $('slots').innerHTML = S.items.map((it) => `<div class="slot"><i style="${itemPos(D.ITEMS[it.k].icon)}"></i></div>`).join('');
  SND.urgent(false);
  const st = D.STORY[S.L.story];
  story = true;
  talk(st.intro, () => { story = false; begin(); });
}
// 接著上次存的地方玩（不重播劇情）
function continueRun() {
  const o = loadRun(); if (!o) { startLevel(0); return; }
  fullscreen();
  li = o.li; S = CORE.restore(o, { vw: view.w, vh: view.h }); acc = 0; joy.id = null; joy.on = false;
  $('modeTag').classList.toggle('hide', !S.hard);
  $('slots').innerHTML = S.items.map((it) => `<div class="slot${it.got ? ' got' : ''}"><i style="${itemPos(D.ITEMS[it.k].icon)}"></i></div>`).join('');
  story = false; SND.urgent(S.exit.open || !!S.boss);
  mode = 'play'; show('hud'); SND.music('song');
  tip(`接著上次：第 ${li + 1} 關・${S.L.name}`, 2.6);
}
function begin() {
  mode = 'play'; show('hud'); SND.music('song');
  if (li === 0) tip('手指按住畫面拖曳就能走；走到梯子往上推就會爬', 6);
  else tip(`找到 ${S.items.map((it) => D.ITEMS[it.k].name).join('、')}`, 4);
}

// 劇情：人物站在畫面裡，下面一格對話
function npcs() {
  if (!S) return [];
  const L = S.L, list = L.npc === 'both' ? ['tu', 'zhang'] : [L.npc];
  const p = S.p, out = [];
  if (story) {
    const side = p.x > S.Wt - 260 ? -1 : 1;
    list.forEach((k, i) => out.push({ k, x: p.x + side * (110 + i * 95), y: p.y, h: k === 'zhang' ? 118 : 112, face: -side }));
  } else {
    const ex = S.exit;
    list.filter((k) => !(k === 'zhang' && S.helper)).forEach((k, i) => out.push({ k, x: ex.x + 80 + i * 90, y: ex.y, h: k === 'zhang' ? 118 : 112, face: -1 }));
  }
  return out;
}
function talk(lines, done) {
  talkQ = lines; talkI = -1; talkDone = done; mode = 'talk';
  show('talk');
  nextTalk();
  if (BOT_ON) setTimeout(() => { if (mode !== 'talk') return; typeT = 999; talkI = talkQ.length - 1; nextTalk(); }, 500);
}
function nextTalk() {
  const p = $('talkText');
  if (mode !== 'talk' || talkI >= talkQ.length) return;   // 對話已經結束（連點多按的）
  if (talkI >= 0 && typeT < talkQ[talkI][1].length) { typeT = 999; return; }   // 字還在跑：先整句顯示
  talkI++;
  if (talkI >= talkQ.length) { const d = talkDone; talkDone = null; d && d(); return; }
  const [who] = talkQ[talkI];
  const w = $('talkWho'); w.textContent = D.NAMES[who]; w.className = 'who ' + who;
  typeT = 0; p.textContent = '';
  if (who !== 'bian') HERO.act(who, who === 'tu' ? 'hop' : 'talk');
  SND.play('tap');
}
$('talkSkip').addEventListener('click', (e) => { e.stopPropagation(); if (mode !== 'talk') return; typeT = 999; talkI = talkQ.length - 1; nextTalk(); });
$('talk').addEventListener('pointerdown', (e) => { if (e.target.id !== 'talkSkip') nextTalk(); });

// ---------- 升級卡 ----------
function showCards() {
  mode = 'pick'; joy.id = null; joy.on = false; cardsAt = performance.now();
  show('hud', 'cards');
  const opening = S.t === 0;
  const nw = CORE.weapons(S).length;
  $('cardsTitle').innerHTML = (opening ? '出發前，挑一樣帶著' : S.lastChest ? '福袋！挑一個' : `升到 Lv ${S.p.lv - S.pending}！選一個`) + `<small>武器 ${nw}/${D.MAXW}</small>`;
  S.lastChest = false;
  const row = $('cardRow'); row.innerHTML = '';
  if (BOT_ON) setTimeout(() => { cardsAt = 0; const b = $('cardRow').children[0]; b && b.click(); }, 400);
  S.offer.forEach((k, i) => {
    const b = document.createElement('button'); b.className = 'card';
    b.style.setProperty('--r', ((i - 1) * 1.2) + 'deg');
    if (k === 'heal') {
      b.innerHTML = `<span class="ic" style="${iconPos(15)}"></span><b>補血</b><p>技能都滿級了，把血補滿</p>`;
    } else {
      const sk = D.SKILLS[k], lv = S.sk[k] || 0;
      const pips = Array.from({ length: D.MAXLV }, (_, j) => `<i class="${j < lv ? 'on' : j === lv ? 'nx' : ''}"></i>`).join('');
      // 稀有度：武器標普通／稀有／史詩（卡片膠帶與外框顏色不同），被動標「道具」
      const rare = sk.kind === 'w' ? sk.rare : 0;
      b.classList.add('r' + rare);
      const tag = rare ? `<span class="rare">${D.RARE[rare].name}</span>` : '<span class="rare">道具</span>';
      const full = CORE.needDrop(S, k) ? '<span class="full">要換掉一種</span>' : '';
      b.innerHTML = `${tag}${lv ? '' : '<span class="new">新</span>'}<span class="ic" style="${iconPos(sk.icon)}"></span><b>${sk.name}</b><span class="lvl">${pips}</span><p>${sk.desc[lv]}</p>${full}`;
    }
    b.onclick = () => {
      if (performance.now() - cardsAt < 350) return;   // 剛跳出來，避免手指還在拖搖桿誤點
      if (CORE.needDrop(S, k)) { showDrop(k); return; }
      take(k);
    };
    row.appendChild(b);
  });
}
function take(k, dropK) {
  CORE.choose(S, k, dropK); SND.play('pick');
  if (S.pending > 0 || S.chestPick > 0) { CORE.step(S, 0); if (S.state === 'pick') { showCards(); return; } }
  mode = 'play'; show('hud');
}
// 武器帶滿 5 種：挑一種丟掉，或放棄這張（補 20 血）
function showDrop(k) {
  const sk = D.SKILLS[k];
  $('cardsTitle').innerHTML = `武器最多帶 ${D.MAXW} 種<small>丟掉一種換「${sk.name}」，或放棄</small>`;
  const row = $('cardRow'); row.innerHTML = '';
  const box = document.createElement('div'); box.className = 'drops';
  for (const w of CORE.weapons(S)) {
    const ws = D.SKILLS[w], b = document.createElement('button'); b.className = 'drop r' + ws.rare;
    b.innerHTML = `<span class="ic" style="${iconPos(ws.icon)}"></span><b>${ws.name}</b><em>Lv ${S.sk[w]}</em><span class="x">丟掉</span>`;
    b.onclick = () => { SND.play('tap'); take(k, w); };
    box.appendChild(b);
  }
  const skip = document.createElement('button'); skip.className = 'drop skip';
  skip.innerHTML = `<b>放棄「${sk.name}」</b><em>補 20 血</em>`;
  skip.onclick = () => { SND.play('tap'); take('skip'); };
  box.appendChild(skip);
  row.appendChild(box);
  if (BOT_ON) setTimeout(() => { const b = box.children[0]; b && b.click(); }, 300);
}

// ---------- 暫停、結算 ----------
function pause(on) {
  if (on) {
    mode = 'pause'; joy.id = null; joy.on = false; show('hud', 'pause');
    $('haveList').innerHTML = Object.entries(S.sk).map(([k, v]) => `<span style="${iconPos(D.SKILLS[k].icon)}"><b>${v}</b></span>`).join('');
    $('pMute').textContent = '聲音：' + (SND.muted() ? '關' : '開');
  } else { mode = 'play'; show('hud'); }
}
$('bPause').addEventListener('click', () => { if (mode === 'play') pause(true); });
$('pResume').onclick = () => pause(false);
$('pRetry').onclick = () => startLevel(li);
$('pMenu').onclick = () => { saveRun(); goTitle(); };
$('pMute').onclick = () => { SND.setMuted(!SND.muted()); $('pMute').textContent = '聲音：' + (SND.muted() ? '關' : '開'); };

function cleared() {
  clearRun();
  mode = 'outro'; story = true; joy.on = false;
  SND.urgent(false); SND.music(null);
  HERO.act('bian', 'sig_bian', true);
  const t = S.t;
  const B = S.hard ? save.bestH : save.best;
  if (B[li] == null || t < B[li]) B[li] = t;
  persist();
  setTimeout(() => {
    HERO.stopAct('bian');
    // 拿齊東西、撐過撤離後，老闆請你上台挑戰；挑戰過了才算過關
    runChallenge(li, () => {
      save.open = Math.max(save.open, Math.min(D.LEVELS.length, li + 2)); persist();
      talk(D.STORY[S.L.story].outro, () => (li === D.LEVELS.length - 1 ? startEnding() : result(true)));
    }, !!S.hard);
  }, 1600);
}

// ---------- 結尾：開席大合照、最後一段對白、成績與致謝 ----------
let endRaf = 0, endTimer = 0;
function startEnding() {
  mode = 'ending'; story = false; joy.on = false; SND.urgent(false); SND.music('play'); show('ending');
  const root = $('ending'), cv = $('endCv'), box = $('endBox'), panel = $('endPanel');
  panel.style.display = 'none'; box.style.display = 'block'; $('endTitle').style.display = 'block';
  const fit = () => { cv.width = root.clientWidth; cv.height = root.clientHeight; }; fit();
  const g = cv.getContext('2d');
  const other = save.gender === 'f' ? 'workerM' : 'workerF';
  const cast = [[other, -2], ['zhang', -1], ['bian', 0], ['tu', 1], ['needle', 2]];   // 角色與水平位置（相對畫面中央）
  for (const [k] of cast) { HERO.act(k, 'sig_bian', true); }
  let last = performance.now(), tt = 0, cfT = 0;
  const loop = (now) => {
    if (mode !== 'ending') return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt; cfT -= dt;
    if (cv.width !== root.clientWidth || cv.height !== root.clientHeight) fit();
    const W = cv.width, H = cv.height, hh = Math.min(W * 0.26, H * 0.42), fy = H * 0.74, step = Math.min(W * 0.19, hh * 0.85);
    g.clearRect(0, 0, W, H);
    for (const [k, off] of cast) {
      HERO.update(k, dt, tt, { speed: 0, face: 1, front: true });
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(W / 2 + off * step, fy, hh * 0.28, hh * 0.06, 0, 0, 6.29); g.fill();
      HERO.draw(g, k, W / 2 + off * step, fy, hh);
    }
    if (cfT <= 0) { cfT = 1.2; endConfetti(root); }
    endRaf = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(endRaf); endRaf = requestAnimationFrame(loop);
  const LINES = [
    ['zhang', '各位同仁，今年大家辛苦了。老闆說幾句話就好——'],
    ['bian', '老闆，我可以吃尾牙了嗎？'],
    ['zhang', '開動！'],
    ['tu', '現在是晚上九點啦！快來吃飯～'],
    ['bian', '終於可以吃尾牙了！'],
  ];
  let i = -1, typing = false;
  const next = () => {
    if (typing) { clearInterval(endTimer); $('endText').textContent = LINES[i][1]; typing = false; return; }
    i++;
    if (i >= LINES.length) { finishEnding(); return; }
    const [who, text] = LINES[i]; $('endWho').textContent = D.NAMES[who]; $('endText').textContent = '';
    HERO.act(who === 'bian' ? 'bian' : who, 'sig_bian', true);
    typing = true; let n = 0; clearInterval(endTimer);
    endTimer = setInterval(() => { n++; $('endText').textContent = text.slice(0, n); SND.play('talk'); if (n >= text.length) { clearInterval(endTimer); typing = false; } }, 38);
    SND.play('tap');
  };
  box.onclick = next; next();
}
function finishEnding() {
  clearInterval(endTimer); $('endBox').style.display = 'none'; $('endTitle').style.display = 'none';
  const B = save.hard ? save.bestH : save.best; let total = 0, n = 0;
  const rows = D.LEVELS.map((L, i) => { const t = B[i]; if (t != null) { total += t; n++; } return `<tr><td>第 ${i + 1} 關　${L.name}</td><td>${t != null ? fmt(t) : '—'}</td></tr>`; });
  $('endStats').innerHTML = rows.join('') + (n === D.LEVELS.length ? `<tr><td><b>總計（最快紀錄）</b></td><td><b>${fmt(total)}</b></td></tr>` : '');
  $('endPanel').style.display = 'flex'; SND.play('clear');
}
window.__startEnding = startEnding;   // 測試用：直接看結尾
function leaveEnding() { cancelAnimationFrame(endRaf); clearInterval(endTimer); }
$('endAgain').onclick = () => { SND.play('tap'); leaveEnding(); startLevel(0); };
$('endTitleBtn').onclick = () => { SND.play('tap'); leaveEnding(); goTitle(); };
function endConfetti(host) {
  const cols = ['#ffd24a', '#ff5a4a', '#7dffc8', '#69b7ff', '#ff8ad8', '#fff'];
  for (let k = 0; k < 24; k++) {
    const d = document.createElement('div'), w = 7 + Math.random() * 7, x = Math.random() * 100;
    d.style.cssText = `position:absolute;left:${x}%;top:-20px;width:${w}px;height:${w * 1.6}px;background:${cols[k % cols.length]};border-radius:2px;pointer-events:none;z-index:1`; host.appendChild(d);
    const a = d.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${(Math.random() - 0.5) * 120}px,${innerHeight + 40}px) rotate(${(Math.random() - 0.5) * 900}deg)`, opacity: 1 }], { duration: 2200 + Math.random() * 1800, easing: 'ease-in' }); a.onfinish = () => d.remove();
  }
}
function failed() {
  clearRun();
  mode = 'dead'; joy.on = false; SND.urgent(false); SND.music(null);
  HERO.act('bian', 'stumble');
  setTimeout(() => result(false), 1400);
}
function result(win) {
  mode = 'result'; story = false;
  show('result');
  const r = $('result'); r.classList.toggle('lose', !win);
  const d = new Date(); $('rDate').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日　第 ${li + 1} 關`;
  const got = S.items.filter((i) => i.got).length;
  $('rTitle').textContent = (win ? '過關！' : '挑戰失敗') + (S.hard ? '（困難）' : '');
  $('rStats').innerHTML = `<li>撐了 <b>${fmt(S.t)}</b></li><li>擊倒 <b>${S.kills}</b> 隻</li><li>拿到 <b>${got}/3</b> 樣東西・Lv <b>${S.p.lv}</b></li>`;
  const last = li === D.LEVELS.length - 1;
  $('rLine').textContent = win ? (last ? '尾牙開席囉！全部區域都走完了。' : '老闆評語：小六今天很努力，快可以吃尾牙了（還不行）。') : got < 3 ? '再來一次！先挑能打一整圈的武器會比較好過。' : '東西都拿到了，差一點！撤離時記得一直走位。';
  $('rNext').textContent = win ? (last ? '再玩一次' : '下一關') : '再來一次';
  $('rNext').onclick = () => { SND.play('tap'); startLevel(win ? (last ? 0 : li + 1) : li); };
  $('rMenu').onclick = () => { SND.play('tap'); goTitle(); };
  SND.play(win ? 'clear' : 'dead');
}

// ---------- 遊戲事件 ----------
function tip(text, sec = 2.6, warn = false) {
  const t = $('tip'); $('tipText').textContent = text; t.classList.remove('hide', 'show'); t.classList.toggle('warn', warn);
  void t.offsetWidth; t.classList.add('show'); tipT = sec;
}
function handleEvents() {
  const ev = S.ev; if (!ev.length) return;
  R.events(S, ev);
  for (const e of ev) {
    switch (e.k) {
      case 'throw': SND.play('throw'); break;
      case 'dmg': SND.play('hit'); break;
      case 'die': SND.play('die'); break;
      case 'boom': SND.play('boom'); break;
      case 'thunder': SND.play('thunder'); break;
      case 'flash': SND.play('flash'); break;
      case 'beam': SND.play('beam'); break;
      case 'gem': SND.play('gem'); break;
      case 'lvup': SND.play('lvup'); break;
      case 'hurt': SND.play('hurt'); break;
      case 'block': SND.play('block'); break;
      case 'search': SND.play('search'); tip('翻找中…站著別走開', 1.6); break;
      case 'item': {
        SND.play('item');
        const n = S.items.filter((i) => i.got).length, idx = S.items.indexOf(e.it);
        const s = $('slots').children[idx]; if (s) { s.classList.add('got', 'pop'); }
        if (n < 3) tip(`拿到${D.ITEMS[e.it.k].name}了！（${n}/3）`);
        break;
      }
      case 'chest': SND.play('chest'); S.lastChest = true; break;
      case 'horde': if (e.label !== 'last' && e.label !== 'boss') { SND.play('horde'); tip(`一大群紅蝦怪從${e.side === 'left' ? '左' : '右'}邊來了！`, 2.4, true); } break;
      case 'exit': {
        SND.play('exit'); SND.urgent(true);
        if (!S.L.boss) { const ex = S.exit, room = D.ROOM, name = roomName(S.rooms[ex.f][Math.floor(ex.x / room.W)]); tip(`三樣都拿齊了！回 ${ex.f + 1} 樓${name}找${D.NAMES[S.L.npc] || '主管'}`, 3.6, true); }
        else if (S.L.boss.at === 'exit') tip(`${D.MONS[S.L.boss.k].name}倒了！站在撤離點撐 ${S.exit.wait} 秒`, 3.2, true);
        else tip(`${D.MONS[S.L.boss.k].name}倒了！到頂樓的撤離點`, 3.2, true);
        break;
      }
      case 'boss': SND.play('boss'); SND.music('boss'); SND.urgent(true); tip(e.at === 'exit' ? `${e.name}守在撤離點！打倒牠才能走` : `頂樓的${e.name}出現了！`, 3.2, true); break;
      case 'summon': SND.play('summon'); break;
      case 'bounce': SND.play('bounce'); break;
      case 'flute': SND.play('flute'); break;
      case 'dust': SND.play('dust'); break;
      case 'bossDown': SND.play('boom'); SND.music('song'); break;
      case 'waitStart': tip(`站在房間裡等${S.L.npc === 'zhang' ? '老闆' : '總務阿兔'}開門，撐住！`, 2.6, true); break;
      case 'heroIn': SND.play('poof'); if (!e.quiet && !S.heroSeen) { S.heroSeen = true; tip('老闆來幫忙了！等一下會變身', 2.4); } break;
      case 'heroTf': SND.play('transform'); HERO.act('zhang', 'handsup'); tip('老闆變身！打怪超人登場（20 秒）', 2.2); break;
      case 'heroBack': SND.play('poof'); tip('變回老闆，休息 20 秒再變身', 2); break;
      case 'clear': SND.play('clear'); cleared(); break;
      case 'dead': failed(); break;
    }
  }
  ev.length = 0;
}
const ROOMN = { class: '宴會廳', lab: '廚房', library: '食材倉庫', nurse: '貴賓休息室', music: '卡拉OK包廂', gym: '大舞台', office: '櫃台', hall: '走道', roof: '露台' };
const ROOMN_F = { class: '組裝區', lab: '品管室', library: '倉庫', nurse: '休息室', music: 'CNC 區', gym: '成品出貨區', hall: '走道' };
const roomName = (k) => ((S && S.L && S.L.skin ? ROOMN_F : ROOMN)[k]) || '';

// ---------- 上方資訊 ----------
let lastHud = '';
function hud() {
  const p = S.p;
  $('xpBar').style.width = Math.min(100, p.xp / p.need * 100).toFixed(1) + '%';
  const key = `${p.lv}|${Math.floor(S.t)}|${S.kills}`;
  if (key !== lastHud) { lastHud = key; $('lvN').textContent = 'Lv ' + p.lv; $('clock').textContent = fmt(S.t); $('kills').textContent = '擊倒 ' + S.kills; }
  const ex = S.exit, w = $('wait');
  const showWait = mode === 'play' && ex.open && ex.wait > 0;
  w.classList.toggle('hide', !showWait);
  if (showWait) {
    const who = S.L.npc === 'zhang' ? '老闆' : '總務阿兔';
    w.classList.toggle('out', !ex.inRoom);
    $('waitText').textContent = ex.inRoom ? `${who}開門中…撐 ${Math.ceil(ex.left)} 秒` : `回撤離點！還要撐 ${Math.ceil(ex.left)} 秒`;
    $('waitBar').style.width = ((1 - ex.left / ex.wait) * 100).toFixed(1) + '%';
  }
}

// ---------- 主迴圈 ----------
function loop(now) { requestAnimationFrame(loop); frame(now); }
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now); T += dt;
  if (!S || !HERO.isReady()) return;
  S.camDy = story ? view.h * 0.14 : 0;
  if (mode === 'op') stepOP(dt);
  else if (story) CORE.updCam(S, Math.min(1, dt * 5));
  if (mode === 'play') {
    S.input = readInput();
    acc += dt;
    let n = 0;
    while (acc >= 1 / 60 && n < 4) {
      CORE.step(S, 1 / 60); acc -= 1 / 60; n++;
      handleEvents();
      if (mode !== 'play') break;
      if (S.state === 'pick') { showCards(); break; }
    }
    if (n === 4) acc = 0;
  } else if (mode === 'dead' || mode === 'outro') {
    CORE.updCam(S, Math.min(1, dt * 4));
  }
  if (tipT > 0 && (tipT -= dt) <= 0) $('tip').classList.add('hide');
  if (mode === 'talk') {
    const line = talkQ[talkI]; if (line) {
      const prev = Math.floor(typeT); typeT += dt * 28;
      const s = line[1].slice(0, Math.floor(typeT)); if ($('talkText').textContent !== s) { $('talkText').textContent = s; if (Math.floor(typeT) > prev && line[0] !== 'bian') SND.play('talk'); }
    }
  }
  // 3D 角色動作
  const p = S.p;
  const ns = npcs();
  if (story) {
    const near = ns[0];
    HERO.update('bian', dt, T, { speed: 0, face: near ? Math.sign(near.x - p.x) || 1 : 1, front: true });
  } else {
    HERO.update('bian', dt, T, { speed: mode === 'play' ? p.moving / D.PLAYER.h : 0, face: p.face, climb: p.lad != null, hurt: p.hurtT > 0 });
  }
  const vis = ns.filter((n) => Math.abs(n.x - S.cam.x) < view.w / 2 + 120 && Math.abs(n.y - S.cam.y) < view.h / 2 + 200);
  for (const n of ns) HERO.update(n.k, dt, T, { speed: 0, face: n.face, front: true });
  const h = S.helper;
  if (h && !story) HERO.update(h.ph === 'fight' ? 'needle' : 'zhang', dt, T, { speed: h.ph === 'calm' ? h.moving / 120 : 0, face: h.face, front: h.ph !== 'calm' || h.moving < 5 });
  R.draw(S, { t: T, dt, hudBottom: $('hud').getBoundingClientRect().bottom, joy: mode === 'play' && joy.on ? toUi(joy) : null, npcs: vis, story: story || mode !== 'play' });
  if (S && !['title', 'select', 'loading', 'op', 'enter'].includes(mode)) hud();
  if (mode === 'play' && S.t - lastRunSave >= 5) saveRun();
}
const toUi = (j) => ({ bx: j.bx, by: j.by, x: j.bx + Math.max(-54, Math.min(54, j.x - j.bx)), y: j.by + Math.max(-54, Math.min(54, j.y - j.by)) });

// ---------- 開機 ----------
$('bStart').onclick = () => {
  SND.play('tap');
  const go = () => { const n = D.LEVELS.findIndex((_, i) => bestOf()[i] == null); startLevel(n < 0 ? 0 : n); };
  go();
};
$('bContinue').onclick = () => { SND.play('tap'); continueRun(); };
$('bOP').onclick = () => startOP();
$('bEnter').onclick = () => { SND.unlock(); fullscreen(); startOP(); };
$('bBack').onclick = () => { SND.play('tap'); goTitle(); };

async function boot() {
  R.init(cv); layout();
  const total = HERO.LOAD_STEPS + R.LOAD_STEPS; let done = 0;
  const tick = () => { done++; $('ldBar').style.width = Math.min(100, done / total * 100) + '%'; };
  try {
    await Promise.all([HERO.init(tick), R.loadImages(tick)]);
  } catch (e) { console.error(e); $('ldText').textContent = '載入失敗，請重新整理'; return; }
  HERO_ICON = HERO.snapshot('needle');
  // 瀏覽器要先點一下才給出聲：載入完先停在「點一下開始」，點了才播片頭＋配樂（測試 ?bot、?noop 直接到標題）
  if (BOT_ON || /[?&]noop/.test(location.search)) goTitle();
  else {
    mode = 'enter';
    $('ldText').classList.add('hide'); $('ldBar').parentNode.classList.add('hide');
    $('bEnter').classList.remove('hide'); $('ldNote').classList.remove('hide');
    S = mk(2, { seed: 7, vw: view.w, vh: view.h });
  }
  requestAnimationFrame(loop);
}
boot();

// 測試用
window.G = { get S() { return S; }, get mode() { return mode; }, start: startLevel, cards: (o) => { S.offer = o; S.state = "pick"; showCards(); },
  // 手動跑 sec 秒的畫面（預覽視窗藏起來時 requestAnimationFrame 不會跑）
  run(sec) { for (let i = 0; i < sec * 60; i++) frame(last + 1000 / 60); return mode; },
  // 量一格要畫多久（毫秒）
  prof(n = 20) { const a = performance.now(); for (let i = 0; i < n; i++) R.draw(S, { t: T, dt: 1 / 60, npcs: npcs() }); const b = performance.now(); for (let i = 0; i < n; i++) CORE.step(S, 1 / 60); S.ev.length = 0; return { draw: (b - a) / n, step: (performance.now() - b) / n }; },
  // 快轉 sec 秒（機器人玩、選第一張卡）
  ff(sec) { const end = S.t + sec; while (S.t < end && (S.state === 'play' || S.state === 'pick')) { if (S.state === 'pick') { const k = S.offer[0]; CORE.choose(S, k, CORE.needDrop(S, k) ? CORE.weapons(S)[0] : undefined); continue; } S.input = window.BOT ? window.BOT(S) : { x: 0, y: 0 }; CORE.step(S, 1 / 60); handleEvents(); } mode = S.state === 'play' ? 'play' : mode; show('hud'); return { t: S.t, mons: S.mons.length, lv: S.p.lv, hp: S.p.hp }; }, give(k, n = 1) { for (let i = 0; i < n; i++) CORE.choose(S, k); }, win() { S.items.forEach((i) => (i.got = true)); S.exit.open = true; S.exit.left = 0.1; S.p.x = S.exit.x; S.p.f = S.exit.f; S.p.y = S.exit.y; } };
