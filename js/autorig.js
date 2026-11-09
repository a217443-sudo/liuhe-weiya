// 自動綁骨：把「不會動的整塊 3D 模型」（Hunyuan3D 生成、頂點上色）變成能走路的角色
// 作法：在身體上放 8 根骨頭（髖、頭、兩隻手臂、兩條腿…），每個頂點依「離哪幾根骨頭最近」自動算權重（線性蒙皮），
// 動作由程式產生（腿手擺動、身體起伏），不需要 Mixamo。
import * as THREE from 'three';

// 關節設定：t＝高度比例（0 腳底、1 頭頂），u＝離中線的水平距離（模型原始單位），都用「原始模型」的尺寸，程式會換算
export const JOINTS_WORKER = {
  hips: [0, 0.44], chest: [0, 0.57], neck: [0, 0.67], headTop: [0, 1.0],
  shoulder: [0.24, 0.63], elbow: [0.36, 0.46], hand: [0.47, 0.30],
  hip: [0.15, 0.44], knee: [0.17, 0.22], ankle: [0.19, 0.03],
};

const segDist = (p, a, b) => {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, l2 = abx * abx + aby * aby + abz * abz;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = p.x - (a.x + abx * t), dy = p.y - (a.y + aby * t), dz = p.z - (a.z + abz * t); return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

// geometry：載入的 GLB 裡第一個 Mesh 的幾何（含 position、color）；回傳 { root, bones, update(dt,speed,t) }
export function rigGeometry(geoIn, J = JOINTS_WORKER, opts = {}) {
  const geo = geoIn.clone(); geo.computeBoundingBox();
  const bb = geo.boundingBox, H = bb.max.y - bb.min.y;
  // 中線：以腿的位置估計（左右腳平均）；高度與前後置中
  const pos = geo.attributes.position; let sx = 0, n = 0;
  for (let i = 0; i < pos.count; i++) { if (pos.getY(i) < bb.min.y + 0.12 * H) { sx += pos.getX(i); n++; } }
  const cx = sx / n, cz = (bb.min.z + bb.max.z) / 2;
  geo.translate(-cx, -bb.min.y, -cz); geo.scale(1 / H, 1 / H, 1 / H); if (!geo.attributes.normal) geo.computeVertexNormals();   // 高度 1、腳踩 y=0、置中
  const P = (u, t) => new THREE.Vector3(u / H, t, 0);
  const jp = {
    hips: P(...J.hips), chest: P(...J.chest), neck: P(...J.neck), head: P(...J.headTop),
    shA: P(-J.shoulder[0], J.shoulder[1]), elA: P(-J.elbow[0], J.elbow[1]), haA: P(-J.hand[0], J.hand[1]),
    shB: P(J.shoulder[0], J.shoulder[1]), elB: P(J.elbow[0], J.elbow[1]), haB: P(J.hand[0], J.hand[1]),
    hpA: P(-J.hip[0], J.hip[1]), kA: P(-J.knee[0], J.knee[1]), anA: P(-J.ankle[0], J.ankle[1]),
    hpB: P(J.hip[0], J.hip[1]), kB: P(J.knee[0], J.knee[1]), anB: P(J.ankle[0], J.ankle[1]),
  };
  // 骨頭：0 root(髖/身體) 1 head 2 上臂A 3 上臂B 4 大腿A 5 大腿B 6 小腿A 7 小腿B 8 前臂A 9 前臂B（有膝蓋、手肘）
  const segs = [
    [jp.hips, jp.neck], [jp.neck, jp.head],
    [jp.shA, jp.elA], [jp.shB, jp.elB],
    [jp.hpA, jp.kA], [jp.hpB, jp.kB],
    [jp.kA, jp.anA], [jp.kB, jp.anB],
    [jp.elA, jp.haA], [jp.elB, jp.haB],
  ];
  // 各骨頭的「影響半徑」：身體大、手腳細
  const rad = [0.2, 0.2, 0.09, 0.09, 0.11, 0.11, 0.1, 0.1, 0.075, 0.075];
  const p = new THREE.Vector3(), N = pos.count;
  const si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const ws = segs.map(([a, b], k) => { const d = segDist(p, a, b); return 1 / Math.pow(d / rad[k] + 0.05, 4); });
    // 手臂：只有離中線夠遠的頂點才受手臂影響（避免背心、身體側邊被拉扯）；上臂再要求離肩膀一小段
    const lm = opts.latMul ?? 1, lateral = THREE.MathUtils.smoothstep((Math.abs(p.x) - 0.17 * lm / H) / (0.07 * lm / H), 0, 1);
    for (const k of [2, 3, 8, 9]) {
      let f = lateral;
      if (k === 2 || k === 3) { const [a, b] = segs[k]; const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z; const sParam = THREE.MathUtils.clamp(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / (abx * abx + aby * aby + abz * abz), 0, 1); f *= THREE.MathUtils.smoothstep(sParam, 0.05, 0.4); }
      if (k < 4) f *= 1 - THREE.MathUtils.smoothstep(segDist(p, segs[k][0], segs[k][1]), rad[k] * 1.8, rad[k] * 3);
      if (k >= 8) f = Math.max(f, 1 - THREE.MathUtils.smoothstep(segDist(p, segs[k][0], segs[k][1]), rad[k] * 0.5, rad[k] * 0.95));   // 前臂／手掌本體（手套）一定跟前臂走，就算貼著大腿也一樣   // 離手臂太遠的衣服側邊不跟著手臂（舉手時不會拉出黑色破面）
      ws[k] = ws[k] * f + ws[k] * 0.0005;
    }
    // 工人：手套掛在大腿旁邊，會有一部分權重被腿／身體分走，手一舉起來就被拉成白色扇形。離開身體夠遠的頂點不給腿和身體權重
    if (opts.armClean && p.y < (opts.armClean[2] ?? 9) && p.y > (opts.armClean[3] ?? 0.2)) { const m = THREE.MathUtils.smoothstep(Math.abs(p.x), opts.armClean[0], opts.armClean[1]); for (const k of [0, 4, 5, 6, 7]) ws[k] *= 1 - 0.985 * m; }   // 只處理腳踝以上：鞋子外側離中線也很遠，不能被當成手套
    if (opts.armGeo !== false) { const dF = Math.min(segDist(p, segs[8][0], segs[8][1]), segDist(p, segs[9][0], segs[9][1])), mF = 1 - THREE.MathUtils.smoothstep(dF, rad[8] * 0.5, rad[8] * 0.95); if (mF > 0) for (const k of [0, 4, 5, 6, 7]) ws[k] *= 1 - 0.985 * mF; }   // 手掌附近的頂點不給腿／身體權重（不然手套被腿拉住，手一舉就拉出一片布）
    // 腿只管髖以下、頭只管脖子以上，避免身體被帶著晃
    const t = p.y;
    if (t > J.hips[1]) { for (const k of [4, 5, 6, 7]) ws[k] *= 0.02; }
    if (t < J.neck[1] - 0.04) ws[1] *= 0.05;
    const idx = ws.map((w, k) => [w, k]).sort((a, b) => b[0] - a[0]).slice(0, 4), sum = idx.reduce((s, [w]) => s + w, 0);
    idx.forEach(([w, k], j) => { si[i * 4 + j] = k; sw[i * 4 + j] = w / sum; });
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  // 原模型是「三角形散開」的網格（每個三角形自己一組頂點），手臂貼著身體時，同一個三角形會同時跨到手臂和身體／腿；
  // 舉手時這種三角形被兩邊拉開，就變成一片白色的布把手和身體連在一起。
  // 做法：肩膀以下、頂點分屬手臂與身體（或左右手臂）的三角形，三個頂點改用同一組權重（整片跟著多數那一邊走）→ 舉手只會裂開，不會拉成布
  if (opts.cut !== false) {
    const shY = jp.shA.y - 0.02, gw = new Float32Array(N * 3), thr = opts.cutTv ?? 0.35;   // 每個頂點：身體＋腿／左手臂／右手臂 各佔多少權重
    for (let i = 0; i < N; i++) for (let j = 0; j < 4; j++) { const k = si[i * 4 + j], w = sw[i * 4 + j]; gw[i * 3 + (k === 2 || k === 8 ? 1 : k === 3 || k === 9 ? 2 : 0)] += w; }
    const tv = (p, q) => 0.5 * (Math.abs(gw[p * 3] - gw[q * 3]) + Math.abs(gw[p * 3 + 1] - gw[q * 3 + 1]) + Math.abs(gw[p * 3 + 2] - gw[q * 3 + 2]));
    let nCut = 0; const keep = [];
    const ix = geo.index ? geo.index.array : null, nI = ix ? ix.length : N;
    for (let t = 0; t < nI; t += 3) {
      const a = ix ? ix[t] : t, b = ix ? ix[t + 1] : t + 1, c = ix ? ix[t + 2] : t + 2;
      if (Math.max(pos.getY(a), pos.getY(b), pos.getY(c)) <= shY && (tv(a, b) > thr || tv(b, c) > thr || tv(a, c) > thr)) { nCut++; continue; }   // 一邊跟手臂、一邊跟身體／腿的三角形：舉手時會被拉成布條或尖刺，直接拿掉
      keep.push(a, b, c);
    }
    geo.setIndex(keep);
    geo.userData.cutTris = nCut;
  }
  // 頂點色（trimesh 寫出的 0..1 數值）
  if (geo.attributes.color) {
    const c = geo.attributes.color, out = new Float32Array(c.count * 3), col = new THREE.Color();
    const gain = opts.colorGain ?? 1.3;   // 頂點色當作線性值直接用（比轉換後更接近概念圖亮度）
    for (let i = 0; i < c.count; i++) { out[i * 3] = Math.min(1, c.getX(i) * gain); out[i * 3 + 1] = Math.min(1, c.getY(i) * gain); out[i * 3 + 2] = Math.min(1, c.getZ(i) * gain); }
    geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  }
  // 骨架（骨頭位置用世界座標，再換成相對父骨）
  const bones = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => new THREE.Bone());
  const pivot = [jp.hips, jp.neck, jp.shA, jp.shB, jp.hpA, jp.hpB, jp.kA, jp.kB, jp.elA, jp.elB];
  const parent = [-1, 0, 0, 0, 0, 0, 4, 5, 2, 3];
  bones.forEach((b, i) => { b.position.copy(pivot[i]); if (parent[i] >= 0) { b.position.sub(pivot[parent[i]]); bones[parent[i]].add(b); } });
  const ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const mat = opts.soft && opts.map ? new THREE.MeshLambertMaterial({ map: opts.map }) : opts.map ? new THREE.MeshToonMaterial({ map: opts.map, gradientMap: ramp }) : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });   // soft：真人感的角色用柔和打光，不用卡通三階色
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.frustumCulled = false;
  // 描邊：往外推一圈、只畫背面的深色殼，跟其他角色的卡通風格一致
  const olMat = new THREE.MeshBasicMaterial({ color: opts.soft ? 0x3a2c28 : 0x1c140f, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 12, polygonOffsetUnits: 12 });
  olMat.onBeforeCompile = (sh) => { sh.uniforms.ow = { value: opts.outline ?? (opts.soft ? 0.0028 : opts.map ? 0.006 : 0.012) }; sh.vertexShader = 'uniform float ow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize( normal ) * ow;'); };
  const outline = new THREE.SkinnedMesh(geo, olMat); outline.frustumCulled = false; outline.renderOrder = -1;
  const root = new THREE.Group(); root.add(bones[0]); root.add(mesh); root.add(outline);
  root.updateMatrixWorld(true);   // 先更新骨頭的世界座標，bind 時才算得出正確的反矩陣
  const skel = new THREE.Skeleton(bones); mesh.bind(skel); outline.bind(skel);
  const base = bones.map((b) => b.position.clone()); const hipsY = pivot[0].y;

  let phase = 0, w = 0, jk = 0, hurtK = 0, climbK = 0;
  const SM = (cur, target, dt, rate) => cur + (target - cur) * Math.min(1, dt * rate);
  // st：{ hurt: 受傷（0..1）, climb: 正在爬梯 }
  function update(dt, speed = 0, t = 0, st = {}) {
    const moving = speed > 0.05 || st.climb;
    w = SM(w, moving ? 1 : 0, dt, 10); jk = SM(jk, speed > 1.3 ? 1 : 0, dt, 8); hurtK = SM(hurtK, st.hurt ? 1 : 0, dt, 18); climbK = SM(climbK, st.climb ? 1 : 0, dt, 12);
    phase += dt * (4 + speed * 4.2) * (1 + 0.25 * jk);
    const sn = Math.sin(phase), cs = Math.cos(phase), idle = 1 - w;
    const amp = (0.58 + 0.17 * jk) * (1 - climbK);   // 步幅小一點：後腳不會甩得又高又長（鞋子大的角色會變成一長條殘影）   // 擺幅：跑步更大
    const sL = sn * amp * w;
    // 腿：大腿前後擺；小腿在腿往前抬起時彎膝
    bones[4].rotation.set(sL, 0, 0); bones[5].rotation.set(-sL, 0, 0);
    const kneeA = (Math.max(0, -cs) * (0.7 + 0.2 * jk) + 0.08) * w, kneeB = (Math.max(0, cs) * (0.7 + 0.2 * jk) + 0.08) * w;
    bones[6].rotation.set(kneeA, 0, 0); bones[7].rotation.set(kneeB, 0, 0);
    // 手臂：和同側腿反向擺，手肘隨擺動彎曲（跑步時彎得更多）
    const armA = -sL * 0.95, armB = sL * 0.95;   // 跑步：手臂前後擺，手肘彎成直角（像真的在跑，不會伸直甩來甩去）
    const flare = 0.1 * w;   // 稍微離開身體，從側面看兩隻手才分得開
    bones[2].rotation.set(armA, 0, 0.06 + flare); bones[3].rotation.set(armB, 0, -0.06 - flare);
    const elbow = (0.25 + 0.95 * jk);   // 走路微彎、跑步約 90 度
    bones[8].rotation.set(-(elbow + Math.max(0, -armA) * 0.35) * w, 0, 0); bones[9].rotation.set(-(elbow + Math.max(0, -armB) * 0.35) * w, 0, 0);
    // 身體：上下彈跳、左右搖擺、轉體；跑步前傾；待機時呼吸、重心輕晃
    bones[0].position.y = base[0].y + Math.abs(sn) * (0.04 + 0.02 * jk) * w + idle * Math.sin(t * 2.2) * 0.006;
    bones[0].rotation.set((0.05 + 0.2 * jk) * w, sn * 0.12 * w, sn * 0.045 * w + idle * Math.sin(t * 1.1) * 0.015);
    bones[1].rotation.set(-0.05 * w + Math.sin(phase * 2) * 0.03 * w, -sn * 0.1 * w + idle * Math.sin(t * 0.8) * 0.18, -sn * 0.03 * w);   // 頭：反向抵銷、輕點頭；待機時左顧右盼
    bones[2].rotation.z += idle * Math.sin(t * 1.7) * 0.05; bones[3].rotation.z -= idle * Math.sin(t * 1.7 + 1) * 0.05;   // 待機手臂輕晃
    // 爬梯：雙手交替向上抓、雙腳交替踩
    if (climbK > 0.01) {
      const c = climbK, up = Math.sin(phase * 1.2);
      // 爬梯：手往前上方伸（朝梯子），不側舉——側舉會把衣服側邊拉成一片「翅膀」
      bones[2].rotation.x = THREE.MathUtils.lerp(bones[2].rotation.x, -(0.55 + 0.4 * up), c); bones[3].rotation.x = THREE.MathUtils.lerp(bones[3].rotation.x, -(0.55 - 0.4 * up), c);
      bones[2].rotation.z = THREE.MathUtils.lerp(bones[2].rotation.z, 0.04, c); bones[3].rotation.z = THREE.MathUtils.lerp(bones[3].rotation.z, -0.04, c);
      bones[8].rotation.x = THREE.MathUtils.lerp(bones[8].rotation.x, -0.5 - 0.5 * Math.max(0, -up), c); bones[9].rotation.x = THREE.MathUtils.lerp(bones[9].rotation.x, -0.5 - 0.5 * Math.max(0, up), c);
      bones[4].rotation.x = THREE.MathUtils.lerp(bones[4].rotation.x, up * 0.7, c); bones[5].rotation.x = THREE.MathUtils.lerp(bones[5].rotation.x, -up * 0.7, c);
      bones[6].rotation.x = THREE.MathUtils.lerp(bones[6].rotation.x, Math.max(0, -up) * 0.9, c); bones[7].rotation.x = THREE.MathUtils.lerp(bones[7].rotation.x, Math.max(0, up) * 0.9, c);
    }
    // 受傷：身體後仰、雙手甩開、頭歪一邊
    if (hurtK > 0.01) {
      const h = hurtK;
      bones[0].rotation.x = THREE.MathUtils.lerp(bones[0].rotation.x, -0.3, h); bones[1].rotation.z += 0.25 * h;
      bones[2].rotation.z -= 0.8 * h; bones[3].rotation.z += 0.8 * h; bones[8].rotation.x = THREE.MathUtils.lerp(bones[8].rotation.x, -0.2, h); bones[9].rotation.x = THREE.MathUtils.lerp(bones[9].rotation.x, -0.2, h);
    }
  }
  return { root, mesh, bones, update, setPhase: (p) => { phase = p; w = 1; update(0, 1, 0); } };
}
