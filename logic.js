// Défuse la mallette — logique pure (aucun DOM), partagée par le jeu, le manuel et les tests.
// Tout est en entiers et en petites tables : la même logique tourne sur un ESP32 (voir docs/ESP32.md).
(function (root) {
  'use strict';
  // ---------- Générateur pseudo-aléatoire : mulberry32 (spécification exacte dans docs/ESP32.md) ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
  }

  // ---------- Couleurs et constantes ----------
  const WIRE_COLORS = ['Rouge', 'Bleu', 'Jaune', 'Blanc', 'Noir', 'Vert'];
  const LIGHT_COLORS = ['Rouge', 'Vert', 'Bleu', 'Jaune'];          // couleurs des DEL RVB
  const DIRS = ['Haut', 'Droite', 'Bas', 'Gauche'];                   // joystick (vu par le désamorceur)
  const TILTS = ['Avant', 'Droite', 'Arrière', 'Gauche'];            // inclinaison de la mallette
  const KEYS = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D']; // clavier 4×4, ligne par ligne
  const BADGES = [ // badges RFID fixes (les mêmes 6 cartes dans la vraie mallette)
    { n: 1, name: 'ALPHA', color: 'Rouge' }, { n: 2, name: 'BRAVO', color: 'Bleu' }, { n: 3, name: 'CHARLIE', color: 'Jaune' },
    { n: 4, name: 'DELTA', color: 'Vert' }, { n: 5, name: 'ECHO', color: 'Blanc' }, { n: 6, name: 'FOXTROT', color: 'Noir' }];
  const MODULES = ['fils', 'clavier', 'joystick', 'rfid', 'inclinaison'];
  const MODULE_LABEL = { fils: 'Fils', clavier: 'Clavier', joystick: 'Joystick', rfid: 'Badge RFID', inclinaison: 'Inclinaison' };

  // ---------- Code de partie : 5 chiffres (10000–99999) + chiffre de contrôle ----------
  function digits(seed) { return String(seed).split('').map(Number); } // D1..D5
  function checkDigit(seed) { // poids 1,3,1,3,1 ; c = (10 − somme mod 10) mod 10
    const d = digits(seed); let s = 0; for (let i = 0; i < 5; i++) s += d[i] * (i % 2 ? 3 : 1);
    return (10 - (s % 10)) % 10;
  }
  function formatCode(seed) { return seed + '-' + checkDigit(seed); }
  function parseCode(str) { // « 48213-7 », « 482137 », « 48213 » → { seed, ok, reason }
    const m = String(str || '').replace(/\s+/g, '').match(/^(\d{5})-?(\d)?$/);
    if (!m) return { ok: false, reason: 'format' };
    const seed = +m[1]; if (seed < 10000) return { ok: false, reason: 'format' };
    if (m[2] !== undefined && +m[2] !== checkDigit(seed)) return { ok: false, seed, reason: 'controle' };
    return { ok: true, seed, checked: m[2] !== undefined };
  }
  function randomSeed() { return 10000 + Math.floor(Math.random() * 90000); }

  // ---------- Règles des fils (données : le texte du manuel et la solution viennent des mêmes tables) ----------
  // Conditions : { t:'none', c } aucun fil c ; { t:'one', c } exactement un ; { t:'many', c } plus d'un ;
  //              { t:'last', c } le dernier fil est c ; { t:'odd' } D5 impair. Toutes les conditions d'une règle doivent être vraies.
  // Action : { cut: k } couper le fil n° k ; { cut: 'last' } le dernier fil ; { cut: 'lastOf', c } le dernier fil de couleur c.
  const WIRE_RULES = {
    4: [{ if: [{ t: 'none', c: 'Rouge' }], cut: 2 },
        { if: [{ t: 'last', c: 'Blanc' }], cut: 'last' },
        { if: [{ t: 'many', c: 'Bleu' }], cut: 'lastOf', c: 'Bleu' },
        { if: [], cut: 1 }],
    5: [{ if: [{ t: 'last', c: 'Noir' }, { t: 'odd' }], cut: 4 },
        { if: [{ t: 'one', c: 'Rouge' }, { t: 'many', c: 'Jaune' }], cut: 1 },
        { if: [{ t: 'none', c: 'Noir' }], cut: 2 },
        { if: [], cut: 1 }],
    6: [{ if: [{ t: 'none', c: 'Jaune' }, { t: 'odd' }], cut: 3 },
        { if: [{ t: 'one', c: 'Jaune' }, { t: 'many', c: 'Blanc' }], cut: 4 },
        { if: [{ t: 'none', c: 'Rouge' }], cut: 'last' },
        { if: [], cut: 4 }]
  };
  function countColor(wires, c) { let n = 0; for (const w of wires) if (w === c) n++; return n; }
  function wireCond(cond, wires, d) {
    const n = countColor(wires, cond.c);
    switch (cond.t) {
      case 'none': return n === 0;
      case 'one': return n === 1;
      case 'many': return n > 1;
      case 'last': return wires[wires.length - 1] === cond.c;
      case 'odd': return d[4] % 2 === 1;
    }
    return false;
  }
  function wireToCut(wires, d) { // retourne { index (0-based), rule (0-based) }
    const rules = WIRE_RULES[wires.length];
    for (let r = 0; r < rules.length; r++) {
      const rule = rules[r];
      if (rule.if.every(c => wireCond(c, wires, d))) {
        let i;
        if (rule.cut === 'last') i = wires.length - 1;
        else if (rule.cut === 'lastOf') i = wires.lastIndexOf(rule.c);
        else i = rule.cut - 1;
        return { index: i, rule: r };
      }
    }
    throw new Error('aucune règle');
  }

  // ---------- Clavier : chiffres du code selon la couleur du rétroéclairage ----------
  const KEYPAD_POS = { Rouge: [1, 2, 3, 4], Vert: [5, 4, 3, 2], Bleu: [2, 4, 1, 5], Jaune: [3, 5, 2, 1] }; // positions Dn
  function keypadCode(color, d, nWires) { return KEYPAD_POS[color].map(p => (d[p - 1] + nWires) % 10).join(''); }
  function keypadEnter(checkD) { return checkD % 2 === 0 ? '#' : 'D'; }

  // ---------- Joystick : couleur → direction, table selon D5 ----------
  const JOY_MAP = { pair: { Rouge: 'Haut', Vert: 'Droite', Bleu: 'Bas', Jaune: 'Gauche' },
                    impair: { Rouge: 'Bas', Vert: 'Gauche', Bleu: 'Haut', Jaune: 'Droite' } };
  function joySolution(seq, d) { const m = JOY_MAP[d[4] % 2 ? 'impair' : 'pair']; return seq.map(c => m[c]); }

  // ---------- RFID : badge 1 = table[couleur][clignotements], badge 2 = décalage par D1 ----------
  const RFID_TABLE = { Rouge: [3, 5, 1, 6], Vert: [2, 4, 6, 1], Bleu: [6, 1, 3, 5], Jaune: [4, 2, 5, 3] };
  function rfidSolution(color, blinks, d) {
    const b1 = RFID_TABLE[color][blinks - 1];
    let b2 = ((b1 - 1 + d[0]) % 6) + 1;
    if (b2 === b1) b2 = (b1 % 6) + 1;
    return [b1, b2];
  }

  // ---------- Inclinaison : 2 inclinaisons selon la couleur, puis N secousses ----------
  const TILT_MAP = { Rouge: ['Gauche', 'Avant'], Vert: ['Arrière', 'Droite'], Bleu: ['Droite', 'Gauche'], Jaune: ['Avant', 'Arrière'] };
  function shakeCount(d) { return (d[2] % 3) + 1; }
  function tiltSolution(color, d) { return { tilts: TILT_MAP[color].slice(), shakes: shakeCount(d) }; }

  // ---------- Génération d'une partie (ordre exact des tirages : docs/ESP32.md) ----------
  function generate(seed) {
    const r = mulberry32(seed), pick = n => r() % n;
    const d = digits(seed), check = checkDigit(seed);
    const nWires = 4 + pick(3);
    const wires = []; for (let i = 0; i < nWires; i++) wires.push(WIRE_COLORS[pick(6)]);
    const keypadColor = LIGHT_COLORS[pick(4)];
    const joySeq = []; for (let i = 0; i < 4; i++) joySeq.push(LIGHT_COLORS[pick(4)]);
    const rfidColor = LIGHT_COLORS[pick(4)], rfidBlinks = 1 + pick(4);
    const tiltColor = LIGHT_COLORS[pick(4)];
    const round = { seed, code: formatCode(seed), d, check, wires, keypadColor, joySeq, rfidColor, rfidBlinks, tiltColor };
    round.solution = solve(round);
    return round;
  }
  function solve(R) { // ce que dit le manuel pour cette mallette
    const w = wireToCut(R.wires, R.d);
    return {
      fils: { cut: w.index, rule: w.rule },
      clavier: { code: keypadCode(R.keypadColor, R.d, R.wires.length), enter: keypadEnter(R.check) },
      joystick: { dirs: joySolution(R.joySeq, R.d) },
      rfid: { badges: rfidSolution(R.rfidColor, R.rfidBlinks, R.d) },
      inclinaison: tiltSolution(R.tiltColor, R.d)
    };
  }

  // ---------- Machines à états des modules (une action = un événement entier) ----------
  // Chaque step(...) renvoie 'ok' (bonne action, continuer), 'solved', 'mistake' ou 'ignore'.
  function createGame(seed, opts) {
    opts = opts || {};
    const R = generate(seed), S = R.solution;
    const G = {
      R, S, seed, code: R.code,
      timeMs: Math.max(1, Math.min(99, opts.minutes == null ? 15 : opts.minutes | 0)) * 60000,
      maxMistakes: Math.max(1, Math.min(9, opts.maxMistakes == null ? 3 : opts.maxMistakes | 0)),
      mistakes: 0, hints: 0, hintLevel: {}, solved: {}, over: null,
      cut: [], keyBuf: '', joyPos: 0, rfidPos: 0, tiltPos: 0, shakes: 0, log: []
    };
    G.remaining = G.timeMs;
    MODULES.forEach(m => { G.solved[m] = false; G.hintLevel[m] = 0; });
    G.allSolved = () => MODULES.every(m => G.solved[m]);
    G.solvedCount = () => MODULES.filter(m => G.solved[m]).length;
    function res(mod, r, extra) {
      if (r === 'mistake') { G.mistakes++; if (G.mistakes >= G.maxMistakes) G.over = 'boom'; }
      if (r === 'solved') { G.solved[mod] = true; if (G.allSolved()) G.over = 'win'; }
      G.log.push([mod, r, extra]); return r;
    }
    G.tick = ms => { if (G.over) return; G.remaining = Math.max(0, G.remaining - ms); if (G.remaining === 0) G.over = 'boom'; };
    G.cutWire = i => {
      if (G.over || G.solved.fils || G.cut.includes(i) || i < 0 || i >= R.wires.length) return 'ignore';
      G.cut.push(i);
      return res('fils', i === S.fils.cut ? 'solved' : 'mistake', i);
    };
    G.pressKey = k => {
      if (G.over || G.solved.clavier || !KEYS.includes(k)) return 'ignore';
      if (k === '*') { G.keyBuf = ''; return 'ok'; }
      if (k === '#' || k === 'D') {
        const ok = G.keyBuf === S.clavier.code && k === S.clavier.enter; G.keyBuf = '';
        return res('clavier', ok ? 'solved' : 'mistake', k);
      }
      if (k >= '0' && k <= '9') { if (G.keyBuf.length < 4) G.keyBuf += k; return 'ok'; }
      return 'ignore'; // A, B, C : sans effet
    };
    G.joy = dir => {
      if (G.over || G.solved.joystick) return 'ignore';
      if (dir === 'Clic') {
        if (G.joyPos === S.joystick.dirs.length) return res('joystick', 'solved');
        G.joyPos = 0; return res('joystick', 'mistake', 'clic');
      }
      if (S.joystick.dirs[G.joyPos] === dir && G.joyPos < S.joystick.dirs.length) { G.joyPos++; return 'ok'; }
      G.joyPos = 0; return res('joystick', 'mistake', dir);
    };
    G.scanBadge = n => {
      if (G.over || G.solved.rfid) return 'ignore';
      if (S.rfid.badges[G.rfidPos] === n) { G.rfidPos++; return G.rfidPos === S.rfid.badges.length ? res('rfid', 'solved') : 'ok'; }
      G.rfidPos = 0; return res('rfid', 'mistake', n);
    };
    G.tilt = dir => { // inclinaison tenue 1 s
      if (G.over || G.solved.inclinaison) return 'ignore';
      if (G.tiltPos < 2) {
        if (S.inclinaison.tilts[G.tiltPos] === dir) { G.tiltPos++; G.shakes = 0; return 'ok'; }
        G.tiltPos = 0; return res('inclinaison', 'mistake', dir);
      }
      return 'ignore'; // après les 2 inclinaisons : seules les secousses comptent
    };
    G.shake = () => { if (G.over || G.solved.inclinaison || G.tiltPos < 2) return 'ignore'; G.shakes = Math.min(9, G.shakes + 1); return 'ok'; };
    G.still = () => { // immobile 2 s après des secousses : on compte
      if (G.over || G.solved.inclinaison || G.tiltPos < 2 || G.shakes === 0) return 'ignore';
      const ok = G.shakes === S.inclinaison.shakes; G.shakes = 0;
      if (ok) return res('inclinaison', 'solved');
      G.tiltPos = 0; return res('inclinaison', 'mistake', 'secousses');
    };
    G.hint = mod => { // indice : niveau 1 = la ligne du manuel, niveau 2 = la prochaine action
      mod = mod && !G.solved[mod] ? mod : MODULES.find(m => !G.solved[m]);
      if (!mod || G.over) return null;
      const lvl = Math.min(2, G.hintLevel[mod] + 1); G.hintLevel[mod] = lvl; G.hints++;
      return { mod, lvl, text: hintText(G, mod, lvl) };
    };
    G.score = () => score(G);
    return G;
  }

  function hintText(G, mod, lvl) {
    const R = G.R, S = G.S;
    if (mod === 'fils') return lvl === 1 ? `${R.wires.length} FILS: REGLE ${S.fils.rule + 1}` : `COUPER FIL ${S.fils.cut + 1}`;
    if (mod === 'clavier') return lvl === 1 ? `LIGNE ${R.keypadColor.toUpperCase()} +${R.wires.length}` : `CODE ${S.clavier.code} ${S.clavier.enter}`;
    if (mod === 'joystick') return lvl === 1 ? `TABLE D5 ${R.d[4] % 2 ? 'IMPAIR' : 'PAIR'}` : `${S.joystick.dirs[G.joyPos] ? 'SUIVANT ' + S.joystick.dirs[G.joyPos].toUpperCase() : 'CLIC'}`;
    if (mod === 'rfid') return lvl === 1 ? `${R.rfidColor.toUpperCase()} x${R.rfidBlinks}` : `BADGE ${S.rfid.badges[G.rfidPos] || S.rfid.badges[0]}`;
    if (mod === 'inclinaison') return lvl === 1 ? `LIGNE ${R.tiltColor.toUpperCase()}` : (G.tiltPos < 2 ? `INCLINER ${S.inclinaison.tilts[G.tiltPos].toUpperCase()}` : `SECOUER x${S.inclinaison.shakes}`);
    return '';
  }

  // ---------- Score (entier) ----------
  // Victoire : 5000 + 10 × secondes restantes − 500 × erreurs − 250 × indices (min 0).
  // Explosion : 500 × modules désamorcés − 250 × indices (min 0).
  function score(G) {
    const sec = Math.floor(G.remaining / 1000);
    if (G.over === 'win') return Math.max(0, 5000 + 10 * sec - 500 * G.mistakes - 250 * G.hints);
    return Math.max(0, 500 * G.solvedCount() - 250 * G.hints);
  }

  // ---------- Texte des règles (le manuel s'affiche à partir de ces fonctions) ----------
  function condText(c) {
    switch (c.t) {
      case 'none': return `il n'y a aucun fil ${c.c.toLowerCase()}`;
      case 'one': return `il y a exactement un fil ${c.c.toLowerCase()}`;
      case 'many': return `il y a plus d'un fil ${c.c.toLowerCase()}`;
      case 'last': return `le dernier fil est ${c.c.toLowerCase()}`;
      case 'odd': return `le dernier chiffre du code (D5) est impair`;
    }
  }
  function cutText(rule) {
    if (rule.cut === 'last') return 'coupez le dernier fil';
    if (rule.cut === 'lastOf') return `coupez le dernier fil ${rule.c.toLowerCase()}`;
    return `coupez le fil n° ${rule.cut}`;
  }
  function wireRuleText(rule, i) {
    if (!rule.if.length) return 'Sinon, ' + cutText(rule) + '.';
    const s = (i ? 'Sinon, s' : 'S') + 'i ' + rule.if.map(condText).join(' et ') + ', ' + cutText(rule) + '.';
    return s.replace(/^Si il/, "S'il").replace(/^Sinon, si il/, "Sinon, s'il");
  }

  const API = { mulberry32, digits, checkDigit, formatCode, parseCode, randomSeed, generate, solve, createGame, score,
    WIRE_COLORS, LIGHT_COLORS, DIRS, TILTS, KEYS, BADGES, MODULES, MODULE_LABEL, WIRE_RULES, KEYPAD_POS, JOY_MAP, RFID_TABLE, TILT_MAP,
    wireToCut, keypadCode, keypadEnter, joySolution, rfidSolution, tiltSolution, shakeCount, wireRuleText, hintText };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.DefuseLogic = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
