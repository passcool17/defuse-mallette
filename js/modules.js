// Les 5 modules (reflet du kit ESP32 de Pascal) + panneau de contrôle : plaques rétroéclairées (CanvasTexture),
// pièces 3D, DEL instanciées et zones tactiles en pixels de plaque (512 × 488, origine en haut à gauche = côté couvercle).
import * as THREE from 'three';
import { PLATE } from './case-model.js';

export const HEX = { Rouge: '#ff2b2b', Vert: '#2bff63', Bleu: '#2f86ff', Jaune: '#ffd21f', Blanc: '#f4f4f4', Noir: '#202226', Neutre: '#bfe3ff', Mauve: '#b98bff' };
const WIRE_HEX = { Rouge: 0xd8201c, Bleu: 0x1f5fe0, Jaune: 0xf2c513, Blanc: 0xf0f0ea, Noir: 0x16171a, Vert: 0x1fa846 };
const CW = PLATE.CW, CH = PLATE.CH;
const toLocal = (px, py, y = 0) => new THREE.Vector3((px / CW - 0.5) * PLATE.W, y, (py / CH - 0.5) * PLATE.D);
const MM = PLATE.W / CW; // mètres par pixel de plaque
export const LAYOUT = {
  fils: { rows: [100, 160, 220, 280, 340, 400], x0: 92, x1: 424 },
  clavier: { xs: [118, 214, 310, 406], ys: [128, 216, 304, 392], key: 80 },
  joystick: { c: [256, 236], r: 118, seq: [92, 432], prog: [300, 336, 372, 408], progY: 432 },
  rfid: { reader: [256, 168], tags: [[104, 352], [256, 352], [408, 352], [104, 436], [256, 436], [408, 436]] },
  inclinaison: { c: [256, 258], r: 150 },
  ctrl: { seg: [256, 112], oled: [150, 262], buzzer: [400, 262], hint: [96, 410], status: [210, 260, 310, 360, 410], statusY: 392, err: 432 }
};

// ---------- Dessin des plaques ----------
function plateBase(x, glow, title, num) {
  const g = x.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, '#15191f'); g.addColorStop(1, '#0a0c10');
  x.fillStyle = g; x.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; x.fillRect(Math.random() * CW, Math.random() * CH, 1, 1); }
  // bord rétroéclairé (acrylique gravé)
  x.save(); x.shadowColor = glow; x.shadowBlur = 22; x.strokeStyle = glow; x.lineWidth = 5; x.globalAlpha = 0.95;
  x.strokeRect(10, 10, CW - 20, CH - 20); x.restore();
  x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1; x.strokeRect(20, 20, CW - 40, CH - 40);
  if (title) {
    x.save(); x.shadowColor = glow; x.shadowBlur = 10; x.fillStyle = glow;
    x.beginPath(); x.arc(48, 46, 17, 0, 7); x.lineWidth = 3; x.strokeStyle = glow; x.stroke();
    x.font = '800 22px system-ui, Roboto, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(num, 48, 47);
    x.textAlign = 'left'; x.font = '800 26px system-ui, Roboto, sans-serif'; x.fillText(title, 76, 47); x.restore();
  }
}
function engrave(x, s, X, Y, size, col, align = 'center', blur = 8) {
  x.save(); x.font = `800 ${size}px system-ui, Roboto, sans-serif`; x.textAlign = align; x.textBaseline = 'middle';
  x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; x.fillText(s, X, Y); x.restore();
}
const DRAW = {
  fils(x, R) {
    const c = HEX.Neutre; plateBase(x, c, 'FILS', '1'); const L = LAYOUT.fils;
    L.rows.forEach((y, i) => {
      engrave(x, String(i + 1), 46, y, 24, c);
      for (const X of [L.x0 - 14, L.x1 + 14]) { x.fillStyle = '#2a2e35'; x.fillRect(X - 16, y - 13, 32, 26); x.strokeStyle = 'rgba(191,227,255,.35)'; x.strokeRect(X - 16, y - 13, 32, 26); }
      x.strokeStyle = 'rgba(191,227,255,.10)'; x.setLineDash([4, 6]); x.beginPath(); x.moveTo(L.x0 + 6, y); x.lineTo(L.x1 - 6, y); x.stroke(); x.setLineDash([]);
    });
  },
  clavier(x, R) {
    const c = HEX[R.keypadColor]; plateBase(x, c, 'CLAVIER', '2'); const L = LAYOUT.clavier;
    x.save(); x.shadowColor = c; x.shadowBlur = 26; x.strokeStyle = c; x.lineWidth = 3; x.globalAlpha = 0.9;
    x.strokeRect(L.xs[0] - 50, L.ys[0] - 50, L.xs[3] - L.xs[0] + 100, L.ys[3] - L.ys[0] + 100); x.restore();
    for (const X of L.xs) for (const Y of L.ys) { const g = x.createRadialGradient(X, Y, 10, X, Y, 52); g.addColorStop(0, c + '88'); g.addColorStop(1, 'transparent'); x.fillStyle = g; x.fillRect(X - 52, Y - 52, 104, 104); }
  },
  joystick(x, R) {
    const c = HEX.Mauve; plateBase(x, c, 'JOYSTICK', '3'); const L = LAYOUT.joystick, [cx, cy] = L.c;
    x.save(); x.shadowColor = c; x.shadowBlur = 16; x.strokeStyle = c; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, L.r, 0, 7); x.stroke();
    x.globalAlpha = 0.35; x.beginPath(); x.arc(cx, cy, L.r * 0.55, 0, 7); x.stroke(); x.restore();
    const lab = [['HAUT', 0, -1], ['DROITE', 1, 0], ['BAS', 0, 1], ['GAUCHE', -1, 0]];
    for (const [s, dx, dy] of lab) {
      const X = cx + dx * (L.r + 26), Y = cy + dy * (L.r + 22);
      x.save(); x.translate(cx + dx * (L.r - 18), cy + dy * (L.r - 18)); x.rotate(Math.atan2(dy, dx) + Math.PI / 2);
      x.fillStyle = c; x.shadowColor = c; x.shadowBlur = 8; x.beginPath(); x.moveTo(0, -12); x.lineTo(10, 4); x.lineTo(-10, 4); x.fill(); x.restore();
      engrave(x, s, dx ? X + dx * 14 : X, Y, 17, c);
    }
    engrave(x, 'SÉQUENCE', L.seq[0] + 32, L.seq[1], 17, HEX.Neutre, 'left');
    engrave(x, 'SAISIE', L.prog[0] - 22, L.progY, 15, 'rgba(191,227,255,.6)', 'right', 0);
  },
  rfid(x, R) {
    const c = HEX.Neutre; plateBase(x, c, 'BADGE RFID', '4'); const [rx, ry] = LAYOUT.rfid.reader;
    x.fillStyle = '#1c2027'; x.fillRect(rx - 110, ry - 80, 220, 160);
    x.save(); x.strokeStyle = c; x.shadowColor = c; x.shadowBlur = 10; x.lineWidth = 2; x.strokeRect(rx - 110, ry - 80, 220, 160);
    for (let i = 1; i <= 3; i++) { x.globalAlpha = 0.25 + i * 0.2; x.beginPath(); x.arc(rx - 30, ry, i * 22, -0.8, 0.8); x.stroke(); }
    x.restore(); engrave(x, 'LECTEUR', rx + 168, ry - 66, 16, 'rgba(191,227,255,.7)', 'center', 0);
    engrave(x, 'BADGES', 34, 300, 15, 'rgba(191,227,255,.55)', 'left', 0);
  },
  inclinaison(x, R) {
    const c = HEX[R.tiltColor]; plateBase(x, c, 'INCLINAISON', '5'); const { c: [cx, cy], r } = LAYOUT.inclinaison;
    const g = x.createRadialGradient(cx, cy, 10, cx, cy, r); g.addColorStop(0, '#0b0e12'); g.addColorStop(0.8, '#11151b'); g.addColorStop(1, c + '55');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.save(); x.shadowColor = c; x.shadowBlur = 20; x.strokeStyle = c; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
    x.beginPath(); x.arc(cx, cy, r * 0.32, 0, 7); x.stroke();
    engrave(x, 'ARRIÈRE', cx, cy - r - 20, 16, c); engrave(x, 'AVANT', cx, cy + r + 20, 16, c);
    engrave(x, 'GAUCHE', cx - r + 8, cy - r + 12, 15, c, 'left'); engrave(x, 'DROITE', cx + r - 8, cy - r + 12, 15, c, 'right');
    engrave(x, 'SEC.', 440, 440, 15, 'rgba(191,227,255,.7)', 'center', 0);
  },
  ctrl(x, R, opts) {
    const c = HEX.Neutre; plateBase(x, c, null); const L = LAYOUT.ctrl;
    x.fillStyle = '#050505'; x.fillRect(L.seg[0] - 190, L.seg[1] - 70, 380, 140);
    x.fillStyle = '#0c0f14'; x.fillRect(L.oled[0] - 118, L.oled[1] - 62, 236, 124); x.strokeStyle = 'rgba(191,227,255,.3)'; x.strokeRect(L.oled[0] - 118, L.oled[1] - 62, 236, 124);
    engrave(x, 'OLED', L.oled[0] - 108, L.oled[1] - 76, 13, 'rgba(191,227,255,.6)', 'left', 0);
    engrave(x, 'BUZZER', L.buzzer[0], L.buzzer[1] + 66, 13, 'rgba(191,227,255,.6)', 'center', 0);
    engrave(x, 'INDICE', L.hint[0], L.hint[1] + 52, 15, HEX.Jaune, 'center', 6);
    L.status.forEach((X, i) => engrave(x, String(i + 1), X, L.statusY - 24, 15, c, 'center', 4));
    engrave(x, 'ERREURS', 186, L.err, 13, 'rgba(255,90,80,.8)', 'right', 0);
  }
};

// ---------- DEL instanciées (+ halo additif) ----------
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
function createLeds(root, max) {
  const geo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), max); mesh.name = 'LEDs';
  const hgeo = new THREE.PlaneGeometry(1, 1); hgeo.rotateX(-Math.PI / 2);
  const halo = new THREE.InstancedMesh(hgeo, new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), max);
  halo.name = 'LED_Glow'; halo.renderOrder = 2;
  mesh.count = halo.count = 0; mesh.frustumCulled = halo.frustumCulled = false;
  root.add(mesh, halo);
  const list = [], m4 = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion();
  const api = {
    add(mount, px, py, sizePx = 12, haloK = 5) {
      const i = list.length; const p = toLocal(px, py, 0.0015); mount.updateWorldMatrix(true, false); root.updateWorldMatrix(true, false);
      const rel = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mount.matrixWorld);
      const r = sizePx * MM / 2;
      list.push({ rel, p, r, haloK, color: new THREE.Color(0x222222), k: 0 });
      mesh.count = halo.count = list.length; api.set(i, 0x222222, 0); return i;
    },
    set(i, hex, k) { // k : 0 éteinte … 1 pleine
      const L = list[i]; if (!L) return; L.color.set(hex); L.k = k;
      col.copy(L.color).multiplyScalar(0.12 + 0.88 * k); mesh.setColorAt(i, col);
      m4.compose(L.p, q.identity(), new THREE.Vector3(L.r, L.r * 0.7, L.r)).premultiply(L.rel); mesh.setMatrixAt(i, m4);
      col.copy(L.color).multiplyScalar(k * 0.9); halo.setColorAt(i, col);
      const hs = L.r * 2 * L.haloK * (0.4 + 0.6 * k);
      m4.compose(L.p, q.identity(), new THREE.Vector3(hs, 1, hs)).premultiply(L.rel); halo.setMatrixAt(i, m4);
      mesh.instanceColor.needsUpdate = halo.instanceColor.needsUpdate = mesh.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true;
    },
    mesh, halo
  };
  return api;
}

// ---------- Maillage instancié avec atlas (étiquettes des touches et badges) ----------
function atlasInstanced(geo, mat, count, cols, rows) {
  const cell = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { cell[i * 2] = (i % cols) / cols; cell[i * 2 + 1] = 1 - (Math.floor(i / cols) + 1) / rows; }
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * vec2(${(1 / cols).toFixed(6)}, ${(1 / rows).toFixed(6)}) + aCell;\n#endif\n#ifdef USE_EMISSIVEMAP\n vEmissiveMapUv = vEmissiveMapUv * vec2(${(1 / cols).toFixed(6)}, ${(1 / rows).toFixed(6)}) + aCell;\n#endif`);
  };
  mat.customProgramCacheKey = () => 'atlas' + cols + 'x' + rows;
  const mesh = new THREE.InstancedMesh(geo, mat, count); mesh.frustumCulled = false; return mesh;
}
// boîte dont seule la face du dessus porte l'étiquette (les autres faces lisent un coin uni de la cellule)
function capGeometry(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) if (f !== 2) for (let v = 0; v < 4; v++) uv.setXY(f * 4 + v, 0.03, 0.03);
  return g;
}
function canvasTexture(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ---------- Fils ----------
function wireCurve(a, b, sag) { const m = a.clone().lerp(b, 0.5); m.y += sag; return new THREE.CatmullRomCurve3([a, a.clone().lerp(m, 0.5).setY(a.y + sag * 0.8), m, b.clone().lerp(m, 0.5).setY(b.y + sag * 0.8), b]); }
const tube = (curve) => new THREE.TubeGeometry(curve, 28, 0.0034, 7, false);
function mergeTwo(g1, g2) { // fusion simple de deux TubeGeometry (indexées)
  const g = new THREE.BufferGeometry(); const n1 = g1.attributes.position.count;
  for (const k of ['position', 'normal', 'uv']) { const a = g1.attributes[k], b = g2.attributes[k]; const arr = new Float32Array(a.array.length + b.array.length); arr.set(a.array); arr.set(b.array, a.array.length); g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize)); }
  const i1 = g1.index.array, i2 = g2.index.array, idx = new Uint32Array(i1.length + i2.length); idx.set(i1); for (let i = 0; i < i2.length; i++) idx[i1.length + i] = i2[i] + n1; g.setIndex(new THREE.BufferAttribute(idx, 1));
  g1.dispose(); g2.dispose(); return g;
}

// ====================================================================================================
export function createModules(C, M, hooks) {
  const root = C.root, mounts = C.mounts;
  const leds = createLeds(root, 64);
  const metalMat = M.metal, blackMat = M.black;
  const plates = {};
  const MOD_MOUNT = { fils: 'Panel_1', clavier: 'Panel_2', joystick: 'Panel_3', rfid: 'Panel_4', inclinaison: 'Panel_5', ctrl: 'Panel_Ctrl' };
  for (const [id, mname] of Object.entries(MOD_MOUNT)) {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.28, metalness: 0.0 });
    mat.name = 'Plate_' + id;
    const g = new THREE.PlaneGeometry(PLATE.W, PLATE.D); g.rotateX(-Math.PI / 2); g.translate(0, 0.0012, 0);
    const mesh = new THREE.Mesh(g, mat); mesh.name = 'Plate_' + id; mesh.userData.module = id; mounts[mname].add(mesh);
    plates[id] = { canvas: c, tex: t, mat, mesh, mount: mounts[mname] };
  }
  const relOf = mount => { mount.updateWorldMatrix(true, false); root.updateWorldMatrix(true, false); return new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mount.matrixWorld); };
  const statusLed = {}; // DEL d'état dans l'en-tête de chaque module + rangée du panneau de contrôle
  const ids = ['fils', 'clavier', 'joystick', 'rfid', 'inclinaison'];
  ids.forEach((id, i) => { statusLed[id] = [leds.add(plates[id].mount, 466, 46, 16, 4), leds.add(plates.ctrl.mount, LAYOUT.ctrl.status[i], LAYOUT.ctrl.statusY, 15, 4)]; });
  const errLeds = []; for (let i = 0; i < 9; i++) errLeds.push(leds.add(plates.ctrl.mount, 206 + i * 31, LAYOUT.ctrl.err, 11, 3));

  // ----- Fils -----
  const wires = [], wireMats = {};
  for (const [k, v] of Object.entries(WIRE_HEX)) wireMats[k] = Object.assign(new THREE.MeshStandardMaterial({ color: v, roughness: 0.42, metalness: 0.05 }), { name: 'Wire_' + k });
  const termGeo = [];
  for (let i = 0; i < 6; i++) {
    const y = LAYOUT.fils.rows[i];
    for (const X of [LAYOUT.fils.x0 - 14, LAYOUT.fils.x1 + 14]) { const g = new THREE.CylinderGeometry(0.0032, 0.0032, 0.006, 10); const p = toLocal(X, y, 0.004); g.translate(p.x, p.y, p.z); termGeo.push(g); }
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), wireMats.Rouge); mesh.name = 'Wire_' + (i + 1); mesh.visible = false; plates.fils.mount.add(mesh);
    wires.push({ mesh, cut: false, anim: 0, cutX: 0 });
  }
  const termMesh = new THREE.Mesh(mergeGeoms(termGeo), metalMat); termMesh.name = 'Wire_Terminals'; plates.fils.mount.add(termMesh);
  function wireEnds(i) { const y = LAYOUT.fils.rows[i]; return [toLocal(LAYOUT.fils.x0, y, 0.006), toLocal(LAYOUT.fils.x1, y, 0.006)]; }
  function buildWire(i, k) { // k : 0 intact … 1 coupé et retombé
    const w = wires[i], [a, b] = wireEnds(i);
    if (!w.cut) { w.mesh.geometry.dispose(); w.mesh.geometry = tube(wireCurve(a, b, 0.009 + (i % 2) * 0.002)); return; }
    const cp = toLocal(w.cutX, LAYOUT.fils.rows[i], 0.015), gap = 0.006 + 0.004 * k;
    const ea = cp.clone(); ea.x -= gap; ea.y = 0.015 - 0.011 * k; ea.z += 0.006 * k;
    const eb = cp.clone(); eb.x += gap; eb.y = 0.015 - 0.011 * k; eb.z -= 0.005 * k;
    const ca = new THREE.CatmullRomCurve3([a, a.clone().lerp(ea, 0.5).setY(0.014), ea]);
    const cb = new THREE.CatmullRomCurve3([eb, b.clone().lerp(eb, 0.5).setY(0.014), b]);
    w.mesh.geometry.dispose(); w.mesh.geometry = mergeTwo(new THREE.TubeGeometry(ca, 14, 0.0034, 7, false), new THREE.TubeGeometry(cb, 14, 0.0034, 7, false));
  }

  // ----- Clavier -----
  const KEYS = hooks.KEYS;
  let keyAtlas = null;
  const keyMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 1 });
  const keyGeo = capGeometry(0.0255, 0.008, 0.0255);
  const keys = atlasInstanced(keyGeo, keyMat, 16, 4, 4); keys.name = 'Keypad_Keys'; root.add(keys);
  const keyRel = relOf(plates.clavier.mount), keyDown = new Float32Array(16);
  function drawKeyAtlas(color) {
    if (keyAtlas) keyAtlas.dispose();
    keyAtlas = canvasTexture(512, 512, x => {
      for (let i = 0; i < 16; i++) {
        const X = (i % 4) * 128, Y = Math.floor(i / 4) * 128, k = KEYS[i], letter = /[A-D]/.test(k), sym = k === '*' || k === '#';
        const g = x.createLinearGradient(X, Y, X, Y + 128); g.addColorStop(0, letter ? '#262a33' : '#2b2f37'); g.addColorStop(1, '#16181d');
        x.fillStyle = g; x.fillRect(X, Y, 128, 128); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 4; x.strokeRect(X + 4, Y + 4, 120, 120);
        x.font = `800 ${sym ? 74 : 66}px system-ui, Roboto, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.shadowColor = color; x.shadowBlur = 12; x.fillStyle = letter ? '#ffffff' : color; x.fillText(k, X + 64, Y + 68); x.shadowBlur = 0;
      }
      x.fillStyle = '#17191e'; x.fillRect(0, 512 - 16, 16, 16); // coin uni pour les côtés
    });
    keyMat.map = keyAtlas; keyMat.emissiveMap = keyAtlas; keyMat.needsUpdate = true;
  }
  function layoutKeys() {
    const m = new THREE.Matrix4();
    for (let i = 0; i < 16; i++) { const p = toLocal(LAYOUT.clavier.xs[i % 4], LAYOUT.clavier.ys[Math.floor(i / 4)], 0.005 - keyDown[i] * 0.003); m.makeTranslation(p.x, p.y, p.z).premultiply(keyRel); keys.setMatrixAt(i, m); }
    keys.instanceMatrix.needsUpdate = true;
  }

  // ----- Joystick -----
  const joy = new THREE.Group(); joy.name = 'Joystick_Stick'; const jc = toLocal(...LAYOUT.joystick.c, 0.004); joy.position.copy(jc); plates.joystick.mount.add(joy);
  const jbase = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.008, 28), blackMat); jbase.position.copy(jc); jbase.position.y = 0.004; plates.joystick.mount.add(jbase);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0045, 0.03, 12), metalMat); shaft.position.y = 0.015; joy.add(shaft);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 20, 12), Object.assign(new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.75 }), { name: 'Rubber' })); knob.scale.y = 0.75; knob.position.y = 0.032; joy.add(knob);
  const seqLed = leds.add(plates.joystick.mount, LAYOUT.joystick.seq[0], LAYOUT.joystick.seq[1], 26, 4);
  const progLeds = LAYOUT.joystick.prog.map(X => leds.add(plates.joystick.mount, X, LAYOUT.joystick.progY, 12, 3));
  const joyState = { v: new THREE.Vector2(), armed: true, down: null };

  // ----- RFID -----
  const tagMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.0 });
  tagMat.map = canvasTexture(768, 320, x => {
    hooks.BADGES.forEach((b, i) => {
      const X = (i % 3) * 256, Y = Math.floor(i / 3) * 160;
      x.fillStyle = '#e9ecef'; x.fillRect(X, Y, 256, 160); x.fillStyle = b.color === 'Blanc' ? '#c9ced6' : HEX[b.color]; x.fillRect(X, Y, 54, 160);
      x.fillStyle = '#1a1d22'; x.font = '900 92px system-ui, Roboto, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(b.n), X + 112, Y + 74);
      x.font = '800 28px system-ui, Roboto, sans-serif'; x.textAlign = 'left'; x.fillText(b.name, X + 150, Y + 56);
      x.font = '600 20px system-ui, Roboto, sans-serif'; x.fillStyle = '#5b6470'; x.fillText('ACCÈS', X + 150, Y + 92);
      x.strokeStyle = '#9aa3ad'; x.lineWidth = 3; for (let k = 1; k <= 3; k++) { x.beginPath(); x.arc(X + 168, Y + 126, k * 7, -0.9, 0.9); x.stroke(); }
    });
    x.fillStyle = '#9aa0a8'; x.fillRect(0, 320 - 10, 10, 10);
  });
  const tags = atlasInstanced(capGeometry(0.044, 0.004, 0.0255), tagMat, 6, 3, 2); tags.name = 'RFID_Badges'; root.add(tags);
  const tagRel = relOf(plates.rfid.mount);
  const tagAnim = [0, 0, 0, 0, 0, 0], tagRead = [false, false, false, false, false, false]; const TAG_MS = 900;
  const readerLeds = [[-96, -66], [96, -66], [-96, 66], [96, 66], [0, -66], [0, 66]].map(([dx, dy]) => leds.add(plates.rfid.mount, LAYOUT.rfid.reader[0] + dx, LAYOUT.rfid.reader[1] + dy, 11, 4));
  const readerCenter = leds.add(plates.rfid.mount, LAYOUT.rfid.reader[0] - 30, LAYOUT.rfid.reader[1], 10, 9);
  function layoutTags() {
    const m = new THREE.Matrix4(), rc = toLocal(...LAYOUT.rfid.reader, 0.006);
    for (let i = 0; i < 6; i++) {
      const home = toLocal(...LAYOUT.rfid.tags[i], 0.0035), k = tagAnim[i] ? Math.min(1, (performance.now() - tagAnim[i]) / TAG_MS) : 0;
      const s = k <= 0 ? 0 : k < 0.45 ? k / 0.45 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; // aller · pause sur le lecteur · retour
      const p = home.clone().lerp(rc, s); p.y += Math.sin(Math.min(1, s) * Math.PI) * 0.03 * (k < 0.6 ? 1 : 0.6);
      m.makeTranslation(p.x, p.y, p.z).premultiply(tagRel); tags.setMatrixAt(i, m);
    }
    tags.instanceMatrix.needsUpdate = true;
  }

  // ----- Inclinaison -----
  const marble = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 20, 12), Object.assign(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.3 }), { name: 'Tilt_Marble' }));
  marble.name = 'Tilt_Marble'; plates.inclinaison.mount.add(marble);
  const tiltLeds = { Arrière: [0, -1], Droite: [1, 0], Avant: [0, 1], Gauche: [-1, 0] };
  const tiltLedIdx = {}; for (const [k, [dx, dy]] of Object.entries(tiltLeds)) tiltLedIdx[k] = leds.add(plates.inclinaison.mount, LAYOUT.inclinaison.c[0] + dx * (LAYOUT.inclinaison.r - 22), LAYOUT.inclinaison.c[1] + dy * (LAYOUT.inclinaison.r - 22), 14, 4);
  const shakeLed = leds.add(plates.inclinaison.mount, 440, 412, 14, 4);
  const tilt = { v: new THREE.Vector2(), target: new THREE.Vector2(), hold: 0, dir: null, armed: true, shakeFlash: 0, lastShake: 0, drag: null };

  // ----- Contrôle : 7 segments, OLED, buzzer, bouton Indice -----
  const ctrlM = plates.ctrl.mount;
  const plane = (w, d, mat, px, py, y) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const p = toLocal(px, py, y); g.translate(p.x, p.y, p.z); const m = new THREE.Mesh(g, mat); ctrlM.add(m); return m; };
  const segMesh = plane(368 * MM, 132 * MM, hooks.seg.mat, ...LAYOUT.ctrl.seg, 0.0022); segMesh.name = 'Timer_7Seg';
  const oledMesh = plane(224 * MM, 112 * MM, hooks.oled.mat, ...LAYOUT.ctrl.oled, 0.0022); oledMesh.name = 'OLED';
  const bz = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.015, 0.009, 28), blackMat); bz.position.copy(toLocal(...LAYOUT.ctrl.buzzer, 0.0045)); bz.name = 'Buzzer'; ctrlM.add(bz);
  const hintBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0125, 0.008, 28), Object.assign(new THREE.MeshStandardMaterial({ color: 0xffc21a, emissive: 0xffa000, emissiveIntensity: 0.55, roughness: 0.35 }), { name: 'LED_HintButton' }));
  hintBtn.position.copy(toLocal(...LAYOUT.ctrl.hint, 0.004)); hintBtn.name = 'Hint_Button'; ctrlM.add(hintBtn);
  let hintPress = 0;

  // ---------- état d'une manche ----------
  let R = null, G = null; const flash = {}; let t0 = 0;
  function setRound(round, game) {
    R = round; G = game;
    for (const [id, p] of Object.entries(plates)) { DRAW[id](p.canvas.getContext('2d'), R); p.tex.needsUpdate = true; }
    wires.forEach((w, i) => { w.cut = false; w.anim = 0; w.mesh.visible = i < R.wires.length; if (w.mesh.visible) { w.mesh.material = wireMats[R.wires[i]]; buildWire(i, 0); } });
    drawKeyAtlas(HEX[R.keypadColor]); keyDown.fill(0); layoutKeys();
    tagAnim.fill(0); layoutTags();
    joyState.v.set(0, 0); joyState.armed = true; joy.rotation.set(0, 0, 0);
    tilt.v.set(0, 0); tilt.target.set(0, 0); tilt.hold = 0; tilt.armed = true; tilt.dir = null;
    for (const k in flash) delete flash[k];
    t0 = performance.now();
  }
  const say = (ev, arg) => hooks.on(ev, arg);
  // résultat d'une action → retour visuel/sonore
  function outcome(id, r) {
    if (r === 'mistake') { flash[id] = performance.now(); say('mistake', id); }
    else if (r === 'solved') say('solved', id);
    return r;
  }
  // ---------- Entrées (coordonnées en pixels de plaque) ----------
  const handlers = {
    fils: {
      down(p) {
        const L = LAYOUT.fils; if (p.px < L.x0 - 6 || p.px > L.x1 + 6) return;
        let best = -1, bd = 26; R.wires.forEach((_, i) => { const d = Math.abs(p.py - L.rows[i]); if (d < bd && !wires[i].cut) { bd = d; best = i; } });
        if (best < 0) return;
        const r = G.cutWire(best); if (r === 'ignore') return;
        const w = wires[best]; w.cut = true; w.cutX = Math.max(L.x0 + 30, Math.min(L.x1 - 30, p.px)); w.anim = 0.0001; say('snip', best);
        outcome('fils', r);
      }
    },
    clavier: {
      down(p) {
        const L = LAYOUT.clavier; const c = L.xs.findIndex(X => Math.abs(p.px - X) < 46), rr = L.ys.findIndex(Y => Math.abs(p.py - Y) < 44);
        if (c < 0 || rr < 0) return; handlers.clavier.key(KEYS[rr * 4 + c]);
      },
      key(k) {
        const i = KEYS.indexOf(k); if (i < 0) return; keyDown[i] = 1;
        const r = G.pressKey(k); say('key', { k, r }); outcome('clavier', r);
      }
    },
    joystick: {
      down(p) { joyState.down = { px: p.px, py: p.py, t: p.t ?? performance.now(), moved: false }; },
      move(p) {
        const d = joyState.down; if (!d) return;
        const dx = p.px - d.px, dy = p.py - d.py; if (Math.hypot(dx, dy) > 12) d.moved = true;
        joyState.v.set(dx, dy).divideScalar(90); if (joyState.v.length() > 1) joyState.v.normalize();
        handlers.joystick.check();
      },
      up(e) { const d = joyState.down; joyState.down = null; joyState.v.set(0, 0); joyState.armed = true; if (d && !d.moved && ((e && e.t) ?? performance.now()) - d.t < 450) handlers.joystick.dir('Clic'); },
      check() {
        const v = joyState.v, L = v.length();
        if (L < 0.3) joyState.armed = true;
        if (L > 0.62 && joyState.armed) {
          joyState.armed = false;
          const dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'Droite' : 'Gauche') : (v.y > 0 ? 'Bas' : 'Haut');
          handlers.joystick.dir(dir);
        }
      },
      dir(d) { const r = G.joy(d); say('joy', { d, r }); outcome('joystick', r); },
      nudge(d) { const V = { Haut: [0, -1], Bas: [0, 1], Gauche: [-1, 0], Droite: [1, 0] }[d]; joyState.v.set(V[0], V[1]); joyState.kb = performance.now(); handlers.joystick.dir(d); }
    },
    rfid: {
      down(p) {
        const i = LAYOUT.rfid.tags.findIndex(([X, Y]) => Math.abs(p.px - X) < 70 && Math.abs(p.py - Y) < 40);
        if (i >= 0) handlers.rfid.scan(i + 1);
      },
      scan(n) { // le badge vole jusqu'au lecteur ; il est lu en touchant le lecteur (k = 0,45)
        const i = n - 1; if (tagAnim[i] > 0 || !G || G.over) return;
        tagAnim[i] = performance.now(); tagRead[i] = false; say('tagLift', n);
      }
    },
    inclinaison: {
      down(p) { tilt.drag = { px: p.px, py: p.py, base: tilt.target.clone() }; },
      move(p) { if (!tilt.drag) return; tilt.target.set(p.px - tilt.drag.px, p.py - tilt.drag.py).divideScalar(110).add(tilt.drag.base); if (tilt.target.length() > 1) tilt.target.normalize(); tilt.src = 'touch'; },
      up() { tilt.drag = null; tilt.target.set(0, 0); },
      sensor(x, y) { if (tilt.drag) return; tilt.target.set(x, y); if (tilt.target.length() > 1) tilt.target.normalize(); tilt.src = 'capteur'; },
      shake() { const r = G.shake(); if (r === 'ignore') { say('shakeIgnored'); return; } tilt.shakeFlash = 1; tilt.lastShake = performance.now(); say('shake', G.shakes); }
    },
    ctrl: {
      down(p) { const [X, Y] = LAYOUT.ctrl.hint; if (Math.hypot(p.px - X, p.py - Y) < 60) { hintPress = 1; say('hintButton'); } }
    }
  };

  // ---------- Animation (chaque image) ----------
  const tmpV = new THREE.Vector3();
  function update(dt, now, live) {
    if (!R) return;
    // fils qui retombent
    wires.forEach((w, i) => { if (w.cut && w.anim > 0 && w.anim < 1) { w.anim = Math.min(1, w.anim + dt * 3.2); const k = w.anim, e = 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.15; buildWire(i, e); } });
    // touches
    let kd = false; for (let i = 0; i < 16; i++) if (keyDown[i] > 0) { keyDown[i] = Math.max(0, keyDown[i] - dt * 7); kd = true; } if (kd) layoutKeys();
    // badges
    let ta = false;
    for (let i = 0; i < 6; i++) if (tagAnim[i] > 0) {
      const k = (now - tagAnim[i]) / TAG_MS; ta = true;
      if (k >= 0.45 && !tagRead[i]) { tagRead[i] = true; if (G && !G.over) { const r = G.scanBadge(i + 1); say('rfid', { n: i + 1, r }); outcome('rfid', r); } }
      if (k >= 1) tagAnim[i] = 0;
    }
    if (ta) layoutTags();
    // joystick : retour élastique, inclinaison du manche
    if (!joyState.down && (!joyState.kb || now - joyState.kb > 160)) joyState.v.multiplyScalar(Math.pow(0.0005, dt));
    joy.rotation.x = joyState.v.y * 0.42; joy.rotation.z = -joyState.v.x * 0.42;
    // inclinaison : la bille suit l'inclinaison ; tenir 1 s vers un bord = une inclinaison
    tilt.v.lerp(tilt.target, 1 - Math.pow(0.0005, dt));
    const [cx, cy] = LAYOUT.inclinaison.c, r = LAYOUT.inclinaison.r - 30;
    marble.position.copy(toLocal(cx + tilt.v.x * r, cy + tilt.v.y * r, 0.0085));
    const L = tilt.v.length(); let dir = null;
    if (L > 0.68) dir = Math.abs(tilt.v.x) > Math.abs(tilt.v.y) ? (tilt.v.x > 0 ? 'Droite' : 'Gauche') : (tilt.v.y > 0 ? 'Avant' : 'Arrière');
    if (L < 0.3) tilt.armed = true;
    if (live && dir && tilt.armed && !G.solved.inclinaison) {
      if (dir !== tilt.dir) { tilt.dir = dir; tilt.since = now; }
      tilt.hold = (now - tilt.since) / 1000;            // temps réel (même à faible fps)
      if (tilt.hold >= 1) { tilt.armed = false; tilt.hold = 0; const res = G.tilt(dir); say('tilt', { dir, r: res }); outcome('inclinaison', res); }
    } else if (!dir) { tilt.dir = null; tilt.hold = 0; }
    // secousses : 2 s sans secousse → on valide le compte
    if (live && G.shakes > 0 && now - tilt.lastShake > 2000) { const res = G.still(); if (res !== 'ignore') { say('still', res); outcome('inclinaison', res); } }
    tilt.shakeFlash = Math.max(0, tilt.shakeFlash - dt * 4);
    hintPress = Math.max(0, hintPress - dt * 5); hintBtn.position.y = 0.004 - hintPress * 0.003;
    hooks.caseTilt && hooks.caseTilt(tilt.v);
    // ---- DEL ----
    const blinkSlow = Math.floor(now / 700) % 2;
    ids.forEach(id => {
      const f = flash[id] && now - flash[id] < 700; const sol = G.solved[id];
      const [c, k] = f ? (Math.floor(now / 90) % 2 ? [0xff2020, 1] : [0xff2020, 0.15]) : sol ? [0x2bff63, 1] : [0xffffff, live ? 0.18 + 0.12 * blinkSlow : 0.05];
      statusLed[id].forEach(i => leds.set(i, c, k));
    });
    for (let i = 0; i < 9; i++) leds.set(errLeds[i], i < G.maxMistakes ? 0xff2020 : 0x000000, i < G.maxMistakes ? (i < G.mistakes ? 1 : 0.06) : 0);
    // séquence du joystick : 4 couleurs de 600 ms (+200 ms noir), pause 1,6 s
    if (!G.solved.joystick && live) {
      const T = (now - t0) % 4800, slot = Math.floor(T / 800), inSlot = T % 800;
      if (slot < 4 && inSlot < 600) leds.set(seqLed, HEX[R.joySeq[slot]], 1); else leds.set(seqLed, 0x222222, 0);
    } else leds.set(seqLed, G.solved.joystick ? 0x2bff63 : 0x222222, G.solved.joystick ? 0.5 : 0);
    progLeds.forEach((li, i) => leds.set(li, 0xffffff, i < G.joyPos ? 1 : 0.05));
    // lecteur RFID : N clignotements de la couleur, pause 1,5 s
    if (!G.solved.rfid && live) {
      const per = R.rfidBlinks * 500 + 1500, T = (now - t0) % per, on = T < R.rfidBlinks * 500 && (T % 500) < 260;
      readerLeds.forEach(li => leds.set(li, HEX[R.rfidColor], on ? 1 : 0.04));
      leds.set(readerCenter, HEX[R.rfidColor], on ? 0.7 : 0);
    } else { readerLeds.forEach(li => leds.set(li, 0x2bff63, G.solved.rfid ? 0.6 : 0)); leds.set(readerCenter, 0x2bff63, 0); }
    // inclinaison : DEL du bord qui se remplit pendant qu'on tient
    for (const [k, li] of Object.entries(tiltLedIdx)) leds.set(li, G.solved.inclinaison ? 0x2bff63 : 0xffffff, G.solved.inclinaison ? 0.6 : (tilt.dir === k ? 0.2 + 0.8 * Math.min(1, tilt.hold) : 0.06));
    leds.set(shakeLed, HEX.Jaune, G.tiltPos >= 2 && !G.solved.inclinaison ? 0.2 + 0.8 * tilt.shakeFlash : 0.04);
  }
  // DEL éteintes ou toutes vertes (cinématiques)
  function allLeds(hex, k) { for (let i = 0; i < 64; i++) leds.set(i, hex, k); }
  function screenOf(id, px, py, camera, canvas) { // pixel de plaque → pixel écran (tests)
    const p = toLocal(px, py, 0.004); plates[id].mount.localToWorld(p); p.project(camera);
    const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
  }
  // Modèle GLB (SPEC.md) : chaque pièce présente remplace la pièce procédurale (tolérant si absente)
  const glb = { keys: null, stick: null, hint: null, batch: null };
  const kM = new THREE.Matrix4(), kC = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
  function adoptGlbParts(P, ledMats, opts = {}) {
    if (!P) return [];
    const used = [];
    // plaques de jeu au-dessus des plaques rétroéclairées du GLB (couche Panel_*_Layer à +1,4 mm) + polygonOffset : pas de z-fighting
    if (opts.polygonOffset) for (const p of Object.values(plates)) { p.mat.polygonOffset = true; p.mat.polygonOffsetFactor = -2; p.mat.polygonOffsetUnits = -2; }
    if (P.Timer_7Seg) { P.Timer_7Seg.traverse(o => { if (o.isMesh && [].concat(o.material).some(m => m.name === 'Timer_Digits')) o.material = hooks.seg.mat; }); segMesh.visible = false; used.push('Timer_7Seg'); }
    if (P.OLED) { P.OLED.traverse(o => { if (o.isMesh && [].concat(o.material).some(m => m.name === 'OLED_Screen')) o.material = hooks.oled.mat; }); oledMesh.visible = false; used.push('OLED'); }
    if (P.Hint_Button) { hintBtn.visible = false; glb.hint = P.Hint_Button; glb.hintY = P.Hint_Button.position.y; used.push('Hint_Button'); }
    if (P.Buzzer) { bz.visible = false; used.push('Buzzer'); }
    if (P.Joystick_Stick) { joy.visible = false; glb.stick = P.Joystick_Stick; used.push('Joystick_Stick'); }
    if (P.Joystick_Base) jbase.visible = false;
    if (P.Wire_Terminals) { termMesh.visible = false; used.push('Wire_Terminals'); }
    // le badge unique du GLB est décoratif : le jeu a besoin des 6 badges étiquetés (ALPHA…FOXTROT)
    if (P.RFID_Badge) { P.RFID_Badge.visible = false; used.push('RFID_Badge (masqué)'); }
    if (P.keys) {
      keys.visible = false;
      const meshes = P.keys.map(k => { let m = null; k.traverse(o => { if (!m && o.isMesh) m = o; }); return m; });
      if (meshes.every(Boolean)) {
        // option A (Pascal) : 16 touches séparées dans le GLB, fusionnées ici en un seul BatchedMesh (1 appel de dessin)
        let nv = 0, ni = 0; meshes.forEach(m => { nv += m.geometry.attributes.position.count; ni += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count; });
        const batch = new THREE.BatchedMesh(16, nv, ni, meshes[0].material); batch.name = 'Keypad_Keys_Batched';
        batch.perObjectFrustumCulled = false; batch.sortObjects = false;
        const parent = P.keys[0].parent; parent.add(batch);
        glb.keys = P.keys.map((k, i) => {
          const gid = batch.addGeometry(meshes[i].geometry), id = batch.addInstance(gid);
          k.updateMatrix(); const local = meshes[i] === k ? k.matrix.clone() : k.matrix.clone().multiply(meshes[i].matrix);
          batch.setMatrixAt(id, local); batch.setColorAt(id, WHITE); k.visible = false;
          return { id, local, glow: 0 };
        });
        glb.batch = batch; used.push('Key_0..Key_15 (BatchedMesh)');
      } else { glb.keysLegacy = P.keys.map(k => ({ o: k, y: k.position.y })); used.push('Key_0..Key_15'); }
    }
    glb.ledMats = ledMats || {};
    for (const m of Object.values(glb.ledMats)) if (m.emissive) { m.emissiveIntensity = 1.6; m.toneMapped = false; }
    return used;
  }
  function keyHit(raycaster) { // touche visée (BatchedMesh) → index 0…15, sinon −1
    if (!glb.batch || !glb.batch.visible) return -1;
    const h = raycaster.intersectObject(glb.batch, false)[0];
    return h && h.batchId !== undefined ? glb.keys.findIndex(k => k.id === h.batchId) : -1;
  }
  function syncGlb(dt) {
    if (glb.batch && R) {
      const tint = new THREE.Color(HEX[R.keypadColor]);
      glb.keys.forEach((k, i) => {
        if (keyDown[i] > 0.5) k.glow = 1; else k.glow = Math.max(0, k.glow - (dt || 0.016) * 2.5);
        kM.copy(k.local); kM.elements[13] -= keyDown[i] * 0.003; glb.batch.setMatrixAt(k.id, kM);
        kC.copy(WHITE).lerp(tint, 0.18 + 0.5 * k.glow).multiplyScalar(1 + 0.9 * k.glow); glb.batch.setColorAt(k.id, kC);
      });
    }
    if (glb.keysLegacy) glb.keysLegacy.forEach((k, i) => { k.o.position.y = k.y - keyDown[i] * 0.003; });
    if (glb.stick) { glb.stick.rotation.x = joy.rotation.x; glb.stick.rotation.z = joy.rotation.z; }
    if (glb.hint) glb.hint.position.y = glb.hintY - hintPress * 0.003;
    if (R && glb.ledMats) {
      const bl = [HEX.Neutre, HEX[R.keypadColor], HEX.Mauve, HEX.Neutre, HEX[R.tiltColor]];
      bl.forEach((c, i) => { const m = glb.ledMats['LED_Backlight_' + (i + 1)]; if (m && m.emissive) m.emissive.set(c); });
      ids.forEach((id, i) => { const m = glb.ledMats['LED_Status_' + (i + 1)]; if (m && m.emissive) m.emissive.set(G.solved[id] ? 0x2bff63 : 0x333333); });
    }
  }
  return { plates, handlers, update: (dt, now, live) => { update(dt, now, live); syncGlb(dt); }, keyHit, setRound, leds, allLeds, screenOf, wires, marble, tilt, MOD_MOUNT, adoptGlbParts,
    plateMeshes: Object.values(plates).map(p => p.mesh), hintBtn };
}
function mergeGeoms(list) { // fusion minimale de géométries non indexées/indexées
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; parts.forEach(g => n += g.attributes.position.count);
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) { const sz = parts[0].attributes[k].itemSize, arr = new Float32Array(n * sz); let o = 0; parts.forEach(g => { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }); out.setAttribute(k, new THREE.BufferAttribute(arr, sz)); }
  return out;
}
