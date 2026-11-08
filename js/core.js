// 遊戲邏輯（不碰畫面，瀏覽器與 node 共用）：校舍、小編移動爬梯、怪物成群爬上來、自動武器、升級三選一、收集與撤離
// 座標：x 往右、y 往下（px）；一樓地板 y=0，第 f 層地板 y=-f*(H+T)
(function (G) {
  const D = G.DATA;
  const { W, H, T } = D.ROOM;
  const FH = H + T;
  const floorY = (f) => -f * FH;

  // ---------- 亂數 ----------
  // 狀態放在 S.rs（存檔要存得起來）
  function mkRng(S) {
    return () => { let s = S.rs; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; S.rs = s >>> 0; return S.rs / 4294967296; };
  }

  // ---------- 建立一局 ----------
  function create(li, opt = {}) {
    const L = D.LEVELS[li];
    const F = L.rooms.length, C = L.rooms[0].split(' ').length;
    const rooms = [];   // rooms[f][c]（f 由下往上）
    for (let f = 0; f < F; f++) rooms.push(L.rooms[F - 1 - f].split(' '));
    const at = ([f, c]) => ({ f, x: c * W, y: floorY(f) });
    const S = {
      li, L, F, C, Wt: C * W, rooms, t: 0, hard: !!opt.hard, rs: ((opt.seed ?? (Date.now() & 0xffffff)) >>> 0) || 1,
      view: { w: opt.vw ?? 720, h: opt.vh ?? 1280 }, cam: { x: 0, y: 0 },
      input: { x: 0, y: 0 }, state: 'play', ev: [],
      ladders: L.ladders.map(([f, c]) => ({ f, x: c * W })),
      items: L.items.map(([k, f, c]) => ({ k, ...at([f, c]), got: false, prog: 0 })),
      chests: L.chests.map(([f, c]) => ({ ...at([f, c]), open: false })),
      exit: { ...at(L.exit), open: false, wait: L.wait, left: L.wait, inRoom: false },
      mons: [], shots: [], bombs: [], pools: [], gems: [], fx: [], beams: [], bolts: [], balls: [], tacks: [], clouds: [], rings: [], waves: [], dia: null,
      sk: { candy: 1 }, tm: {}, buddies: [], offer: null, pending: 0, chestPick: 0,
      job: { id: null, tier: 0 }, partners: [], nurse: null, hua: null, syringes: [], hz: [], zones: [], partnerOffer: null, traps: [], turrets: [], promoDone: 0, promoPend: 0, promoOffer: null, sawHit: new Map(),
      spawnAcc: 0, hordeT: L.waves.horde, kills: 0, bossSpawned: false, boss: null, nid: 1,
    };
    S.rng = mkRng(S);
    const st = at(L.start);
    S.p = { x: st.x, y: st.y, f: st.f, lad: null, face: 1, hp: D.PLAYER.hp, max: D.PLAYER.hp, lv: 1, xp: 0, need: 0,
      shield: 0, shieldT: 0, hurtT: 0, inv: 0, moving: 0, vx: 0, glowA: 0, sawA: 0 };
    S.p.need = need(S, 1);
    S.chestPick = 1 + li;   // 開場先選武器（後面的關卡多送幾張，怪也比較強）
    updCam(S, 1);
    return S;
  }

  // 升到下一級要幾顆糖（困難版比較多）
  // Boss 血量：主角職階、強化越高越厚（帶著前面關卡的強化來打，Boss 不能被秒殺）
  const bossScale = (S) => (1 + 0.45 * (S.job ? S.job.tier : 0) + 0.25 * (S.selfLv || 0)) * (S.hard ? 1.25 : 1) * (1 + 0.1 * (S.li || 0));
  const need = (S, lv) => Math.round(D.needXp(lv) * (1 + 0.2 * (S.li || 0)) * (S.hard ? D.HARD : D.EASY).xp);   // 關卡越後面，升級要的經驗越多
  // 技能目前等級的數值
  const sv = (S, k) => S.sk[k] ? D.SKILLS[k].lv[S.sk[k] - 1] : null;
  const cdMul = (S) => sv(S, 'clock')?.m ?? 1;
  const spdMul = (S) => (sv(S, 'shoe')?.m ?? 1) * (1 + 0.05 * (S.selfLv || 0));

  // ---------- 鏡頭（生怪要知道哪裡在畫面外） ----------
  function updCam(S, k) {
    const p = S.p, v = S.view, c = S.cam;
    let tx = p.x, ty = p.y - 60 + (S.camDy || 0);   // camDy：劇情時鏡頭往下移，人物在畫面上半、對話框不擋人
    const minX = v.w / 2 - 140, maxX = S.Wt - v.w / 2 + 140;
    tx = minX > maxX ? S.Wt / 2 : Math.max(minX, Math.min(maxX, tx));
    const top = floorY(S.F) - 120 - v.h * 0.2, bot = 80 + v.h * 0.2;
    const minY = top + v.h / 2, maxY = bot - v.h / 2;
    ty = minY > maxY ? (top + bot) / 2 : Math.max(minY, Math.min(maxY, ty));
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
  }
  const onScreen = (S, x, y, m = 40) => Math.abs(x - S.cam.x) < S.view.w / 2 + m && Math.abs(y - S.cam.y) < S.view.h / 2 + m;

  // ---------- 空間格子（怪物互推、武器找目標） ----------
  const CELL = 80;
  function buildGrid(S) {
    const g = new Map();
    for (const m of S.mons) {
      if (m.dead) continue;
      const key = (Math.floor((m.y + 6000) / CELL) << 10) | (Math.floor((m.x + 400) / CELL) & 1023);
      let a = g.get(key); if (!a) g.set(key, a = []); a.push(m);
    }
    S.grid = g;
  }
  function query(S, x, y, r, cb) {
    const x0 = Math.floor((x - r + 400) / CELL), x1 = Math.floor((x + r + 400) / CELL);
    const y0 = Math.floor((y - r + 6000) / CELL), y1 = Math.floor((y + r + 6000) / CELL);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const a = S.grid.get((cy << 10) | (cx & 1023)); if (!a) continue;
      for (const m of a) if (!m.dead) { const dx = m.x - x, dy = m.y - y, rr = r + m.r; if (dx * dx + dy * dy < rr * rr) cb(m); }
    }
  }
  function nearest(S, x, y, range, filt) {
    let best = null, bd = range * range;
    for (const m of S.mons) {
      if (m.dead || (filt && !filt(m))) continue;
      const dx = m.x - x, dy = m.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // 找附近怪最多的地方（隨機挑幾隻，看誰身邊最擠）
  function cluster(S, x, y, range, r) {
    const cand = []; for (const m of S.mons) if (!m.dead && Math.abs(m.x - x) < range && Math.abs(m.y - y) < range) cand.push(m);
    if (!cand.length) return null;
    let best = cand[0], bn = -1;
    for (let j = 0; j < 6; j++) { const c = cand[(S.rng() * cand.length) | 0]; let n = 0; query(S, c.x, c.y, r, () => n++); if (n > bn) { bn = n; best = c; } }
    return best;
  }

  // ---------- 小編 ----------
  const pc = (S) => S.p.y - 52;   // 身體中心
  function stepPlayer(S, dt) {
    const p = S.p, inp = S.input, P = D.PLAYER;
    const mag = Math.hypot(inp.x, inp.y);
    const jx = mag > 0.15 ? inp.x : 0, jy = mag > 0.15 ? inp.y : 0;
    const spd = P.spd * spdMul(S) * (p.slowT > 0 ? 0.4 : 1);
    if (p.slowT > 0) p.slowT -= dt;
    if (p.lad == null) {
      // 想上下樓：靠近梯子、搖桿往上或往下推
      if (Math.abs(jy) > 0.45 && Math.abs(jy) > Math.abs(jx) * 0.55) {
        const up = jy < 0;
        let best = null, bd = 46;
        S.ladders.forEach((l, i) => {
          const ok = up ? l.f === p.f : l.f === p.f - 1;
          const d = Math.abs(l.x - p.x);
          if (ok && d < bd) { bd = d; best = i; }
        });
        if (best != null) { p.lad = best; p.x = S.ladders[best].x; S.ev.push({ k: 'climb' }); }
      }
      if (p.lad == null) {
        p.vx = jx * spd;
        // 被怪擠住：前面有一坨地上的怪就走很慢（要先打開一條路）
        if (p.vx && S.grid) {
          let n = 0;
          query(S, p.x + Math.sign(p.vx) * 22, p.y - 26, 22, (m) => { if (!m.d.fly && m.stun <= 0 && Math.sign(m.x - p.x) === Math.sign(p.vx)) n++; });
          if (n) p.vx *= n >= 3 ? 0.3 : 0.55;
        }
        p.x += p.vx * dt;
        p.x = Math.max(28, Math.min(S.Wt - 28, p.x));
        p.y = floorY(p.f);
        if (Math.abs(jx) > 0.1) p.face = jx > 0 ? 1 : -1;
        p.moving = Math.abs(p.vx);
      }
    }
    if (p.lad != null) {
      const l = S.ladders[p.lad];
      p.x = l.x; p.vx = 0;
      const vy = (Math.abs(jy) > 0.2 ? Math.sign(jy) : 0) * P.climb * spdMul(S);
      p.y += vy * dt;
      p.moving = Math.abs(vy);
      if (p.y <= floorY(l.f + 1)) { p.y = floorY(l.f + 1); p.f = l.f + 1; p.lad = null; }
      else if (p.y >= floorY(l.f)) { p.y = floorY(l.f); p.f = l.f; p.lad = null; }
      // 在梯子上往左右推：爬到最近的那一端下來
      else if (Math.abs(jx) > 0.7 && Math.abs(jy) < 0.3) {
        const mid = (floorY(l.f) + floorY(l.f + 1)) / 2;
        p.y += (p.y < mid ? -1 : 1) * P.climb * dt;
      }
    }
    // 護盾充電
    const cape = sv(S, 'cape');
    if (cape && p.shield < cape.n) { p.shieldT += dt; if (p.shieldT >= cape.cd) { p.shieldT = 0; p.shield++; } }
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.inv > 0) p.inv -= dt;
  }
  // 小編現在算哪一層（怪物追的目標）
  const pFloor = (S) => {
    const p = S.p;
    if (p.lad == null) return p.f;
    const l = S.ladders[p.lad];
    return (p.y < (floorY(l.f) + floorY(l.f + 1)) / 2) ? l.f + 1 : l.f;
  };

  function hurtPlayer(S, dmg, m) {
    const p = S.p;
    if (S.state !== 'play') return;
    if (p.inv > 0) return;   // 被打到後短暫無敵：被圍住也是一下一下扣，不會瞬間死
    p.inv = 0.36;
    if (p.shield > 0) { p.shield--; p.shieldT = 0; S.ev.push({ k: 'block', x: p.x, y: pc(S) }); return; }
    p.hp -= dmg; p.hurtT = 0.25;
    S.ev.push({ k: 'hurt', x: p.x, y: pc(S), n: dmg });
    if (p.hp <= 0) { p.hp = 0; S.state = 'dead'; S.ev.push({ k: 'dead' }); }
  }

  // ---------- 怪物 ----------
  function spawn(S, k, x, y, f) {
    const d = D.MONS[k];
    const hpMul = 1 + S.t / 75 + S.li * 0.32;   // 越後面越耐打（武器也一直升級）
    const m = { id: S.nid++, k, d, x, y, f, vy: 0, vx: 0, r: d.r, hp: d.hp * (d.boss ? bossScale(S) : hpMul * (S.hard ? D.HARD : D.EASY).hp), max: 0, spd: d.spd * (0.9 + S.rng() * 0.2),
      cl: null, conn: null, connT: 0, hitCd: 0, stun: 0, slow: 0, flash: 0, face: 1, ph: S.rng() * 6.28, dead: false, age: 0 };
    m.max = m.hp;
    S.mons.push(m);
    return m;
  }
  // 找畫面外、離小編不太遠的地方生怪
  function spawnPoint(S, fly) {
    const pf = pFloor(S);
    // 六成生在同一層、剛好在畫面外（一群一群從左右衝進來）
    if (S.rng() < 0.6) {
      const side = S.rng() < 0.5 ? -1 : 1;
      for (const sd of [side, -side]) {
        const x = S.cam.x + sd * (S.view.w / 2 + 60 + S.rng() * 260);
        if (x > 30 && x < S.Wt - 30) return { x, y: floorY(pf) - (fly ? 140 + S.rng() * 160 : 30), f: pf };
      }
    }
    for (let i = 0; i < 14; i++) {
      const f = Math.max(0, Math.min(S.F - 1, pf + Math.round((S.rng() - 0.5) * 2.6)));
      const x = 30 + S.rng() * (S.Wt - 60);
      const y = floorY(f) - (fly ? 120 + S.rng() * 200 : 30);
      if (!onScreen(S, x, y, 60) && Math.abs(x - S.p.x) + Math.abs(f - pf) * 500 < 1500) return { x, y, f };
    }
    // 整棟都在畫面裡：從外牆窗戶爬進來
    const f = Math.max(0, Math.min(S.F - 1, pf + (S.rng() < 0.5 ? 0 : (S.rng() < 0.5 ? 1 : -1))));
    const side = S.rng() < 0.5 ? 1 : S.Wt - 1;
    return { x: side, y: floorY(f) - (fly ? 160 : 30), f };
  }
  function pickType(S, mix) {
    const ok = mix.filter((e) => S.t >= e[2]); let tot = 0; for (const e of ok) tot += e[1];
    let r = S.rng() * tot; for (const e of ok) { if ((r -= e[1]) <= 0) return e[0]; }
    return ok[0][0];
  }
  function stepSpawn(S, dt) {
    const w = S.L.waves;
    const alive = S.mons.length;
    const H = S.hard ? D.HARD : D.EASY;
    const rate = (w.rate + w.grow * S.t / 60) * (H ? H.spawn : 1), cap = capOf(S);
    S.spawnAcc += rate * dt;
    // 一次生一小群（同種、同一個地方）
    const pack = Math.min(6, 2 + Math.floor(S.t / 40));
    while (S.spawnAcc >= pack) {
      S.spawnAcc -= pack;
      if (alive >= cap) continue;
      const k = pickType(S, w.mix), sp = spawnPoint(S, D.MONS[k].fly);
      const n = k === 'mummy' ? Math.ceil(pack / 3) : pack;
      for (let i = 0; i < n; i++) { const m = spawn(S, k, sp.x + (S.rng() - 0.5) * 60, sp.y - i * 8, sp.f); m.stun = i * 0.12; }
    }
    // 大群：從一邊整群湧進來
    S.hordeT -= dt;
    if (S.hordeT <= 0) { S.hordeT = w.horde; horde(S, Math.round((w.hordeN + Math.floor(S.t / 60) * 4) * (H ? H.horde : 1))); }
  }
  // 同時在場上限（大群也算進去，手機才不會卡）
  const capOf = (S) => S.L.waves.cap * (S.hard ? D.HARD : D.EASY).cap;
  function horde(S, n, label) {
    n = Math.min(n, Math.max(0, Math.round(capOf(S)) - S.mons.length));
    if (!n && !label) return;
    const pf = pFloor(S);
    const side = S.p.x > S.Wt / 2 ? -1 : 1;   // 從比較遠的那邊來
    let x = side < 0 ? 20 : S.Wt - 20;
    if (Math.abs(x - S.p.x) < S.view.w / 2 + 60) x = side < 0 ? S.Wt - 20 : 20;
    for (let i = 0; i < n; i++) {
      const m = spawn(S, i % 7 === 6 && S.t > 60 ? 'mummy' : 'pumpkin', x + (side < 0 ? -1 : 1) * i * 6, floorY(pf) - 30 - (i % 4) * 30, pf);
      m.stun = i * 0.04;
    }
    S.ev.push({ k: 'horde', side: x < S.Wt / 2 ? 'left' : 'right', label });
  }

  // 第 1 關 Boss：失控機械手臂王。每隔幾秒舉起手臂預告（紅圈），重拳砸地震波傷到圈內的人；血量剩一半時叫一群毛邊怪
  function stepArmBoss(S, m, dt) {
    const a = m.ai || (m.ai = { t: 3, ph: 'idle', hold: false, sum: false }), p = S.p;
    a.t -= dt; a.hit = Math.max(0, (a.hit || 0) - dt);
    if (a.ph === 'idle' && a.t <= 0) {
      a.ph = 'wind'; a.t = 1.0; a.hold = true;
      S.fx.push({ k: 'slamWarn', x: m.x, y: m.y + m.r * 0.7, r: 300, t: 0, dur: 1.0 }); S.ev.push({ k: 'armWind' });
    } else if (a.ph === 'wind' && a.t <= 0) {
      a.ph = 'idle'; a.t = S.hard ? 3.4 : 4.4; a.hold = false; a.hit = 0.35;
      S.fx.push({ k: 'boom', x: m.x, y: m.y + m.r * 0.7, r: 300, t: 0, dur: 0.5 }); S.ev.push({ k: 'boom' });
      if (p.lad == null && pFloor(S) === m.f && Math.abs(p.x - m.x) < 300) hurtPlayer(S, S.hard ? 38 : 30, m);
    }
    if (!a.sum && m.hp < m.max * 0.5) {
      a.sum = true;
      for (let i = 0; i < 8; i++) if (S.mons.length < capOf(S) + 8) spawn(S, 'screw', m.x + (i - 3.5) * 48, m.y - 30, m.f);   // 設備壞掉掉出一堆螺絲怪
      S.ev.push({ k: 'summon', x: m.x, y: m.y });
    }
  }
  // ---------- 第 2、3、4 關 Boss ----------
  const bossMul = (m) => {
    const a = m.ai;
    if (m.d.ai === 'roll') return a.vuln ? 1.5 : 1;
    if (m.d.ai === 'pot') return a.lid ? 0.35 : 1.5;   // 鍋蓋蓋著很硬，掀開才好打
    if (m.d.ai === 'wheel') return a.slot === 'jackpot' ? 2 : a.slot === 'miss' ? 1.5 : 1;
    return 1;
  };
  function stepBoss(S, m, dt) {
    const ai = m.d.ai;
    if (ai === 'arm') { if (m.ai && m.age > 55) m.ai.rage = true; return stepArmBoss(S, m, dt); }
    const a = m.ai || (m.ai = { t: 2.5, ph: 'idle', hold: false, sum: false });
    if (m.age > 55 && !a.rage) { a.rage = true; S.ev.push({ k: 'say', x: m.x, y: m.y - m.r - 60, s: '拖太久了，我要認真了！' }); }   // 打太久：Boss 狂暴，移動變快
    const p = S.p, floorFy = floorY(m.f);
    a.t -= dt; a.hit = Math.max(0, (a.hit || 0) - dt);
    if (ai === 'lobster') {
      const rageK = a.rage ? 0.6 : 1;   // 殘血狂暴：招式間隔縮短
      if (!a.rage && m.hp < m.max * 0.2) { a.rage = true; S.ev.push({ k: 'say', x: m.x, y: m.y - m.r - 60, s: '吾要生氣了！' }); S.ev.push({ k: 'boom', x: m.x, y: m.y }); }
      // 大螯夾擊：舉螯 0.9 秒（前方出現紅圈）→ 夾下去
      if (a.ph === 'idle' && a.t <= 0) {
        a.ph = 'wind'; a.t = 0.9; a.hold = true; a.cx = m.x + m.face * 120;
        S.fx.push({ k: 'slamWarn', x: a.cx, y: m.y + m.r * 0.7, r: 240, t: 0, dur: 0.9 }); S.ev.push({ k: 'armWind' });
      } else if (a.ph === 'wind' && a.t <= 0) {
        a.ph = 'idle'; a.t = (S.hard ? 3.2 : 4.2) * rageK; a.hold = false; a.hit = 0.35;
        S.fx.push({ k: 'boom', x: a.cx, y: m.y + m.r * 0.7, r: 240, t: 0, dur: 0.5 }); S.ev.push({ k: 'boom' });
        if (p.lad == null && pFloor(S) === m.f && Math.abs(p.x - a.cx) < 240) hurtPlayer(S, S.hard ? 46 : 34, m);
      }
      // 吐泡泡：一次 3 顆朝你飛，打到會黏住你、跑變慢
      a.bub = (a.bub ?? 3) - dt;
      if (a.bub <= 0 && a.ph === 'idle') {
        a.bub = (S.hard ? 5 : 6.5) * rageK; const base = Math.atan2(pc(S) - (m.y - 20), p.x - m.x);
        for (const d of [0, -0.25, 0.25]) S.hz.push({ k: 'bubble', x: m.x, y: m.y - 20, vx: Math.cos(base + d) * 260, vy: Math.sin(base + d) * 260, life: 3.6, r: 28, dmg: 10 });
        S.ev.push({ k: 'throw' });
      }
      if (!a.sum && m.hp < m.max * 0.5) { a.sum = true; for (let i = 0; i < 6; i++) if (S.mons.length < capOf(S) + 8) spawn(S, 'pumpkin', m.x + (i - 2.5) * 55, m.y - 30, m.f); S.ev.push({ k: 'summon', x: m.x, y: m.y }); S.ev.push({ k: 'say', x: m.x, y: m.y - m.r - 60, s: '小的們，上！' }); }
    } else if (ai === 'roll') {
      if (a.ph === 'idle' && a.t <= 0) {
        if (pFloor(S) !== m.f) { a.t = 1; }
        else { a.ph = 'aim'; a.t = 0.9; a.hold = true; a.dir = Math.sign(p.x - m.x) || 1; S.fx.push({ k: 'dashWarn', x: m.x, y: m.y, dir: a.dir, t: 0, dur: 0.9 }); S.ev.push({ k: 'armWind' }); }
      } else if (a.ph === 'aim' && a.t <= 0) { a.ph = 'dash'; a.t = S.hard ? 1.8 : 1.4; a.dashV = a.dir * 640; a.dmgMul = 1.8; a.hold = false; m.face = a.dir; }
      else if (a.ph === 'dash') {
        m.vx = a.dashV;
        if (m.x <= m.r + 4 || m.x >= S.Wt - m.r - 4) { a.dashV = -a.dashV; m.x = Math.max(m.r + 6, Math.min(S.Wt - m.r - 6, m.x)); S.ev.push({ k: 'boom', x: m.x, y: m.y }); }
        if (a.t <= 0) { a.ph = 'rest'; a.t = 2.4; a.dashV = null; a.dmgMul = 1; a.hold = true; a.vuln = true; m.vx = 0; }
      } else if (a.ph === 'rest' && a.t <= 0) { a.ph = 'idle'; a.t = S.hard ? 2.2 : 3; a.hold = false; a.vuln = false; }
      if (!a.sum && m.hp < m.max * 0.5) {
        a.sum = true;
        for (let i = 0; i < 2; i++) if (S.mons.length < capOf(S) + 8) spawn(S, 'ngwheel', m.x + (i ? 80 : -80), m.y - 30, m.f);
        for (let i = 0; i < 4; i++) if (S.mons.length < capOf(S) + 8) spawn(S, 'ngdisc', m.x + (i - 1.5) * 50, m.y - 30, m.f);
        S.ev.push({ k: 'summon', x: m.x, y: m.y });
      }
    } else if (ai === 'pot') {
      // 鍋蓋蓋著 4 秒（很硬）→ 掀開 3.5 秒（好打，同時丟米糕砲彈）
      if (a.lid === undefined) a.lid = true;
      if (a.ph === 'idle') { a.lid = true; if (a.t <= 0) { a.ph = 'open'; a.t = 3.5; a.lid = false; a.hold = true; a.thrown = 0; S.ev.push({ k: 'armWind' }); } }
      else if (a.ph === 'open') {
        if ((a.thrown === 0 && a.t < 3.1) || (a.thrown === 1 && a.t < 1.8)) {
          a.thrown++; a.hit = 0.4;
          for (let i = 0; i < 3; i++) { const tx = p.x + (i - 1) * 110 + (S.rng() - 0.5) * 60; S.hz.push({ k: 'blob', x0: m.x, y0: m.y - m.r, tx: Math.max(40, Math.min(S.Wt - 40, tx)), ty: floorFy, t: 0, dur: 0.95, r: 72, dmg: S.hard ? 26 : 19 }); }
          S.ev.push({ k: 'throw' });
        }
        if (a.t <= 0) { a.ph = 'idle'; a.t = S.hard ? 3.2 : 4; a.lid = true; a.hold = false; }
      }
      if (!a.sum && m.hp < m.max * 0.5) { a.sum = true; for (let i = 0; i < 4; i++) if (S.mons.length < capOf(S) + 8) spawn(S, 'mummy', m.x + (i - 1.5) * 60, m.y - 30, m.f); S.ev.push({ k: 'summon', x: m.x, y: m.y }); }
    } else if (ai === 'wheel') {
      // 轉盤轉 4.5 秒（射抽獎球）→ 停在某一格 3 秒：銘謝惠顧＝暈、特獎＝受傷加倍、紅包＝回血
      if (a.ph === 'idle') {
        a.hold = false; a.slot = null; a.fire = (a.fire ?? 0.8) - dt;
        if (a.fire <= 0) {
          a.fire = S.hard ? 0.65 : 0.85;
          const base = Math.atan2(pc(S) - (m.y - 10), p.x - m.x);
          for (const d of [0, -0.3, 0.3]) S.hz.push({ k: 'ball', x: m.x, y: m.y - 10, vx: Math.cos(base + d) * 330, vy: Math.sin(base + d) * 330, life: 3.2, r: 22, dmg: S.hard ? 18 : 13, n: 1 + ((S.rng() * 38) | 0) });
        }
        if (a.t <= 0) {
          const r = S.rng(); a.slot = r < 0.55 ? 'miss' : r < 0.75 ? 'jackpot' : 'packet'; a.ph = 'stop'; a.t = 3; a.hold = true;
          if (a.slot === 'packet') { m.hp = Math.min(m.max, m.hp + m.max * 0.05); }
          a.hit = 0.5; S.ev.push({ k: 'wheelStop', slot: a.slot, x: m.x, y: m.y - m.r });
          if (a.slot === 'miss') m.stun = Math.max(m.stun, 2.6);
        }
      } else if (a.ph === 'stop' && a.t <= 0) { a.ph = 'idle'; a.t = S.hard ? 4 : 4.8; a.hold = false; a.slot = null; }
      if (m.hp < m.max * 0.5) {   // 半血：撒錢攻擊——每隔一陣子，天上撒下一堆錢（地上先出現紅圈，砸到會痛）
        a.rainCd = (a.rainCd ?? 1) - dt;
        if (a.rainCd <= 0 && !(a.rainLeft > 0)) { a.rainLeft = 4; a.rainCd = S.hard ? 7 : 9; a.coinT = 0; S.ev.push({ k: 'say', x: m.x, y: m.y - m.r - 60, s: '撒錢啦～' }); S.ev.push({ k: 'armWind' }); }
        if (a.rainLeft > 0) {
          a.rainLeft -= dt; a.coinT -= dt;
          if (a.coinT <= 0) {
            a.coinT = 0.32; const fy = floorY(pFloor(S));
            for (let i = 0; i < 3; i++) { const tx = Math.max(40, Math.min(S.Wt - 40, p.x + (S.rng() - 0.5) * 640)); S.hz.push({ k: 'coin', tx, ty: fy, t: 0, dur: 0.95, r: 46, dmg: S.hard ? 18 : 13 }); }
          }
        }
      }
    }
  }
  // Boss 丟出來的東西：米糕砲彈（落地爆炸＋留下燙傷區）、抽獎球（直線飛，打到人會痛）
  function stepBossHz(S, dt) {
    const p = S.p, cy = pc(S);
    for (const h of S.hz) {
      h.t = (h.t || 0) + dt;
      if (h.k === 'blob') {
        if (h.t >= h.dur && !h.done) {
          h.done = true; S.fx.push({ k: 'boom', x: h.tx, y: h.ty - 10, r: h.r * 1.6, t: 0, dur: 0.45 }); S.ev.push({ k: 'boom' });
          if (p.lad == null && Math.abs(p.x - h.tx) < h.r && Math.abs(p.y - h.ty) < 120) hurtPlayer(S, h.dmg, null);
          S.zones.push({ x: h.tx, y: h.ty, r: h.r, life: 5, dps: 7, t: 0, acc: 0 });
        }
      } else if (h.k === 'coin') {   // 撒錢：落地才傷人
        if (h.t >= h.dur && !h.done) {
          h.done = true; S.fx.push({ k: 'pop', x: h.tx, y: h.ty - 20, r: 40, t: 0, dur: 0.3 });
          if (p.lad == null && Math.abs(p.x - h.tx) < h.r && Math.abs(p.y - h.ty) < 120) hurtPlayer(S, h.dmg, null);
        }
      } else if (h.k === 'bubble') {   // 龍蝦吐的泡泡：打到會被黏住變慢
        h.x += h.vx * dt; h.y += h.vy * dt;
        if (h.t >= h.life || h.x < -40 || h.x > S.Wt + 40) h.done = true;
        else { const dx = h.x - p.x, dy = h.y - cy; if (dx * dx + dy * dy < (h.r + 20) ** 2) { hurtPlayer(S, h.dmg, null); p.slowT = 2.5; h.done = true; S.fx.push({ k: 'pop', x: h.x, y: h.y, r: 36, t: 0, dur: 0.3 }); } }
      } else if (h.k === 'ball') {
        h.x += h.vx * dt; h.y += h.vy * dt;
        if (h.t >= h.life || h.x < -40 || h.x > S.Wt + 40) h.done = true;
        else { const dx = h.x - p.x, dy = h.y - cy; if (dx * dx + dy * dy < (h.r + 20) ** 2) { hurtPlayer(S, h.dmg, null); h.done = true; S.fx.push({ k: 'pop', x: h.x, y: h.y, r: 30, t: 0, dur: 0.25 }); } }
      }
    }
    S.hz = S.hz.filter((h) => !h.done);
    for (const z of S.zones) {
      z.life -= dt; z.t += dt; z.acc += dt;
      if (z.acc >= 0.5) { z.acc = 0; if (p.lad == null && Math.abs(p.x - z.x) < z.r && Math.abs(p.y - z.y) < 80) hurtPlayer(S, z.dps / 2 + 1, null); }
    }
    S.zones = S.zones.filter((z) => z.life > 0);
  }
  function stepMons(S, dt) {
    stepBossHz(S, dt);
    const p = S.p, pf = pFloor(S), cy = pc(S);
    const g = 1500;
    const frost = sv(S, 'frost');
    for (const m of S.mons) {
      if (m.dead) continue;
      m.age += dt;
      if (m.spawnShield > 0) m.spawnShield -= dt;
      if (m.flash > 0) m.flash -= dt;
      if (m.hitCd > 0) m.hitCd -= dt;
      let slow = 1;
      if (m.slow > 0) { m.slow -= dt; slow *= 0.55; }
      if (frost) { const dx = m.x - p.x, dy = m.y - cy; if (dx * dx + dy * dy < frost.r * frost.r) { slow *= 1 - frost.slow; hurt(S, m, frost.dps * dt, 'frost', true); if (m.dead) continue; m.cold = 0.2; } }
      if (m.cold > 0) m.cold -= dt;
      if (m.stun > 0) { m.stun -= dt; slow = 0; }
      if (m.d.ai) stepBoss(S, m, dt);
      const spd = m.spd * slow * (m.ai && m.ai.hold ? 0 : 1) * (m.ai && m.ai.rage ? 1.5 : 1);
      if (m.d.summon) {   // 魔王每 6 秒叫 3 隻小弟
        m.sumT = (m.sumT ?? 3) - dt;
        if (m.sumT <= 0 && S.mons.length < capOf(S)) { m.sumT = 7; for (let i = 0; i < 3; i++) spawn(S, m.d.summon, m.x + (i - 1) * 60, m.y - 40, m.f); S.ev.push({ k: 'summon', x: m.x, y: m.y }); }
      }
      if (m.d.fly) {
        // 會飛的：直接飛向小編（蝙蝠繞來繞去、床單鬼慢慢飄）
        const tx = p.x + Math.sin(m.age * 1.7 + m.ph) * (m.k === 'bat' ? 70 : 20), ty = cy + Math.cos(m.age * 2.3 + m.ph) * (m.k === 'bat' ? 50 : 14);
        const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
        m.vx += (dx / d * spd - m.vx) * Math.min(1, dt * 3);
        m.vy += (dy / d * spd - m.vy) * Math.min(1, dt * 3);
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (Math.abs(dx) > 4) m.face = dx > 0 ? 1 : -1;
        m.f = Math.max(0, Math.min(S.F - 1, Math.floor(-(m.y + 10) / FH)));
      } else if (m.cl) {
        // 爬梯子／爬外牆
        m.x += (m.cl.x - m.x) * Math.min(1, dt * 8);
        m.y += m.cl.dir * -spd * (m.d.boss ? 1.7 : 1.1) * dt;   // Boss 爬梯子比較快，才追得上主角
        const ty = floorY(m.cl.to) - m.r, fy0 = floorY(m.f) - m.r;
        m.y = Math.max(Math.min(ty, fy0), Math.min(Math.max(ty, fy0), m.y));
        if ((m.cl.dir > 0 && m.y <= ty) || (m.cl.dir < 0 && m.y >= ty)) { m.f = m.cl.to; m.y = ty; m.vy = 0; m.cl = null; m.conn = null; }
      } else {
        let tx;
        if (m.f === pf) { tx = p.x; m.conn = null; }
        else {
          // 往小編那層走：找最近的梯子，外牆也能爬（比較遠）
          m.connT -= dt;
          if (!m.conn || m.connT <= 0) {
            const up = pf > m.f ? 1 : -1;
            let best = null, bd = Infinity;
            for (const l of S.ladders) {
              if ((up > 0 && l.f === m.f) || (up < 0 && l.f === m.f - 1)) { const d = Math.abs(l.x - m.x); if (d < bd) { bd = d; best = l.x; } }
            }
            for (const wx of [m.r + 2, S.Wt - m.r - 2]) { const d = Math.abs(wx - m.x) + 260; if (d < bd) { bd = d; best = wx; } }
            m.conn = { x: best, dir: up }; m.connT = 0.6;
          }
          tx = m.conn.x;
          if (Math.abs(m.x - tx) < 10 && m.y > floorY(m.f) - m.r - 80) { m.cl = { x: tx, dir: m.conn.dir, to: m.f + m.conn.dir }; }
        }
        const dx = tx - m.x;
        // 走到小編身邊就停下來咬（後面的會爬到前面那隻頭上，疊成一坨）
        const stopAt = m.f === pf ? m.r * 0.6 + 8 : 6;
        const want = m.ai && m.ai.dashV != null ? m.ai.dashV : (Math.abs(dx) > stopAt ? Math.sign(dx) * spd : 0);
        m.vx += (want - m.vx) * Math.min(1, dt * 6);
        m.x += m.vx * dt;
        if (Math.abs(dx) > 6) m.face = dx > 0 ? 1 : -1;
        // 前面被同伴擋住：往上爬過去
        if (want && m.vy >= 0 && S.grid) {
          let blocked = false;
          query(S, m.x + Math.sign(want) * m.r * 1.1, m.y, m.r * 0.7, (o) => { if (o !== m && !o.d.fly && !o.cl && Math.abs(o.y - m.y) < m.r * 0.8) blocked = true; });
          if (blocked && S.rng() < dt * 5) m.vy = -(260 + S.rng() * 160);
        }
        // 重力：掉回地板，被擠就疊成一坨
        m.vy += g * dt; m.y += m.vy * dt;
        const fy = floorY(m.f) - m.r;
        if (m.y > fy) { m.y = fy; m.vy = 0; }
        const ceil = floorY(m.f) - H + m.r;
        if (m.y < ceil) { m.y = ceil; m.vy = Math.max(0, m.vy); }
      }
      m.x = Math.max(m.r * 0.5, Math.min(S.Wt - m.r * 0.5, m.x));
      // 碰到小編
      const dx = m.x - p.x, dy = m.y - cy, rr = m.r + D.PLAYER.r + 14;   // 碰到的判定放寬一點
      if (m.hitCd <= 0 && m.stun <= 0 && dx * dx + dy * dy < rr * rr) { m.hitCd = 0.9; hurtPlayer(S, Math.round(m.d.dmg * ((m.ai && m.ai.dmgMul) || 1)), m); }
    }
    // 互推：疊起來的怪往上擠（重力再把牠們拉回來，就會疊成一坨一坨）
    buildGrid(S);
    for (const m of S.mons) {
      if (m.dead || m.d.boss) continue;
      query(S, m.x, m.y, m.r * 0.9, (o) => {
        if (o === m || o.id < m.id || o.d.boss) return;
        if (m.d.fly !== o.d.fly || m.cl || o.cl) return;   // 爬梯子的排成一串，不互推（會被推出天花板）
        const dx = o.x - m.x, dy = o.y - m.y, d = Math.hypot(dx, dy) || 0.01, ov = (m.r + o.r) * 0.82 - d;
        if (ov <= 0) return;
        const nx = dx / d, ny = dy / d, k = ov * 0.5;
        m.x -= nx * k; o.x += nx * k;
        if (!m.d.fly) {   // 地上的：被壓在下面的不會往下陷（地板擋著），上面那隻往上疊
          if (ny > 0) { o.y += ny * k * 0.3; m.y -= ny * k * 1.2; } else { m.y += -ny * k * 0.3; o.y -= -ny * k * 1.2; }
        } else { m.y -= ny * k; o.y += ny * k; }
      });
    }
  }

  // ---------- 傷害 ----------
  // 傷害數字：同一隻怪 0.3 秒內的傷害加總成一個數字（不然螢光棒、光束會刷成一整排）
  function hurt(S, m, dmg, src, quiet) {
    if (m.dead) return;
    if (m.spawnShield > 0) { if (!quiet) m.flash = 0.05; return; }
    dmg *= 1 + 0.15 * (S.selfLv || 0);   // 晉升時「強化自己」：所有攻擊 +15%／級
    if (m.d.boss && m.ai) dmg *= bossMul(m);
    if (m.marked > 0) dmg *= m.markMul || 1.6;   // 人資「考績評比」標記的怪：受到的傷害變多
    if (S.raiseT > 0) dmg *= S.raiseMul || 1.4;   // 人資「調薪」：全員攻擊提升   // Boss 的弱點時機：輪圈怪喘氣、大鍋掀蓋、轉盤停在特定格
    m.hp -= dmg;
    if (!quiet) m.flash = 0.08;
    m.dacc = (m.dacc || 0) + dmg;
    if (m.hp <= 0 || S.t >= (m.dnext || 0)) {
      if (m.dacc >= 1) S.ev.push({ k: 'dmg', x: m.x, y: m.y - m.r, n: Math.round(m.dacc), src, big: m.dacc >= 60 });
      m.dacc = 0; m.dnext = S.t + 0.3;
    }
    if (m.hp <= 0) kill(S, m);
  }
  function kill(S, m) {
    m.dead = true; S.kills++;
    S.ev.push({ k: 'die', x: m.x, y: m.y, t: m.k, r: m.r });
    const fy = m.d.fly ? floorY(Math.max(0, Math.min(S.F - 1, Math.floor(-(m.y - 20) / FH)))) : floorY(m.f);
    const n = m.d.xp;
    for (let i = 0; i < Math.min(n, 8); i++) S.gems.push({ x: m.x + (S.rng() - 0.5) * m.r, y: m.y, vy: -200 - S.rng() * 150, vx: (S.rng() - 0.5) * 120, fy, v: n > 8 && i === 0 ? n - 7 : 1, pull: false, big: m.d.boss });
    if (S.rng() < 0.009) S.gems.push({ x: m.x, y: m.y, vy: -250, vx: 0, fy, heart: true, pull: false });
    if (m.d.boss) { S.boss = null; S.ev.push({ k: 'bossDown', x: m.x, y: m.y }); openExit(S); }
  }

  // ---------- 武器 ----------
  function timer(S, k, cd, dt) {
    S.tm[k] = (S.tm[k] ?? cd * 0.5) - dt;
    if (S.tm[k] <= 0) { S.tm[k] += cd * cdMul(S); return true; }
    return false;
  }
  function stepWeapons(S, dt) {
    const p = S.p, cx = p.x, cy = pc(S);
    let v;
    stepHelper(S, dt);
    stepJob(S, dt);
    stepNurse(S, dt);
    stepHua(S, dt);
    // 粉筆連發：朝最近的怪丟（優先同一層）
    if ((v = sv(S, 'candy')) && timer(S, 'candy', v.cd, dt)) {
      const sameF = (m) => Math.abs(m.y - cy) < 200;
      let tg = nearest(S, cx, cy, 560, sameF) || nearest(S, cx, cy, 420);
      if (tg) {
        for (let i = 0; i < v.n; i++) {
          const a = Math.atan2(tg.y - cy, tg.x - cx) + (i - (v.n - 1) / 2) * 0.13;
          S.shots.push({ k: 'candy', x: cx + p.face * 10, y: cy - 6, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, life: 0.85, dmg: v.dmg, pierce: v.pierce, hit: new Set(), rot: S.rng() * 6 });
        }
        S.ev.push({ k: 'throw' });
      }
    }
    // 螢光棒：從身體往外放射、一直轉（影片裡的光劍）
    if ((v = sv(S, 'glow'))) {
      p.glowA += v.spd * dt;
      S.glowHit = S.glowHit || new Map();
      for (let i = 0; i < v.n; i++) {
        const a = p.glowA + i * Math.PI * 2 / v.n, ca = Math.cos(a), sa = Math.sin(a);
        for (let s = 40; s <= v.len; s += 30) {
          query(S, cx + ca * s, cy + sa * s, 12, (m) => {
            const last = S.glowHit.get(m.id) ?? -9;
            if (S.t - last < 0.32) return;
            S.glowHit.set(m.id, S.t); hurt(S, m, v.dmg, 'glow');
          });
        }
      }
      if (S.glowHit.size > 600) S.glowHit.clear();
    }
    // 南瓜炸彈：丟到怪最多的地方
    if ((v = sv(S, 'bomb')) && timer(S, 'bomb', v.cd, dt)) {
      for (let i = 0; i < v.n; i++) {
        const cand = []; for (const m of S.mons) if (!m.dead && Math.abs(m.x - cx) < 520 && Math.abs(m.y - cy) < 560) cand.push(m);
        if (!cand.length) break;
        let best = cand[0], bn = -1;
        for (let j = 0; j < 6; j++) { const c = cand[(S.rng() * cand.length) | 0]; let n = 0; query(S, c.x, c.y, v.r, () => n++); if (n > bn) { bn = n; best = c; } }
        S.bombs.push({ x0: cx, y0: cy - 20, x: best.x, y: best.y, t: 0, dur: 0.55 + i * 0.08, dmg: v.dmg, r: v.r });
      }
    }
    // 自拍閃光
    if ((v = sv(S, 'flash')) && timer(S, 'flash', v.cd, dt)) {
      let n = 0;
      query(S, cx, cy, v.r, (m) => { hurt(S, m, v.dmg, 'flash'); m.stun = Math.max(m.stun, v.stun); const dx = m.x - cx; m.x += Math.sign(dx) * 30; n++; });
      S.fx.push({ k: 'flash', x: cx, y: cy, r: v.r, t: 0, dur: 0.45 });
      S.ev.push({ k: 'flash' });
    }
    // 手電筒：一道強光往怪多的方向掃過去
    if ((v = sv(S, 'beam')) && timer(S, 'beam', v.cd, dt)) {
      const tg = nearest(S, cx, cy, 700);
      if (tg) {
        const a0 = Math.atan2(tg.y - cy, tg.x - cx);
        for (let i = 0; i < v.n; i++) {
          const a = a0 + (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI * 2 / Math.max(v.n, 3)));
          S.beams.push({ a: a - 0.35, da: 0.7 / v.dur, t: 0, dur: v.dur, len: v.len, w: v.w, dps: v.dps });
        }
        S.ev.push({ k: 'beam' });
      }
    }
    for (const b of S.beams) {
      b.t += dt; b.a += b.da * dt;
      const ca = Math.cos(b.a), sa = Math.sin(b.a);
      const seen = new Set();
      for (let s = 30; s <= b.len; s += b.w) query(S, cx + ca * s, cy + sa * s, b.w / 2, (m) => { if (!seen.has(m)) { seen.add(m); hurt(S, m, b.dps * dt, 'beam', true); m.burn = 0.15; } });
    }
    S.beams = S.beams.filter((b) => b.t < b.dur);
    // 圓桌轉盤：玩家在手上拿著轉盤，冷卻好就拋到怪最多的地方，落地狂轉把旁邊的怪捲進來，再拉回手上
    if ((v = sv(S, 'buddy'))) {
      const hx = cx + p.face * 18, hy = cy - 4;
      let d = S.dia || (S.dia = { st: 'hold', x: hx, y: hy, t: 0, cd: 0.6, spin: 0 });
      d.spin += dt * (d.st === 'spin' ? 40 : 18); d.t += dt;
      if (d.st === 'hold') {
        d.x = hx; d.y = hy + Math.sin(S.t * 6) * 6;
        d.cd -= dt;
        if (d.cd <= 0) {
          const c = cluster(S, cx, cy, 480, v.r);
          if (c) { d.st = 'out'; d.t = 0; d.x0 = d.x; d.y0 = d.y; d.tx = c.x; d.ty = c.d.fly ? c.y : floorY(c.f) - 26; } else d.cd = 0.4;
        }
      } else if (d.st === 'out') {
        const k = Math.min(1, d.t / 0.45);
        d.x = d.x0 + (d.tx - d.x0) * k; d.y = d.y0 + (d.ty - d.y0) * k - Math.sin(k * Math.PI) * 140;
        if (k >= 1) { d.st = 'spin'; d.t = 0; d.hitT = 0; }
      } else if (d.st === 'spin') {
        d.hitT -= dt;
        if (d.hitT <= 0) {
          d.hitT = 0.2;
          query(S, d.x, d.y, v.r, (m) => { hurt(S, m, v.dmg, 'buddy'); if (!m.d.boss) { m.x += (d.x - m.x) * 0.18; if (m.d.fly) m.y += (d.y - m.y) * 0.18; } });
        }
        if (d.t >= v.spin) { d.st = 'back'; d.t = 0; d.x0 = d.x; d.y0 = d.y; }
      } else {
        const k = Math.min(1, d.t / 0.35);
        d.x = d.x0 + (hx - d.x0) * k; d.y = d.y0 + (hy - d.y0) * k - Math.sin(k * Math.PI) * 60;
        if (k >= 1) { d.st = 'hold'; d.cd = v.cd * cdMul(S); }
      }
    } else S.dia = null;
    // 籃球：在怪跟怪之間彈來彈去
    if ((v = sv(S, 'ball')) && timer(S, 'ball', v.cd, dt)) {
      const tg = nearest(S, cx, cy, 520);
      if (tg) S.balls.push({ x: cx, y: cy - 20, tg, left: v.bounce, dmg: v.dmg, hit: new Set(), rot: 0, life: 4 });
    }
    for (const b of S.balls) {
      b.life -= dt; b.rot += dt * 10;
      if (!b.tg || b.tg.dead) { b.tg = nearest(S, b.x, b.y, 360, (m) => !b.hit.has(m.id)); if (!b.tg) { b.life = Math.min(b.life, 0.3); b.y += 400 * dt; continue; } }
      const dx = b.tg.x - b.x, dy = b.tg.y - b.y, dd = Math.hypot(dx, dy) || 1, step = 950 * dt;
      if (dd <= step + b.tg.r) {
        hurt(S, b.tg, b.dmg, 'ball'); b.hit.add(b.tg.id); S.ev.push({ k: 'bounce' });
        b.x = b.tg.x; b.y = b.tg.y;
        if (--b.left <= 0) { b.life = 0; S.fx.push({ k: 'pop', x: b.x, y: b.y, r: 40, t: 0, dur: 0.25 }); }
        else b.tg = nearest(S, b.x, b.y, 360, (m) => !b.hit.has(m.id));
      } else { b.x += dx / dd * step; b.y += dy / dd * step - Math.sin(b.life * 9) * 2; }
    }
    S.balls = S.balls.filter((b) => b.life > 0);
    // 直笛：前面（升級後前後）一整片音波，把怪震退
    if ((v = sv(S, 'flute')) && timer(S, 'flute', v.cd, dt)) {
      for (const dir of v.both ? [p.face, -p.face] : [p.face]) {
        for (const m of S.mons) {
          if (m.dead) continue;
          const dx = (m.x - cx) * dir;
          if (dx > -10 && dx < v.len && Math.abs(m.y - cy) < 80 + dx * 0.15) { hurt(S, m, v.dmg, 'flute'); if (!m.d.boss) { m.x += dir * 45; m.stun = Math.max(m.stun, 0.2); } }
        }
        S.waves.push({ x: cx, y: cy, dir, len: v.len, t: 0, dur: 0.5 });
      }
      S.ev.push({ k: 'flute' });
    }
    S.waves.forEach((w) => (w.t += dt)); S.waves = S.waves.filter((w) => w.t < w.dur);
    // 圖釘：撒在地上，踩到的地上怪每 0.5 秒痛一下
    if ((v = sv(S, 'tack')) && timer(S, 'tack', v.cd, dt)) {
      for (let i = 0; i < v.n; i++) S.tacks.push({ x: Math.max(20, Math.min(S.Wt - 20, p.x + (S.rng() - 0.5) * 260)), y: floorY(p.f), f: p.f, t: 0, dur: v.dur, dmg: v.dmg, cd: 0, rot: S.rng() * 6 });
      if (S.tacks.length > 60) S.tacks.splice(0, S.tacks.length - 60);
    }
    for (const tk of S.tacks) {
      tk.t += dt; tk.cd -= dt;
      if (tk.cd > 0) continue;
      let hit = false;
      query(S, tk.x, tk.y - 20, 18, (m) => { if (!m.d.fly && !m.cl && m.f === tk.f) { hurt(S, m, tk.dmg, 'tack'); hit = true; } });
      if (hit) tk.cd = 0.5;
    }
    S.tacks = S.tacks.filter((tk) => tk.t < tk.dur);
    // 板擦：丟出去拍出一團粉筆灰
    if ((v = sv(S, 'eraser')) && timer(S, 'eraser', v.cd, dt)) {
      const c = cluster(S, cx, cy, 480, v.r);
      if (c) S.bombs.push({ type: 'eraser', x0: cx, y0: cy - 20, x: c.x, y: c.y, t: 0, dur: 0.45, r: v.r, dps: v.dps, cdur: v.dur });
    }
    for (const cl of S.clouds) {
      cl.t += dt;
      query(S, cl.x, cl.y, cl.r, (m) => { hurt(S, m, cl.dps * dt, 'eraser', true); m.slow = Math.max(m.slow, 0.2); m.dusty = 0.2; });
    }
    S.clouds = S.clouds.filter((cl) => cl.t < cl.dur);
    // 呼拉圈：一圈從腰上擴散出去，碰到的怪被推開
    if ((v = sv(S, 'hoop')) && timer(S, 'hoop', v.cd, dt)) S.rings.push({ r: 40, max: v.r, t: 0, dur: 0.7, dmg: v.dmg, hit: new Set() });
    for (const rg of S.rings) {
      rg.t += dt; rg.r = 40 + (rg.max - 40) * Math.min(1, rg.t / rg.dur);
      query(S, cx, cy, rg.r + 20, (m) => {
        if (rg.hit.has(m.id)) return;
        const dd = Math.hypot(m.x - cx, m.y - cy);
        if (dd > rg.r - 30) { rg.hit.add(m.id); hurt(S, m, rg.dmg, 'hoop'); if (!m.d.boss) m.x += Math.sign(m.x - cx || 1) * 50; }
      });
    }
    S.rings = S.rings.filter((rg) => rg.t < rg.dur);
    // 打雷：隨機劈畫面裡的怪
    if ((v = sv(S, 'thunder')) && timer(S, 'thunder', v.cd, dt)) {
      const vis = S.mons.filter((m) => !m.dead && onScreen(S, m.x, m.y, -30));
      for (let i = 0; i < v.n && vis.length; i++) {
        const m = vis.splice((S.rng() * vis.length) | 0, 1)[0];
        query(S, m.x, m.y, v.r, (o) => hurt(S, o, v.dmg, 'thunder'));
        S.bolts.push({ x: m.x, y: m.y, t: 0, dur: 0.35, seed: S.rng() * 1000 });
      }
      if (S.bolts.length) S.ev.push({ k: 'thunder' });
    }
    S.bolts.forEach((b) => (b.t += dt)); S.bolts = S.bolts.filter((b) => b.t < b.dur);
    // 巫婆湯：走過的地方留一灘
    if ((v = sv(S, 'brew')) && timer(S, 'brew', v.cd, dt)) {
      S.pools.push({ x: p.x + (S.rng() - 0.5) * 40, y: p.y, r: v.r, t: 0, dur: v.dur, dps: v.dps, slow: v.slow });
    }
    for (const pl of S.pools) {
      pl.t += dt;
      query(S, pl.x, pl.y - 30, pl.r, (m) => { if (Math.abs(m.y + m.r - pl.y) < 70 || m.d.fly) { hurt(S, m, pl.dps * dt, 'brew', true); m.slow = Math.max(m.slow, 0.2); } });
    }
    S.pools = S.pools.filter((pl) => pl.t < pl.dur);
    // 飛行物
    for (const s of S.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (s.rot != null) s.rot += dt * 12;
      if (s.life <= 0) continue;
      query(S, s.x, s.y, 8, (m) => {
        if (s.life <= 0 || s.hit.has(m.id)) return;
        s.hit.add(m.id); hurt(S, m, s.dmg, s.k);
        m.x += Math.sign(s.vx) * 4;
        if (s.pierce-- <= 0) s.life = 0;
      });
    }
    S.shots = S.shots.filter((s) => s.life > 0);
    for (const b of S.bombs) {
      b.t += dt;
      if (b.t >= b.dur && !b.done) {
        b.done = true;
        if (b.type === 'eraser') { S.clouds.push({ x: b.x, y: b.y, r: b.r, t: 0, dur: b.cdur, dps: b.dps }); S.ev.push({ k: 'dust' }); continue; }
        query(S, b.x, b.y, b.r, (m) => { hurt(S, m, b.dmg, 'bomb'); m.vy = -300; });
        S.fx.push({ k: 'boom', x: b.x, y: b.y, r: b.r, t: 0, dur: 0.5 });
        S.ev.push({ k: 'boom', x: b.x, y: b.y });
      }
    }
    S.bombs = S.bombs.filter((b) => !b.done);
    S.fx.forEach((f) => (f.t += dt)); S.fx = S.fx.filter((f) => f.t < f.dur);
  }

  // ---------- 打怪超人：校長先走出來，變身打 20 秒，變回校長休息 20 秒，一直輪流 ----------
  const HELP = { first: 2, calm: 20, fight: 20, tf: 0.9, back: 0.6 };
  function stepHelper(S, dt) {
    const v = sv(S, 'hero'); if (!v) return;
    const p = S.p, pf = pFloor(S);
    let h = S.helper;
    if (!h) {
      const side = p.x > S.Wt - 200 ? -1 : p.x < 200 ? 1 : -p.face || 1;
      h = S.helper = { ph: 'calm', t: 0, left: HELP.first, x: p.x + side * 110, y: p.y, f: p.f, face: -side, hitT: 0, vx: 0, vy: 0, moving: 0 };
      S.ev.push({ k: 'heroIn', x: h.x, y: h.y });
      return;
    }
    h.t += dt;
    if (h.ph === 'calm') {
      // 校長：跟在小編旁邊走；小編換樓層就從樓梯「咻」一下跟上
      h.left -= dt;
      if (followLadder(S, h, dt)) { h.moving = 0; return; }
      if (h.f !== pf && p.lad == null) { h.lost = (h.lost || 0) + dt; if (h.lost > 0.4) { h.lost = 0; h.f = p.f; h.x = p.x - p.face * 90; S.ev.push({ k: 'heroIn', x: h.x, y: floorY(h.f) }); } }
      h.y = floorY(h.f);
      const tx = Math.max(30, Math.min(S.Wt - 30, p.x - p.face * 90)), dx = tx - h.x;
      if (Math.abs(dx) > 650) h.x = tx;
      const st = Math.abs(dx) > 40 ? Math.sign(dx) * Math.min(460, Math.max(170, Math.abs(dx) * 3)) : 0;
      h.x += st * dt; h.moving = Math.abs(st);
      h.face = Math.abs(dx) > 40 ? Math.sign(dx) : (p.x > h.x ? 1 : -1);
      if (h.left <= 0) { h.ph = 'tf'; h.t = 0; S.ev.push({ k: 'heroTf', x: h.x, y: h.y - 60 }); }
    } else if (h.ph === 'tf') {
      if (h.t >= HELP.tf) { h.ph = 'fight'; h.t = 0; h.left = HELP.fight; h.vx = h.vy = 0; }
    } else if (h.ph === 'fight') {
      h.left -= dt;
      // 飛向小編附近的怪（穿樓板）
      h.retT = (h.retT || 0) - dt;
      if (!h.tg || h.tg.dead || h.retT <= 0) { h.tg = nearest(S, p.x, pc(S), 700) || null; h.retT = 0.8; }
      const tx = h.tg ? h.tg.x : p.x + 80 * p.face, ty = h.tg ? h.tg.y + 50 : p.y - 130;
      const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
      h.vx += (dx / d * v.spd - h.vx) * Math.min(1, dt * 5); h.vy += (dy / d * v.spd - h.vy) * Math.min(1, dt * 5);
      h.x = Math.max(30, Math.min(S.Wt - 30, h.x + h.vx * dt)); h.y += h.vy * dt;
      h.moving = Math.hypot(h.vx, h.vy);
      if (Math.abs(h.vx) > 30) h.face = h.vx > 0 ? 1 : -1;
      h.hitT -= dt;
      if (h.hitT <= 0) { h.hitT = 0.25; query(S, h.x, h.y - 55, v.r, (m) => { hurt(S, m, v.dmg, 'hero'); m.x += Math.sign(m.x - h.x) * 14; }); }
      if (h.left <= 0) {   // 變回校長：落在小編旁邊
        h.ph = 'back'; h.t = 0; h.ouch = true; h.f = pf; h.x = Math.max(30, Math.min(S.Wt - 30, p.x - p.face * 90)); h.y = floorY(h.f);
        S.ev.push({ k: 'heroBack', x: h.x, y: h.y - 60 });
      }
    } else if (h.ph === 'back') {
      if (h.t >= HELP.back) { h.ph = 'calm'; h.t = 0; h.left = HELP.calm; }
    }
  }

  // ---------- 撿東西 ----------
  function stepPickups(S, dt) {
    const p = S.p, cx = p.x, cy = pc(S);
    const mag = D.PLAYER.magnet;
    for (const g of S.gems) {
      if (g.pull) {
        const dx = cx - g.x, dy = cy - g.y, d = Math.hypot(dx, dy) || 1;
        g.sp = (g.sp || 300) + dt * 1600;
        g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt;
        if (d < 26) {
          g.got = true;
          if (g.heart) { p.hp = Math.min(p.max, p.hp + 20); S.ev.push({ k: 'heal', x: cx, y: cy, n: 20 }); }
          else { gainXp(S, g.v); S.ev.push({ k: 'gem' }); }
        }
      } else {
        // 掉出來彈一下，然後自己飛向小編
        g.vy += 1400 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 0.96;
        if (g.y > g.fy - 8) { g.y = g.fy - 8; g.vy = 0; g.vx = 0; }
        const dx = cx - g.x, dy = cy - g.y;
        if (dx * dx + dy * dy < mag * mag) g.pull = true;   // 走到附近才吸得到
      }
    }
    S.gems = S.gems.filter((g) => !g.got);
    if (S.gems.length > 500) S.gems.splice(0, S.gems.length - 500);
    // 任務物品
    for (const it of S.items) {
      if (it.got) continue;
      // 站在旁邊翻找 2 秒才拿得到
      if (Math.abs(it.x - p.x) < D.PLAYER.pick && Math.abs(it.y - 30 - cy) < 90) {
        if (it.prog === 0) S.ev.push({ k: 'search', it });
        it.prog += dt;
        if (it.prog >= D.PLAYER.search) {
          it.got = true; S.ev.push({ k: 'item', it });
          if (S.items.every((i) => i.got)) allItems(S);
        }
      } else it.prog = Math.max(0, it.prog - dt * 0.5);
    }
    for (const c of S.chests) {
      if (c.open) continue;
      if (Math.abs(c.x - p.x) < D.PLAYER.pick && Math.abs(c.y - 30 - cy) < 90) { c.open = true; S.chestPick++; S.ev.push({ k: 'chest', c }); }
    }
    // 撤離：走進撤離點那間教室，撐完倒數（老師開門）
    const ex = S.exit;
    ex.inRoom = p.lad == null && p.f === ex.f && Math.floor(p.x / W) === Math.floor(ex.x / W);
    if (ex.open && ex.inRoom) {
      if (ex.left === ex.wait && ex.wait > 0) S.ev.push({ k: 'waitStart' });
      ex.left -= dt;
      if (ex.left <= 0) { ex.left = 0; S.state = 'clear'; S.ev.push({ k: 'clear' }); }
    }
  }
  function allItems(S) {
    const B = S.L.boss;
    if (B) {
      // 魔王：頂樓（南瓜大王）或守在撤離點（床單鬼王），打倒才能撤離
      const d = D.MONS[B.k];
      let f, x, y;
      if (B.at === 'chase') { f = pFloor(S); x = S.p.x < S.Wt / 2 ? Math.min(S.Wt - 120, S.p.x + 330) : Math.max(120, S.p.x - 330); y = floorY(f) - d.r; }   // 拿齊寶物後，Boss 出現在主角所在的這層樓（面對面對話），之後一路追著主角，直到被打倒
      else if (B.at === 'exit') { f = S.exit.f; x = S.exit.x; y = floorY(f) - 170; }
      else { f = S.F - 1; x = S.p.f === f ? (S.p.x < S.Wt / 2 ? S.Wt - 120 : 120) : S.Wt / 2; y = floorY(f) - d.r; }
      S.boss = spawn(S, B.k, x, y, f); S.boss.spawnShield = 3.5; S.boss.face = S.p.x >= S.boss.x ? 1 : -1;   // 登場後 3.5 秒無敵，讓玩家看到 Boss 現身
      S.ev.push({ k: 'boss', name: d.name, at: B.at });
      horde(S, B.at === 'exit' || B.at === 'chase' ? 12 : 30, 'boss');
    } else {
      openExit(S);
      horde(S, Math.round((S.L.waves.hordeN + 10) * (S.hard ? D.HARD : D.EASY).horde), 'last');
    }
  }
  function openExit(S) { S.exit.open = true; S.ev.push({ k: 'exit' }); }

  function gainXp(S, n) {
    const p = S.p;
    p.xp += n * (sv(S, 'magnet')?.m ?? 1);
    while (p.xp >= p.need) { p.xp -= p.need; p.lv++; p.need = need(S, p.lv); S.pending++; S.ev.push({ k: 'lvup' }); }
    while (S.promoDone < D.PROMO_LV.length && p.lv >= D.PROMO_LV[S.promoDone]) { S.promoDone++; S.promoPend++; }   // Lv5／10／15 各一次晉升
  }

  // ---------- 升級三選一 ----------
  // 稀有度越高越少出現；武器帶滿 5 種時新武器還是會出現，但要丟掉一種才能拿（或放棄）
  const hasBoss = (S) => S.partners.some((x) => x.k === 'zhang');
  const weapons = (S) => Object.keys(S.sk).filter((k) => D.SKILLS[k].kind === 'w' && !(k === 'hero' && hasBoss(S)));
  const isFull = (S) => weapons(S).length >= D.MAXW;
  function makeOffer(S) {
    const keys = Object.keys(D.SKILLS).filter((k) => (S.sk[k] || 0) < D.MAXLV && k !== 'hero');   // 打怪超人只由「晉升時選老闆夥伴」取得，不再出現在一般升級卡
    const full = isFull(S);
    const pool = keys.map((k) => {
      const sk = D.SKILLS[k], own = !!S.sk[k];
      let w = (own ? 1.6 : 1) * (sk.kind === 'w' ? 1.15 : 0.85) * (sk.rare ? D.RARE[sk.rare].w : 1);
      if (k === 'bento' && S.p.hp < S.p.max * 0.5) w *= 2.5;
      if (full && sk.kind === 'w' && !own) w *= 0.45;   // 帶滿了：新武器少出現一點
      return { k, w };
    });
    const out = [];
    while (out.length < 3 && pool.length) {
      let tot = 0; for (const e of pool) tot += e.w;
      let r = S.rng() * tot, i = 0;
      for (; i < pool.length - 1; i++) if ((r -= pool[i].w) <= 0) break;
      out.push(pool.splice(i, 1)[0].k);
    }
    if (!out.length) out.push('heal');
    return out;
  }
  // 拿這張卡要不要先丟一種武器
  const needDrop = (S, k) => k !== 'heal' && k !== 'skip' && D.SKILLS[k].kind === 'w' && !S.sk[k] && isFull(S);
  // 丟掉一種武器（連它的狀態一起清掉）
  function drop(S, k) {
    delete S.sk[k]; delete S.tm[k];
    if (k === 'buddy') S.dia = null;
    if (k === 'hero') S.helper = null;
    if (k === 'glow') S.glowHit = null;
    if (k === 'ball') S.balls = [];
    S.ev.push({ k: 'drop', s: k });
  }
  function choose(S, k, dropK) {
    if (k === 'heal') S.p.hp = S.p.max;
    else if (k === 'skip') S.p.hp = Math.min(S.p.max, S.p.hp + 20);   // 放棄：補一點血
    else {
      if (needDrop(S, k)) { if (!dropK || !S.sk[dropK]) return false; drop(S, dropK); }
      S.sk[k] = (S.sk[k] || 0) + 1;
      if (k === 'bento') { const add = S.sk[k] === 5 ? 30 : 25; S.p.max += add; S.p.hp = S.p.max; }
      if (k === 'cape') S.p.shield = sv(S, 'cape').n;
    }
    S.offer = null; S.state = 'play';
    S.ev.push({ k: 'pick', s: k });
    return true;
  }

  // ---------- 職業晉升 ----------
  // 選項：繼續晉升（同職業升一階）、轉職（新職業的階級＝目前階級－1，最低 1 階）；第一次沒有職業，直接選
  function makePromoOffer(S) {
    const cur = S.job, out = [];
    if (cur.id && cur.tier < 3) out.push({ job: cur.id, tier: cur.tier + 1, kind: 'up' });
    else if (cur.id) out.push({ job: cur.id, tier: 3, kind: 'max' });   // 已經最高階：維持並補血
    for (const id of Object.keys(D.JOBS)) {
      if (id === cur.id) continue;
      out.push({ job: id, tier: cur.id ? Math.max(1, cur.tier - 1) : 1, kind: cur.id ? 'switch' : 'pick', ready: D.JOBS[id].ready });
    }
    for (const o of out) if (o.ready === undefined) o.ready = D.JOBS[o.job].ready;
    return out;
  }
  function choosePromo(S, i) {
    const o = S.promoOffer && S.promoOffer[i]; if (!o || !o.ready) return false;
    S.job = { id: o.job, tier: o.tier };
    if (S.partners.some((x) => x.k === 'zhang')) S.sk.hero = Math.min(D.MAXLV, 1 + o.tier);
    S.p.max += 20; S.p.hp = S.p.max;   // 晉升加血量上限並補滿
    const idx = S.promoDone - S.promoPend;   // 這是第幾次晉升（0、1、2）
    S.promoPend--; S.promoOffer = null; S.state = 'play'; S.sawHit.clear(); S.traps = []; S.turrets = []; S.turretT = undefined; S.raiseT = 0;
    // 每次晉升都可以選：還沒帶的夥伴，或是「強化自己」
    S.partnerOffer = buildPartnerOffer(S); S.state = 'partner'; S.ev.push({ k: 'partnerPick' });
    S.ev.push({ k: 'promoted', job: o.job, tier: o.tier });
    return true;
  }
  // 夥伴離開時清掉牠的狀態
  function dropPartner(S, who) {
    S.partners = S.partners.filter((x) => x.k !== who);
    if (who === 'zhang') { delete S.sk.hero; delete S.tm.hero; S.helper = null; }
    if (who === 'tu') S.nurse = null;
    if (who === 'hua') S.hua = null;
  }
  // 夥伴／強化自己的選項：還沒帶的夥伴（已有夥伴就是「換」）＋強化自己
  function buildPartnerOffer(S) {
    const full = S.partners.length >= D.PARTNER_MAX;
    return [...Object.keys(D.PARTNERS).filter((k) => !S.partners.some((x) => x.k === k)).map((k) => (full ? 'swap:' + k : k)), 'self'];
  }
  // 一開始就選職業（不用等到 Lv5 才有職業）：直接從第 1 階開始
  function chooseStartJob(S, id) {
    const J = D.JOBS[id]; if (!J || !J.ready) return false;
    S.job = { id, tier: 1 }; S.p.max += 20; S.p.hp = S.p.max; S.ev.push({ k: 'promoted', job: id, tier: 1 });
    return true;
  }
  function choosePartner(S, i, dropK) {
    let k = S.partnerOffer && S.partnerOffer[i]; if (!k) return false;
    if (k.startsWith('swap:')) { k = k.slice(5); if (!dropK || !S.partners.some((x) => x.k === dropK)) return false; dropPartner(S, dropK); S.ev.push({ k: 'partnerLeave', who: dropK, to: k }); }
    if (k === 'self') { S.selfLv = (S.selfLv || 0) + 1; S.p.max += 30; S.p.hp = S.p.max; S.partnerOffer = null; S.offer = null; S.state = 'play'; S.ev.push({ k: 'selfUp', n: S.selfLv }); return true; }
    S.partners.push({ k });
    if (k === 'zhang') S.sk.hero = Math.min(D.MAXLV, Math.max(S.sk.hero || 0, 1 + (S.job.tier || 1)));   // 老闆夥伴＝打怪超人，不佔武器欄，隨職階加強
    S.partnerOffer = null; S.offer = null; S.state = 'play'; S.ev.push({ k: 'partnerJoin', who: k });
    return true;
  }
  // 主角在梯子上：夥伴也爬上／爬下梯子，跟在主角下方；回傳 true 表示正在爬
  function followLadder(S, h, dt) {
    const p = S.p;
    if (p.lad == null) { h.climbing = false; return false; }
    const l = S.ladders[p.lad], lo = floorY(l.f), hi = floorY(l.f + 1);
    h.climbing = true; h.moving = 0; h.f = p.y < (lo + hi) / 2 ? l.f + 1 : l.f;
    h.x += (l.x + 30 - h.x) * Math.min(1, dt * 10);
    const ty = Math.max(hi, Math.min(lo, p.y + 85));
    h.y += (ty - h.y) * Math.min(1, dt * 12);
    h.face = 1; h.lost = 0;
    return true;
  }
  // 小花（現場女工人）：跟在主角旁邊，朝最近的怪丟扳手
  function stepHua(S, dt) {
    if (!S.partners.some((x) => x.k === 'hua')) { S.hua = null; return; }
    const p = S.p, pf = pFloor(S), tier = S.job.tier || 0;
    let h = S.hua;
    if (!h) { h = S.hua = { x: p.x - 90, y: p.y, f: p.f, face: 1, moving: 0, cd: 1, age: 0 }; return; }
    h.age += dt; h.cd -= dt;
    if (followLadder(S, h, dt)) return;
    if (h.f !== pf && p.lad == null) { h.lost = (h.lost || 0) + dt; if (h.lost > 0.2) { h.lost = 0; h.f = p.f; h.x = p.x - p.face * 90; S.ev.push({ k: 'nurseWarp', x: h.x, y: floorY(h.f) - 50 }); } } else h.lost = 0;
    h.y = floorY(h.f);
    const tx = Math.max(30, Math.min(S.Wt - 30, p.x - p.face * 95)), dx = tx - h.x;
    if (Math.abs(dx) > 650) h.x = tx;
    const st = Math.abs(dx) > 40 ? Math.sign(dx) * Math.min(460, Math.max(170, Math.abs(dx) * 3)) : 0;
    h.x += st * dt; h.moving = Math.abs(st);
    h.face = Math.abs(dx) > 40 ? Math.sign(dx) : (p.x > h.x ? 1 : -1);
    if (h.cd <= 0) {
      const tg = nearest(S, h.x, h.y - 60, 540);
      if (tg) { h.cd = 1.8; h.face = tg.x >= h.x ? 1 : -1; const a = Math.atan2(tg.y - (h.y - 60), tg.x - h.x); S.shots.push({ k: 'candy', x: h.x, y: h.y - 60, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, life: 0.9, dmg: 16 * (1 + 0.25 * tier), pierce: 1, hit: new Set(), rot: S.rng() * 6 }); S.ev.push({ k: 'throw' }); }
      else h.cd = 0.3;
    }
  }
  // 總務阿兔：平常跟在主角旁邊；每隔一段時間變身「護士兔」，站在主角身邊持續回血；老闆夥伴則用原本的打怪超人（S.helper）
  const NURSE = { first: 6, calm: 10, tf: 0.6, heal: 3.4, back: 0.6 };   // 變護士→連打 3 針→變回總務，隔一陣子再啟動
  function stepSyringes(S, dt) {
    for (const sy of S.syringes) {
      sy.t += dt;
      if (sy.t >= sy.dur && !sy.done) {
        sy.done = true; const p = S.p;
        if (p.hp < p.max) { p.hp = Math.min(p.max, p.hp + sy.n); S.ev.push({ k: 'heal', x: p.x, y: pc(S) - 40, n: sy.n }); }
        S.fx.push({ k: 'heal', x: p.x, y: p.y - 40, r: 90, t: 0, dur: 0.7 }); S.ev.push({ k: 'shot' });
      }
    }
    S.syringes = S.syringes.filter((sy) => !sy.done);
  }
  function stepNurse(S, dt) {
    stepSyringes(S, dt);
    if (!S.partners.some((x) => x.k === 'tu')) { S.nurse = null; return; }
    const p = S.p, pf = pFloor(S), cy = pc(S), tier = S.job.tier || 0;
    let h = S.nurse;
    if (!h) { h = S.nurse = { ph: 'calm', t: 0, left: NURSE.first, x: p.x + 90, y: p.y, f: p.f, face: -1, moving: 0, tick: 0, age: 0 }; return; }
    h.t += dt; h.age += dt;
    if (h.ph === 'calm' && followLadder(S, h, dt)) return;   // 變身中不爬（原地等主角下來再追）
    // 跟在主角旁邊（主角換樓層就跟上去）
    if (h.f !== pf && p.lad == null) { h.lost = (h.lost || 0) + dt; if (h.lost > 0.2) { h.lost = 0; h.f = p.f; h.x = p.x + p.face * 90; S.ev.push({ k: 'nurseWarp', x: h.x, y: floorY(h.f) - 50 }); } } else h.lost = 0;
    h.y = floorY(h.f);
    const tx = Math.max(30, Math.min(S.Wt - 30, p.x + (h.ph === 'heal' ? p.face * 70 : p.face * 90))), dx = tx - h.x;
    if (Math.abs(dx) > 650) h.x = tx;
    const st = Math.abs(dx) > 40 ? Math.sign(dx) * Math.min(460, Math.max(170, Math.abs(dx) * 3)) : 0;
    h.x += st * dt; h.moving = Math.abs(st);
    h.face = Math.abs(dx) > 40 ? Math.sign(dx) : (p.x > h.x ? 1 : -1);
    if (h.ph === 'calm') { h.left -= dt; if (h.left <= 0) { h.ph = 'tf'; h.t = 0; S.ev.push({ k: 'nurseTf', x: h.x, y: h.y - 60 }); } }
    else if (h.ph === 'tf') { if (h.t >= NURSE.tf) { h.ph = 'heal'; h.t = 0; h.left = NURSE.heal; h.tick = 0; } }
    else if (h.ph === 'heal') {
      h.left -= dt; h.tick -= dt;
      if (h.tick <= 0) {
        h.tick = 1.0; const n = Math.max(5, Math.round((2.5 + 1.2 * tier) * 1.8 * (S.job.id === 'mt' ? 1.5 : 1)));
        S.syringes.push({ x0: h.x + h.face * 14, y0: h.y - 62, t: 0, dur: 0.3, n });   // 打針：一支針筒飛向主角，到了才回血
      }
      if (h.left <= 0) { h.ph = 'back'; h.t = 0; S.ev.push({ k: 'nurseBack', x: h.x, y: h.y - 60 }); }
    } else if (h.ph === 'back') { if (h.t >= NURSE.back) { h.ph = 'calm'; h.t = 0; h.left = NURSE.calm; } }
  }
  // 機台操作員：鋸盤（繞身體）、衝壓機（定時重壓）、油壓錘（全場大震波）
  function stepJob(S, dt) {
    const j = S.job; if (!j.id) return;
    const v = D.JOBS[j.id].lv && D.JOBS[j.id].lv[j.tier]; if (!v) return;
    const cx = S.p.x, cy = pc(S);
    if (j.id === 'mt') { stepMaint(S, v, dt); return; }
    if (j.id === 'hr') { stepHR(S, v, dt); return; }
    if (v.saw) {
      S.p.sawA += v.saw.spd * dt;
      for (let i = 0; i < v.saw.n; i++) {
        const a = S.p.sawA + i * Math.PI * 2 / v.saw.n, x = cx + Math.cos(a) * v.saw.r, y = cy + Math.sin(a) * v.saw.r;
        query(S, x, y, 30, (m) => { const last = S.sawHit.get(m.id) ?? -9; if (S.t - last < 0.3) return; S.sawHit.set(m.id, S.t); hurt(S, m, v.saw.dmg, 'saw'); });
      }
      if (S.sawHit.size > 600) S.sawHit.clear();
    }
    if (v.stamp && timer(S, 'j_stamp', v.stamp.cd, dt)) {
      let n = 0;
      query(S, cx, cy, v.stamp.r, (m) => { hurt(S, m, v.stamp.dmg, 'stamp'); m.stun = Math.max(m.stun, v.stamp.stun); if (!m.d.boss) m.x += Math.sign(m.x - cx || 1) * 40; n++; });
      S.fx.push({ k: 'stamp', x: cx, y: cy + 26, r: v.stamp.r, t: 0, dur: 0.5 }); S.ev.push({ k: 'stamp' });
    }
    if (v.hammer && timer(S, 'j_hammer', v.hammer.cd, dt)) {
      query(S, cx, cy, v.hammer.r, (m) => { hurt(S, m, v.hammer.dmg * (m.d.boss ? 0.5 : 1), 'hammer'); m.stun = Math.max(m.stun, v.hammer.stun); });
      S.fx.push({ k: 'hammer', x: cx, y: cy + 26, r: v.hammer.r, t: 0, dur: 0.8 }); S.ev.push({ k: 'hammer' });
    }
  }

  // 人資：公告張貼（定住）、加班單（減速＋慢慢受傷）、考績評比（標記）、面試（連續逼問）、調薪（全員攻擊提升）、請假單（把一群怪請走）
  function stepHR(S, v, dt) {
    const cx = S.p.x, cy = pc(S);
    if (S.raiseT > 0) S.raiseT -= dt;
    if (v.notice && timer(S, 'h_notice', v.notice.cd, dt)) {
      query(S, cx, cy, v.notice.r, (m) => { hurt(S, m, v.notice.dmg, 'notice'); m.stun = Math.max(m.stun, m.d.boss ? 0.8 : v.notice.stun); });
      S.fx.push({ k: 'notice', x: cx, y: cy, r: v.notice.r, t: 0, dur: 0.6 }); S.ev.push({ k: 'say', x: cx, y: cy - 90, s: '公告張貼！' }); S.ev.push({ k: 'flash' });
    }
    if (v.overtime) {   // 加班單：身邊一圈的怪被加班，變慢又慢慢掉血
      S.otAcc = (S.otAcc || 0) + dt;
      query(S, cx, cy, v.overtime.r, (m) => { m.slow = Math.max(m.slow || 0, 0.3); if (S.otAcc >= 0.5) hurt(S, m, v.overtime.dps * 0.5, 'overtime', true); });
      if (S.otAcc >= 0.5) S.otAcc = 0;
    }
    if (v.review && timer(S, 'h_review', v.review.cd, dt)) {   // 考績評比：標記最耐打的幾隻
      const cand = S.mons.filter((m) => !m.dead && Math.abs(m.x - cx) < 620 && Math.abs(m.y - cy) < 560 && !(m.marked > 0)).sort((a, b) => b.hp - a.hp).slice(0, v.review.n);
      for (const m of cand) { m.marked = v.review.dur; m.markMul = v.review.mul; }
      if (cand.length) S.ev.push({ k: 'say', x: cand[0].x, y: cand[0].y - cand[0].r - 40, s: '考績：丙！' });
    }
    for (const m of S.mons) if (m.marked > 0) m.marked -= dt;
    if (v.interview && timer(S, 'h_intv', v.interview.cd, dt)) {   // 面試：發問，逼問 3 秒（連續傷害）
      const tg = nearest(S, cx, cy, 520);
      if (tg) { tg.intv = { t: v.interview.dur, dps: v.interview.dps }; S.ev.push({ k: 'say', x: tg.x, y: tg.y - tg.r - 40, s: ['請自我介紹！', '你的缺點是？', '為什麼想來我們公司？'][(S.rng() * 3) | 0] }); }
    }
    for (const m of S.mons) if (m.intv && m.intv.t > 0) { m.intv.t -= dt; hurt(S, m, m.intv.dps * dt, 'interview', true); }
    if (v.raise && timer(S, 'h_raise', v.raise.cd, dt)) { S.raiseT = v.raise.dur; S.raiseMul = v.raise.mul; S.ev.push({ k: 'say', x: cx, y: cy - 100, s: '調薪！攻擊提升' }); }
    if (v.leave && timer(S, 'h_leave', v.leave.cd, dt)) {   // 請假單：把一群怪請走（暫時離開、定住 3.5 秒）
      let n = 0;
      query(S, cx, cy, v.leave.r, (m) => { if (n >= v.leave.n || m.d.boss) return; n++; m.stun = Math.max(m.stun, v.leave.stun); m.x += Math.sign(m.x - cx || 1) * 220; });
      if (n) { S.fx.push({ k: 'notice', x: cx, y: cy, r: v.leave.r, t: 0, dur: 0.7 }); S.ev.push({ k: 'say', x: cx, y: cy - 90, s: '請假單核准！' }); }
    }
  }
  // 維修員：夾具陷阱（放在怪多的地方）、自動砲台（自己開火）、慢慢回血、砲台連線補血
  // 跨關接續：把職業、階級、夥伴、強化帶到下一關
  function snapshotCarry(S) { return { job: { ...S.job }, partners: S.partners.map((x) => x.k), selfLv: S.selfLv || 0 }; }
  function applyCarry(S, c) {
    if (!c) return;
    S.job = { ...c.job }; S.partners = c.partners.filter((k) => D.PARTNERS[k]).map((k) => ({ k })); S.selfLv = c.selfLv || 0;
    S.p.max += 20 * (S.job.tier || 0) + 30 * S.selfLv; S.p.hp = S.p.max;
    if (S.partners.some((x) => x.k === 'zhang')) S.sk.hero = Math.min(D.MAXLV, 1 + (S.job.tier || 1));
  }
  function stepMaint(S, v, dt) {
    const cx = S.p.x, cy = pc(S);
    if (v.regen) {
      S.p.regenT = (S.p.regenT || 0) + dt;
      if (S.p.regenT >= v.regen.every) { S.p.regenT = 0; if (S.p.hp < S.p.max) { S.p.hp = Math.min(S.p.max, S.p.hp + v.regen.n); S.ev.push({ k: 'heal', x: cx, y: cy - 40, n: v.regen.n }); } }
    }
    if (v.trap && timer(S, 'j_trap', v.trap.cd, dt)) {
      for (let i = 0; i < v.trap.n; i++) {
        const cand = S.mons.filter((m) => !m.dead && !m.d.fly && Math.abs(m.y - cy) < 120 && Math.abs(m.x - cx) < 420);
        const tg = cand.length ? cand[(S.rng() * cand.length) | 0] : null;
        const x = tg ? tg.x : cx + S.p.face * (60 + i * 50);
        S.traps.push({ x, y: cy, r: v.trap.r, dmg: v.trap.dmg, life: v.trap.dur, t: 0, hit: new Map() });
      }
      if (S.traps.length > 12) S.traps.splice(0, S.traps.length - 12);
    }
    for (const tp of S.traps) {
      tp.t += dt; tp.life -= dt;
      query(S, tp.x, tp.y, tp.r, (m) => {
        const last = tp.hit.get(m.id) ?? -9; m.slow = Math.max(m.slow || 0, 0.5);
        if (S.t - last < 0.5) return; tp.hit.set(m.id, S.t); hurt(S, m, tp.dmg, 'trap'); m.stun = Math.max(m.stun, 0.3);
      });
    }
    S.traps = S.traps.filter((tp) => tp.life > 0);
    if (v.turret) {
      S.turretT = (S.turretT ?? v.turret.spawn * 0.4) - dt;
      if (S.turretT <= 0 && S.turrets.length < v.turret.n) { S.turretT = v.turret.spawn; S.turrets.push({ x: cx + S.p.face * 50, y: cy, life: v.turret.dur, cd: 0.3, ang: 0 }); S.ev.push({ k: 'turretOn' }); }
      else if (S.turretT <= 0) S.turretT = 1;
      for (const tu of S.turrets) {
        tu.life -= dt; tu.cd -= dt;
        const tg = nearest(S, tu.x, tu.y, v.turret.range);
        if (tg) tu.ang = Math.atan2(tg.y - tu.y, tg.x - tu.x);
        if (tg && tu.cd <= 0) {
          tu.cd = v.turret.cd;
          S.shots.push({ k: 'candy', x: tu.x, y: tu.y - 8, vx: Math.cos(tu.ang) * 760, vy: Math.sin(tu.ang) * 760, life: 0.8, dmg: v.turret.dmg, pierce: 0, hit: new Set(), rot: S.rng() * 6 });
        }
      }
      S.turrets = S.turrets.filter((tu) => tu.life > 0);
      if (v.turret.link && S.turrets.length >= 2) {   // 兩座砲台連線：每 2 秒幫主角補一點血
        S.linkT = (S.linkT || 0) + dt;
        if (S.linkT >= 2) { S.linkT = 0; if (S.p.hp < S.p.max) { S.p.hp = Math.min(S.p.max, S.p.hp + 4); S.ev.push({ k: 'heal', x: cx, y: cy - 60, n: 4 }); } }
      }
    }
  }
  // ---------- 一格 ----------
  function step(S, dt) {
    if (S.state !== 'play') return;
    // 有升級或寶箱就先暫停選卡
    if (S.pending > 0 || S.chestPick > 0) {
      if (S.chestPick > 0) S.chestPick--; else S.pending--;
      S.offer = makeOffer(S);
      S.state = 'pick'; S.ev.push({ k: 'offer' });
      return;
    }
    if (S.promoPend > 0) { S.promoOffer = makePromoOffer(S); S.state = 'promo'; S.ev.push({ k: 'promo' }); return; }
    S.t += dt;
    stepPlayer(S, dt);
    stepSpawn(S, dt);
    stepMons(S, dt);
    stepWeapons(S, dt);
    stepPickups(S, dt);
    S.mons = S.mons.filter((m) => !m.dead);
    updCam(S, Math.min(1, dt * 6));
  }

  // ---------- 存檔：關卡打到一半也能存起來，下次接著玩 ----------
  const MKEYS = ['id', 'k', 'x', 'y', 'f', 'vy', 'vx', 'hp', 'max', 'spd', 'cl', 'face', 'ph', 'age', 'stun', 'slow'];
  function serialize(S) {
    const pick = (o, ks) => { const r = {}; for (const k of ks) r[k] = o[k]; return r; };
    return {
      v: 1, job: { ...S.job }, selfLv: S.selfLv || 0, partners: S.partners.map((x) => x.k), promoDone: S.promoDone, promoPend: S.promoPend + (S.state === 'promo' ? 0 : 0), li: S.li, hard: S.hard, t: S.t, rs: S.rs, p: { ...S.p }, sk: { ...S.sk }, tm: { ...S.tm },
      items: S.items.map((i) => [i.got, i.prog]), chests: S.chests.map((c) => c.open), exit: pick(S.exit, ['open', 'left']),
      mons: S.mons.filter((m) => !m.dead).map((m) => pick(m, MKEYS)), boss: S.boss ? S.boss.id : null,
      gems: S.gems.slice(-150).map((g) => pick(g, ['x', 'y', 'fy', 'v', 'heart', 'big'])),
      pools: S.pools.map((p) => ({ ...p })), buddies: S.buddies.map((b) => ({ ...b, st: 'orbit' })),
      helper: S.helper ? { ...S.helper, tg: null } : null,
      pending: S.pending + (S.offer ? 1 : 0), chestPick: S.chestPick, spawnAcc: S.spawnAcc, hordeT: S.hordeT, kills: S.kills, nid: S.nid, heroSeen: S.heroSeen,
    };
  }
  function restore(o, opt = {}) {
    const S = create(o.li, { seed: 1, ...opt, hard: !!o.hard });
    Object.assign(S, { t: o.t, rs: o.rs, sk: o.sk, tm: o.tm, pending: o.pending, chestPick: o.chestPick, spawnAcc: o.spawnAcc, hordeT: o.hordeT, kills: o.kills, nid: o.nid, heroSeen: o.heroSeen });
    Object.assign(S.p, o.p);
    S.partners = (o.partners || []).filter((k) => D.PARTNERS[k]).map((k) => ({ k }));
    S.selfLv = o.selfLv || 0; S.job = o.job || { id: null, tier: 0 }; S.promoDone = o.promoDone || 0; S.promoPend = o.promoPend || 0;
    o.items.forEach(([got, prog], i) => { S.items[i].got = got; S.items[i].prog = prog; });
    o.chests.forEach((open, i) => { S.chests[i].open = open; });
    Object.assign(S.exit, o.exit);
    S.mons = o.mons.map((m) => ({ ...m, d: D.MONS[m.k], r: D.MONS[m.k].r, conn: null, connT: 0, hitCd: 0.5, flash: 0, dead: false }));
    S.boss = o.boss != null ? S.mons.find((m) => m.id === o.boss) || null : null;
    S.gems = o.gems.map((g) => ({ ...g, vy: 0, vx: 0, pull: false }));
    S.pools = o.pools; S.buddies = o.buddies; S.helper = o.helper;
    updCam(S, 1);
    return S;
  }

  G.CORE = { create, step, choose, choosePromo, chooseStartJob, choosePartner, buildPartnerOffer, dropPartner, snapshotCarry, applyCarry, makePromoOffer, needDrop, weapons, makeOffer, serialize, restore, floorY, pc, pFloor, sv, onScreen, updCam, ROOM: D.ROOM };
})(typeof window !== 'undefined' ? window : globalThis);
