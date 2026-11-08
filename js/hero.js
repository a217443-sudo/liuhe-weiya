// 3D 角色：工人（玩家，男／女）、總務阿兔與老闆（只在劇情和撤離點出現）、打怪超人（自製幾何角色，見 chars.js）
// 用一個小的 WebGL 畫布輪流畫每個角色，再貼到 2D 主畫面上（2D 畫面負責校舍、怪物、特效）
import * as THREE from 'three';
import { makeChar, makeRigChar, updateChar, actChar, stopChar } from './chars.js?v=70';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SZ = 256;
const VIEW = 1.5;            // 正交鏡頭看 1.5 單位寬高（角色 1 單位高）
const FOOT = 0.12;           // 腳底離畫布底部幾成
let R = null, scene, cam, ready = false;
const A = {};
const MAP_BASE = {};   // 各角色原始貼圖（換裝用）
let tint = null, tg = null;
let PK = 'bian';   // 玩家用哪個角色：bian 男、bianF 女
const P = (k) => (k === 'bian' ? PK : k === 'workerM' ? 'bian' : k === 'workerF' ? 'bianF' : k);   // workerM/workerF：結尾合照指定男女工人
export function setPlayer(g) { PK = g === 'f' ? 'bianF' : 'bian'; }

export async function init(tick = () => {}) {
  R = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  R.setPixelRatio(1); R.setSize(SZ, SZ, false);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3226, 2.1));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.9); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa24a, 0.9); rim.position.set(-3, 2, -2); scene.add(rim);   // 紅燈籠的暖色輪廓光
  cam = new THREE.OrthographicCamera(-VIEW / 2, VIEW / 2, VIEW * (1 - FOOT), -VIEW * FOOT, 0.1, 30);
  cam.position.set(0, 0, 8); cam.lookAt(0, 0, 0);
  tint = document.createElement('canvas'); tint.width = tint.height = SZ; tg = tint.getContext('2d');
  // 五個角色都優先用 Hunyuan3D 生成、自動綁骨的 3D 模型（models/*.glb），讀不到就用程式拼的角色
  const FILES = { bian: 'worker-male', bianF: 'worker-female', tu: 'rabbit', zhang: 'boss', needle: 'hero' }, GEO = {}, MAP = {};
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    try { const g = await new GLTFLoader().loadAsync(`models/${f}.glb?v=9`); g.scene.traverse((o) => { if (o.isMesh && !GEO[k]) { GEO[k] = o.geometry; MAP[k] = o.material && o.material.map; MAP_BASE[k] = MAP[k]; } }); } catch (e) { console.warn(f + '.glb not loaded', e); }
  }));
  // tuN＝護士兔（總務變身）：同一隻兔子的模型，貼圖把粉紅裙子換成護士藍白，頭上加護士帽
  if (GEO.tu && MAP.tu && MAP.tu.image) { GEO.tuN = GEO.tu; MAP.tuN = nurseTex(MAP.tu); }
  // bian＝男工人、bianF＝女工人、tu＝總務阿兔、zhang＝老闆、needle＝打怪超人、tuN＝護士兔
  for (const [k, kind] of [['bian', 'workerM'], ['bianF', 'workerF'], ['tu', 'tu'], ['zhang', 'zhang'], ['needle', 'needle'], ['tuN', 'tu']]) {
    let a = null;
    if (GEO[k]) { try { a = makeRigChar(GEO[k], kind, MAP[k] || null); } catch (e) { console.warn('rig failed', k, e); } }
    if (!a) a = makeChar(kind);
    if (k === 'tuN' && a.rig) addNurseCap(a);
    a.root.visible = false; scene.add(a.root);
    a.key = k; a.face = 1; a.rot = 0; A[k] = a; tick();
  }
  for (let i = 0; i < 7; i++) tick();
  ready = true;
}

// ---------- 護士兔：把粉紅裙子（圖的下半部、粉紅色）換成護士淺藍，加護士帽 ----------
function nurseTex(base) {
  const img = base.image, w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = (i >> 2) / w; if (y < h * 0.45) continue;   // 只改身體（臉頰的粉紅不動）
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn;
    if (mx < 0.55 || dl < 0.1) continue;
    const sat = dl / mx; let hue = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4; hue = (hue * 60 + 360) % 360;
    if (!(hue >= 335 || hue <= 18) || sat < 0.18) continue;   // 粉紅／紅
    d[i] = 150 + 60 * (1 - sat); d[i + 1] = 205 + 30 * (1 - sat); d[i + 2] = 235;   // 淺藍
  }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = base.flipY; t.colorSpace = base.colorSpace; t.anisotropy = base.anisotropy; return t;
}
function addNurseCap(a) {
  const head = a.rig.bones[1], grp = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const red = new THREE.MeshBasicMaterial({ color: 0xe53935 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.05, 0.004), red), hz = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.004), red);
  v.position.z = hz.position.z = 0.052;
  grp.add(cap, v, hz); grp.position.set(0, 0.19, 0.075); head.add(grp);
}
// ---------- 晉升換裝：把男工人貼圖裡的「安全帽黃」「背心橘」換成別的顏色（依職業與階級）----------
// [色相, 飽和度, 明度倍率]。作業員（第 0 階）維持原樣
const OUTFIT = {
  op: [null,
    { helm: [0, 0.04, 1.28], vest: [96, 0.9, 1.0] },      // 機台技師：白帽、螢光綠背心
    { helm: [0, 0.04, 1.28], vest: [2, 0.9, 0.95] },      // 機台組長：白帽、紅背心（另外戴臂章）
    { helm: [24, 0.95, 1.0], vest: [47, 0.92, 1.05] }],   // 機台課長：橘帽、金色背心
  hr: [null,   // 人資＝辦公室白領：白色安全帽＋襯衫／西裝色背心＋領帶＋工作證（不是現場工人的反光背心）
    { helm: [0, 0.03, 1.3], vest: [0, 0.03, 1.25], tie: 0x1e63c8 },                       // 人資助理：白帽、白襯衫背心、藍領帶、工作證
    { helm: [0, 0.03, 1.3], vest: [215, 0.16, 1.05], tie: 0xd32f2f, arm: 0x8e24aa },     // 人資專員：白帽、灰藍背心、紅領帶、紫臂章
    { helm: [0, 0.03, 1.3], vest: [0, 0.0, 0.3], tie: 0xf2b705, arm: 0xf2b705 }],        // 人資主管：白帽、深灰西裝背心、金領帶、金臂章
  mt: [null,
    { helm: [215, 0.85, 0.95], vest: [52, 0.9, 1.05] },    // 維修技師：藍帽、黃背心
    { helm: [225, 0.9, 0.62], vest: [26, 1.0, 1.0], arm: 0x1e88e5 },   // 維修組長：深藍帽、橘背心、藍臂章
    { helm: [0, 0.05, 0.72], vest: [172, 0.9, 0.95], arm: 0xf2b705 }],  // 維修課長：銀灰帽、青綠背心、金臂章
};
const OUT_TEX = {};
let curOutfit = '';
function recolor(img, o) {
  const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); const id = g.getImageData(0, 0, w, h), d = id.data;
  const hsv2rgb = (hh, ss, vv) => { const f = (n) => { const k = (n + hh / 60) % 6; return vv - vv * ss * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5) * 255, f(3) * 255, f(1) * 255]; };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn;
    if (mx < 0.45 || dl < 0.2) continue;
    const sat = dl / mx; if (sat < 0.5) continue;
    let hue = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4; hue = (hue * 60 + 360) % 360;
    const head = (i >> 2) < w * h * 0.27;   // 圖的上段（頭部／安全帽）：帽子陰影偏橘，也要算帽子，不能變成背心色
    const t = head ? (hue >= 12 && hue <= 68 ? o.helm : null) : hue >= 42 && hue <= 68 ? o.helm : hue >= 12 && hue < 42 ? o.vest : null;   // 黃＝安全帽、橘＝背心
    if (!t) continue;
    const rgb = hsv2rgb(t[0], Math.min(1, t[1] * Math.min(1, sat / 0.85)), Math.min(1, mx * t[2]));
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
  }
  g.putImageData(id, 0, 0); return c;
}

// 領帶＋工作證（人資）：掛在身體骨頭上，跟著動
function setTie(a, color) {
  if (!a || !a.rig) return;
  if (a.tieGrp) { a.tieGrp.visible = !!color; if (color) a.tieGrp.children.forEach((m) => { if (m.userData.tie) m.material.color.setHex(color); }); if (color || a.tieGrp.children.length) return; }
  if (!color) return;
  const grp = new THREE.Group(), tm = new THREE.MeshBasicMaterial({ color });
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.012), tm), blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.01), tm);
  knot.userData.tie = true; blade.userData.tie = true; knot.position.set(0, 0.165, 0.09); blade.position.set(0, 0.085, 0.09);
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.008), new THREE.MeshBasicMaterial({ color: 0xffffff })), strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.009), new THREE.MeshBasicMaterial({ color: 0x1e88e5 }));
  card.position.set(-0.07, 0.07, 0.088); strip.position.set(-0.07, 0.095, 0.0885);
  grp.add(knot, blade, card, strip); a.rig.bones[0].add(grp); a.tieGrp = grp;
}
// 臂章（班長）：套在上臂中段的紅色環＋白色細條，跟著手臂骨頭一起動
function setArmband(a, on, color = 0xd32020) {
  if (!a || !a.rig) return;
  if (a.armbands) { for (const m of a.armbands) { m.visible = on; if (on) m.children[0].material.color.setHex(color); } if (on || a.armbands.length) return; }
  if (!on) return;
  const bones = a.rig.bones; a.armbands = [];
  for (const [bi, ei] of [[2, 8], [3, 9]]) {
    const dir = bones[ei].position.clone(), len = dir.length(); dir.normalize();
    const g = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.05, 20, 1, true), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0575, 0.0575, 0.014, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    g.add(band, stripe);
    g.position.copy(dir).multiplyScalar(len * 0.5); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate().multiplyScalar(-1));
    bones[bi].add(g); a.armbands.push(g);
  }
}
// 主角（男工人）換裝；回傳 true 表示有換
export function setOutfit(job, tier, k = 'bian') {
  const a = A[P(k)]; if (!a || !a.rig || !MAP_BASE[P(k)]) return false;
  const key = (job || '') + tier;
  if (key === curOutfit && k === 'bian') return true;
  const base = MAP_BASE[P(k)], spec = OUTFIT[job] && OUTFIT[job][tier];
  let tex = base;
  if (spec) {
    const ck = P(k) + key;
    if (!OUT_TEX[ck]) { const t = new THREE.CanvasTexture(recolor(base.image, spec)); t.flipY = base.flipY; t.colorSpace = base.colorSpace; t.anisotropy = base.anisotropy; OUT_TEX[ck] = t; }
    tex = OUT_TEX[ck];
  }
  a.rig.mesh.material.map = tex; a.rig.mesh.material.needsUpdate = true;
  const arm = spec && spec.arm ? spec.arm : job === 'op' && tier === 2 ? 0xd32020 : 0;
  setArmband(a, !!arm, arm || undefined);
  setTie(a, spec && spec.tie ? spec.tie : 0);
  if (k === 'bian') curOutfit = key;
  return true;
}
export const isReady = () => ready;
export const LOAD_STEPS = 12;

// 角色站姿截圖（升級卡的圖示用）
export function snapshot(k, face = 0.35) {
  k = P(k); const a = A[k]; if (!a) return '';
  const r = a.root.rotation.y; a.root.rotation.y = face;
  for (const kk in A) A[kk].root.visible = kk === k;
  R.render(scene, cam); const url = R.domElement.toDataURL('image/png');
  a.root.rotation.y = r; return url;
}

// 播一段動作（loop：一直播，像勝利歡呼；不然播一次就回走路）
const CLIP = { sig_bian: 'cheer', sig_tu: 'cheer', sig_zhang: 'cheer', handsup: 'handsup', hop: 'hop', talk: 'talk', stumble: 'stumble' };
export function act(k, clip, loop = false) { const a = A[P(k)]; if (!a) return; actChar(a, CLIP[clip] || clip, loop); }
export function stopAct(k) { const a = A[P(k)]; if (a) stopChar(a); }

// 每幀：speed 每秒幾個身高、face 1 右 -1 左、climb 背對鏡頭爬梯
export function update(k, dt, t, o) {
  const a = A[P(k)]; if (!a) return;
  a.speed = o.speed || 0; a.hurt = !!o.hurt; a.climb = !!o.climb;
  // 側面 3/4 角度（不要整個側過去，臉才看得到）；爬梯子背對鏡頭
  const want = o.climb && !o.keepFront ? Math.PI : (o.face ?? 1) * (o.front ? 0.35 : 1.05);   // keepFront：夥伴爬梯子也面向鏡頭，才看得到臉
  let d = want - a.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
  a.rot += d * Math.min(1, dt * 12);
  a.root.rotation.y = a.rot;
  updateChar(a, dt, t);
}

// 畫到 2D 主畫面：x、y 是腳底的世界座標，h 是角色高（世界 px）
export function draw(ctx, k, x, y, h, o = {}) {
  k = P(k); const a = A[k]; if (!a || !ready) return;
  for (const kk in A) A[kk].root.visible = kk === k;
  R.render(scene, cam);
  const size = h * VIEW;   // 畫布對應的世界大小
  let src = R.domElement;
  if (o.red || o.white) {
    tg.clearRect(0, 0, SZ, SZ); tg.globalCompositeOperation = 'source-over'; tg.drawImage(src, 0, 0);
    tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = o.red ? `rgba(255,40,30,${o.red})` : `rgba(255,255,255,${o.white})`; tg.fillRect(0, 0, SZ, SZ);
    src = tint;
  }
  ctx.drawImage(src, x - size / 2, y - size * (1 - FOOT), size, size);
}
