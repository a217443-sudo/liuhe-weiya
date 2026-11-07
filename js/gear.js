// 裝備：幫現有 3D 角色（共用 Mixamo 骨架）在 Head 骨頭上加安全帽、護目鏡、口罩
// 配件放進一個抵銷 Head 縮放的群組，座標就能直接用「角色 1 單位高」計算
import * as THREE from 'three';

const mat = (c) => new THREE.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: 0.32 });

// opts: { hat: 0xffd21f, mask: true, goggles: true, ponytail: false, hy: 頭中心高度, hr: 頭半徑 }
export function addGear(actor, opts = {}) {
  let head = null; actor.model.traverse((o) => { if (o.name === 'Head') head = o; });
  if (!head) return;
  const U = 1 / head.getWorldScale(new THREE.Vector3()).x;   // 抵銷骨頭的縮放（自製角色的頭是 1）
  const g = new THREE.Group(); g.scale.setScalar(U); g.name = 'gear';
  const { hy = 0.12, hr = 0.2, hat = 0xffd21f } = opts;   // 相對 Head 骨頭的頭中心高度、頭半徑（角色單位）
  if (opts.chef) {   // 大廚超人：白色高帽
    const w = mat(0xffffff);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.95, hr * 0.9, hr * 0.7, 20), w); band.position.set(0, hy + hr * 0.95, 0); g.add(band);
    for (const [x, y, z, s] of [[0, 1.75, 0, 0.75], [-0.5, 1.5, 0, 0.55], [0.5, 1.5, 0, 0.55], [0, 1.5, 0.45, 0.5], [0, 1.5, -0.45, 0.5]]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(hr * s, 14, 10), w); p.position.set(x * hr, hy + y * hr, z * hr); g.add(p);
    }
    head.add(g); return g;
  }
  // 安全帽：半球＋帽簷＋中間一條脊
  const dome = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.08, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hat));
  dome.position.set(0, hy + hr * 0.12, 0); g.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(hr * 1.2, hr * 1.2, hr * 0.07, 24, 1), mat(hat));
  brim.position.set(0, hy + hr * 0.1, hr * 0.12); brim.scale.set(1, 1, 1.18); g.add(brim);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(hr * 0.16, hr * 0.1, hr * 1.9), mat(hat === 0xffffff ? 0xdddddd : 0xe0a800));
  ridge.position.set(0, hy + hr * 1.18, 0); g.add(ridge);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(hr * 0.22, 16), mat(0xe53935));   // 帽前紅色徽章
  badge.position.set(0, hy + hr * 0.62, hr * 1.075); g.add(badge);
  if (opts.goggles) {   // 護目鏡：深色橫條＋兩個鏡片
    const band = new THREE.Mesh(new THREE.BoxGeometry(hr * 2.15, hr * 0.42, hr * 0.14), mat(0x20262e));
    band.position.set(0, hy - hr * 0.1, hr * 0.98); g.add(band);
  }
  if (opts.mask) {   // 口罩（藍色）：遮住下半臉
    const m = new THREE.Mesh(new THREE.BoxGeometry(hr * 1.5, hr * 0.62, hr * 0.28), mat(0x4aa8d8));
    m.position.set(0, hy - hr * 0.62, hr * 0.92); g.add(m);
  }
  if (opts.ponytail) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.32, 12, 10), mat(0x3a2418));
    t.position.set(0, hy - hr * 0.1, -hr * 1.05); t.scale.set(1, 1.7, 1); g.add(t);
  }
  head.add(g);
  return g;
}
