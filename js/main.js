// 主程式：畫面切換、搖桿、遊戲迴圈、上方資訊、升級卡、劇情對話、存檔
import * as HERO from './hero.js?v=119';
import * as R from './render.js?v=54';
import { runChallenge } from './challenge.js?v=122';

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
  R.setZoom(1); layout();
  S = mk(1, { seed: 7, vw: view.w, vh: view.h });   // 片頭／標題用工廠場景（第 2 關的剖面）
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
function syncGender() { save.gender = 'm'; HERO.setPlayer('m'); }   // 只保留男工人當主角
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
  R.setZoom(1); layout();
  S = mk(1, { seed: 7, vw: view.w, vh: view.h });   // 片頭／標題用工廠場景（第 2 關的剖面）
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
let carry = null;   // 上一關結束時的職業、階級、夥伴、強化，帶到下一關
function startLevel(i) {
  li = i; fullscreen(); clearRun();
  S = mk(i, { vw: view.w, vh: view.h, hard: !!save.hard });
  R.setZoom(S.flat ? 1.35 : 1); layout();   // 平面地圖放大一點
  if (i === 0) { carry = null; if (save.carry) { save.carry = null; persist(); } }   // 從第 1 關開始＝重新來過
  else { if (!carry && save.carry) carry = save.carry; CORE.applyCarry(S, carry); }   // 第 2 關起：接續上一關的職業、夥伴、強化（重新整理頁面、從選關進來也一樣）
  $('modeTag').classList.toggle('hide', !S.hard);
  acc = 0; joy.id = null; joy.on = false;
  // 槽位
  $('slots').innerHTML = S.items.map((it) => `<div class="slot"><i style="${itemPos(D.ITEMS[it.k].icon)}"></i></div>`).join('');
  SND.urgent(false);
  const st = D.STORY[S.L.story];
  story = true;
  talk(st.intro, () => { story = false; if (!S.job.id) showJobStart(); else begin(); });   // 第 1 關一開始：先替自己選一位初階角色（之後升級走同一條晉升路線）
}
// 一開始就選職業：三條路線，直接從第 1 階開始（之後 Lv5、10、15 還能晉升或轉職）
function showJobStart() {
  mode = 'pick'; joy.id = null; joy.on = false; cardsAt = performance.now();
  show('hud', 'cards');
  $('cardsTitle').innerHTML = '選擇你的角色！<small>三位初階角色任選・之後升級走同一條晉升路線・夥伴要升級後才能選</small>';
  const row = $('cardRow'); row.innerHTML = ''; row.classList.remove('four');
  Object.keys(D.JOBS).filter((id) => D.JOBS[id].ready).forEach((id, i) => {
    const J = D.JOBS[id], b = document.createElement('button'); b.className = 'card r' + (i === 0 ? 1 : i === 1 ? 2 : 3);
    b.style.setProperty('--r', ((i - 1) * 1.2) + 'deg');
    HERO.setOutfit(id, 1);
    const pic = HERO.snapshot('bian', 0.35);
    b.innerHTML = `<span class="rare">${J.short}</span><span class="ic" style="background-image:url(${pic});background-size:contain;background-position:center;width:132px;height:132px"></span><b>${J.titles[1]}</b><p>${J.desc[0]}</p>`;
    b.onclick = () => {
      if (performance.now() - cardsAt < 350) return;
      CORE.chooseStartJob(S, id); SND.play('pick'); HERO.act('bian', 'sig_bian'); tip(`你是「${J.titles[1]}」！`, 2.4, true);
      mode = 'play'; show('hud'); begin();
    };
    row.appendChild(b);
  });
  HERO.setOutfit(null, 0);
  if (BOT_ON) setTimeout(() => { cardsAt = 0; const b = $('cardRow').children[0]; b && b.click(); }, 400);
}
// 接著上次存的地方玩（不重播劇情）
function continueRun() {
  const o = loadRun(); if (!o) { startLevel(0); return; }
  fullscreen();
  li = o.li; S = CORE.restore(o, { vw: view.w, vh: view.h }); acc = 0; joy.id = null; joy.on = false;
  R.setZoom(S.flat ? 1.35 : 1); layout();
  $('modeTag').classList.toggle('hide', !S.hard);
  $('slots').innerHTML = S.items.map((it) => `<div class="slot${it.got ? ' got' : ''}"><i style="${itemPos(D.ITEMS[it.k].icon)}"></i></div>`).join('');
  story = false; SND.urgent(S.exit.open || !!S.boss);
  mode = 'play'; show('hud'); SND.music('song');
  tip(`接著上次：第 ${li + 1} 關・${S.L.name}`, 2.6);
}
function begin() {
  mode = 'play'; show('hud'); SND.music('song');
  if (S.flat && li === 0) tip('手指按住畫面拖曳，往任何方向走；撞到機台會沿著繞過去', 6);
  else tip(`找到 ${S.items.map((it) => D.ITEMS[it.k].name).join('、')}`, 4);
}

// 劇情：人物站在畫面裡，下面一格對話
// 撤離點等你的人：關卡原本指定的是總務或老闆；如果你已經帶這位當夥伴，撤離點就換成另一位，不會同時出現兩個
function exitWho() {
  const L = S.L, has = (k) => S.partners.some((x) => x.k === k);
  let list = L.npc === 'both' ? ['tu', 'zhang'] : [L.npc];
  list = list.filter((k) => !has(k));
  if (!list.length) list = [has('tu') ? 'zhang' : 'tu'];
  return list;
}
const WHO_NAME = { tu: '總務阿兔', zhang: '老闆' };
function npcs() {
  if (!S) return [];
  const L = S.L, list = L.npc === 'both' ? ['tu', 'zhang'] : [L.npc];
  const p = S.p, out = [];
  if (story) {
    const side = p.x > S.Wt - 260 ? -1 : 1;
    list.forEach((k, i) => out.push({ k, x: p.x + side * (110 + i * 95), y: p.y, h: k === 'zhang' ? 118 : 112, face: -side }));
  } else {
    const ex = S.exit, ew = exitWho();
    ew.filter((k) => !(k === 'zhang' && S.helper)).forEach((k, i) => out.push({ k, x: ex.x + 80 + i * 90, y: ex.y, h: k === 'zhang' ? 118 : 112, face: -1 }));
  }
  return out;
}
// Boss 出場／倒下時的小對話（在關卡中途，講完回到遊戲）
function bossTalk(key) {
  const st = D.STORY[S.L.story], lines = st && st[key]; if (!lines) return;
  talk(lines, () => { mode = 'play'; show('hud'); });
  show('hud', 'talk');
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
  $('cardsTitle').innerHTML = (opening ? '出發前，挑一樣帶著' : '福袋！挑一個') + `<small>武器 ${nw}/${D.MAXW}</small>`;
  S.lastChest = false;
  const row = $('cardRow'); row.innerHTML = ''; row.classList.remove('four');
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
// ---------- 職業晉升（Lv5／10／15）：用升級卡的畫面，三張卡＝繼續晉升／轉職 ----------
function showPromo() {
  mode = 'pick'; joy.id = null; joy.on = false; cardsAt = performance.now();
  show('hud', 'cards');
  const cur = S.job, J = cur.id ? D.JOBS[cur.id] : null, pt = S.partners[0];
  $('cardsTitle').innerHTML = `升到 Lv ${S.p.lv - S.promoPend + 1}！<small>一次選一個${pt ? `・夥伴：${D.PARTNERS[pt.k].name} ${'★'.repeat(pt.tier || 1)}` : '・還沒有夥伴'}</small>`;
  const row = $('cardRow'); row.innerHTML = ''; row.classList.remove('four');
  const pic = (k) => HERO.snapshot(k === 'wk' ? 'mtp' : k === 'hr' ? 'hrp' : k, 0.35);
  const card = (cls, tag, img, title, desc, onclick, i) => {
    const b = document.createElement('button'); b.className = 'card ' + cls; b.style.setProperty('--r', ((i - 1) * 1.2) + 'deg');
    b.innerHTML = `<span class="rare">${tag}</span><span class="ic" style="background-image:url(${img});background-size:contain;background-position:center;width:132px;height:132px"></span><b>${title}</b><p>${desc}</p>`;
    b.onclick = () => { if (performance.now() - cardsAt < 350) return; onclick(); };
    row.appendChild(b);
  };
  const done = (lines) => {
    SND.play('pick');
    const fin = () => {
      if (S.pending > 0 || S.chestPick > 0 || S.promoPend > 0) { CORE.step(S, 0); if (S.state === 'pick') { showCards(); return; } if (S.state === 'promo') { showPromo(); return; } }
      mode = 'play'; show('hud');
    };
    if (lines) { talk(lines, fin); show('hud', 'talk'); } else fin();
  };
  // 夥伴候選清單（增加／換）
  const pick = (kind) => {
    $('cardsTitle').innerHTML = kind === 'swap' ? `換成哪一位夥伴？<small>現在這位會離開，新夥伴從 ★ 開始</small>` : '選一位夥伴跟著你！<small>夥伴從 ★ 開始，之後可以晉升</small>';
    row.innerHTML = ''; cardsAt = performance.now(); row.classList.toggle('four', Object.keys(D.PARTNERS).filter((k) => !(pt && pt.k === k)).length >= 4);
    Object.keys(D.PARTNERS).filter((k) => !(pt && pt.k === k)).forEach((k, i) => {
      const P = D.PARTNERS[k];
      card('r' + (k === 'zhang' ? 3 : k === 'tu' ? 1 : 2), P.role, pic(k), P.name, P.desc, () => {
        const old = pt && pt.k;
        if (!CORE.choosePromo(S, kind, k)) return;
        tip(`${P.name}加入了！`, 2.4, true); done(kind === 'swap' ? D.DISCARD[old] : null);
      }, i);
    });
  };
  // 選職業（第一次晉升）：三條路線，從第 1 階開始
  const pickJob = () => {
    $('cardsTitle').innerHTML = '選擇你的職業！<small>從第 1 階開始，之後升級還能繼續晉升</small>';
    row.innerHTML = ''; cardsAt = performance.now();
    Object.keys(D.JOBS).filter((id) => D.JOBS[id].ready).forEach((id, i) => {
      const JJ = D.JOBS[id]; HERO.setOutfit(id, 1);
      card('r' + (i === 0 ? 1 : i === 1 ? 2 : 3), JJ.short, pic('bian'), JJ.titles[1], JJ.desc[0], () => { CORE.choosePromo(S, 'job', id); HERO.act('bian', 'sig_bian'); tip(`你是「${JJ.titles[1]}」！`, 2.4, true); done(); }, i);
    });
    HERO.setOutfit(null, 0);
  };
  HERO.setOutfit(cur.id, Math.min(3, cur.tier + 1));
  const offers = CORE.makePromoOffer(S);
  offers.forEach((o, i) => {
    if (o.kind === 'job') { card('r3', '晉升自己', pic('bian'), '選職業', '從機台操作員、維修員、人資三條路線挑一條', () => pickJob(), i); return; }
    if (o.kind === 'up') card('r3', '晉升自己', pic('bian'), J.titles[o.tier], J.desc[o.tier - 1], () => { CORE.choosePromo(S, 'up'); HERO.act('bian', 'sig_bian'); tip(`晉升成「${J.titles[o.tier]}」！裝備換新`, 2.6, true); done(); }, i);
    else if (o.kind === 'add') card('r2', '增加夥伴', pic('zhang'), '增加夥伴', '從老闆、總務阿兔、維修人員、人資挑一位跟著你', () => pick('add'), i);
    else if (o.kind === 'pup') card('r3', '晉升夥伴', pic(o.k), `${D.PARTNERS[o.k].name} ${'★'.repeat(o.tier)}`, `${D.PARTNERS[o.k].name}升到第 ${o.tier} 階，能力變強`, () => { CORE.choosePromo(S, 'pup'); tip(`${D.PARTNERS[o.k].name}晉升了！（${o.tier} 階）`, 2.4, true); done(); }, i);
    else if (o.kind === 'pboost') { const PN = D.PARTNERS[o.k].name, DESC = { zhang: '打怪超人撞得更痛', tu: '護士兔每針補更多血', wk: '自動砲台傷害提高', hr: '人資的各種招式更痛' }[o.k] || '夥伴能力提高'; card('r1', '夥伴升級', pic(o.k), `強化${PN}`, `${DESC}，傷害與效果 +20%（目前 ${S.pBoost || 0} 級）`, () => { CORE.choosePromo(S, 'pboost'); tip(`強化${PN}！能力再提升了`, 2.4, true); done(); }, i); }
    else if (o.kind === 'boost') card('r2', '強化自己', pic('bian'), '強化自己', `血量 +30 並補滿、攻擊 +15%、跑速 +5%（目前 ${S.selfLv || 0} 級）`, () => { CORE.choosePromo(S, 'boost'); tip('強化自己！血量、攻擊、跑速都提升了', 2.4, true); done(); }, i);
    else if (o.kind === 'swap') card('r1', '換夥伴', pic('tu'), '換夥伴', '請現在這位離開，換另一位（會留下一段話）', () => pick('swap'), i);
  });
  HERO.setOutfit(cur.id, cur.tier);
  if (BOT_ON) setTimeout(() => { cardsAt = 0; const b = $('cardRow').children[0]; b && b.click(); }, 400);
}
// 晉升後選夥伴：最多兩位，三種各管一件事
function showPartner() {
  mode = 'pick'; joy.id = null; joy.on = false; cardsAt = performance.now();
  show('hud', 'cards');
  $('cardsTitle').innerHTML = `選一位夥伴，或強化自己！<small>夥伴 ${S.partners.length}／${D.PARTNER_MAX}・強化自己 ${S.selfLv || 0} 級${S.partners.length >= D.PARTNER_MAX ? '・只能帶一位，選新夥伴會換掉現在這位' : ''}</small>`;
  const row = $('cardRow'); row.innerHTML = ''; row.classList.toggle('four', S.partnerOffer.length >= 4);
  HERO.setOutfit(S.job.id, S.job.tier);
  const pk = (k) => (k === 'self' ? 'bian' : (k.startsWith('swap:') ? k.slice(5) : k) === 'hua' ? 'bianF' : k.startsWith('swap:') ? k.slice(5) : k);
  const after = () => {
    if (S.pending > 0 || S.chestPick > 0 || S.promoPend > 0) { CORE.step(S, 0); if (S.state === 'pick') { showCards(); return; } if (S.state === 'promo') { showPromo(); return; } }
    mode = 'play'; show('hud');
  };
  S.partnerOffer.forEach((k, i) => {
    const swap = k.startsWith('swap:'), kk = swap ? k.slice(5) : k;
    const P = k === 'self' ? { name: '強化自己', role: '主角', desc: `血量 +30 並補滿、攻擊 +15%、跑速 +5%（目前 ${S.selfLv || 0} 級）` } : D.PARTNERS[kk], b = document.createElement('button'); b.className = 'card r' + (kk === 'zhang' ? 3 : k === 'self' ? 2 : 1);
    b.style.setProperty('--r', ((i - 1) * 1.2) + 'deg');
    const pic = HERO.snapshot(pk(k), 0.35);
    b.innerHTML = `<span class="rare">${swap ? '換夥伴' : P.role}</span><span class="ic" style="background-image:url(${pic});background-size:contain;background-position:center;width:132px;height:132px"></span><b>${P.name}</b><p>${P.desc}</p>`;
    b.onclick = () => {
      if (performance.now() - cardsAt < 350) return;
      if (swap) { showLeave(i, kk, after); return; }
      CORE.choosePartner(S, i); SND.play('pick'); tip(k === 'self' ? `強化自己！血量、攻擊、跑速都提升了（${S.selfLv} 級）` : `${P.name}加入了！`, 2.4, true);
      after();
    };
    row.appendChild(b);
  });
  if (BOT_ON) setTimeout(() => { cardsAt = 0; const b = $('cardRow').children[0]; b && b.click(); }, 400);
}
// 只能帶一位夥伴：選了新夥伴，現在這位就被換掉，並留下一段話
function showLeave(i, toK, after) {
  const who = S.partners[0] && S.partners[0].k;
  if (!who || !CORE.choosePartner(S, i, who)) return;
  SND.play('pick');
  const lines = D.DISCARD[who], hi = D.PARTNERS[toK].name;
  const done = () => { tip(`${hi}加入了！`, 2.4, true); after(); };
  if (lines) { talk(lines, done); show('hud', 'talk'); } else done();
}
function promoFx() { tip(`晉升成「${D.JOBS[S.job.id].titles[S.job.tier]}」！裝備換新`, 2.6, true); }
function take(k, dropK) {
  CORE.choose(S, k, dropK); SND.play('pick');
  if (S.pending > 0 || S.chestPick > 0) { CORE.step(S, 0); if (S.state === 'pick') { showCards(); return; } }
  mode = 'play'; show('hud');
}
// 武器帶滿 5 種：挑一種丟掉，或放棄這張（補 20 血）
function showDrop(k) {
  const sk = D.SKILLS[k];
  $('cardsTitle').innerHTML = `武器最多帶 ${D.MAXW} 種<small>丟掉一種換「${sk.name}」，或放棄</small>`;
  const row = $('cardRow'); row.innerHTML = ''; row.classList.remove('four');
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
  clearRun(); carry = CORE.snapshotCarry(S); save.carry = carry;   // 存起來，關掉頁面再回來也在
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
  $('rMenu').onclick = () => { SND.play('tap'); goSelect(); };
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
      case 'horde': if (e.label !== 'last' && e.label !== 'boss') { SND.play('horde'); tip(`一大群${S.L.skin === 'f' ? '螺絲怪' : '紅蝦怪'}從${e.side === 'left' ? '左' : '右'}邊來了！`, 2.4, true); } break;
      case 'exit': {
        SND.play('exit'); SND.urgent(true);
        if (!S.L.boss && S.flat) tip(`三樣都拿齊了！回撤離點（地上的圓圈）找${exitWho().map((k) => WHO_NAME[k]).join('、')}`, 3.6, true);
        else if (!S.L.boss) { const ex = S.exit, room = D.ROOM, name = roomName(S.rooms[ex.f][Math.floor(ex.x / room.W)]); tip(`三樣都拿齊了！回 ${ex.f + 1} 樓${name}找${exitWho().map((k) => WHO_NAME[k]).join('、')}`, 3.6, true); }
        else if (S.L.boss.at === 'exit' || S.L.boss.at === 'chase') tip(`${D.MONS[S.L.boss.k].name}倒了！站在撤離點撐 ${S.exit.wait} 秒`, 3.2, true);
        else tip(`${D.MONS[S.L.boss.k].name}倒了！到頂樓的撤離點`, 3.2, true);
        break;
      }
      case 'boss': SND.play('boss'); SND.music('boss' + (S.li + 1)); SND.urgent(true); bossTalk('bossIn'); tip(e.at === 'chase' ? `${e.name}現身了！打倒牠才能走` : e.at === 'exit' ? `${e.name}守在撤離點！打倒牠才能走` : `頂樓的${e.name}出現了！`, 3.2, true); break;
      case 'summon': SND.play('summon'); break;
      case 'bounce': SND.play('bounce'); break;
      case 'nurseTf': SND.play('transform'); tip('總務變身護士兔！幫你回血', 2.2); break;
      case 'nurseBack': SND.play('poof'); break;
      case 'nurseWarp': SND.play('poof'); break;
      case 'stamp': SND.play('boom'); break;
      case 'hammer': SND.play('boom'); break;
      case 'flute': SND.play('flute'); break;
      case 'dust': SND.play('dust'); break;
      case 'bossDown': SND.play('boom'); SND.music('song'); bossTalk('bossOut'); break;
      case 'armWind': SND.play('flash'); break;
      case 'wheelStop': SND.play(e.slot === 'jackpot' ? 'chest' : 'bounce'); break;
      case 'waitStart': tip(`站在房間裡等${WHO_NAME[exitWho()[0]]}開門，撐住！`, 2.6, true); break;
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
  const jb = S.job && S.job.id ? ' ' + D.JOBS[S.job.id].titles[S.job.tier] : '';
  HERO.setOutfit(S.job && S.job.id, S.job ? S.job.tier : 0);
  const key = `${p.lv}|${Math.floor(S.t)}|${S.kills}|${jb}`;
  if (key !== lastHud) { lastHud = key; $('lvN').textContent = 'Lv ' + p.lv + jb; $('clock').textContent = fmt(S.t); $('kills').textContent = '擊倒 ' + S.kills; }
  const ex = S.exit, w = $('wait');
  const showWait = mode === 'play' && ex.open && ex.wait > 0;
  w.classList.toggle('hide', !showWait);
  if (showWait) {
    const who = WHO_NAME[exitWho()[0]];
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
      if (S.state === 'promo') { showPromo(); break; }
      if (S.state === 'partner') { showPartner(); break; }
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
  if (!story && S.hrp) HERO.update('hrp', dt, T, { speed: S.hrp.moving / 120, face: S.hrp.face, front: S.hrp.moving < 5, climb: !!S.hrp.climbing, keepFront: true });
  if (!story && S.wk) HERO.update('mtp', dt, T, { speed: S.wk.moving / 120, face: S.wk.face, front: S.wk.moving < 5, climb: !!S.wk.climbing, keepFront: true });
  if (!story && S.nurse) HERO.update(S.nurse.ph === 'heal' ? 'tuN' : 'tu', dt, T, { speed: S.nurse.moving / 120, face: S.nurse.face, front: S.nurse.moving < 5, climb: !!S.nurse.climbing, keepFront: true });
  const h = S.helper;
  if (h && !story) HERO.update(h.ph === 'fight' ? 'needle' : 'zhang', dt, T, { speed: h.ph === 'calm' ? h.moving / 120 : 0, face: h.face, front: h.ph !== 'calm' || h.moving < 5, climb: !!h.climbing, keepFront: true });
  R.draw(S, { t: T, dt, hudBottom: $('hud').getBoundingClientRect().bottom, joy: mode === 'play' && joy.on ? toUi(joy) : null, npcs: vis, story: story || mode !== 'play' });
  if (S && !['title', 'select', 'loading', 'op', 'enter'].includes(mode)) hud();
  if (mode === 'play' && S.t - lastRunSave >= 5) saveRun();
}
const toUi = (j) => ({ bx: j.bx, by: j.by, x: j.bx + Math.max(-54, Math.min(54, j.x - j.bx)), y: j.by + Math.max(-54, Math.min(54, j.y - j.by)) });

// ---------- 開機 ----------
$('bStart').onclick = () => {
  SND.play('tap');
  const go = () => startLevel(0);   // 開始＝一律從第 1 關（工廠）起；中途離開的進度用「繼續」
  go();
};
$('bSelect').onclick = () => { SND.play('tap'); goSelect(); };   // 測試用：五關都可以直接選
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
    R.setZoom(1); layout();
  S = mk(1, { seed: 7, vw: view.w, vh: view.h });   // 片頭／標題用工廠場景（第 2 關的剖面）
  }
  requestAnimationFrame(loop);
}
boot();

// 測試用
window.G = { frame: (n) => frame(n), get S() { return S; }, get mode() { return mode; }, start: startLevel, cards: (o) => { S.offer = o; S.state = "pick"; showCards(); },
  // 手動跑 sec 秒的畫面（預覽視窗藏起來時 requestAnimationFrame 不會跑）
  run(sec) { for (let i = 0; i < sec * 60; i++) frame(last + 1000 / 60); return mode; },
  // 量一格要畫多久（毫秒）
  prof(n = 20) { const a = performance.now(); for (let i = 0; i < n; i++) R.draw(S, { t: T, dt: 1 / 60, npcs: npcs() }); const b = performance.now(); for (let i = 0; i < n; i++) CORE.step(S, 1 / 60); S.ev.length = 0; return { draw: (b - a) / n, step: (performance.now() - b) / n }; },
  // 快轉 sec 秒（機器人玩、選第一張卡）
  ff(sec) { const end = S.t + sec; while (S.t < end && (S.state === 'play' || S.state === 'pick')) { if (S.state === 'pick') { const k = S.offer[0]; CORE.choose(S, k, CORE.needDrop(S, k) ? CORE.weapons(S)[0] : undefined); continue; } S.input = window.BOT ? window.BOT(S) : { x: 0, y: 0 }; CORE.step(S, 1 / 60); handleEvents(); } mode = S.state === 'play' ? 'play' : mode; show('hud'); return { t: S.t, mons: S.mons.length, lv: S.p.lv, hp: S.p.hp }; }, give(k, n = 1) { for (let i = 0; i < n; i++) CORE.choose(S, k); }, win() { S.items.forEach((i) => (i.got = true)); S.exit.open = true; S.exit.left = 0.1; S.p.x = S.exit.x; S.p.f = S.exit.f; S.p.y = S.exit.y; } };
