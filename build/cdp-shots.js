// Fast frame renderer: one headless Edge page, art loaded once, then seek(t) + screenshot per frame over the DevTools protocol.
// node cdp-shots.js <scene> <outDir> <fps> <durationSec> [width=1920] [tabs=3] [format=png|jpeg]   (START=ms offsets the first frame)
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const [scene, outDir, fps = 30, dur = 23, width = 1920, tabs = 3, fmt = 'png'] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', PORT = 9300 + Math.floor(Math.random() * 500);
const out = path.join(__dirname, outDir); fs.mkdirSync(out, { recursive: true });
const url = 'file:///' + path.join(__dirname, process.env.PAGE || 'preview-delivery.html').split(path.sep).join('/') + '?s=' + scene + '#0';
const prof = path.join(os.tmpdir(), 'svgator-render', 'cdp' + PORT);
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + PORT, '--force-device-scale-factor=' + (width / 1920), '--window-size=1920,1080', '--allow-file-access-from-files', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function json(p) { for (let i = 0; i < 60; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}${p}`)).json(); } catch (e) { await sleep(250); } } throw new Error('no devtools'); }
function client(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map(), waiters = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method) waiters.filter(w => w.m === d.method).forEach(w => { w.r(d); waiters.splice(waiters.indexOf(w), 1); }); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = m => new Promise(r => waiters.push({ m, r }));
  return new Promise(r => { ws.onopen = () => r({ send, once, close: () => ws.close() }); });
}
(async () => {
  await json('/json/version');
  const frames = Array.from({ length: Math.round(dur * fps) }, (_, i) => i);
  const workers = [];
  for (let w = 0; w < +tabs; w++) {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
    workers.push((async () => {
      console.log('tab', w, t.url); const c = await client(t.webSocketDebuggerUrl); console.log('ws open', w); await c.send('Page.enable'); await c.send('Runtime.enable');
      await c.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: width / 1920, mobile: false });
      for (let k = 0; k < 120; k++) { const r = await c.send('Runtime.evaluate', { expression: "document.readyState==='complete' && typeof seek==='function' && [...document.images].every(i=>i.complete) && document.fonts.status==='loaded'", returnByValue: true }); if (r.result && r.result.result && r.result.result.value) break; await sleep(250); }
      // images inside SVG are not in document.images: wait until every <image> has decoded
      await c.send('Runtime.evaluate', { expression: "Promise.all([...document.querySelectorAll('image')].map(im=>new Promise(res=>{const i=new Image();i.onload=i.onerror=res;i.src=im.getAttribute('href');})))", awaitPromise: true });
      console.log('ready', w); await sleep(800);
      if (process.env.TRANSPARENT) {   // alpha PNGs (single layers for compositing): no page, body or canvas background
        await c.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
        await c.send('Runtime.evaluate', { expression: "document.documentElement.style.background=document.body.style.background='transparent';document.querySelector('svg').style.background='transparent'" });
      }
      while (frames.length) {
        const i = frames.shift(), tms = Math.round(+(process.env.START || 0) + i * 1000 / fps);
        await c.send('Runtime.evaluate', { expression: `seek(${tms})` });
        const s = await c.send('Page.captureScreenshot', { format: fmt, ...(fmt === 'jpeg' ? { quality: 94 } : {}), captureBeyondViewport: false });
        fs.writeFileSync(path.join(out, 'f_' + String(i).padStart(4, '0') + (fmt === 'jpeg' ? '.jpg' : '.png')), Buffer.from(s.result.data, 'base64')); if (i % 30 === 0) console.log('frame', i);
      }
      c.close();
    })());
  }
  await Promise.all(workers); proc.kill(); console.log('frames', Math.round(dur * fps), '->', out);
})().catch(e => { console.error(e); proc.kill(); process.exit(1); });
