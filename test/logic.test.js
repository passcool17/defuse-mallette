// Test de logique : node test/logic.test.js  (5000 codes × chaque module + erreurs/chrono/score/indices)
const L = require('../logic.js');
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 20) console.error('ÉCHEC', m); } };
const N = 5000, seeds = []; for (let i = 0; i < N; i++) seeds.push(10000 + ((i * 7919 + 13) % 90000));
const ruleHits = {}, keyEnter = { '#': 0, D: 0 }, shakes = {}, firstBadge = {};

// 0. vecteurs de référence mulberry32 (copiés dans docs/ESP32.md)
const r = L.mulberry32(48213); const vec = [r(), r(), r(), r()];
console.log('mulberry32(48213) =', vec.join(', '));

for (const seed of seeds) {
  const R = L.generate(seed), S = R.solution;
  ok(R.wires.length >= 4 && R.wires.length <= 6, 'nb fils');
  ok(S.fils.cut >= 0 && S.fils.cut < R.wires.length, 'fil à couper existe ' + seed);
  ruleHits[R.wires.length + ':' + S.fils.rule] = (ruleHits[R.wires.length + ':' + S.fils.rule] || 0) + 1;
  ok(/^\d{4}$/.test(S.clavier.code), 'code 4 chiffres'); keyEnter[S.clavier.enter]++;
  ok(S.joystick.dirs.length === 4 && S.joystick.dirs.every(d => L.DIRS.includes(d)), 'joystick');
  ok(S.rfid.badges[0] !== S.rfid.badges[1] && S.rfid.badges.every(b => b >= 1 && b <= 6), 'badges distincts ' + seed);
  firstBadge[S.rfid.badges[0]] = 1;
  ok(S.inclinaison.tilts.length === 2 && S.inclinaison.shakes >= 1 && S.inclinaison.shakes <= 3, 'inclinaison'); shakes[S.inclinaison.shakes] = 1;
  ok(L.generate(seed).code === R.code && JSON.stringify(L.generate(seed)) === JSON.stringify(R), 'déterministe');
  ok(L.parseCode(R.code).seed === seed, 'parse code');

  // 1. partie parfaite : chaque module soluble, victoire, score
  const G = L.createGame(seed, { minutes: 15, maxMistakes: 3 });
  ok(G.cutWire(S.fils.cut) === 'solved', 'fils soluble');
  for (const ch of S.clavier.code) G.pressKey(ch);
  ok(G.pressKey(S.clavier.enter) === 'solved', 'clavier soluble ' + seed);
  S.joystick.dirs.forEach(d => ok(G.joy(d) === 'ok', 'joy pas'));
  ok(G.joy('Clic') === 'solved', 'joystick soluble');
  ok(G.scanBadge(S.rfid.badges[0]) === 'ok' && G.scanBadge(S.rfid.badges[1]) === 'solved', 'rfid soluble');
  S.inclinaison.tilts.forEach(t => ok(G.tilt(t) === 'ok', 'tilt pas'));
  for (let k = 0; k < S.inclinaison.shakes; k++) G.shake();
  ok(G.still() === 'solved', 'inclinaison soluble');
  ok(G.over === 'win' && G.mistakes === 0, 'victoire');
  ok(G.score() === 5000 + 10 * 900, 'score parfait');

  // 2. erreurs : une erreur par module, puis on finit quand même (maxMistakes 9)
  const H = L.createGame(seed, { minutes: 10, maxMistakes: 9 });
  const wrongWire = (S.fils.cut + 1) % R.wires.length;
  ok(H.cutWire(wrongWire) === 'mistake', 'mauvais fil'); ok(H.cutWire(wrongWire) === 'ignore', 'fil déjà coupé');
  ok(H.cutWire(S.fils.cut) === 'solved', 'fils après erreur');
  const bad = S.clavier.code.split('').map(c => (+c + 1) % 10).join('');
  for (const ch of bad) H.pressKey(ch); H.pressKey('A');
  ok(H.pressKey(S.clavier.enter) === 'mistake', 'mauvais code');
  for (const ch of S.clavier.code) H.pressKey(ch);
  ok(H.pressKey(S.clavier.enter === '#' ? 'D' : '#') === 'mistake', 'mauvaise touche de validation');
  H.pressKey('5'); H.pressKey('*'); for (const ch of S.clavier.code) H.pressKey(ch);
  ok(H.pressKey(S.clavier.enter) === 'solved', 'clavier après effacement');
  const wrongDir = L.DIRS.find(d => d !== S.joystick.dirs[0]);
  ok(H.joy(wrongDir) === 'mistake', 'mauvaise direction'); ok(H.joy('Clic') === 'mistake', 'clic trop tôt');
  S.joystick.dirs.forEach(d => H.joy(d)); ok(H.joy('Clic') === 'solved', 'joystick après erreur');
  const wrongBadge = [1, 2, 3, 4, 5, 6].find(b => b !== S.rfid.badges[0]);
  ok(H.scanBadge(wrongBadge) === 'mistake', 'mauvais badge');
  H.scanBadge(S.rfid.badges[0]); ok(H.scanBadge(S.rfid.badges[1]) === 'solved', 'rfid après erreur');
  ok(H.shake() === 'ignore', 'secousse trop tôt ignorée');
  const wrongTilt = L.TILTS.find(t => t !== S.inclinaison.tilts[0]);
  ok(H.tilt(wrongTilt) === 'mistake', 'mauvaise inclinaison');
  S.inclinaison.tilts.forEach(t => H.tilt(t));
  for (let k = 0; k < S.inclinaison.shakes + 1; k++) H.shake();
  ok(H.still() === 'mistake', 'mauvais nombre de secousses');
  S.inclinaison.tilts.forEach(t => H.tilt(t)); for (let k = 0; k < S.inclinaison.shakes; k++) H.shake();
  ok(H.still() === 'solved', 'inclinaison après erreur');
  ok(H.over === 'win' && H.mistakes === 8, 'victoire avec 8 erreurs (' + H.mistakes + ')');
  ok(H.score() === Math.max(0, 5000 + 10 * 600 - 500 * 8), 'score avec erreurs');

  // 3. maximum d'erreurs → BOUM ; plus aucune action ensuite
  const B = L.createGame(seed, { minutes: 5, maxMistakes: 2 });
  B.cutWire(wrongWire); ok(!B.over, 'pas encore');
  B.joy(wrongDir); ok(B.over === 'boom', 'boom à 2 erreurs');
  ok(B.cutWire(S.fils.cut) === 'ignore', 'figé après boom');
}

// 4. chrono → BOUM, score, indices
{
  const G = L.createGame(48213, { minutes: 1, maxMistakes: 3 });
  G.cutWire(G.S.fils.cut);
  G.tick(59999); ok(!G.over, 'chrono pas fini'); G.tick(5); ok(G.over === 'boom' && G.remaining === 0, 'boom au chrono');
  ok(G.score() === 500, 'score explosion 1 module');
  const H = L.createGame(48213, { minutes: 99, maxMistakes: 9 });
  ok(H.timeMs === 99 * 60000, 'chrono 99 min');
  const h1 = H.hint(), h2 = H.hint();
  ok(h1.mod === 'fils' && h1.lvl === 1 && h2.lvl === 2 && H.hints === 2, 'indices progressifs');
  ok(h2.text === 'COUPER FIL ' + (H.S.fils.cut + 1), 'indice 2 = action');
  ok(L.createGame(1e4, { minutes: 0 }).timeMs === 60000 && L.createGame(1e4, { minutes: 500 }).timeMs === 99 * 60000, 'bornes chrono');
}
// 5. code de partie : toute faute de frappe d'un chiffre détectée
{
  let missed = 0;
  for (let s = 10000; s < 100000; s += 37) {
    const code = L.formatCode(s).replace('-', '');
    for (let p = 0; p < 6; p++) for (let v = 0; v < 10; v++) {
      if (+code[p] === v) continue; const bad = code.slice(0, p) + v + code.slice(p + 1);
      if (bad[0] === '0') continue;
      if (L.parseCode(bad).ok) missed++;
    }
  }
  ok(missed === 0, 'fautes de frappe non détectées : ' + missed);
}
// 6. couverture : chaque règle des fils sert au moins une fois
for (const n of [4, 5, 6]) L.WIRE_RULES[n].forEach((_, i) => ok(ruleHits[n + ':' + i] > 0, `règle fils ${n}:${i + 1} jamais utilisée`));
ok(keyEnter['#'] > 0 && keyEnter.D > 0, 'les deux touches de validation servent');
ok(Object.keys(shakes).length === 3 && Object.keys(firstBadge).length === 6, 'variété');
console.log('règles des fils utilisées :', JSON.stringify(ruleHits));
console.log(fails ? `ÉCHEC : ${fails}/${checks}` : `OK : ${checks} vérifications sur ${N} codes`);
process.exit(fails ? 1 : 0);
