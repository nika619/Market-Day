// node fill.js <scene> <dir> [workers]  -> re-renders any missing f_NNNN.png of a 30 fps sequence, until none are missing
const { execFile } = require('child_process'), fs = require('fs'), path = require('path');
const [scene, dir, workers = 4, width = 1920] = process.argv.slice(2);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out = path.join(__dirname, dir), url = 'file:///' + path.join(__dirname, process.env.PAGE || 'preview-market.html').split(path.sep).join('/') + '?s=' + scene;
const missing = () => Array.from({ length: 450 }, (_, i) => i).filter(i => !fs.existsSync(path.join(out, 'f_' + String(i).padStart(4, '0') + '.png')));
function round() { const todo = missing(); if (!todo.length) return console.log('complete'); console.log('missing', todo.length); let next = 0, done = 0;
  const run = w => { if (next >= todo.length) return; const i = todo[next++], t = Math.round(i * 1000 / 30);
    execFile(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=' + (width / 1920), '--window-size=1920,1080', '--virtual-time-budget=12000', '--allow-file-access-from-files', '--user-data-dir=' + path.join(process.env.TEMP, 'claude', 'edgeprof' + w), '--screenshot=' + path.join(out, 'f_' + String(i).padStart(4, '0') + '.png'), url + '#' + t], () => { if (++done === todo.length) round(); else run(w); }); };
  for (let w = 0; w < +workers; w++) run(w); }
round();
