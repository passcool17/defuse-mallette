// Afficheurs : chrono 4 chiffres 7 segments, écran OLED 128×64 et écran du couvercle (tous en CanvasTexture).
import * as THREE from 'three';

function tex(c, nearest) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }
  return t;
}
// ---------- 7 segments (4 chiffres + deux-points) ----------
const SEG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '', d: 'bcdeg', E: 'adefg', F: 'aefg', o: 'cdeg', n: 'ceg', b: 'cdefg', U: 'bcdef', A: 'abcefg', r: 'eg', P: 'abefg' };
export function makeSevenSeg() {
  const c = document.createElement('canvas'); c.width = 320; c.height = 120; const x = c.getContext('2d');
  const t = tex(c); let last = '';
  function seg(ox, s, on, col) {
    const w = 46, h = 84, th = 9, y0 = 18;
    const H = (y) => [[ox + 6, y], [ox + w - 6, y]], V = (xx, y) => [[xx, y + 6], [xx, y + h / 2 - 6]];
    const segs = { a: H(y0), g: H(y0 + h / 2), d: H(y0 + h), f: V(ox, y0), b: V(ox + w, y0), e: V(ox, y0 + h / 2), c: V(ox + w, y0 + h / 2) };
    for (const k of 'abcdefg') {
      const [[x1, y1], [x2, y2]] = segs[k]; const lit = on.includes(k);
      x.strokeStyle = lit ? col : 'rgba(255,40,30,.07)'; x.lineWidth = th; x.lineCap = 'round';
      x.shadowColor = lit ? col : 'transparent'; x.shadowBlur = lit ? 14 : 0;
      x.beginPath(); x.moveTo(x1 - (k === 'e' || k === 'f' ? 0 : 0) - (y1 === y2 ? 0 : 3) * 0, y1); x.lineTo(x2, y2); x.stroke();
    }
    x.shadowBlur = 0;
  }
  function draw(str, colon = true, col = '#ff3326') { // str : 4 caractères
    const key = str + colon + col; if (key === last) return; last = key;
    x.fillStyle = '#070202'; x.fillRect(0, 0, 320, 120);
    const xs = [22, 92, 182, 252];
    for (let i = 0; i < 4; i++) seg(xs[i], SEG[str[i]] || '', SEG[str[i]] || '', col);
    for (const yy of [44, 82]) { x.fillStyle = colon ? col : 'rgba(255,40,30,.07)'; x.shadowColor = col; x.shadowBlur = colon ? 10 : 0; x.beginPath(); x.arc(160, yy, 5.5, 0, 7); x.fill(); }
    x.shadowBlur = 0; t.needsUpdate = true;
  }
  draw('8888');
  const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); mat.name = 'LED_Timer';
  return { canvas: c, tex: t, mat, draw };
}
// ---------- OLED 128×64 (pixels nets, monochrome bleu-blanc) ----------
export function makeOled() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  const t = tex(c, true); let last = '';
  function draw(lines, invertFirst) {
    const key = lines.join('|') + invertFirst; if (key === last) return; last = key;
    x.fillStyle = '#000'; x.fillRect(0, 0, 128, 64);
    x.font = 'bold 10px monospace'; x.textBaseline = 'top';
    lines.slice(0, 5).forEach((s, i) => {
      if (i === 0 && invertFirst) { x.fillStyle = '#bfe9ff'; x.fillRect(0, 0, 128, 12); x.fillStyle = '#000'; } else x.fillStyle = '#bfe9ff';
      x.fillText(String(s).slice(0, 21), 2, 1 + i * 12.6);
    });
    // seuil : vrais pixels allumés/éteints
    const img = x.getImageData(0, 0, 128, 64), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const on = d[i + 2] > 110; d[i] = on ? 190 : 2; d[i + 1] = on ? 233 : 4; d[i + 2] = on ? 255 : 8; d[i + 3] = 255; }
    x.putImageData(img, 0, 0); t.needsUpdate = true;
  }
  const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); mat.name = 'OLED';
  return { canvas: c, tex: t, mat, draw };
}
// ---------- Écran du couvercle (1024×640) ----------
export function makeLidScreen(qrFactory) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const x = c.getContext('2d');
  const t = tex(c); t.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); mat.name = 'Screen';
  let qrCanvas = null, qrFor = '';
  const COL = { ok: '#3dff7a', bad: '#ff3b30', idle: '#7fb8ff', warn: '#ffc93c', dim: '#5b6777' };
  function bg(tint = '#06121c') {
    const g = x.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, tint); g.addColorStop(1, '#020509'); x.fillStyle = g; x.fillRect(0, 0, 1024, 640);
    x.strokeStyle = 'rgba(127,184,255,.06)'; x.lineWidth = 1; for (let y = 0; y < 640; y += 4) { x.beginPath(); x.moveTo(0, y); x.lineTo(1024, y); x.stroke(); }
  }
  function text(s, X, Y, size, col, align = 'left', weight = '700') { x.font = `${weight} ${size}px system-ui, "Segoe UI", Roboto, sans-serif`; x.textAlign = align; x.textBaseline = 'alphabetic'; x.fillStyle = col; x.fillText(s, X, Y); }
  function mono(s, X, Y, size, col, align = 'left') { x.font = `700 ${size}px "DejaVu Sans Mono", "Roboto Mono", monospace`; x.textAlign = align; x.fillStyle = col; x.fillText(s, X, Y); }
  // st : { phase:'boot'|'play'|'win'|'boom'|'off', code, modeLabel, url, modules:[{label,state}], mistakes, maxMistakes, hints, timeStr, msg, score, showQR }
  function draw(st) {
    const key = JSON.stringify(st); if (key === draw.last) return; draw.last = key;
    if (st.phase === 'off') { x.fillStyle = '#010203'; x.fillRect(0, 0, 1024, 640); t.needsUpdate = true; return; }
    if (st.phase === 'boom') {
      bg('#2a0303'); text('ÉCHEC', 512, 300, 170, COL.bad, 'center', '900'); text(st.msg || 'La mallette a explosé', 512, 380, 40, '#ffb4ae', 'center', '600');
      mono(`SCORE ${st.score}`, 512, 470, 56, '#fff', 'center'); t.needsUpdate = true; return;
    }
    if (st.phase === 'win') {
      bg('#03240f'); text('DÉSAMORCÉE', 512, 270, 130, COL.ok, 'center', '900'); mono(`TEMPS RESTANT ${st.timeStr}`, 512, 360, 44, '#d8ffe4', 'center');
      mono(`SCORE ${st.score}`, 512, 450, 64, '#fff', 'center'); t.needsUpdate = true; return;
    }
    bg();
    // en-tête
    x.fillStyle = 'rgba(127,184,255,.12)'; x.fillRect(0, 0, 1024, 78);
    text('MALLETTE M-5  ·  DÉFUSE', 36, 52, 34, '#cfe6ff', 'left', '800');
    text(st.modeLabel || '', 988, 52, 30, COL.warn, 'right', '700');
    if (st.phase === 'boot') { mono('DÉMARRAGE…', 512, 330, 64, COL.idle, 'center'); mono(st.msg || '', 512, 400, 30, COL.dim, 'center'); t.needsUpdate = true; return; }
    // code de partie
    text('CODE DE PARTIE', 36, 140, 28, COL.dim, 'left', '700');
    mono(st.code, 36, 232, 104, '#ffffff');
    // modules
    st.modules.forEach((m, i) => {
      const y = 300 + i * 56;
      x.fillStyle = m.state === 'ok' ? COL.ok : m.state === 'bad' ? COL.bad : COL.idle; x.beginPath(); x.arc(56, y - 12, 13, 0, 7); x.fill();
      text(`${i + 1}  ${m.label}`, 86, y, 36, m.state === 'ok' ? '#c9ffd9' : '#e6eef8', 'left', '700');
      if (m.state === 'ok') mono('OK', 520, y, 32, COL.ok, 'right');
    });
    // erreurs / indices
    text('ERREURS', 36, 600, 26, COL.dim); for (let i = 0; i < st.maxMistakes; i++) { x.fillStyle = i < st.mistakes ? COL.bad : 'rgba(255,59,48,.18)'; x.fillRect(170 + i * 36, 578, 26, 26); }
    text(`INDICES ${st.hints}`, 520, 600, 26, COL.dim, 'right');
    // QR + lien (rôle Expert), sinon le chrono en grand
    if (st.showQR && qrFactory) {
      if (qrFor !== st.url) { qrCanvas = qrFactory(st.url); qrFor = st.url; }
      x.fillStyle = '#fff'; x.fillRect(640, 120, 340, 340); if (qrCanvas) x.drawImage(qrCanvas, 655, 135, 310, 310);
      text('EXPERT : SCANNEZ', 810, 505, 28, '#cfe6ff', 'center', '800');
      text('le manuel calcule tout hors ligne', 810, 545, 24, COL.dim, 'center', '600');
      mono(st.timeStr, 810, 610, 52, '#ff5a4d', 'center');
    } else {
      mono(st.timeStr, 800, 330, 150, '#ff5a4d', 'center');
      text(st.msg || '', 800, 420, 30, COL.warn, 'center', '700');
    }
    t.needsUpdate = true;
  }
  draw({ phase: 'off' });
  return { canvas: c, tex: t, mat, draw };
}
