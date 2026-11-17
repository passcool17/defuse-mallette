// Test de bout en bout avec de vrais événements tactiles (CDP Input.dispatchTouchEvent), 412×915 puis 915×412.
// node test/e2e-touch.mjs [url]   (sans url : serveur local)
import { launch, sleep } from './cdp.mjs';
import { serve } from './serve.mjs';
const ext = process.argv[2];
const { srv, url } = ext ? { srv: null, url: ext } : await serve();
const SHOTS = process.env.SHOTS || '';
let fails = 0, checks = 0; const log = [];
const ok = (c, m) => { checks++; if (!c) { fails++; console.error('  ÉCHEC', m); } };
const maxCalls = {};

async function run(W, H) {
  const tag = `${W}x${H}`; console.log('== ' + tag);
  const p = await launch(); await p.size(W, H);
  const q = url.includes('?') ? '&' : '?';
  await p.goto(url + q + 'nosw=1&tier=2');
  const ev = s => p.ev(s);
  const rect = async sel => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height]; })()`);
  const tapSel = async sel => { await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'nearest' })`); await sleep(60); const [x, y] = await rect(sel); await p.tap(x, y); };
  const visible = sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.left < innerWidth; })()`);
  const waitFor = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (await ev(expr)) return true; await sleep(100); } return false; };
  const calls = async v => { const c = await ev('__c204.render.calls'); maxCalls[tag + ':' + v] = c; ok(c < 100, `${tag} ${v} : ${c} appels`); };
  const shot = async n => { if (SHOTS) await p.shot(`${SHOTS}/${n}-${tag}.png`); };
  const sc = (id, px, py) => ev(`DM.screenOf('${id}', ${px}, ${py})`);
  const inView = async ([x, y]) => x > 0 && x < W && y > 0 && y < H;
  const settle = async () => { await sleep(300); return waitFor('DM.settled()', 5000); };

  // --- menu, réglages ---
  await sleep(800); ok(await visible('#title') && await visible('#play'), 'menu visible'); await calls('menu'); await shot('01-menu');
  for (const sel of ['#play', '#openSettings', '#openHowto', '#openCredits']) { const r = await rect(sel); ok(r[3] >= 44 && r[2] >= 44, `${sel} cible ≥ 44 px (${r[2]|0}×${r[3]|0})`); }
  await tapSel('#openSettings'); ok(await visible('#settings'), 'réglages ouverts');
  await ev(`(() => { const m = document.getElementById('minutes'); m.value = 7; m.dispatchEvent(new Event('input')); const e = document.getElementById('mistakes'); e.value = 4; e.dispatchEvent(new Event('input')); })()`);
  ok(await ev(`document.getElementById('minutesOut').textContent`) === '7 min', 'minutes affichées'); await shot('02-reglages');
  await tapSel('#settingsDone'); ok(await visible('#title'), 'retour menu');
  await tapSel('#openHowto'); ok(await visible('#howto'), 'comment jouer'); await tapSel('#howtoDone');
  // --- mode Équipe + code tapé ---
  await tapSel('input[name=mode][value=equipe] + span');
  ok(await ev(`DM.settings.mode`) === 'equipe', 'mode équipe choisi');
  await tapSel('#codeIn'); await p.send('Input.insertText', { text: '48213-5' }); await tapSel('#play');
  ok((await ev(`document.getElementById('codeErr').textContent`)).includes('contrôle'), 'code faux refusé');
  await ev(`document.getElementById('codeIn').value = ''`); await tapSel('#codeIn'); await p.send('Input.insertText', { text: '48213-4' }); await tapSel('#play');
  ok(await visible('#brief'), 'briefing'); ok(await ev(`document.getElementById('briefCode').textContent`) === '48213-4', 'code du briefing'); await shot('03-brief-equipe');
  await tapSel('#go');
  ok(await waitFor(`DM.cine() && DM.cine().type === 'intro'`, 2000), 'intro lancée');
  await sleep(1500); await shot('04-ouverture');
  ok(await waitFor(`DM.phase() === 'play'`, 6000), 'chrono démarré après l’ouverture');
  ok(Math.abs(await ev('DM.lid()') + 1.745) < 0.01, 'couvercle ouvert à −100°');
  const G0 = await ev(`(() => { const G = DM.G(); return { timeMs: G.timeMs, max: G.maxMistakes, S: G.S, R: G.R }; })()`);
  ok(G0.timeMs === 7 * 60000 && G0.max === 4, 'réglages appliqués (7 min, 4 erreurs)');
  await settle(); await calls('overview'); await shot('05-vue-ensemble');
  const { S, R } = G0; const LAY = await ev('DM.LAYOUT');
  // toucher un module dans la vue d'ensemble = s'en approcher
  async function focus(id) { const pt = await sc(id, 256, 244); await p.tap(pt[0], pt[1]); await sleep(150); ok(await ev('DM.view()') === id, `toucher ${id} → vue ${id}`); await settle(); await calls(id); }
  async function back() { await tapSel('#back'); await settle(); }
  // --- 1 Fils ---
  await focus('fils'); await shot('10-fils');
  { const pt = await sc('fils', 300, LAY.fils.rows[S.fils.cut]); ok(await inView(pt), 'fil visible'); await p.tap(pt[0], pt[1]); await sleep(600);
    ok(await ev(`DM.G().solved.fils`), 'fils désamorcé au toucher'); ok((await ev('DM.wires()'))[S.fils.cut], 'fil coupé (animation)'); await shot('11-fil-coupe'); }
  // --- 2 Clavier (passage par ▶ : fils → clavier) ---
  await tapSel('#next'); await settle(); ok(await ev('DM.view()') === 'clavier', '▶ passe au clavier'); await calls('clavier');
  for (const k of (S.clavier.code + S.clavier.enter)) { const i = ['1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D'].indexOf(k); const pt = await sc('clavier', LAY.clavier.xs[i % 4], LAY.clavier.ys[Math.floor(i / 4)]); await p.tap(pt[0], pt[1]); await sleep(80); }
  await sleep(300); ok(await ev(`DM.G().solved.clavier`), 'clavier désamorcé'); await shot('12-clavier');
  // --- 3 Joystick : glisser le manche dans 4 directions, puis toucher (clic) ---
  await back(); await focus('joystick'); await shot('13-joystick');
  { const [cx, cy] = LAY.joystick.c; const c = await sc('joystick', cx, cy);
    const V = { Haut: [0, -110], Bas: [0, 110], Gauche: [-110, 0], Droite: [110, 0] };
    for (const d of S.joystick.dirs) { const e = await sc('joystick', cx + V[d][0], cy + V[d][1]); await p.swipe(c[0], c[1], e[0] - c[0], e[1] - c[1], 8); await sleep(200); }
    ok(await ev('DM.G().joyPos') === 4, 'joystick : 4 directions saisies (' + await ev('DM.G().joyPos') + ')');
    await p.tap(c[0], c[1]); await sleep(300); ok(await ev(`DM.G().solved.joystick`), 'joystick désamorcé (clic)'); }
  // test des directions écran ↔ manche (doigt vers le haut de l'écran = « Haut »)
  // --- 4 RFID ---
  await back(); await focus('rfid'); await shot('14-rfid');
  for (const n of S.rfid.badges) { const [x, y] = LAY.rfid.tags[n - 1]; const pt = await sc('rfid', x, y); await p.tap(pt[0], pt[1]); await sleep(1300); }
  ok(await ev(`DM.G().solved.rfid`), 'badges RFID désamorcés');
  // --- 5 Inclinaison : glisser-tenir (repli tactile) + bouton Secouer ---
  await back(); await focus('inclinaison'); ok(await visible('#sensorBtn') && await visible('#shakeBtn'), 'boutons capteurs + secouer'); await shot('15-inclinaison');
  { const [cx, cy] = LAY.inclinaison.c; const T = { Avant: [0, 130], Arrière: [0, -130], Gauche: [-130, 0], Droite: [130, 0] };
    for (const d of S.inclinaison.tilts) {
      const a = await sc('inclinaison', cx, cy), b = await sc('inclinaison', cx + T[d][0], cy + T[d][1]);
      await p.touch('touchStart', [a]); for (let i = 1; i <= 8; i++) { await sleep(16); await p.touch('touchMove', [[a[0] + (b[0] - a[0]) * i / 8, a[1] + (b[1] - a[1]) * i / 8]]); }
      await sleep(1600); await p.touch('touchEnd', []); await sleep(700);
    }
    ok(await ev('DM.G().tiltPos') === 2, 'deux inclinaisons tenues (' + await ev('DM.G().tiltPos') + ', erreurs ' + await ev('JSON.stringify(DM.G().log)') + ')');
    for (let i = 0; i < S.inclinaison.shakes; i++) { await tapSel('#shakeBtn'); await sleep(250); }
    ok(await waitFor('DM.G().solved.inclinaison', 4000), 'inclinaison désamorcée (secousses + immobile 2 s)'); }
  // --- indice, manuel partagé (mode Équipe) ---
  ok(await ev('DM.G().over') === 'win', 'les 5 modules → victoire');
  ok(await waitFor(`DM.cine() && DM.cine().type === 'win'`, 1000) || await visible('#end'), 'cinématique de victoire'); await sleep(1200); await shot('16-victoire'); await calls('win');
  ok(await waitFor(`!document.getElementById('end').classList.contains('hidden')`, 6000), 'écran de fin');
  ok((await ev(`document.getElementById('endTitle').textContent`)).includes('désamorcée'), 'titre victoire');
  ok(+(await ev(`document.getElementById('endScore').textContent`)).replace(/\D/g, '') > 5000, 'score affiché'); await shot('17-fin-victoire');
  // --- 2e partie : Duo, indice, manuel, erreurs → BOUM ---
  await tapSel('#toMenu'); await tapSel('#openSettings');
  await ev(`(() => { const e = document.getElementById('mistakes'); e.value = 2; e.dispatchEvent(new Event('input')); })()`); await tapSel('#settingsDone');
  await tapSel('input[name=mode][value=duo] + span'); await ev(`document.getElementById('codeIn').value = ''`); await tapSel('#play');
  ok(await visible('#briefQR svg'), 'QR du manuel (duo)'); ok(!(await visible('#manualBtn')), 'pas de manuel dans la mallette en duo'); await shot('20-brief-duo');
  await tapSel('#go'); await sleep(400); await tapSel('#skip'); ok(await ev('DM.phase()') === 'play', 'intro passée (Passer)');
  await tapSel('#hintBtn'); await sleep(200); ok(await ev('DM.G().hints') === 1 && await visible('#toast'), 'indice affiché et compté');
  await focus('ctrl'); await shot('21-controle-oled'); 
  { const [hx, hy] = LAY.ctrl.hint; const pt = await sc('ctrl', hx, hy); await p.tap(pt[0], pt[1]); await sleep(200); ok(await ev('DM.G().hints') === 2, 'bouton INDICE de la mallette'); }
  const S2 = await ev('DM.G().S'), R2 = await ev('DM.G().R');
  await back(); await focus('fils');
  { const wrong = (S2.fils.cut + 1) % R2.wires.length; const pt = await sc('fils', 300, LAY.fils.rows[wrong]); await p.tap(pt[0], pt[1]); await sleep(300); ok(await ev('DM.G().mistakes') === 1, 'mauvais fil = 1 erreur'); await shot('22-erreur'); }
  await tapSel('#next'); await settle();
  for (const k of '0000#') { const i = ['1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D'].indexOf(k); const pt = await sc('clavier', LAY.clavier.xs[i % 4], LAY.clavier.ys[Math.floor(i / 4)]); await p.tap(pt[0], pt[1]); await sleep(80); }
  await sleep(200);
  const boomOk = S2.clavier.code === '0000' && S2.clavier.enter === '#';
  ok(boomOk || await ev('DM.G().over') === 'boom', '2e erreur = BOUM');
  await sleep(2000); await shot('23-boum'); await calls('boom');
  ok(await waitFor(`!document.getElementById('end').classList.contains('hidden')`, 6000), 'écran BOUM'); ok(await ev(`document.getElementById('end').classList.contains('lose')`), 'style défaite'); await shot('24-fin-boum');
  // --- pause + manuel en mode Équipe ---
  await tapSel('#toMenu'); await tapSel('input[name=mode][value=equipe] + span'); await tapSel('#play'); await tapSel('#go'); await sleep(300); await tapSel('#skip');
  await tapSel('#manualBtn'); ok(await visible('#manualOverlay'), 'manuel ouvert dans le jeu');
  ok(await waitFor(`(() => { try { const d = document.getElementById('manualFrame').contentDocument; return d && d.querySelectorAll('.sec').length >= 7 && d.getElementById('code').value === DM.G().code; } catch (e) { return false; } })()`, 5000), 'manuel chargé avec le code de la partie');
  await sleep(300); await shot('25-manuel-equipe');
  await tapSel('#manualClose'); ok(!(await visible('#manualOverlay')), 'manuel fermé');
  await tapSel('#pauseBtn'); ok(await visible('#pause'), 'pause'); const r0 = await ev('DM.G().remaining'); await sleep(1200); ok(await ev('DM.G().remaining') === r0, 'chrono figé en pause');
  await tapSel('#resume'); await sleep(600); ok(await ev('DM.G().remaining') < r0, 'chrono reprend');
  // --- page du manuel seule ---
  await p.goto(url.replace(/\?.*$/, '').replace(/index\.html$/, '') + 'manuel.html?nosw=1&code=48213-4', { wait: false });
  ok(await waitFor(`!!(window.Manual && document.querySelectorAll('.digits span').length === 6)`, 6000), 'manuel : code lu, D1–D5 + C affichés');
  await shot('30-manuel');
  ok(p.errors.length === 0, `${tag} : 0 erreur console (${p.errors.join(' | ')})`);
  p.close();
}
if (process.env.ONLY !== "L") await run(412, 915);
if (process.env.ONLY !== "1") await run(915, 412);
srv && srv.close();
console.log('appels max par vue :', JSON.stringify(maxCalls));
console.log(fails ? `ÉCHEC : ${fails}/${checks}` : `OK : ${checks} vérifications tactiles (412×915 et 915×412), 0 erreur console`);
process.exit(fails ? 1 : 0);
