// node shots.js <scene> <outDir> <t1,t2,...|fps:N> [workers] [width]  -> PNG per time via headless Edge
const { execFile } = require('child_process'), fs = require('fs'), path = require('path');
const [scene, outDir, spec, workers = 6, width = 1920] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const times = spec.startsWith('fps:') ? Array.from({ length: Math.round(15 * +spec.slice(4)) }, (_, i) => Math.round(i * 1000 / +spec.slice(4))) : spec.split(',').map(Number);
const out = path.join(__dirname, outDir); fs.mkdirSync(out, { recursive: true });
const url = 'file:///' + path.join(__dirname, process.env.PAGE || 'preview.html').split(path.sep).join('/') + '?s=' + scene;
let next = 0, done = 0;
function run(w) { if (next >= times.length) return; const i = next++, t = times[i];
  const f = path.join(out, (spec.startsWith('fps:') ? 'f_' + String(i).padStart(4, '0') : 't_' + String(t).padStart(5, '0')) + '.png');
  execFile(edge, ['--headless=new', '--disable-gpu', ...(process.env.TRANSPARENT ? ['--default-background-color=00000000'] : []), '--hide-scrollbars', '--force-device-scale-factor=' + (width / 1920), '--window-size=1920,1080', '--virtual-time-budget=8000', '--allow-file-access-from-files', '--user-data-dir=' + path.join(process.env.TEMP, 'svgator-render', 'edgeprof' + w), '--screenshot=' + f, url + '#' + t], () => { if (++done === times.length) console.log('shots', done); run(w); }); }
for (let w = 0; w < +workers; w++) run(w);
