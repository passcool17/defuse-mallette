// Défuse la mallette — jeu principal (three.js 0.187 auto-hébergé, modules ES, aucun CDN).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getGPUTier } from '../vendor/detect-gpu-5.0.70.esm.js';
import qrcode from '../vendor/qrcode-generator-2.0.4.mjs';
import { Sfx } from './audio.js';
import { makeMaterials, buildProceduralCase, loadCaseGLB, DIM, LID_OPEN, PLATE } from './case-model.js';
import { createModules, LAYOUT, HEX } from './modules.js';
import { makeSevenSeg, makeOled, makeLidScreen } from './displays.js';
import { createFx } from './fx.js';

const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';
const L = window.DefuseLogic;
const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = 4;                                   // échelle monde de la mallette (1 m réel = 4 unités)
const ORDER = ['fils', 'clavier', 'joystick', 'rfid', 'inclinaison', 'ctrl'];
const VIEW_LABEL = { fils: '1 · Fils', clavier: '2 · Clavier', joystick: '3 · Joystick', rfid: '4 · Badge RFID', inclinaison: '5 · Inclinaison', ctrl: 'Contrôle', overview: 'Vue d’ensemble' };
const store = { get(k, d) { try { const v = localStorage.getItem('defusemallette.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('defusemallette.' + k, JSON.stringify(v)); } catch (e) {} } };

// ---------- Qualité ----------
const tierParam = qs.get('tier');
const forcedTier = tierParam !== null && tierParam !== '' && Number.isFinite(+tierParam) ? +tierParam : null;
let gpu = { tier: forcedTier ?? 2, gpu: '?', type: forcedTier !== null ? 'forcé' : 'en cours' };
let low = forcedTier !== null && forcedTier <= 1, prCap = low ? 1 : 2, Q = (RM ? 0.3 : 1) * (low ? 0.5 : 1);

// ---------- Rendu ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, prCap));
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const BG = 0x07090c; scene.background = new THREE.Color(BG); scene.fog = new THREE.Fog(BG, 14, 34);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 80);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5; pm.dispose();
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x2a1c12, 1.1); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe2c0, 2.2); key.position.set(-3, 8, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x7fb0ff, 1.0); rim.position.set(5, 3, -6); scene.add(rim);
const panelGlow = new THREE.PointLight(0x9fc8ff, 1.4, 5, 1.5); panelGlow.position.set(0, 1.0, 0.1); scene.add(panelGlow);
const alarm = new THREE.PointLight(0xff2a1a, 0, 9, 1.2); alarm.position.set(0, 2.2, 1.8); scene.add(alarm);
const blast = new THREE.PointLight(0xffa040, 0, 20, 1); blast.position.set(0, 1, 0.5); scene.add(blast);

// ---------- Décor : table en bois, fenêtre de ville la nuit, flaque de lumière, ombre de contact ----------
function ctex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } t.anisotropy = 4; return t; }
const wood = ctex(512, 512, (x) => {
  x.fillStyle = '#4a2f1c'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) { const y = Math.random() * 512; x.strokeStyle = `rgba(${Math.random() < 0.5 ? '25,12,4' : '150,100,60'},${0.04 + Math.random() * 0.08})`; x.lineWidth = 0.6 + Math.random() * 1.4; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(170, y + Math.random() * 8 - 4, 340, y + Math.random() * 8 - 4, 512, y + Math.random() * 6 - 3); x.stroke(); }
  for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(20,10,3,.3)'; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, 6 + Math.random() * 14, 2 + Math.random() * 3, 0, 0, 7); x.fill(); }
}, 3);
const table = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.16, 72), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.42, metalness: 0.05 }));
table.position.y = -0.08; table.name = 'Table'; scene.add(table);
const city = ctex(1024, 512, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1424'); g.addColorStop(0.55, '#16243a'); g.addColorStop(1, '#2a2230'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { const bw = 30 + Math.random() * 70, bh = 120 + Math.random() * 300, bx = Math.random() * w; x.fillStyle = `rgba(8,12,20,${0.7 + Math.random() * 0.3})`; x.fillRect(bx, h - bh, bw, bh);
    for (let k = 0; k < bh / 9; k++) if (Math.random() < 0.35) { x.fillStyle = Math.random() < 0.8 ? 'rgba(255,200,120,.55)' : 'rgba(150,200,255,.5)'; x.fillRect(bx + 4 + Math.random() * (bw - 10), h - bh + k * 9, 3, 4); } }
  for (let i = 0; i < 70; i++) { const r = 6 + Math.random() * 26, gx = Math.random() * w, gy = h * 0.4 + Math.random() * h * 0.6, gg = x.createRadialGradient(gx, gy, 0, gx, gy, r); const c = ['255,170,80', '255,90,60', '120,180,255', '255,230,180'][i % 4]; gg.addColorStop(0, `rgba(${c},.35)`); gg.addColorStop(1, `rgba(${c},0)`); x.fillStyle = gg; x.fillRect(gx - r, gy - r, 2 * r, 2 * r); }
  x.fillStyle = 'rgba(0,0,0,.55)'; for (let k = 0; k < 4; k++) x.fillRect(k * w / 4 - 6, 0, 12, h); x.fillRect(0, h * 0.48, w, 10);    // montants de la fenêtre
});
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: city, fog: false, color: 0x8a96a8 }));
backdrop.position.set(0, 5, -13); backdrop.name = 'Window'; scene.add(backdrop);
const radialTex = (stops) => ctex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([k, c]) => g.addColorStop(k, c)); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,200,140,.35)'], [1, 'rgba(255,200,140,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.002; scene.add(pool);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(0,0,0,.85)'], [0.6, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; shadow.scale.set(DIM.W * S * 1.35, DIM.D * S * 1.6, 1); scene.add(shadow);

// ---------- Mallette + afficheurs + modules ----------
const M = makeMaterials();
let C = null, glbUsed = [];
// Mallette GLB (Pelican de N8 + pièces, CC BY 4.0) par défaut ; ?glb=0 → mallette procédurale ; ?glb=chemin.glb → autre modèle.
// Le premier fetch peut échouer pendant la navigation (vu dans Chrome) : 3 essais, puis mallette procédurale en secours.
const glbParam = qs.get('glb');
const GLB_URL = glbParam && glbParam !== '0' ? glbParam : './assets/defuse_case_v1.glb?v=' + VERSION;
if (glbParam !== '0') {
  for (let i = 0; i < 3 && !C; i++) {
    try { C = await loadCaseGLB(GLB_URL, renderer); }
    catch (e) { if (i === 2) console.warn('GLB non chargé, mallette procédurale gardée :', e.message); else await new Promise(r => setTimeout(r, 250 * (i + 1))); }
  }
}
if (!C) C = buildProceduralCase(M);
C.root.scale.setScalar(S); scene.add(C.root);
const seg = makeSevenSeg(), oled = makeOled();
const lidScreen = makeLidScreen(url => { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); const n = q.getModuleCount(), c = document.createElement('canvas'); c.width = c.height = n * 8; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(k * 8, r * 8, 8, 8); return c; } catch (e) { return null; } });
C.screen.material = lidScreen.mat;
const mods = createModules(C, M, { KEYS: L.KEYS, BADGES: L.BADGES, seg, oled, on: onModuleEvent, caseTilt });
glbUsed = mods.adoptGlbParts(C.parts, C.ledMats, { polygonOffset: !!C.isGLB });
const floorY = 0;
const fx = createFx(scene, floorY);

// ---------- État ----------
const settings = Object.assign({ minutes: 15, maxMistakes: 3, mode: 'duo' }, store.get('reglages', {}));
let G = null, phase = 'menu', view = 'menu', paused = false, last = performance.now();
let oledMsg = ['', ''], oledUntil = 0, cine = null, lidAngle = 0, latchAngle = 0, power = 0, roundStart = 0;
let best = store.get('meilleurs', {});
const hook = { ready: false, version: VERSION, mode: 'menu', renderer, scene, camera, hasTransmission: false, source: C.source, render: {}, sizes: () => ({ mount: null }) };

// ---------- Caméra ----------
const camPos = new THREE.Vector3(5, 4, 7), camLook = new THREE.Vector3(0, 0.6, 0), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
let shake = 0;
function plateCenter(id) { const v = new THREE.Vector3(); mods.plates[id].mount.getWorldPosition(v); return v; }
function fitDistance(hw, hh, margin = 1.08) {
  const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  return Math.max(hw / Math.tan(hf / 2), hh / Math.tan(vf / 2)) * margin;
}
function viewPose(v, t) {
  const portrait = camera.aspect < 1;
  if (v === 'menu') { // la mallette fermée qui se balance ; décalée pour tomber dans l'espace libre entre le titre et le panneau
    const a = Math.sin(t * 0.00018) * 0.5 + 0.3, d = portrait ? 8.4 : 6.6;
    wantLook.set(0, 0.35, 0); wantPos.set(Math.sin(a) * d, portrait ? 3.0 : 2.5, Math.cos(a) * d);
    const fwd = wantLook.clone().sub(wantPos).normalize(), right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    const hh = d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), hw = hh * camera.aspect;
    // position voulue à l'écran (NDC) : portrait (0 ; +0,22), paysage (−0,48 ; −0,38)
    const nx = portrait ? 0 : -0.48, ny = portrait ? 0.22 : -0.38;
    const off = right.multiplyScalar(-nx * hw).addScaledVector(up, -ny * hh);
    wantLook.add(off); wantPos.add(off); return; }
  if (v === 'overview' || v === 'win' || v === 'boom') {
    wantLook.set(0, portrait ? 1.05 : 0.95, -0.05);
    const dir = new THREE.Vector3(0, 0.82, 1).normalize();
    // portrait : HUD en haut et barre en bas → on garde de la marge verticale
    const d = fitDistance(1.32, portrait ? 1.55 : 1.42, portrait ? 1.04 : 1.1);
    wantPos.copy(wantLook).addScaledVector(dir, d);
    if (v === 'win') { const a = Math.sin(t * 0.0004) * 0.5; wantPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); }
    return;
  }
  const c = plateCenter(v); wantLook.copy(c);
  const dir = new THREE.Vector3(0, 1, 0.34).normalize();
  const hw = PLATE.W * S / 2, hh = PLATE.D * S / 2 * 0.96;
  // la barre du bas (portrait) ou la colonne de droite (paysage) prend de la place : on décale la cible
  const d = fitDistance(hw, hh, portrait ? 1.07 : 1.22);
  wantPos.copy(c).addScaledVector(dir, d);
  if (portrait) { wantLook.z += 0.05; wantPos.z += 0.05; } else { wantLook.x += hw * 0.28; wantPos.x += hw * 0.28; }
}
function camUpdate(dt, t, snap) {
  viewPose(view, t);
  const k = snap ? 1 : 1 - Math.pow(0.0009, dt);
  camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
  camera.position.copy(camPos);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.2); }
  camera.lookAt(camLook);
}
function caseTilt(v) { // la mallette penche un peu dans le sens de l'inclinaison
  const tx = (phase === 'play' && view === 'inclinaison') ? v.y * 0.07 : 0, tz = (phase === 'play' && view === 'inclinaison') ? -v.x * 0.07 : 0;
  C.root.rotation.x += (tx - C.root.rotation.x) * 0.15; C.root.rotation.z += (tz - C.root.rotation.z) * 0.15;
}

// ---------- Interface ----------
const screens = ['title', 'settings', 'howto', 'credits', 'brief', 'pause', 'end', 'manualOverlay'];
function show(id) { screens.forEach(s => $(s) && $(s).classList.toggle('hidden', s !== id)); document.body.dataset.screen = id || 'game'; const el = id && $(id); if (el) { const f = el.querySelector('[data-autofocus]') || el.querySelector('button'); f && f.focus({ preventScroll: true }); } }
function fmt(ms) { const s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function setView(v) {
  if (v !== view && phase === 'play') Sfx.whoosh && Sfx.whoosh();
  view = v; hook.mode = v; $('viewName').textContent = VIEW_LABEL[v] || '';
  document.body.dataset.view = v;
  $('sensorBar').classList.toggle('hidden', v !== 'inclinaison');
  $('back').classList.toggle('hidden', v === 'overview');
}
function stepView(d) { const i = view === 'overview' ? (d > 0 ? -1 : ORDER.length) : ORDER.indexOf(view); setView(ORDER[(i + d + ORDER.length) % ORDER.length]); }
function updateHud() {
  if (!G) return;
  $('timer').textContent = fmt(G.remaining);
  $('timer').classList.toggle('urgent', G.remaining < 60000);
  const st = $('strikes'); st.textContent = ''; for (let i = 0; i < G.maxMistakes; i++) { const s = document.createElement('i'); if (i < G.mistakes) s.className = 'on'; st.appendChild(s); }
  st.setAttribute('aria-label', `Erreurs : ${G.mistakes} sur ${G.maxMistakes}`);
  $('hintCount').textContent = G.hints;
  $('modCount').textContent = `${G.solvedCount()}/5`;
}
function toast(msg, kind) { const t = $('toast'); t.textContent = msg; t.className = 'show ' + (kind || ''); clearTimeout(toast.h); toast.h = setTimeout(() => t.className = '', 2200); }
function setOled(a, b, ms = 2600) { oledMsg = [a, b || '']; oledUntil = performance.now() + ms; }
function manualURL() { const u = new URL('manuel.html', location.href); u.search = '?code=' + encodeURIComponent(G ? G.code : ''); return u.href; }

// ---------- Partie ----------
function newGame(seed) {
  if (!seed) seed = L.randomSeed();
  G = L.createGame(seed, { minutes: settings.minutes, maxMistakes: settings.maxMistakes });
  mods.setRound(G.R, G);
  fx.clear(); restoreLid(); lidAngle = 0; latchAngle = 0; power = 0; applyPower();
  setOled('CODE ' + G.code, '');
  updateHud();
}
function startFlow(seed) {
  Sfx.init(); Sfx.roomStart(); document.body.dataset.mode = settings.mode;
  newGame(seed);
  if (settings.mode === 'duo' || settings.mode === 'equipe') { phase = 'brief'; fillBrief(); show('brief'); } else beginIntro();
}
function fillBrief() {
  $('briefCode').textContent = G.code;
  $('briefMode').textContent = settings.mode === 'duo' ? 'Désamorceur + Expert' : 'Équipe';
  $('briefDuo').classList.toggle('hidden', settings.mode !== 'duo');
  $('briefTeam').classList.toggle('hidden', settings.mode !== 'equipe');
  $('briefLink').href = manualURL(); $('briefLink').textContent = manualURL().replace(/^https?:\/\//, '');
  const q = qrcode(0, 'M'); q.addData(manualURL()); q.make(); $('briefQR').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  $('briefTime').textContent = `${settings.minutes} min · ${settings.maxMistakes} erreur${settings.maxMistakes > 1 ? 's' : ''} max.`;
}
function beginIntro() {
  phase = 'intro'; show(null); $('hud').classList.remove('hidden'); setView('overview');
  cine = { type: 'intro', t0: performance.now() }; $('skip').classList.remove('hidden');
  lidScreen.draw({ phase: 'off' });
}
function startClock() {
  cine = null; $('skip').classList.add('hidden'); phase = 'play'; paused = false; lidAngle = LID_OPEN; latchAngle = 1; power = 1; applyPower();
  roundStart = performance.now(); Sfx.roomStop();
  Sfx.bedStart(() => G && { remaining: G.remaining, startMs: G.timeMs, strikes: G.mistakes, running: phase === 'play' && !paused, final: false });
  setOled('CODE ' + G.code, 'PRET', 2000);
}
function applyPower() { for (const p of Object.values(mods.plates)) p.mat.emissiveIntensity = 0.85 * power; panelGlow.intensity = 1.4 * power; }
function endGame(kind) {
  if (phase !== 'play') return;
  phase = 'end'; Sfx.bedStop(true);
  if (kind === 'win') {
    cine = { type: 'win', t0: performance.now() }; lidScreen.draw({ phase: 'win', timeStr: fmt(G.remaining), score: G.score() }); Sfx.powerDown(); setTimeout(() => Sfx.jingle(), 500); fx.winConfetti(Q);
    setView('win');
  } else {
    cine = { type: 'boom', t0: performance.now() }; Sfx.heartRush(1.3);
    setView('boom');
  }
  $('skip').classList.remove('hidden');
}
function showEnd() {
  cine = null; $('skip').classList.add('hidden');
  const win = G.over === 'win', sc = G.score(), mode = settings.mode;
  const prev = best[mode] || 0; const record = win && sc > prev; if (record) { best[mode] = sc; store.set('meilleurs', best); }
  $('endTitle').textContent = win ? 'Mallette désamorcée' : 'BOUM';
  $('end').classList.toggle('lose', !win);
  $('endSub').textContent = win ? (record ? 'Nouveau record pour ce mode !' : 'Bien joué, l’équipe.') : (G.remaining <= 0 ? 'Le chrono est tombé à zéro.' : 'Trop d’erreurs : la mallette a sauté.');
  $('endTime').textContent = fmt(G.remaining); $('endMist').textContent = `${G.mistakes} / ${G.maxMistakes}`; $('endHints').textContent = G.hints;
  $('endMods').textContent = `${G.solvedCount()} / 5`; $('endScore').textContent = sc.toLocaleString('fr-CA'); $('endBest').textContent = (best[mode] || 0).toLocaleString('fr-CA');
  $('endCode').textContent = G.code;
  $('hud').classList.add('hidden'); show('end');
}
function useHint() {
  if (phase !== 'play' || !G) return;
  const h = G.hint(ORDER.includes(view) && view !== 'ctrl' ? view : undefined); if (!h) return;
  Sfx.hint(); setOled('INDICE ' + L.MODULE_LABEL[h.mod].toUpperCase(), h.text, 6000);
  toast(`Indice (${L.MODULE_LABEL[h.mod]}) : ${h.text}`, 'hint'); updateHud();
}

// ---------- Événements des modules ----------
function onModuleEvent(ev, a) {
  switch (ev) {
    case 'snip': Sfx.snip(); setOled('FIL ' + (a + 1) + ' COUPE', ''); break;
    case 'key': Sfx.key(L.KEYS.indexOf(a.k)); if (a.r === 'ok' || a.r === 'ignore') setOled('CODE> ' + (G.keyBuf + '____').slice(0, 4), a.k === '*' ? 'EFFACE' : '', 4000); break;
    case 'joy': Sfx.joy(); if (a.r === 'ok') setOled('JOY ' + a.d.toUpperCase(), G.joyPos + '/4'); break;
    case 'tagLift': Sfx.whoosh(); break;
    case 'rfid': Sfx.rfid(); if (a.r === 'ok') setOled('BADGE ' + a.n + ' LU', '1/2'); break;
    case 'tilt': Sfx.tiltTick(1); if (a.r === 'ok') setOled('INCL. ' + a.dir.toUpperCase() + ' OK', G.tiltPos === 2 ? 'SECOUEZ' : ''); break;
    case 'shake': Sfx.shake(); shake = Math.max(shake, 0.05); setOled('SECOUSSE x' + a, 'IMMOBILE 2 S = OK', 3000); break;
    case 'shakeIgnored': Sfx.shake(); break;
    case 'hintButton': useHint(); break;
    case 'mistake':
      Sfx.buzzer(); shake = 0.08; alarm.intensity = 6; setOled('ERREUR ' + L.MODULE_LABEL[a].toUpperCase(), `${G.mistakes}/${G.maxMistakes}`, 3000);
      if (navigator.vibrate) navigator.vibrate([90, 60, 90]); $('flash').className = 'red'; setTimeout(() => $('flash').className = '', 180);
      break;
    case 'solved': Sfx.good(); setOled(L.MODULE_LABEL[a].toUpperCase() + ' OK', `${G.solvedCount()}/5 MODULES`, 3000); toast(`${L.MODULE_LABEL[a]} désamorcé`, 'ok'); break;
  }
  updateHud();
  if (G.over && phase === 'play') endGame(G.over);
}

// ---------- Entrées tactiles / souris ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let ptr = null;
function rayAt(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
function plateHit(e) { rayAt(e); const h = ray.intersectObjects(mods.plateMeshes, false)[0]; return h ? { id: h.object.userData.module, px: h.uv.x * PLATE.CW, py: (1 - h.uv.y) * PLATE.CH } : null; }
const plane = new THREE.Plane(), tmp = new THREE.Vector3();
function planeCoords(e, id) { // prolonge le doigt hors de la plaque (glisser le joystick)
  rayAt(e); const m = mods.plates[id].mesh; const n = new THREE.Vector3(0, 1, 0).transformDirection(m.matrixWorld); plane.setFromNormalAndCoplanarPoint(n, m.getWorldPosition(new THREE.Vector3()));
  if (!ray.ray.intersectPlane(plane, tmp)) return null; mods.plates[id].mount.worldToLocal(tmp);
  return { px: (tmp.x / PLATE.W + 0.5) * PLATE.CW, py: (tmp.z / PLATE.D + 0.5) * PLATE.CH };
}
canvas.addEventListener('pointerdown', e => {
  Sfx.init();
  if (cine && cine.type === 'intro') return;
  if (phase !== 'play' || paused) return;
  canvas.setPointerCapture(e.pointerId);
  const h = plateHit(e);
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), hit: h, mod: null };
  if (view === 'clavier') { const ki = mods.keyHit(ray); if (ki >= 0) { ptr.mod = 'clavier'; mods.handlers.clavier.key(L.KEYS[ki]); return; } } // touche du GLB (BatchedMesh)
  if (h && view === h.id && mods.handlers[h.id]) { ptr.mod = h.id; mods.handlers[h.id].down(h); }
});
canvas.addEventListener('pointermove', e => {
  if (!ptr || ptr.id !== e.pointerId) return;
  if (ptr.mod && mods.handlers[ptr.mod].move) { const p = planeCoords(e, ptr.mod); if (p) mods.handlers[ptr.mod].move(p); }
});
function endPtr(e) {
  if (!ptr || ptr.id !== e.pointerId) return;
  const p = ptr; ptr = null; const dx = e.clientX - p.x, dy = e.clientY - p.y, quick = performance.now() - p.t < 600;
  if (p.mod) { mods.handlers[p.mod].up && mods.handlers[p.mod].up(); return; }
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && quick && view !== 'overview') { stepView(dx < 0 ? 1 : -1); return; }
  if (Math.hypot(dx, dy) < 14 && p.hit && p.hit.id !== view) setView(p.hit.id); // toucher un module = s'en approcher
}
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);

// ---------- Clavier ----------
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, select, textarea')) return;
  if (e.key === 'm' || e.key === 'M') { Sfx.init(); Sfx.setMuted(!Sfx.muted); syncSound(); return; }
  if (cine && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { skipCine(); e.preventDefault(); return; }
  if (phase !== 'play' || paused) return;
  const k = e.key;
  if (k === 'Escape') { setView('overview'); return; }
  if (k === 'PageDown' || k === ']' || (k === 'Tab' && !e.shiftKey)) { stepView(1); e.preventDefault(); return; }
  if (k === 'PageUp' || k === '[' || (k === 'Tab' && e.shiftKey)) { stepView(-1); e.preventDefault(); return; }
  if (k === 'h' || k === 'H' || k === '?') { useHint(); return; }
  const H = mods.handlers;
  if (view === 'clavier') { const kk = k.toUpperCase(); if (L.KEYS.includes(kk)) { H.clavier.key(kk); e.preventDefault(); } else if (k === 'Backspace') H.clavier.key('*'); else if (k === 'Enter') H.clavier.key('#'); return; }
  if (view === 'fils' && /^[1-6]$/.test(k)) { const i = +k - 1; if (i < G.R.wires.length) H.fils.down({ px: (LAYOUT.fils.x0 + LAYOUT.fils.x1) / 2, py: LAYOUT.fils.rows[i] }); return; }
  if (view === 'rfid' && /^[1-6]$/.test(k)) { H.rfid.scan(+k); return; }
  const ARW = { ArrowUp: 'Haut', ArrowDown: 'Bas', ArrowLeft: 'Gauche', ArrowRight: 'Droite', w: 'Haut', s: 'Bas', a: 'Gauche', d: 'Droite' };
  if (view === 'joystick') { if (ARW[k] && !e.repeat) { H.joystick.nudge(ARW[k]); e.preventDefault(); } else if (k === 'Enter' || k === ' ') { H.joystick.dir('Clic'); e.preventDefault(); } return; }
  if (view === 'inclinaison') {
    const T = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k];
    if (T) { kbTilt.set(T[0], T[1]); e.preventDefault(); } else if ((k === 's' || k === 'S' || k === ' ') && !e.repeat) { H.inclinaison.shake(); e.preventDefault(); }
  }
});
const kbTilt = new THREE.Vector2();
addEventListener('keyup', e => { if (/^Arrow/.test(e.key)) kbTilt.set(0, 0); });

// ---------- Capteurs (GY-6500 ↔ DeviceOrientation / DeviceMotion) ----------
const sensor = { on: false, b0: null, g0: null, x: 0, y: 0, lastShake: 0 };
async function enableSensors() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') throw new Error('refus'); }
    if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) { await DeviceMotionEvent.requestPermission().catch(() => {}); }
  } catch (e) { toast('Capteurs refusés : glissez sur le module à la place.', 'warn'); return; }
  if (!('DeviceOrientationEvent' in window)) { toast('Pas de capteur ici : glissez sur le module.', 'warn'); return; }
  sensor.on = true; sensor.b0 = null; $('sensorBtn').textContent = 'Capteurs actifs · recalibrer'; $('sensorBtn').setAttribute('aria-pressed', 'true');
  toast('Tenez le téléphone comme d’habitude : c’est la position neutre.', 'ok');
}
addEventListener('deviceorientation', e => {
  if (!sensor.on || e.beta == null) return;
  if (sensor.b0 === null) { sensor.b0 = e.beta; sensor.g0 = e.gamma; }
  let x = (e.gamma - sensor.g0) / 25, y = (e.beta - sensor.b0) / 25;        // ±25° = bord
  const ang = (screen.orientation && screen.orientation.angle) || 0;        // paysage : on tourne les axes
  if (ang === 90) [x, y] = [y, -x]; else if (ang === 270 || ang === -90) [x, y] = [-y, x];
  sensor.x = x; sensor.y = y;
});
addEventListener('devicemotion', e => {
  if (!sensor.on || phase !== 'play' || view !== 'inclinaison') return;
  const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null; if (!a) return;
  const m = Math.hypot(a.x, a.y, a.z), now = performance.now();
  if (m > 14 && now - sensor.lastShake > 380) { sensor.lastShake = now; mods.handlers.inclinaison.shake(); }
});

// ---------- Cinématiques ----------
const lidHome = { parent: null, pos: new THREE.Vector3(), rot: new THREE.Euler() };
function restoreLid() {
  if (lidHome.parent) { lidHome.parent.add(C.lid); C.lid.position.copy(lidHome.pos); C.lid.rotation.copy(lidHome.rot); lidHome.parent = null; }
  C.lid.userData.fly = null; C.root.position.set(0, 0, 0); C.root.rotation.set(0, 0, 0);
}
function skipCine() {
  if (!cine) return;
  if (cine.type === 'intro') { startClock(); return; }
  showEnd();
}
const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function cineUpdate(dt, now) {
  if (!cine) return;
  const t = (now - cine.t0) / 1000;
  if (cine.type === 'intro') {
    const fire = (key, at, fn) => { if (t >= at && !cine[key]) { cine[key] = 1; fn(); } };
    fire('l1', 0.35, () => Sfx.latch()); fire('l2', 0.55, () => Sfx.latch()); fire('lid', 0.9, () => Sfx.lidOpen());
    latchAngle = Math.min(1, Math.max(0, (t - 0.3) / 0.35));
    const k = Math.min(1, Math.max(0, (t - 0.9) / 1.3)); lidAngle = LID_OPEN * (k < 1 ? ease(k) + Math.sin(k * Math.PI) * 0.04 : 1);
    for (let i = 0; i < 6; i++) fire('p' + i, 2.3 + i * 0.12, () => Sfx.powerOn(i));
    power = Math.min(1, Math.max(0, (t - 2.3) / 0.8)); applyPower();
    if (t > 2.3) lidScreen.draw({ phase: 'boot', modeLabel: modeLabel(), msg: 'MODULES ' + Math.min(5, Math.floor((t - 2.3) * 7)) + '/5' });
    if (t > 2.3) seg.draw(Math.floor(t * 8) % 2 ? '8888' : '    ', true);
    fire('chord', 3.0, () => Sfx.bootChord());
    if (t > 3.4) startClock();
    return;
  }
  if (cine.type === 'win') {
    seg.draw(fmtDigits(G.remaining), true, Math.floor(t * 3) % 2 ? '#2bff63' : '#0b4019');
    mods.allLeds(0x2bff63, t < 1.2 ? (Math.floor(t * 10) % 2) : 1);
    if (Math.random() < 0.3 * Q) fx.goldSpark(1.2);
    if (t > (RM ? 1.5 : 3.2)) showEnd();
    return;
  }
  if (cine.type === 'boom') {
    if (t < 1.3) { alarm.intensity = Math.floor(t * 12) % 2 ? 9 : 1; shake = 0.03 + t * 0.05; seg.draw(Math.floor(t * 12) % 2 ? '0000' : '    ', true); return; }
    if (!cine.blown) {
      cine.blown = 1; Sfx.bigBoom(); fx.explode(Q, camera); blast.intensity = 60; shake = RM ? 0.1 : 0.6; alarm.intensity = 0;
      $('flash').className = 'white'; setTimeout(() => $('flash').className = '', 260); if (navigator.vibrate) navigator.vibrate([400, 80, 200]);
      // le couvercle est arraché et vole
      lidHome.parent = C.lid.parent; lidHome.pos.copy(C.lid.position); lidHome.rot.copy(C.lid.rotation);
      scene.attach(C.lid); C.lid.userData.fly = { v: new THREE.Vector3(0.8, 7.5, -2.5), w: new THREE.Vector3(-3.5, 0.6, 1.2) };
      mods.allLeds(0x000000, 0); power = 0.08; applyPower(); lidScreen.draw({ phase: 'off' });
    }
    blast.intensity = Math.max(0, blast.intensity - dt * 70);
    const f = C.lid.userData.fly; if (f) { f.v.y -= 9.8 * dt; C.lid.position.addScaledVector(f.v, dt); C.lid.rotation.x += f.w.x * dt; C.lid.rotation.y += f.w.y * dt; C.lid.rotation.z += f.w.z * dt; if (C.lid.position.y < 0.2 && f.v.y < 0) { C.lid.position.y = 0.2; f.v.multiplyScalar(0.35); f.v.y = Math.abs(f.v.y) * 0.4; f.w.multiplyScalar(0.5); } }
    C.root.position.y = Math.max(0, Math.sin(Math.min(1, (t - 1.3) * 2) * Math.PI) * 0.4);
    if (t > (RM ? 2.4 : 4.2)) showEnd();
  }
}
const fmtDigits = ms => fmt(ms).replace(':', '');
function modeLabel() { return settings.mode === 'duo' ? 'DUO · DÉSAMORCEUR' : settings.mode === 'equipe' ? 'ÉQUIPE' : 'SOLO'; }

// ---------- Boucle ----------
const perf = { fps: 0, frames: 0, t0: performance.now(), calls: 0, tris: 0 };
const fpsBox = qs.get('fps') === '1' ? $('fps') : null; if (fpsBox) fpsBox.classList.remove('hidden');
let lidT = 0;
function frame(now) {
  const realMs = Math.min(1000, now - last), dt = Math.min(0.05, realMs / 1000); last = now;
  const live = phase === 'play' && !paused;
  // le chrono suit le temps réel, même à faible fps
  if (live) { G.tick(realMs); if (G.over) { updateHud(); endGame(G.over); } }
  // inclinaison : clavier ou capteurs
  if (live && view === 'inclinaison') { if (kbTilt.lengthSq()) mods.handlers.inclinaison.sensor(kbTilt.x, kbTilt.y); else if (sensor.on) mods.handlers.inclinaison.sensor(sensor.x, sensor.y); else if (!mods.tilt.drag) mods.tilt.target.set(0, 0); }
  if (G) mods.update(dt, now, live);
  cineUpdate(dt, now);
  if (!C.lid.userData.fly) { C.lid.rotation.x = lidAngle; }
  if (C.latches) C.latches.rotation.x = latchAngle * 1.2;
  alarm.intensity = Math.max(0, alarm.intensity - dt * 12);
  // afficheurs
  if (G && live) {
    const urgent = G.remaining < 10000, blink = Math.floor(now / (urgent ? 125 : 500)) % 2;
    seg.draw(fmtDigits(G.remaining), blink === 0, '#ff3326');
    const msg = now < oledUntil ? oledMsg : [G.solvedCount() + '/5 MODULES', 'INDICE = BOUTON'];
    oled.draw(['CODE ' + G.code, `ERR ${G.mistakes}/${G.maxMistakes}  IND ${G.hints}`, msg[0], msg[1], fmt(G.remaining)], true);
    if (now - lidT > 250) { lidT = now; drawLid(); }
    if (now - (frame.h || 0) > 200) { frame.h = now; updateHud(); }
  }
  camUpdate(dt, now);
  fx.update(dt, now); // particules
  renderer.render(scene, camera);
  const ri = renderer.info.render; perf.calls = ri.calls; perf.tris = ri.triangles; perf.frames++;
  Object.assign(hook.render, { calls: ri.calls, triangles: ri.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 0 });
  if (now - perf.t0 >= 500) {
    perf.fps = Math.round(perf.frames * 1000 / (now - perf.t0)); perf.frames = 0; perf.t0 = now;
    if (fpsBox) fpsBox.textContent = `${perf.fps} fps · ${perf.calls} appels · ${(perf.tris / 1000).toFixed(1)} k tri · palier ${gpu.tier}${low ? ' (bas)' : ''} · pr ${renderer.getPixelRatio()} · ${gpu.gpu}`;
  }
}
function drawLid() {
  lidScreen.draw({ phase: 'play', code: G.code, modeLabel: modeLabel(), url: manualURL(), showQR: settings.mode === 'duo',
    modules: L.MODULES.map(m => ({ label: L.MODULE_LABEL[m], state: G.solved[m] ? 'ok' : 'idle' })), mistakes: G.mistakes, maxMistakes: G.maxMistakes,
    hints: G.hints, timeStr: fmt(G.remaining), msg: settings.mode === 'equipe' ? 'Manuel : bouton 📖' : '' });
}

// ---------- Redimensionnement ----------
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, prCap)); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 46 : 40; camera.updateProjectionMatrix();
  fx.setScale(h, camera.fov, renderer.getPixelRatio());
  document.body.classList.toggle('landscape', w > h);
}
addEventListener('resize', resize);

// ---------- Boutons ----------
function syncSound() { $('sound').textContent = Sfx.muted ? '🔇' : '🔊'; $('sound').setAttribute('aria-label', Sfx.muted ? 'Activer le son' : 'Couper le son'); }
function bind(id, fn) { $(id).addEventListener('click', e => { Sfx.init(); Sfx.click && Sfx.click(); fn(e); }); }
bind('play', () => { const c = $('codeIn').value.trim(); if (c) { const p = L.parseCode(c); if (!p.ok) { $('codeErr').textContent = p.reason === 'controle' ? 'Code invalide (chiffre de contrôle). Vérifiez la saisie.' : 'Format attendu : 48213-4'; return; } $('codeErr').textContent = ''; startFlow(p.seed); } else startFlow(); });
document.querySelectorAll('[name=mode]').forEach(r => { r.checked = r.value === settings.mode; r.addEventListener('change', () => { settings.mode = r.value; store.set('reglages', settings); }); });
bind('openSettings', () => { $('minutes').value = settings.minutes; $('minutesOut').textContent = settings.minutes + ' min'; $('mistakes').value = settings.maxMistakes; $('mistakesOut').textContent = settings.maxMistakes; show('settings'); });
$('minutes').addEventListener('input', e => { settings.minutes = Math.max(1, Math.min(99, +e.target.value | 0)); $('minutesOut').textContent = settings.minutes + ' min'; store.set('reglages', settings); });
$('mistakes').addEventListener('input', e => { settings.maxMistakes = Math.max(1, Math.min(9, +e.target.value | 0)); $('mistakesOut').textContent = settings.maxMistakes; store.set('reglages', settings); });
bind('settingsDone', () => show('title'));
bind('openHowto', () => show('howto')); bind('howtoDone', () => show('title'));
bind('openCredits', () => show('credits')); bind('creditsDone', () => show('title'));
bind('go', () => beginIntro());
bind('briefBack', () => { phase = 'menu'; setView('menu'); show('title'); });
bind('skip', () => skipCine());
bind('pauseBtn', () => { if (phase !== 'play') return; paused = true; Sfx.bedStop(); show('pause'); $('pauseCode').textContent = G.code; });
bind('resume', () => { paused = false; show(null); Sfx.bedStart(() => G && { remaining: G.remaining, startMs: G.timeMs, strikes: G.mistakes, running: phase === 'play' && !paused }); });
bind('quit', () => { paused = false; phase = 'menu'; Sfx.bedStop(); G = null; restoreLid(); lidAngle = 0; latchAngle = 0; power = 0; applyPower(); lidScreen.draw({ phase: 'off' }); $('hud').classList.add('hidden'); setView('menu'); show('title'); });
bind('again', () => { const s = G.seed; G = null; startFlow(L.randomSeed() === s ? s + 1 : undefined); });
bind('sameCode', () => startFlow(G.seed));
bind('toMenu', () => { phase = 'menu'; G = null; restoreLid(); lidAngle = 0; latchAngle = 0; power = 0; applyPower(); fx.clear(); lidScreen.draw({ phase: 'off' }); setView('menu'); show('title'); });
bind('sound', () => { Sfx.setMuted(!Sfx.muted); syncSound(); });
bind('hintBtn', () => useHint());
bind('prev', () => stepView(-1)); bind('next', () => stepView(1)); bind('back', () => setView('overview'));
bind('sensorBtn', () => enableSensors());
bind('shakeBtn', () => mods.handlers.inclinaison.shake());
bind('manualBtn', () => { $('manualFrame').src = 'manuel.html?embed=1&code=' + encodeURIComponent(G ? G.code : ''); show('manualOverlay'); });
bind('manualClose', () => { show(null); $('manualFrame').src = 'about:blank'; });
syncSound();

// ---------- Palier GPU ----------
async function detectTier() {
  try { const r = await getGPUTier({ benchmarksURL: new URL('../detect-gpu-benchmarks', import.meta.url).href }); gpu = { tier: r.tier ?? 2, gpu: r.gpu || '?', type: r.type }; }
  catch (e) { gpu = { tier: 2, gpu: '?', type: 'erreur' }; }
  if (forcedTier !== null) gpu.tier = forcedTier;
  if (gpu.tier <= 1 && !low) { low = true; prCap = 1; Q *= 0.5; scene.environment = null; hemi.intensity = 1.5; resize(); }
}

// ---------- API de test et de mesure ----------
function setMode(m) {
  hook.mode = m; cine = null; fx.clear();
  if (m === 'menu') { phase = 'menu'; G = null; restoreLid(); lidAngle = 0; latchAngle = 0; power = 0; applyPower(); setView('menu'); show('title'); $('hud').classList.add('hidden'); return; }
  if (!G || G.over) { newGame(+qs.get('seed') || 48213); }
  if (phase !== 'play') { show(null); $('hud').classList.remove('hidden'); startClock(); }
  restoreLid(); lidAngle = LID_OPEN;
  if (m === 'closed') { lidAngle = 0; latchAngle = 0; setView('menu'); return; }
  if (m === 'win' || m === 'boom') { G.over = m; phase = 'play'; endGame(m); cine.loop = true; return; }
  setView(ORDER.includes(m) ? m : 'overview');
}
hook.setMode = setMode;
window.__c204 = hook; // nom attendu par /home/box/opt/perf3d/measure.mjs
window.DM = {
  L, version: VERSION, G: () => G, phase: () => phase, view: () => view, setView, setMode, startFlow, beginIntro, startClock, skipCine,
  screenOf: (id, px, py) => mods.screenOf(id, px, py, camera, canvas), LAYOUT, settled: () => camPos.distanceTo(wantPos) < 0.01 && camLook.distanceTo(wantLook) < 0.01,
  cine: () => cine && { type: cine.type, t: (performance.now() - cine.t0) / 1000 }, lid: () => +C.lid.rotation.x.toFixed(3),
  wires: () => mods.wires.map(w => w.cut), nodes: () => { const n = []; C.root.traverse(o => o.name && n.push(o.name)); return n; },
  perf: () => ({ ...perf, tier: gpu.tier, low, pr: renderer.getPixelRatio(), gpu: gpu.gpu }), tilt: () => ({ v: mods.tilt.v.toArray().map(x => +x.toFixed(2)), hold: mods.tilt.hold }),
  audio: () => Sfx.ctx ? { state: Sfx.ctx.state, bed: !!Sfx.bed, muted: Sfx.muted } : null, settings, oled: () => oledMsg, source: () => C.source, glbParts: () => glbUsed
};

// ---------- Démarrage ----------
resize(); setView('menu'); show('title');
renderer.compile(scene, camera);
renderer.setAnimationLoop(frame);
const ready = () => { hook.ready = true; document.body.classList.add('ready'); $('loading').classList.add('hidden'); };
detectTier().then(ready); setTimeout(ready, 4000);
if (qs.get('autostart') === '1') { settings.mode = qs.get('mode') || settings.mode; startFlow(qs.get('seed') ? +qs.get('seed') : undefined); }

// ---------- Service worker ----------
if ('serviceWorker' in navigator && qs.get('nosw') !== '1' && isSecureContext) addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=' + VERSION).catch(() => {}));
