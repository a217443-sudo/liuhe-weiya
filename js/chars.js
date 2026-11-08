// 自製 3D 角色（用 three.js 幾何圖形組成的 Q 版人物，高度 1 單位、臉朝 +z、腳踩 y=0）
// 取代原作者的 .glb 模型：工人（男／女）、總務阿兔、老闆、打怪超人
import * as THREE from 'three';
import { addGear } from './gear.js';
import { rigGeometry } from './autorig.js?v=28';

const RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 178, 178, 178, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const OUT = new THREE.MeshBasicMaterial({ color: 0x1c140f, side: THREE.BackSide });
const mats = new Map();
const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshToonMaterial({ color: c, gradientMap: RAMP, ...o })); return mats.get(k); };

// 一個有描邊的零件
function part(geo, color, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, M(color, o.mat)); m.position.set(x, y, z);
  if (o.outline !== false) { const ol = new THREE.Mesh(geo, OUT); ol.scale.setScalar(o.ow || 1.09); m.add(ol); }
  return m;
}
const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r, w = 20, h = 14, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest);

const SKIN = 0xf2c9a0;

function face(head, r, o = {}) {
  const eye = new THREE.SphereGeometry(0.03, 10, 8);
  for (const s of [-1, 1]) head.add(part(eye, 0x1a1210, s * 0.075, 0.02, r * 0.93, { outline: false }));
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 6, 12, Math.PI), M(0x8b2d2d)); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.045, r * 0.96); head.add(mouth);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), M(0xf4a29a)); c.position.set(s * 0.13, -0.03, r * 0.86); c.rotation.y = s * 0.5; head.add(c); }
  if (o.glasses) for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 16), M(0x222222)); g.position.set(s * 0.075, 0.02, r * 0.95); head.add(g); }
}

function build(kind) {
  const root = new THREE.Group(), model = new THREE.Group(); root.add(model);
  const P = {};
  const o = {
    workerM: { shirt: 0x2f6fb5, pants: 0x2a5a96, shoe: 0x4a3b2a, vest: true, glove: 0xf0f0f0 },
    workerF: { shirt: 0x2f6fb5, pants: 0x2a5a96, shoe: 0x4a3b2a, vest: true, glove: 0xf0f0f0, slim: true },
    tu: { shirt: 0xffffff, pants: SKIN, shoe: 0xffffff, glove: SKIN, skirt: 0xf4a6c0, slim: true },
    zhang: { shirt: 0x2b2f3a, pants: 0x23262f, shoe: 0x111111, glove: SKIN, suit: true, belly: true },
    needle: { shirt: 0x1f55b5, pants: 0x1f55b5, shoe: 0xc62828, glove: 0xc62828, hero: true },
  }[kind];
  const sx = o.slim ? 0.93 : 1;
  // 腿
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.085, 0.28, 0);
    pivot.add(part(cyl(0.055, 0.05, 0.25), o.pants, 0, -0.125, 0));
    pivot.add(part(new THREE.BoxGeometry(0.11, 0.06, 0.17), o.shoe, 0, -0.26, 0.03));
    model.add(pivot); P[s < 0 ? 'legL' : 'legR'] = pivot;
  }
  // 身體
  const torso = new THREE.Group(); torso.position.set(0, 0.43, 0); model.add(torso); P.torso = torso;
  const body = part(cyl(0.14 * sx, 0.15 * sx, 0.3), o.shirt); if (o.belly) body.scale.set(1.12, 1, 1.18); torso.add(body);
  if (o.vest) {   // 反光背心
    torso.add(part(cyl(0.158 * sx, 0.168 * sx, 0.26), 0xffb300, 0, 0, 0, { ow: 1.04 }));
    for (const y of [-0.04, 0.06]) torso.add(part(cyl(0.16 * sx, 0.17 * sx, 0.03), 0xe8e8e8, 0, y, 0, { outline: false }));
  }
  if (o.skirt) { const sk = part(cyl(0.15, 0.25, 0.2), o.skirt, 0, -0.14, 0); torso.add(sk); }
  if (o.suit) { const tie = part(new THREE.BoxGeometry(0.05, 0.2, 0.03), 0xc62828, 0, 0.02, 0.17 * 1.1, { outline: false }); torso.add(tie); torso.add(part(new THREE.BoxGeometry(0.1, 0.18, 0.02), 0xffffff, 0, 0.04, 0.17 * 1.1, { outline: false })); tie.position.z += 0.012; }
  if (o.hero) {   // 打怪超人：黃腰帶、胸前徽章、紅披風
    torso.add(part(cyl(0.152, 0.158, 0.05), 0xffc107, 0, -0.1, 0, { outline: false }));
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.065, 20), M(0xffc107)); em.position.set(0, 0.06, 0.152); torso.add(em);
    const em2 = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), M(0xd32f2f)); em2.position.set(0, 0.06, 0.154); torso.add(em2);
    const cape = part(new THREE.BoxGeometry(0.4, 0.5, 0.02), 0xd32f2f, 0, -0.06, -0.18); cape.rotation.x = 0.14; torso.add(cape);
  }
  // 手臂
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.19 * sx, 0.57, 0);
    pivot.add(part(cyl(0.045, 0.04, 0.2), o.suit || o.hero || kind.startsWith('worker') ? o.shirt : SKIN, 0, -0.1, 0));
    pivot.add(part(sph(0.055), o.glove, 0, -0.22, 0));
    model.add(pivot); P[s < 0 ? 'armL' : 'armR'] = pivot;
  }
  // 頭
  const head = new THREE.Group(); head.name = 'Head'; head.position.set(0, 0.78, 0); model.add(head); P.head = head;
  head.add(part(sph(0.21), SKIN));
  if (kind === 'tu') {
    head.add(part(sph(0.225, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x5a3a26, 0, 0.02, -0.02));
    head.add(part(cyl(0.2, 0.17, 0.3), 0x5a3a26, 0, -0.14, -0.07));   // 長髮
    for (const s of [-1, 1]) {   // 兔耳
      const e = part(new THREE.CapsuleGeometry(0.045, 0.22, 6, 10), 0xffffff, s * 0.09, 0.36, -0.01); e.rotation.z = -s * 0.22; head.add(e);
      const inn = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.16, 4, 8), M(0xf8b6c8)); inn.position.set(0, 0, 0.03); e.add(inn);
    }
    face(head, 0.21);
  } else if (kind === 'zhang') {
    head.add(part(sph(0.222, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), 0x15120f, 0, 0.02, -0.02));
    face(head, 0.21, { glasses: true });
  } else if (kind === 'needle') {
    head.add(part(sph(0.222, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), 0x15120f, 0, 0.02, -0.02));   // 黑髮
    for (const [x, r] of [[-0.1, 0.35], [0, 0], [0.1, -0.35]]) { const sp = part(new THREE.ConeGeometry(0.05, 0.14, 8), 0x15120f, x, 0.24, 0.02); sp.rotation.z = r; head.add(sp); }   // 尖尖的頭髮
    face(head, 0.21);
    head.add(part(new THREE.BoxGeometry(0.44, 0.055, 0.06), 0xd32f2f, 0, 0.1, 0.185, { outline: false }));   // 超人頭帶（露出眼睛）
  } else {   // 工人：安全帽、護目鏡、口罩，看不到臉
    addGear({ model: head }, { hr: 0.21, hy: 0, goggles: true, mask: true, ponytail: kind === 'workerF' });
  }
  return { root, model, parts: P, kind, speed: 0, w: 0, phase: Math.random() * 6, sig: null, sigT: 0 };
}

export function makeChar(kind) { return build(kind); }
// 用 Hunyuan3D 生成、自動綁骨的 3D 模型當角色（geo 是 GLB 裡的幾何）
export function makeRigChar(geo, kind = 'rigged', map = null) {
  const rig = rigGeometry(geo, undefined, { map, armClean: kind === 'workerM' || kind === 'workerF' ? [0.15, 0.19] : kind === 'tu' ? [0.12, 0.16, 0.58] : null }), root = new THREE.Group(); root.add(rig.root);
  return { root, model: rig.root, parts: null, rig, kind, speed: 0, w: 0, phase: 0, sig: null, sigT: 0 };
}
function updateRig(a, dt, t) {
  const b = a.rig.bones; a.rig.update(dt, a.speed, t, { hurt: a.hurt, climb: a.climb });
  a.model.rotation.z = 0; a.model.position.y = 0;
  if (a.sig) {
    a.sigT += dt; const d = DUR[a.sig] || 1.4, k = a.sigLoop ? a.sigT : Math.min(a.sigT, d);
    if (!a.sigLoop && a.sigT > d) { a.sig = null; return; }
    if (a.sig === 'hop') { a.model.position.y = Math.sin(Math.PI * Math.min(1, k / d)) * 0.28; b[2].rotation.set(-0.35, 0, -0.32); b[3].rotation.set(-0.35, 0, 0.32); b[8].rotation.x = b[9].rotation.x = -0.35; b[6].rotation.x = b[7].rotation.x = 0.6 * Math.sin(Math.PI * Math.min(1, k / d)); }
    else if (a.sig === 'stumble') { const f = Math.min(1, k / d); a.model.rotation.z = Math.sin(f * 14) * 0.25 * (1 - f); b[0].rotation.x = 0.5 * Math.sin(f * Math.PI); }
    else if (a.sig === 'talk') {   // 講話：手臂不側舉（側舉會把衣服側邊拉成黑色破面），改成手肘彎起、前臂在胸前比劃
      const s = Math.sin(k * 5), s2 = Math.sin(k * 3.1 + 1);
      b[3].rotation.set(-0.55 + s * 0.12, 0, -0.18); b[9].rotation.set(-1.25 + s2 * 0.3, 0, 0);
      b[2].rotation.set(-0.12, 0, 0.1); b[8].rotation.set(-0.3, 0, 0);
      b[1].rotation.x = 0.04 + Math.max(0, s) * 0.06; b[1].rotation.z = Math.sin(k * 2) * 0.05;
    }
    else { a.model.position.y = Math.abs(Math.sin(k * 8)) * 0.07; const wv = Math.sin(k * 8) * 0.25; b[2].rotation.set(-0.85 + wv * 0.4, 0, -0.45); b[3].rotation.set(-0.85 - wv * 0.4, 0, 0.45); b[8].rotation.x = b[9].rotation.x = 0;  b[1].rotation.z = Math.sin(k * 8) * 0.12; b[4].rotation.x = Math.sin(k * 8) * 0.15; b[5].rotation.x = -Math.sin(k * 8) * 0.15; }   // 歡呼：雙手舉高
  }
}

// ---------- 動作（程式動畫）----------
export function actChar(a, clip, loop) { a.sig = clip; a.sigT = 0; a.sigLoop = !!loop; }
export function stopChar(a) { a.sig = null; }

const DUR = { handsup: 1.4, hop: 0.7, stumble: 1.5, talk: 3 };
export function updateChar(a, dt, t) {
  if (a.rig) return updateRig(a, dt, t);
  const P = a.parts, moving = a.speed > 0.05;
  a.w += ((moving ? 1 : 0) - a.w) * Math.min(1, dt * 10);
  a.phase += dt * (4 + a.speed * 4.2);
  const sw = Math.sin(a.phase) * 0.75 * a.w, jog = Math.min(1, Math.max(0, (a.speed - 1.3) / 0.8));
  P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
  P.armL.rotation.x = -sw * 0.9; P.armR.rotation.x = sw * 0.9;
  P.armL.rotation.z = 0.08; P.armR.rotation.z = -0.08;
  P.torso.rotation.x = 0.08 * jog * a.w; P.torso.rotation.z = 0; P.head.rotation.set(0, 0, 0);
  let y = Math.abs(Math.sin(a.phase)) * 0.035 * a.w + (1 - a.w) * Math.sin(t * 3 + a.phase) * 0.006;
  a.model.rotation.z = 0; a.model.position.y = 0;
  if (a.sig) {   // 招牌動作：蓋過走路
    a.sigT += dt; const d = DUR[a.sig] || 1.4, k = a.sigLoop ? a.sigT : Math.min(a.sigT, d);
    if (!a.sigLoop && a.sigT > d) { a.sig = null; }
    else if (a.sig === 'hop') { y = Math.sin(Math.PI * Math.min(1, k / d)) * 0.28; P.armL.rotation.z = P.armR.rotation.z = 0; P.armL.rotation.x = P.armR.rotation.x = -2.4; }
    else if (a.sig === 'stumble') { const f = Math.min(1, k / d); a.model.rotation.z = Math.sin(f * 14) * 0.25 * (1 - f); P.torso.rotation.x = 0.5 * Math.sin(f * Math.PI); P.armL.rotation.x = P.armR.rotation.x = -1.2; y = 0; }
    else { y += Math.abs(Math.sin(k * 8)) * 0.07; P.armL.rotation.x = P.armR.rotation.x = 0; P.armL.rotation.z = 2.6; P.armR.rotation.z = -2.6; P.head.rotation.z = Math.sin(k * 8) * 0.12; }   // 歡呼
  }
  a.model.position.y = y;
}
