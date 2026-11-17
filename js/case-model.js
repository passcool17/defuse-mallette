// Défuse la mallette — la mallette procédurale (orange, type Pelican), prête à être remplacée par un GLB.
// Contrat de noms (identique pour le futur modèle GLB, unités en mètres, +Y en haut, face avant vers +Z) :
//   Case_Body      coque du bas (origine au sol, centre)
//   Case_Lid       couvercle ; ORIGINE SUR L'AXE DE LA CHARNIÈRE (arrière, en haut de la coque) ; fermé = rotation 0,
//                  ouvert = rotation.x négative (−100°)
//   Lid_Screen     écran dans le couvercle, matériau nommé « Screen », UV 0–1 (u vers la droite, v vers le haut du couvercle ouvert)
//   Case_Latches   loquets avant (optionnel), origine sur leur axe de basculement
//   Panel_1 … Panel_5  repères vides (Object3D) au centre de la surface de chaque module : 1 Fils, 2 Clavier, 3 Joystick,
//                  4 Badge RFID, 5 Inclinaison ; +Y = normale (vers le haut), +X = droite, +Z = vers le désamorceur
//   Panel_Ctrl     repère du panneau de contrôle (chrono 7 segments, OLED, buzzer, bouton Indice)
//   Optionnels (SPEC.md de Modélisation, choix de Pascal 16 nov. 21 h 33) : Keypad_Base, Key_0…Key_15 (ligne par ligne,
//   Key_0 en haut à gauche), Joystick_Base, Joystick_Stick (origine sur la rotule), RFID_Reader, RFID_Badge, Tilt_Base,
//   Timer_7Seg (matériau « Timer_Digits », UV 0–1), OLED (matériau « OLED_Screen », UV 0–1), Buzzer, Hint_Button,
//   Wire_Terminals, matériaux LED_Backlight_1…5 et LED_Status_1…5 : le jeu pilote leur couleur émissive.
//   Chaque pièce présente remplace la pièce procédurale du jeu ; une pièce absente garde la version procédurale.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const DIM = { W: 0.60, D: 0.40, HB: 0.17, HL: 0.085, RIM: 0.022 };
export const DECK_Y = DIM.HB - 0.008;                         // dessus de la plaque intérieure
export const PLATE = { W: 0.170, D: 0.162, CW: 512, CH: 488 };  // plaque de module (m) et sa texture (px)
export const LID_OPEN = -100 * Math.PI / 180;
export const PANELS = ['Panel_1', 'Panel_2', 'Panel_3', 'Panel_4', 'Panel_5', 'Panel_Ctrl'];
// position (x, z) des centres de cellules : rangée arrière (près du couvercle) puis avant
const CELL = { Panel_2: [-0.184, -0.088], Panel_Ctrl: [0, -0.088], Panel_3: [0.184, -0.088],
               Panel_1: [-0.184, 0.088], Panel_4: [0, 0.088], Panel_5: [0.184, 0.088] };

function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4; return t;
}
// grain de plastique moulé (bosselage léger, comme une vraie mallette étanche)
function stippleTex() {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 100 + Math.random() * 60 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  }, [6, 6], false);
}
function foamTex() { // mousse à cubes prédécoupés
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#0c0d0f'; x.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const g = x.createRadialGradient(i * s + s / 2, j * s + s / 2, 2, i * s + s / 2, j * s + s / 2, s * 0.7);
      g.addColorStop(0, '#2a2c30'); g.addColorStop(1, '#16171a'); x.fillStyle = g; x.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  }, [3, 2]);
}
function deckTex() { // tôle noire à pointes de diamant, très discrète
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#131518'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      x.save(); x.translate(i * 16 + (j % 2) * 8, j * 16); x.rotate(j % 2 ? 0.6 : -0.6);
      x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(-5, -1.5, 10, 3); x.restore();
    }
  }, [5, 3]);
}

export function makeMaterials() {
  const bump = stippleTex();
  return {
    orange: Object.assign(new THREE.MeshStandardMaterial({ color: 0xe8590c, roughness: 0.62, metalness: 0, bumpMap: bump, bumpScale: 0.6 }), { name: 'Case_Orange' }),
    black: Object.assign(new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.55, metalness: 0.1 }), { name: 'Case_Black' }),
    metal: Object.assign(new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.32, metalness: 0.85 }), { name: 'Metal' }),
    foam: Object.assign(new THREE.MeshStandardMaterial({ map: foamTex(), roughness: 0.95 }), { name: 'Foam' }),
    deck: Object.assign(new THREE.MeshStandardMaterial({ map: deckTex(), roughness: 0.5, metalness: 0.5 }), { name: 'Deck' })
  };
}

const rbox = (w, h, d, r = 0.01, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; };
const merge = list => mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g), false);

export function buildProceduralCase(M) {
  const { W, D, HB, HL, RIM } = DIM;
  const root = new THREE.Group(); root.name = 'Case_Root';
  // ---------- Coque du bas ----------
  const body = new THREE.Group(); body.name = 'Case_Body'; root.add(body);
  const H0 = HB - 0.012;
  const orangeBody = merge([
    at(rbox(W, H0, D, 0.03, 3), 0, H0 / 2, 0),
    at(rbox(W + 0.012, 0.016, D + 0.012, 0.008), 0, 0.045, 0),          // nervures horizontales
    at(rbox(W + 0.012, 0.016, D + 0.012, 0.008), 0, H0 - 0.02, 0),
    at(rbox(W, 0.016, RIM, 0.005), 0, HB - 0.008, D / 2 - RIM / 2),        // rebord du haut
    at(rbox(W, 0.016, RIM, 0.005), 0, HB - 0.008, -D / 2 + RIM / 2),
    at(rbox(RIM, 0.016, D, 0.005), W / 2 - RIM / 2, HB - 0.008, 0),
    at(rbox(RIM, 0.016, D, 0.005), -W / 2 + RIM / 2, HB - 0.008, 0),
    ...[-1, 1].map(s => at(rbox(0.07, 0.11, 0.012, 0.004), s * 0.17, 0.085, D / 2 + 0.004)) // renforts derrière les loquets
  ]);
  body.add(new THREE.Mesh(orangeBody, M.orange));
  const blackBody = merge([
    at(new THREE.BoxGeometry(W - 2 * RIM + 0.002, 0.006, D - 2 * RIM + 0.002), 0, DECK_Y - 0.003, 0),   // fond noir sous les modules
    at(rbox(0.17, 0.024, 0.026, 0.01), 0, HB - 0.05, D / 2 + 0.04),       // poignée
    ...[-1, 1].map(s => at(rbox(0.022, 0.03, 0.05, 0.006), s * 0.085, HB - 0.045, D / 2 + 0.018)),
    at(new THREE.CylinderGeometry(0.016, 0.018, 0.012, 20), -0.25, 0.095, D / 2 + 0.006, Math.PI / 2), // valve de pression
    ...[-0.2, 0, 0.2].map(x => at(new THREE.CylinderGeometry(0.009, 0.009, 0.09, 12), x, HB - 0.004, -D / 2 - 0.006, 0, 0, Math.PI / 2)), // charnières
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => at(rbox(0.05, 0.012, 0.05, 0.005), sx * (W / 2 - 0.05), 0.004, sz * (D / 2 - 0.05))) // pieds
  ]);
  body.add(new THREE.Mesh(blackBody, M.black));
  // ---------- Loquets (basculent vers l'avant à l'ouverture) ----------
  const latches = new THREE.Group(); latches.name = 'Case_Latches'; latches.position.set(0, HB - 0.055, D / 2 + 0.012); body.add(latches);
  latches.add(new THREE.Mesh(merge([-1, 1].map(s => at(rbox(0.062, 0.085, 0.016, 0.006), s * 0.17, 0.042, 0.004)).concat(
    [-1, 1].map(s => at(rbox(0.04, 0.012, 0.01, 0.003), s * 0.17, 0.07, 0.014)))), M.black));
  // ---------- Panneaux (repères) + cadres et vis ----------
  const metalParts = [], mounts = {};
  for (const name of PANELS) {
    const [cx, cz] = CELL[name];
    const m = new THREE.Object3D(); m.name = name; m.position.set(cx, DECK_Y, cz); body.add(m); mounts[name] = m;
    const fw = PLATE.W + 0.008, fd = PLATE.D + 0.008, t = 0.004;
    metalParts.push(at(new THREE.BoxGeometry(fw, 0.003, t), cx, DECK_Y + 0.0005, cz - fd / 2 + t / 2), at(new THREE.BoxGeometry(fw, 0.003, t), cx, DECK_Y + 0.0005, cz + fd / 2 - t / 2),
      at(new THREE.BoxGeometry(t, 0.003, fd), cx - fw / 2 + t / 2, DECK_Y + 0.0005, cz), at(new THREE.BoxGeometry(t, 0.003, fd), cx + fw / 2 - t / 2, DECK_Y + 0.0005, cz));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) metalParts.push(at(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), cx + sx * (PLATE.W / 2 - 0.007), DECK_Y + 0.0035, cz + sz * (PLATE.D / 2 - 0.007)));
  }
  body.add(Object.assign(new THREE.Mesh(merge(metalParts), M.metal), { name: 'Panel_Frames' }));
  // ---------- Couvercle (origine sur la charnière) ----------
  const lid = new THREE.Group(); lid.name = 'Case_Lid'; lid.position.set(0, HB, -D / 2); root.add(lid);
  lid.add(new THREE.Mesh(merge([
    at(rbox(W, HL, D, 0.03, 3), 0, HL / 2, D / 2),
    at(rbox(W + 0.012, 0.016, D + 0.012, 0.008), 0, 0.03, D / 2),
    at(rbox(W - 0.14, 0.012, D - 0.12, 0.02), 0, HL + 0.004, D / 2),      // plateau en relief sur le dessus
    at(rbox(W - 0.22, 0.008, 0.03, 0.006), 0, HL + 0.012, D / 2 - 0.06), at(rbox(W - 0.22, 0.008, 0.03, 0.006), 0, HL + 0.012, D / 2 + 0.06)
  ]), M.orange));
  lid.add(new THREE.Mesh(merge([
    at(new THREE.BoxGeometry(W - 2 * RIM, 0.004, D - 2 * RIM), 0, -0.001, D / 2),     // joint
    at(rbox(0.27, 0.008, 0.18, 0.006), 0, -0.006, D / 2 + 0.005),                    // cadre de l'écran
    at(new THREE.BoxGeometry(0.04, 0.003, D - 2 * RIM - 0.02), -0.2, -0.012, D / 2), // sangles
    at(new THREE.BoxGeometry(0.04, 0.003, D - 2 * RIM - 0.02), 0.2, -0.012, D / 2),
    ...[-0.2, 0.2].map(x => at(new THREE.CylinderGeometry(0.009, 0.009, 0.09, 12), x === -0.2 ? -0.1 : 0.1, 0.004, -0.006, 0, 0, Math.PI / 2))
  ]), M.black));
  const foam = new THREE.Mesh(at(new THREE.BoxGeometry(W - 2 * RIM - 0.006, 0.012, D - 2 * RIM - 0.006), 0, -0.004, D / 2), M.foam); lid.add(foam);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }); screenMat.name = 'Screen';
  const screenGeo = new THREE.PlaneGeometry(0.248, 0.155); screenGeo.rotateX(Math.PI / 2); screenGeo.translate(0, -0.0105, D / 2 + 0.005);
  const screen = new THREE.Mesh(screenGeo, screenMat); screen.name = 'Lid_Screen'; lid.add(screen);
  return { root, body, lid, latches, screen, mounts, parts: {}, ledMats: {}, source: 'procedural' };
}

// Chargement du futur GLB (non branché par défaut : ?glb=chemin.glb). Mêmes noms que ci-dessus.
export async function loadCaseGLB(url, renderer) {
  const ktx2 = new KTX2Loader().setTranscoderPath(new URL('../vendor/three-0.187.0/addons/libs/basis/', import.meta.url).href).detectSupport(renderer);
  const gltf = await new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const root = gltf.scene, get = n => root.getObjectByName(n);
  const body = get('Case_Body'), lid = get('Case_Lid'), screen = get('Lid_Screen');
  if (!body || !lid || !screen) throw new Error('GLB : Case_Body, Case_Lid et Lid_Screen sont obligatoires');
  const mounts = {}; for (const n of PANELS) { mounts[n] = get(n); if (!mounts[n] && n !== 'Panel_Ctrl') throw new Error('GLB : ' + n + ' manquant'); }
  if (!mounts.Panel_Ctrl) { mounts.Panel_Ctrl = new THREE.Object3D(); mounts.Panel_Ctrl.name = 'Panel_Ctrl'; mounts.Panel_1.parent.add(mounts.Panel_Ctrl); mounts.Panel_Ctrl.position.set(0, mounts.Panel_1.position.y, mounts.Panel_2.position.z); }
  // couche du jeu (plaques gravées, DEL, fils) 1,4 mm au-dessus des plaques LED_Backlight du GLB (dessus à +1 mm du repère)
  const layers = {}; for (const n of PANELS) { const l = new THREE.Object3D(); l.name = n + '_Layer'; l.position.y = 0.0014; mounts[n].add(l); layers[n] = l; }
  screen.material = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }); screen.material.name = 'Screen';
  // Les écrans du jeu sont des CanvasTexture (flipY = true) ; les UV glTF ont v vers le bas : on retourne v sur l'OLED et le 7 segments.
  const flipV = o => o && o.traverse(m => { const uv = m.isMesh && m.geometry.attributes.uv; if (!uv || m.userData.vFlipped) return; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); uv.needsUpdate = true; m.userData.vFlipped = true; });
  flipV(get('Timer_7Seg')); flipV(get('OLED'));
  // pièces facultatives (tolérant : rien n'est obligatoire)
  const OPT = ['Keypad_Base', 'Joystick_Base', 'Joystick_Stick', 'RFID_Reader', 'RFID_Badge', 'Tilt_Base', 'Timer_7Seg', 'OLED', 'Buzzer', 'Hint_Button', 'Wire_Terminals'];
  const parts = {}; for (const n of OPT) { const o = get(n); if (o) parts[n] = o; }
  const keys = []; for (let i = 0; i < 16; i++) keys.push(get('Key_' + i) || null);
  if (keys.every(Boolean)) parts.keys = keys;
  const ledMats = {}; root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && /^LED_(Backlight|Status)_\d$/.test(m.name)) ledMats[m.name] = m; });
  root.traverse(o => { if (o.isMesh) o.frustumCulled = true; });
  return { root, body, lid, latches: get('Case_Latches'), screen, mounts: layers, panels: mounts, parts, ledMats, source: 'glb:' + url, isGLB: true };
}
