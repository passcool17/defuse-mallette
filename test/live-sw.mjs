// Usage : node test/live-sw.mjs <url>  (playwright-core de /home/box/opt/perf3d, ou PW=<chemin du module>)
// Vérifie la version publiée avec le service worker actif : 0 erreur, modules ?v=, cache versionné, manuel.
const { chromium } = await import(process.env.PW || '/home/box/opt/perf3d/node_modules/playwright-core/index.mjs');
const url = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url); await p.waitForFunction(() => window.__c204?.ready, null, { timeout: 60000 });
await p.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready, null, { timeout: 30000 });
await p.reload(); await p.waitForFunction(() => window.__c204?.ready, null, { timeout: 60000 });
const info = await p.evaluate(async () => ({ version: window.__c204.version, ctrl: !!navigator.serviceWorker.controller, caches: await caches.keys(),
  cdn: [...document.querySelectorAll('script[src],link[href]')].map(e => e.src || e.href).filter(u => !u.startsWith(location.origin)) }));
const m = await ctx.newPage(); m.on('pageerror', e => errs.push('MANUEL ' + e.message));
await m.goto(new URL('manuel.html?code=48213-4', url).href); await m.waitForTimeout(1500);
const man = await m.evaluate(() => document.querySelector('h1')?.textContent + ' | ' + document.body.innerText.includes('Code valide'));
console.log(JSON.stringify({ ...info, man, errs }));
await b.close();
