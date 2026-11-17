// Test de cohérence manuel ↔ jeu : on lit le manuel RENDU (tables + phrases des fils) dans Chrome,
// on résout 5000 codes uniquement avec ce qu'il affiche, et on compare à la solution du jeu.
import { launch, sleep } from './cdp.mjs';
import { serve } from './serve.mjs';
const { srv, url } = await serve();
const p = await launch();
await p.size(412, 915);
await p.goto(url + 'manuel.html?nosw=1', { wait: false });
for (let i = 0; i < 100; i++) { await sleep(50); if (await p.ev('!!(window.Manual && Manual.ready)').catch(() => false)) break; }
const res = await p.ev(`(() => {
  const L = DefuseLogic, txt = e => e.textContent.trim();
  const rows = sel => [...document.querySelectorAll(sel + ' tbody tr')].map(tr => [...tr.children].map(txt));
  // tables lues dans le DOM
  const KP = Object.fromEntries(rows('.t-keypad').map(r => [r[0], r.slice(1).map(s => +s.slice(1))]));
  const JP = Object.fromEntries(rows('.t-joy-pair').map(r => [r[0], r[1]])), JI = Object.fromEntries(rows('.t-joy-impair').map(r => [r[0], r[1]]));
  const RF = Object.fromEntries(rows('.t-rfid').map(r => [r[0], r.slice(1).map(Number)]));
  const TL = Object.fromEntries(rows('.t-tilt').map(r => [r[0], [r[1], r[2]]]));
  const SH = rows('.t-shake').map(r => [r[0].split(',').map(s => +s.trim()), +r[1]]);
  const bodyTxt = document.getElementById('manual').textContent;
  const enterEven = /avec\\s*#\\s*si le chiffre de contrôle C est pair/.test(bodyTxt);
  // phrases des fils → règles (analyse du français affiché)
  const COL = 'rouge|bleu|jaune|blanc|noir|vert', cap = s => s[0].toUpperCase() + s.slice(1);
  const WR = {};
  for (const card of document.querySelectorAll('[data-wires]')) {
    WR[card.dataset.wires] = [...card.querySelectorAll('li')].map(li => {
      const s = txt(li).replace(/^Sinon, /, '').replace(/\\.$/, '');
      const m = s.match(/^(?:si |s')?(.*?),? ?(coupez .*)$/i); const condStr = s.startsWith('coupez') ? '' : m[1], act = s.startsWith('coupez') ? s : m[2];
      const conds = condStr ? condStr.split(' et ').map(c => {
        let k;
        if ((k = c.match(new RegExp("il n'y a aucun fil (" + COL + ")")))) return w => !w.wires.includes(cap(k[1]));
        if ((k = c.match(new RegExp('il y a exactement un fil (' + COL + ')')))) return w => w.wires.filter(x => x === cap(k[1])).length === 1;
        if ((k = c.match(new RegExp("il y a plus d'un fil (" + COL + ')')))) return w => w.wires.filter(x => x === cap(k[1])).length > 1;
        if ((k = c.match(new RegExp('le dernier fil est (' + COL + ')')))) return w => w.wires[w.wires.length - 1] === cap(k[1]);
        if (/D5\\) est impair/.test(c)) return w => w.d[4] % 2 === 1;
        throw new Error('condition inconnue : ' + c);
      }) : [];
      let k, cut;
      if ((k = act.match(/coupez le fil n° (\\d)/))) cut = w => +k[1] - 1;
      else if (/coupez le dernier fil$/.test(act)) cut = w => w.wires.length - 1;
      else if ((k = act.match(new RegExp('coupez le dernier fil (' + COL + ')')))) cut = w => w.wires.lastIndexOf(cap(k[1]));
      else throw new Error('action inconnue : ' + act);
      return { conds, cut };
    });
  }
  let bad = 0, n = 0, first = [];
  for (let i = 0; i < 5000; i++) {
    const seed = 10000 + ((i * 7919 + 13) % 90000), R = L.generate(seed), S = R.solution; n++;
    const rule = WR[R.wires.length].find(r => r.conds.every(c => c(R)));
    const m = {
      fils: rule.cut(R),
      clavier: KP[R.keypadColor].map(p => (R.d[p - 1] + R.wires.length) % 10).join('') + ((R.check % 2 === 0) === enterEven ? '#' : 'D'),
      joystick: R.joySeq.map(c => (R.d[4] % 2 ? JI : JP)[c]).join(','),
      rfid: (() => { const b1 = RF[R.rfidColor][R.rfidBlinks - 1]; let b2 = b1; for (let k = 0; k < R.d[0]; k++) b2 = b2 % 6 + 1; if (b2 === b1) b2 = b1 % 6 + 1; return b1 + ',' + b2; })(),
      inclinaison: TL[R.tiltColor].join(',') + ',' + SH.find(([ds]) => ds.includes(R.d[2]))[1]
    };
    const g = { fils: S.fils.cut, clavier: S.clavier.code + S.clavier.enter, joystick: S.joystick.dirs.join(','), rfid: S.rfid.badges.join(','), inclinaison: S.inclinaison.tilts.join(',') + ',' + S.inclinaison.shakes };
    for (const k in g) if (String(m[k]) !== String(g[k])) { bad++; if (first.length < 5) first.push(seed + ' ' + k + ' manuel=' + m[k] + ' jeu=' + g[k]); }
  }
  // fiche de l'arbitre (page propre à un code) = solution du jeu
  let arbBad = 0;
  for (let i = 0; i < 200; i++) {
    const seed = 10000 + i * 449, R = Manual.applyCode(L.formatCode(seed), true), S = R.solution;
    const get = k => document.querySelector('[data-sol=' + k + ']').textContent;
    if (+get('fils') !== S.fils.cut + 1 || get('clavier') !== S.clavier.code + ' ' + S.clavier.enter || get('rfid') !== S.rfid.badges.join(' puis ')) arbBad++;
  }
  const typo = Manual.applyCode('48213-5', true) === null;
  return { n, bad, first, arbBad, typo, wireRules: Object.values(WR).flat().length };
})()`);
console.log(JSON.stringify(res));
const ok = res.bad === 0 && res.arbBad === 0 && res.typo && res.wireRules === 12 && p.errors.length === 0;
console.log(ok ? `OK : manuel = jeu sur ${res.n} codes × 5 modules ; fiche arbitre 200/200 ; faute de frappe détectée ; 0 erreur console` : 'ÉCHEC ' + JSON.stringify(p.errors));
p.close(); srv.close(); process.exit(ok ? 0 : 1);
