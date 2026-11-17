// v0.1.1 : mallette GLB (nœuds, charnière lue dans le nœud, course complète du couvercle), manette (4 directions × 2 orientations,
// sens à l'écran = sens du doigt/de la croix), touches BatchedMesh, plein écran, appels < 100, 0 erreur console.
// node test/e2e-glb-pad.mjs [url]   (SHOTS=dossier pour les captures)
import { launch, sleep } from './cdp.mjs';
import { serve } from './serve.mjs';
const ext = process.argv[2];
const { srv, url } = ext ? { srv: null, url: ext } : await serve();
const SHOTS = process.env.SHOTS || '';
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.error('  ÉCHEC', m); } };
const report = {};
const PAD = `(() => { const btn = () => Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  window.__pad = { connected: true, id: 'test', mapping: 'standard', buttons: btn(), axes: [0, 0, 0, 0], index: 0 };
  navigator.getGamepads = () => [window.__pad]; return true; })()`;
async function run(W, H) {
  const tag = `${W}x${H}`; console.log('== ' + tag); report[tag] = {};
  const p = await launch(); await p.size(W, H);
  const q = url.includes('?') ? '&' : '?';
  await p.goto(url + q + 'nosw=1&tier=2&seed=48213');
  const ev = s => p.ev(s);
  const press = async (i, hold = 260) => { await ev(`__pad.buttons[${i}].pressed = true`); await sleep(hold); await ev(`__pad.buttons[${i}].pressed = false`); await sleep(200); };
  const frames = (n = 2) => ev(`new Promise(r => { let k = ${n}; const f = () => (--k <= 0 ? r(1) : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
  // caméra posée + 2 images rendues (matrices à jour), robuste quand la box tourne à 1–2 fps
  const settle = async () => { await sleep(300); for (let i = 0; i < 150; i++) { if (await ev('DM.settled()')) break; await sleep(100); } await frames(2); return true; };
  // 1. GLB et nœuds
  const src = await ev('DM.source()'); ok(src.startsWith('glb:') && src.includes('defuse_case_v1.glb?v='), 'source GLB versionnée : ' + src);
  const nodes = await ev('DM.nodes()');
  for (const n of ['Case_Root', 'Case_Body', 'Case_Lid', 'Lid_Screen', 'Panel_1', 'Panel_2', 'Panel_3', 'Panel_4', 'Panel_5', 'Panel_Ctrl', 'Joystick_Stick', 'Hint_Button', 'Timer_7Seg', 'OLED', 'Keypad_Keys_Batched'])
    ok(nodes.includes(n), 'nœud ' + n);
  const parts = await ev('DM.glbParts()'); ok(parts.some(x => x.includes('BatchedMesh')), 'touches en BatchedMesh');
  // 2. charnière lue dans le nœud + course complète du couvercle
  const li = await ev('DM.lidInfo()'); report[tag].lid = li;
  ok(li.parent === 'Case_Root' && Math.abs(li.pos[1] - 0.1715) < 1e-3 && Math.abs(li.pos[2] + 0.2375) < 1e-3, 'charnière = nœud Case_Lid (0, 0.1715, -0.2375) : ' + JSON.stringify(li));
  await ev(`DM.setMode('overview')`); await settle();
  for (const a of [0, -0.6, -1.2, -1.745, -1.92]) {
    await ev(`DM.lidAt(${a})`); await frames(3);
    const r = await ev('DM.lid()'); ok(Math.abs(r - a) < 0.01, `couvercle à ${a} rad (lu ${r})`);
    if (SHOTS) await p.shot(`${SHOTS}/glb-couvercle-${Math.round(-a * 180 / Math.PI)}deg-${tag}.png`);
  }
  await ev(`DM.lidAt(-100 * Math.PI / 180)`); await frames(2);
  // 3. manette : joystick (4 directions), le manche penche du même côté à l'écran
  await ev(PAD);
  await ev(`DM.setMode('joystick')`); await settle();
  const sol = await ev('DM.G().S.joystick.dirs'); ok(JSON.stringify(sol) === '["Bas","Gauche","Droite","Haut"]', 'solution joystick 48213');
  const BTN = { Haut: 12, Bas: 13, Gauche: 14, Droite: 15 };
  const base = await ev(`DM.projLocal('Joystick_Stick', 0, 0.002, 0)`);
  const dirRes = {};
  for (const d of sol) {
    await ev(`__pad.buttons[${BTN[d]}].pressed = true`); await sleep(160);
    const tip = await ev(`DM.projLocal('Joystick_Stick', 0, 0.036, 0)`);
    await ev(`__pad.buttons[${BTN[d]}].pressed = false`); await sleep(250);
    const dx = tip[0] - base[0], dy = tip[1] - base[1];
    const seen = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'Droite' : 'Gauche') : (dy > 0 ? 'Bas' : 'Haut');
    dirRes[d] = { seen, dx: +dx.toFixed(1), dy: +dy.toFixed(1) };
    ok(seen === d, `joystick ${d} : le manche va ${seen} à l'écran (dx ${dx.toFixed(1)}, dy ${dy.toFixed(1)})`);
  }
  ok(await ev('DM.G().joyPos') === 4, '4 directions acceptées par la logique');
  await press(0); ok(await ev('DM.G().solved.joystick'), 'A = Clic → joystick désamorcé');
  report[tag].joystick = dirRes;
  // 4. manette : inclinaison au stick (la bille va du même côté à l'écran)
  await ev(`DM.setMode('inclinaison')`); await settle();
  const c0 = await ev(`DM.projLocal('Tilt_Marble')`); const tiltRes = {};
  for (const [d, ax] of [['Haut', [0, -1]], ['Bas', [0, 1]], ['Gauche', [-1, 0]], ['Droite', [1, 0]]]) {
    await ev(`__pad.axes[0] = ${ax[0]}; __pad.axes[1] = ${ax[1]}`); await sleep(700);
    const m = await ev(`DM.projLocal('Tilt_Marble')`);
    await ev(`__pad.axes[0] = 0; __pad.axes[1] = 0`); await sleep(700);
    const dx = m[0] - c0[0], dy = m[1] - c0[1];
    const seen = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'Droite' : 'Gauche') : (dy > 0 ? 'Bas' : 'Haut');
    tiltRes[d] = { seen, dx: +dx.toFixed(1), dy: +dy.toFixed(1) };
    ok(seen === d, `inclinaison stick ${d} : la bille va ${seen} à l'écran`);
  }
  report[tag].inclinaison = tiltRes;
  // 5. manette : curseur du clavier (Droite, Droite, Bas → touche « 6 »), A appuie, X efface
  await ev(`DM.setMode('clavier')`); await settle();
  await press(15); await press(15); await press(13);
  const g = await ev('DM.gamepadDebug()'); ok(g.cur.clavier === 6 && g.cursor, 'curseur clavier sur la touche 6 et visible : ' + JSON.stringify(g));
  if (SHOTS) await p.shot(`${SHOTS}/manette-clavier-curseur-${tag}.png`);
  await press(0); ok(await ev('DM.G().keyBuf') === '6', 'A appuie la touche 6');
  await press(2); ok(await ev('DM.G().keyBuf') === '', 'X efface (*)');
  // 6. clic direct sur une touche du BatchedMesh (vrai toucher)
  const [kx, ky] = await ev(`DM.projLocal('Panel_2', -0.0458, 0.009, -0.0385)`); // Key_0 = « 1 »
  await p.tap(kx, ky); await sleep(300); ok(await ev('DM.G().keyBuf') === '1', 'toucher Key_0 (BatchedMesh) → « 1 »');
  // 7. LB/RB, B, Y
  await press(5); ok(await ev('DM.view()') === 'joystick', 'RB → module suivant');
  await press(4); ok(await ev('DM.view()') === 'clavier', 'LB → module précédent');
  await press(1); ok(await ev('DM.view()') === 'overview', 'B → vue d’ensemble');
  const h0 = await ev('DM.G().hints'); await press(3); ok(await ev('DM.G().hints') === h0 + 1, 'Y → indice');
  // 8. appels de dessin par vue + plein écran
  const calls = {};
  for (const v of ['menu', 'overview', 'fils', 'clavier', 'joystick', 'rfid', 'inclinaison', 'ctrl', 'win', 'boom']) {
    await ev(`DM.setMode('${v}')`); await sleep(1600); const r = await ev('JSON.stringify(__c204.render)'); const o = JSON.parse(r); calls[v] = [o.calls, o.triangles]; ok(o.calls < 100, `${v} : ${o.calls} appels`);
  }
  report[tag].calls = calls;
  await ev(`DM.setMode('menu')`); await sleep(500);
  ok(await ev(`(() => { const b = document.getElementById('fsTitle'); return !!b && (b.offsetParent !== null || document.body.classList.contains('no-fs')); })()`), 'bouton plein écran (menu)');
  const mh = await ev(`Math.min(...[...document.querySelectorAll('#title button, #title a, #title input')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height))`);
  ok(mh >= 44, 'cibles du menu ≥ 44 px (min ' + mh + ')');
  ok(p.errors.length === 0, '0 erreur console : ' + JSON.stringify(p.errors).slice(0, 300));
  p.close();
}
if (process.env.ONLY !== 'L') await run(412, 915);
if (process.env.ONLY !== '1') await run(915, 412);
if (srv) srv.close();
console.log(JSON.stringify(report));
console.log(fails ? `ÉCHEC : ${fails} / ${checks}` : `OK : ${checks} vérifications (GLB, couvercle, manette, appels) en 412×915 et 915×412, 0 erreur console`);
process.exit(fails ? 1 : 0);
