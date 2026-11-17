// Manette (API Gamepad, disposition « standard ») : mêmes directions que le clavier et le pad tactile.
// A = valider / toucher · B = retour (vue d'ensemble) · X = secouer / effacer · Y = indice · LB/RB = module précédent/suivant
// Start = pause · croix ou stick gauche = directions. Dans les menus : directions = focus, A = activer, B = retour.
export function createGamepad(api) {
  const prev = []; let armed = true, lastDir = null, active = false;
  const DIR = { 12: 'Haut', 13: 'Bas', 14: 'Gauche', 15: 'Droite' };
  function stickDir(x, y) { const L = Math.max(Math.abs(x), Math.abs(y)); if (L < 0.3) { armed = true; return null; } if (L < 0.62 || !armed) return null; armed = false; return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'Droite' : 'Gauche') : (y > 0 ? 'Bas' : 'Haut'); }
  function poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { api.tilt(0, 0, false); return; }
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), edge = i => { const now = b(i), was = prev[i]; prev[i] = now; return now && !was; };
    const press = []; for (let i = 0; i < 17; i++) if (edge(i)) press.push(i);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    let dir = null; for (const i of [12, 13, 14, 15]) if (press.includes(i)) dir = DIR[i];
    const sd = stickDir(ax, ay); if (!dir && sd) dir = sd;
    // inclinaison : stick analogique continu (ou croix maintenue)
    let tx = Math.abs(ax) > 0.15 ? ax : 0, ty = Math.abs(ay) > 0.15 ? ay : 0;
    if (b(12)) ty = -1; if (b(13)) ty = 1; if (b(14)) tx = -1; if (b(15)) tx = 1;
    api.tilt(Math.max(-1, Math.min(1, tx)), Math.max(-1, Math.min(1, ty)), true);
    if (press.length || dir) { active = true; api.used(); }
    for (const i of press) if (!DIR[i]) api.button(i);
    if (dir) api.dir(dir);
    lastDir = dir;
  }
  return { poll, get active() { return active; }, set active(v) { active = v; } };
}
