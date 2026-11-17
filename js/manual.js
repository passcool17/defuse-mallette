// Manuel de l'expert : tout est généré à partir des tables de logic.js (même source que le jeu).
const L = window.DefuseLogic;
const qs = new URLSearchParams(location.search);
if (qs.get('embed') === '1') document.body.classList.add('embed');
const main = document.getElementById('manual');
const h = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else e.setAttribute(k, v); } for (const c of kids.flat()) e.append(c instanceof Node ? c : document.createTextNode(String(c))); return e; };
const sw = c => h('span', { class: 'sw sw-' + c.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') }, c);
const section = (id, num, title, ...kids) => h('section', { id, class: 'sec' }, h('h2', {}, num ? h('span', { class: 'num' }, num) : '', title), ...kids);
const table = (cls, head, rows) => h('table', { class: cls }, h('thead', {}, h('tr', {}, head.map(x => h('th', { scope: 'col' }, x)))), h('tbody', {}, rows.map(r => h('tr', {}, r.map((x, i) => i === 0 ? h('th', { scope: 'row' }, x) : h('td', {}, x))))));

main.append(
  section('s0', '', 'Lire le code de partie',
    h('p', {}, 'Le code a 5 chiffres, un tiret et un chiffre de contrôle : ', h('b', {}, 'D1 D2 D3 D4 D5 – C'), '. Exemple : 48213-4 donne D1 = 4, D2 = 8, D3 = 2, D4 = 1, D5 = 3 et C = 4.'),
    h('p', {}, 'Tapez le code en haut de ce manuel : il vérifie le chiffre de contrôle (faute de frappe) et affiche D1 à D5.'),
    h('p', { class: 'note' }, 'Dans ce manuel, « haut » est le côté du couvercle (charnière), « bas » le côté du désamorceur, « gauche » et « droite » comme le voit le désamorceur.')),
  section('s1', '1', 'Fils',
    h('p', {}, 'Il y a 4, 5 ou 6 fils, numérotés à partir du haut (1 = le plus près du couvercle). ', h('b', {}, 'Coupez UN seul fil.'), ' Prenez la liste qui correspond au nombre de fils et appliquez la ', h('b', {}, 'première'), ' règle vraie.'),
    h('p', { class: 'note' }, 'Couleurs possibles : ', L.WIRE_COLORS.map(sw)),
    ...[4, 5, 6].map(n => h('div', { class: 'card', 'data-wires': n }, h('h3', {}, n + ' fils'), h('ol', { class: 'rules' }, L.WIRE_RULES[n].map((r, i) => h('li', { 'data-rule': i }, L.wireRuleText(r, i))))))),
  section('s2', '2', 'Clavier',
    h('p', {}, 'Le clavier 4 × 4 est rétroéclairé d’une couleur. La ligne de cette couleur dit quels chiffres du code prendre, dans l’ordre.'),
    table('t-keypad', ['Rétroéclairage', '1er', '2e', '3e', '4e'], Object.entries(L.KEYPAD_POS).map(([c, p]) => [sw(c), ...p.map(x => 'D' + x)])),
    h('ol', { class: 'steps' },
      h('li', {}, 'Ajoutez à chacun de ces 4 chiffres ', h('b', {}, 'K = le nombre de fils'), ' (fils présents au départ, coupés ou non). Gardez seulement le dernier chiffre (ex. 8 + 5 = 13 → 3).'),
      h('li', {}, 'Tapez les 4 chiffres. ', h('b', {}, '*'), ' efface la saisie. Les touches A, B et C ne font rien.'),
      h('li', {}, 'Validez avec ', h('b', {}, '#'), ' si le chiffre de contrôle C est pair (0, 2, 4, 6, 8), sinon avec ', h('b', {}, 'D'), '.'))),
  section('s3', '3', 'Joystick',
    h('p', {}, 'La DEL « SÉQUENCE » montre 4 couleurs, puis une pause, en boucle. Pour chaque couleur, poussez le joystick dans la direction donnée par la table, dans l’ordre. Ensuite, ', h('b', {}, 'cliquez'), ' sur le manche (appui) pour valider. Une mauvaise direction fait une erreur et la saisie recommence.'),
    h('div', { class: 'two' },
      h('div', { class: 'card' }, h('h3', {}, 'D5 pair'), table('t-joy t-joy-pair', ['Couleur', 'Direction'], Object.entries(L.JOY_MAP.pair).map(([c, d]) => [sw(c), d]))),
      h('div', { class: 'card' }, h('h3', {}, 'D5 impair'), table('t-joy t-joy-impair', ['Couleur', 'Direction'], Object.entries(L.JOY_MAP.impair).map(([c, d]) => [sw(c), d]))))),
  section('s4', '4', 'Badge RFID',
    h('p', {}, 'Le lecteur clignote d’une couleur, N fois, puis fait une pause. Passez ', h('b', {}, 'deux badges'), ' sur le lecteur, dans l’ordre.'),
    table('t-rfid', ['Couleur', '1 clignotement', '2', '3', '4'], Object.entries(L.RFID_TABLE).map(([c, r]) => [sw(c), ...r.map(String)])),
    h('ol', { class: 'steps' },
      h('li', {}, h('b', {}, 'Badge 1'), ' = la case de la table (ligne = couleur, colonne = nombre de clignotements).'),
      h('li', {}, h('b', {}, 'Badge 2'), ' : partez du badge 1 et avancez de D1 badges (après 6 on revient à 1). Si vous retombez sur le même badge que le premier, prenez le badge suivant.'),
      h('li', {}, 'Badges : ', L.BADGES.map(b => h('span', { class: 'badge' }, b.n + ' ' + b.name))), ' Un mauvais badge fait une erreur et il faut recommencer au badge 1.')),
  section('s5', '5', 'Inclinaison',
    h('p', {}, 'Le module est rétroéclairé d’une couleur. Penchez la mallette dans les deux directions de la table, dans l’ordre, en tenant chaque fois ', h('b', {}, '1 seconde'), ' (la DEL du bord se remplit). Revenez à plat entre les deux.'),
    table('t-tilt', ['Couleur', '1re inclinaison', '2e inclinaison'], Object.entries(L.TILT_MAP).map(([c, t]) => [sw(c), t[0], t[1]])),
    h('p', {}, 'Puis ', h('b', {}, 'secouez'), ' la mallette N fois et restez immobile 2 secondes : N dépend de D3.'),
    table('t-shake', ['D3', 'Secousses'], [['0, 3, 6, 9', '1'], ['1, 4, 7', '2'], ['2, 5, 8', '3']]),
    h('p', { class: 'note' }, '« Avant » = le bord du désamorceur descend. « Arrière » = le bord du couvercle descend.')),
  section('s6', '', 'Erreurs, chrono et score',
    h('ul', {},
      h('li', {}, 'Chaque erreur fait sonner le buzzer et allume une DEL rouge « ERREURS ». La mallette explose quand le nombre d’erreurs permises est atteint (réglage, 3 par défaut), ou quand le chrono (1 à 99 min) arrive à 00:00.'),
      h('li', {}, 'Bouton INDICE : 1er appui = la ligne du manuel à utiliser, 2e appui = la prochaine action. Il coûte 250 points.'),
      h('li', {}, h('b', {}, 'Score'), ' (victoire) = 5 000 + 10 × secondes restantes − 500 × erreurs − 250 × indices. Explosion : 500 par module désamorcé − 250 × indices.'))),
  h('section', { id: 'arbitre', class: 'sec arb' }, h('h2', {}, 'Fiche de l’arbitre'),
    h('p', { class: 'note' }, 'Pour l’animateur ou pour vérifier une partie. Elle révèle la mallette et la solution du code tapé en haut : ne la montrez pas à l’expert pendant le jeu.'),
    h('details', { id: 'arbDetails' }, h('summary', {}, 'Afficher la solution de ce code'), h('div', { id: 'arbBody' }, h('p', {}, 'Tapez d’abord un code valide en haut.'))))
);

// ---------- Code de partie ----------
const input = document.getElementById('code'), msg = document.getElementById('codeMsg'), digits = document.getElementById('digits');
function applyCode(str, quiet) {
  const p = L.parseCode(str);
  if (!str) { msg.textContent = ''; digits.classList.add('hidden'); return null; }
  if (!p.ok) { msg.textContent = p.reason === 'controle' ? 'Chiffre de contrôle faux : relisez le code.' : 'Format attendu : 5 chiffres, tiret, 1 chiffre (ex. 48213-4).'; msg.className = 'bad'; digits.classList.add('hidden'); return null; }
  const R = L.generate(p.seed);
  msg.textContent = p.checked ? 'Code valide.' : 'Code accepté (sans chiffre de contrôle : vérifiez ' + R.code + ').'; msg.className = 'ok';
  digits.replaceChildren(...['D1', 'D2', 'D3', 'D4', 'D5'].map((k, i) => h('span', {}, h('small', {}, k), R.d[i])), h('span', { class: 'c' }, h('small', {}, 'C'), R.check));
  digits.classList.remove('hidden');
  fillArbiter(R);
  if (!quiet) history.replaceState(null, '', '?code=' + R.code + (qs.get('embed') === '1' ? '&embed=1' : ''));
  return R;
}
function fillArbiter(R) {
  const S = R.solution;
  const body = document.getElementById('arbBody');
  body.replaceChildren(
    h('dl', { class: 'arb-dl', 'data-code': R.code },
      h('dt', {}, 'Fils'), h('dd', { 'data-k': 'fils' }, R.wires.length + ' fils : ', R.wires.map((c, i) => h('span', {}, (i + 1) + '\u00a0', sw(c), ' ')), ' → couper le fil ', h('b', { 'data-sol': 'fils' }, S.fils.cut + 1)),
      h('dt', {}, 'Clavier'), h('dd', {}, sw(R.keypadColor), ' → ', h('b', { 'data-sol': 'clavier' }, S.clavier.code + ' ' + S.clavier.enter)),
      h('dt', {}, 'Joystick'), h('dd', {}, R.joySeq.map(sw), ' → ', h('b', { 'data-sol': 'joystick' }, S.joystick.dirs.join(', ') + ', Clic')),
      h('dt', {}, 'Badge RFID'), h('dd', {}, sw(R.rfidColor), ' × ' + R.rfidBlinks + ' → ', h('b', { 'data-sol': 'rfid' }, S.rfid.badges.join(' puis '))),
      h('dt', {}, 'Inclinaison'), h('dd', {}, sw(R.tiltColor), ' → ', h('b', { 'data-sol': 'inclinaison' }, S.inclinaison.tilts.join(', ') + ', ' + S.inclinaison.shakes + ' secousse' + (S.inclinaison.shakes > 1 ? 's' : ''))))
  );
}
document.getElementById('codeForm').addEventListener('submit', e => { e.preventDefault(); applyCode(input.value.trim()); });
input.addEventListener('input', () => { if (/^\d{5}-?\d$/.test(input.value.trim())) applyCode(input.value.trim()); });
if (qs.get('code')) { input.value = qs.get('code'); applyCode(qs.get('code'), true); }
window.Manual = { applyCode, ready: true };

if ('serviceWorker' in navigator && qs.get('nosw') !== '1' && isSecureContext) addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=' + (new URL(import.meta.url).searchParams.get('v') || 'dev')).catch(() => {}));
